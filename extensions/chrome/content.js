/**
 * Pingmark Type-to-Link (MVP)
 * Behavior: When the user types the trigger "!@", the extension grabs current
 * geolocation and replaces the token with a pingmark link that includes
 * latitude, longitude, and an ISO-8601 UTC timestamp.
 *
 * - In <input>/<textarea>: replaces "!@" with the canonical URL.
 * - In contentEditable: inserts an <a> element at the caret.
 * - Uses page-origin geolocation permission.
 */

(function () {
	"use strict";

	const TRIGGER = "!@";
	const ISO = () => new Date().toISOString(); // UTC ISO-8601
	const round6 = (n) => Number.parseFloat(n).toFixed(6);

	// Singleton guard (avoid double-install on SPA reloads, iframes, etc.)
	const PM_GLOBAL = "__pm_type2link_installed__";
	if (window[PM_GLOBAL]) {
		throw new Error("Pingmark Type-to-Link already installed");
	}
	window[PM_GLOBAL] = true;

	// Runtime state
	const inflight = new WeakMap();      // element -> boolean (geo request running)
	const lastExpansion = new WeakMap(); // element -> { time:number }

	// Safe WeakMap helpers (defensive against pages that tamper with globals)
	const wmGet = (wm, key) => (wm && typeof wm.get === "function") ? wm.get(key) : undefined;
	const wmSet = (wm, key, val) => (wm && typeof wm.set === "function") ? wm.set(key, val) : undefined;

	// ===== Pingmark Link Preview (Web Component) =====
	const PM_LINK_RE = /^https?:\/\/pingmark\.me\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)(?:\/([^/?#]+))?$/i;
	const PM_UPGRADED_ATTR = "data-pm-upgraded";
	const PM_CARD_TAG = "pingmark-card";

	const LOGO_URL = (typeof chrome !== "undefined" && chrome.runtime?.getURL)
		? chrome.runtime.getURL("icons/icon48.png")
		: "icons/icon48.png"; // fallback

	const ICON_OPEN = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3zM5 5h6v2H7v10h10v-4h2v6H5V5z" fill="currentColor"/></svg>`;
	const ICON_COPY = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 1H4c-1.1 0-2 .9-2 2v12h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" fill="currentColor"/></svg>`;
	const ICON_PM   = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12l5 5L21 4l-1.41-1.41L8 14.17 4.41 10.6 3 12z" fill="currentColor"/></svg>`;


	const PM_STYLES = `
		:host{all:initial; display:inline-block; vertical-align:middle}
		*,*::before,*::after{box-sizing:border-box}
		.wrapper{font:500 13px/1.3 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
		color:#0b1220; display:inline-flex; align-items:center; gap:8px;
		background:linear-gradient(135deg, #f1f5ff, #eef9ff);
		border:1px solid rgba(0,0,0,.06); border-radius:12px; padding:8px 10px;
		box-shadow:0 1px 2px rgba(0,0,0,.06), inset 0 0 0 1px rgba(255,255,255,.6);
		transition:box-shadow .2s ease, transform .2s ease}
		.wrapper:hover{box-shadow:0 6px 18px rgba(30,80,160,.15); transform:translateY(-1px)}
		.wrapper:focus{outline:none; box-shadow:0 0 0 2px #007aff}
		.pin{width:18px;height:18px;display:inline-block}
		.pin svg{display:block;width:100%;height:100%}
		.meta{display:flex;flex-direction:column;gap:2px;min-width:0}
		.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
		.latlon{font-weight:600;white-space:nowrap}
		.time{opacity:.7;white-space:nowrap}
		.actions{display:flex;gap:6px;flex-wrap:wrap;margin-left:auto}
		.btn{appearance:none;border:1px solid rgba(0,0,0,.08); background:#fff; border-radius:8px;
		padding:4px 8px; font:600 12px/1 system-ui; cursor:pointer}
		.btn:hover{background:#f6f8ff}
		.hidden{display:none}
		.logo{width:18px;height:18px;display:inline-block;border-radius:4px;overflow:hidden}
		.logo img{display:block;width:100%;height:100%;object-fit:cover}
		.iconbar{display:inline-flex;gap:6px;align-items:center}
		.iconbtn{appearance:none;border:1px solid rgba(0,0,0,.08); background:#fff; border-radius:8px;
		width:28px;height:28px; display:inline-flex; align-items:center; justify-content:center; cursor:pointer}
		.iconbtn:hover{background:#f6f8ff}
		.iconbtn svg{width:16px;height:16px;display:block}
`;

	// Simple icon
	const PIN_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor"
d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5
  2.5 2.5 0 0 1 0 5z"/></svg>`;

	function buildUrl(lat, lon, ts) {
		const L = round6(lat);
		const G = round6(lon);
		return `https://pingmark.me/${L}/${G}/${ts}`;
	}

	function getPosition() {
		return new Promise((resolve, reject) => {
			if (!("geolocation" in navigator)) {
				reject(new Error("Geolocation unavailable"));
				return;
			}
			navigator.geolocation.getCurrentPosition(
				(pos) => resolve(pos.coords),
				(err) => reject(err),
				{enableHighAccuracy: true, maximumAge: 10000, timeout: 10000}
			);
		});
	}

	function isEditable(el) {
		if (!el) return false;
		const tag = el.tagName;
		if (!tag) return false;
		const t = tag.toUpperCase();
		if (t === "TEXTAREA") return true;
		if (t === "INPUT") {
			const type = (el.type || "text").toLowerCase();
			return ["text", "search", "url", "email", "tel", "number", "password"].includes(type);
		}
		if (el.isContentEditable) return true;
		return false;
	}

	function replaceInInput(el, start, end, text) {
		const val = el.value;
		const before = val.slice(0, start);
		const after = val.slice(end);
		const newVal = before + text + after;
		const newCaret = before.length + text.length;
		el.value = newVal;
		// Trigger native events so frameworks notice the change
		el.dispatchEvent(new InputEvent("input", {bubbles: true}));
		el.setSelectionRange(newCaret, newCaret);
	}

	function findTriggerInInput(el) {
		const caret = el.selectionStart;
		const upto = el.value.slice(0, caret);
		const idx = upto.lastIndexOf(TRIGGER);
		if (idx >= 0) {
			return {start: idx, end: idx + TRIGGER.length, caret};
		}
		return null;
	}

	function insertLinkInContentEditable(url) {
		const sel = window.getSelection();
		if (!sel || sel.rangeCount === 0) return;
		const range = sel.getRangeAt(0);

		// Replace the "!@" text immediately before caret if present
		let node = range.startContainer;
		let offset = range.startOffset;
		if (node && node.nodeType === Node.TEXT_NODE) {
			const text = node.nodeValue || "";
			const before = text.slice(0, offset);
			const idx = before.lastIndexOf(TRIGGER);
			if (idx >= 0) {
				// Replace the trigger portion with a link
				const after = text.slice(offset);
				const newBefore = before.slice(0, idx);
				const parent = node.parentNode;

				const frag = document.createDocumentFragment();
				if (newBefore) frag.append(new Text(newBefore));
				const a = document.createElement("a");
				a.href = url;
				a.textContent = url;
				a.target = "_blank";
				a.rel = "noopener noreferrer";
				frag.append(a);
				if (after) frag.append(new Text(after));

				parent.replaceChild(frag, node);

				// Place caret after the link
				const r = document.createRange();
				r.setStartAfter(a);
				r.collapse(true);
				sel.removeAllRanges();
				sel.addRange(r);
				return true;
			}
		}

		// Fallback: just insert a link at caret
		const a = document.createElement("a");
		a.href = url;
		a.textContent = url;
		a.target = "_blank";
		a.rel = "noopener noreferrer";
		range.deleteContents();
		range.insertNode(a);
		range.setStartAfter(a);
		range.collapse(true);
		sel.removeAllRanges();
		sel.addRange(range);
		return true;
	}

	async function handleTrigger(el) {
		if (!el) return;
		if (wmGet(inflight, el)) return; // prevent parallel requests
		wmSet(inflight, el, true);
		try {
			const coords = await getPosition();
			const ts = ISO();
			const url = buildUrl(coords.latitude, coords.longitude, ts);

			if (el.tagName && (el.tagName.toUpperCase() === "INPUT" || el.tagName.toUpperCase() === "TEXTAREA")) {
				const info = findTriggerInInput(el);
				if (info && info.end === info.caret) {
					replaceInInput(el, info.start, info.end, url);
				}
			} else if (el.isContentEditable) {
				insertLinkInContentEditable(url);
			}

			// mark last successful expansion (debounce)
			wmSet(lastExpansion, el, {time: Date.now()});
		} catch (e) {
			// silent fail
		} finally {
			wmSet(inflight, el, false);
		}
	}

	function onKeyup(e) {
		const el = e.target;
		if (!el || !isEditable(el)) return;

		// soft debounce to avoid rapid retriggers
		const last = wmGet(lastExpansion, el);
		if (last && (Date.now() - last.time) < 700) return;

		if (el.tagName && (el.tagName.toUpperCase() === "INPUT" || el.tagName.toUpperCase() === "TEXTAREA")) {
			const info = findTriggerInInput(el);
			if (info && info.end === info.caret) {
				handleTrigger(el);
			}
		} else if (el.isContentEditable) {
			const sel = window.getSelection();
			if (!sel || sel.rangeCount === 0) return;
			const range = sel.getRangeAt(0);
			const node = range.startContainer;
			const offset = range.startOffset;
			if (node && node.nodeType === Node.TEXT_NODE) {
				const text = node.nodeValue || "";
				if (text.slice(0, offset).endsWith(TRIGGER)) {
					handleTrigger(el);
				}
			}
		}
	}
	const PM_LOGO_FALLBACK = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHmQJdV5XvkgAAAABJRU5ErkJggg=="; // 1x1 px

	function getLogoURL(){
		try{
			if (typeof chrome !== "undefined" && chrome?.runtime?.getURL){
				const u = chrome.runtime.getURL("icons/icon48.png");
				// Guard against invalid pseudo-URL some contexts return
				if (u && !/^chrome-extension:\/\/invalid/i.test(u)) return u;
			}
		}catch(_e){}
		// Fallback to data URL (tiny PNG); replace with your own data URL if desired
		return PM_LOGO_FALLBACK;
	}

	function renderPingmarkCard(anchor, href) {
		// 0) Валидации – нищо да не хвърля
		if (!href || !PM_LINK_RE.test(href)) {
			const span = document.createElement("span");
			span.textContent = href || "";
			return span;
		}

		// 1) Парсни href безопасно
		let lat6 = "", lon6 = "", ts = "", when = "";
		try {
			const m = href.match(PM_LINK_RE);
			if (m) {
				const [, lat, lon, rawTs] = m;
				lat6 = Number.parseFloat(lat).toFixed(6);
				lon6 = Number.parseFloat(lon).toFixed(6);
				ts = rawTs || "";
				if (ts) {
					let d;
					if (/^\d{10}$/.test(ts)) d = new Date(Number(ts) * 1000);
					else if (/^\d{13}$/.test(ts)) d = new Date(Number(ts));
					else d = new Date(ts);
					if (!isNaN(d.getTime())) {
						const abs = d.toLocaleString();
						const diff = (Date.now() - d.getTime()) / 1000;
						const rtf = (typeof Intl !== "undefined" && Intl.RelativeTimeFormat)
							? new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }) : null;
						const units = [
							["year",   31536000],
							["month",   2592000],
							["day",       86400],
							["hour",       3600],
							["minute",       60],
							["second",        1]
						];
						let rel = "";
						if (rtf) {
							for (const [unit, sec] of units) {
								if (Math.abs(diff) >= sec || unit === "second") {
									rel = rtf.format(-Math.round(diff / sec), unit);
									break;
								}
							}
						}
						when = rel ? `${abs} (${rel})` : abs;
					}
				}
			}
		} catch (_e) {
			// ignore parse errors
		}

		// 2) Построй host и опитай Shadow DOM; ако не стане — fallback без shadow
		let host, shadow;
		try {
			host = document.createElement("span");
			host.className = "pingmark-card-host";
			host.style.display = "inline-block";
			host.style.verticalAlign = "middle";
			shadow = host.attachShadow({ mode: "open" });

			// стилове
			if ("adoptedStyleSheets" in shadow && "CSSStyleSheet" in window) {
				const sheet = new CSSStyleSheet();
				sheet.replaceSync(PM_STYLES);
				shadow.adoptedStyleSheets = [sheet];
			} else {
				const style = document.createElement("style");
				style.textContent = PM_STYLES;
				shadow.appendChild(style);
			}

			const LOGO_URL = getLogoURL();

			const tpl = document.createElement("template");
			tpl.innerHTML = `
      <span class="wrapper" part="wrapper" role="group" aria-label="Pingmark preview">
        <span class="logo" part="logo"><img alt="Pingmark" src="${LOGO_URL}"></span>
        <span class="meta" part="meta">
          <span class="row">
            <span class="latlon" part="latlon"></span>
            <span class="time" part="time"></span>
          </span>
          <a class="url hidden" part="url" target="_blank" rel="noopener noreferrer"></a>
        </span>
        <span class="actions iconbar" part="actions">
          <button class="iconbtn open"      type="button" title="Open">
            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3zM5 5h6v2H7v10h10v-4h2v6H5V5z"/></svg>
          </button>
          <button class="iconbtn copy-url"  type="button" title="Copy URL">
            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v12h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
          </button>
          <button class="iconbtn copy-pm"   type="button" title="Copy Pingmark">
            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 12l5 5L21 4l-1.41-1.41L8 14.17 4.41 10.6 3 12z"/></svg>
          </button>
        </span>
      </span>
    `;
			shadow.appendChild(tpl.content.cloneNode(true));
			const logoEl = shadow.querySelector(".logo img");
			if (logoEl){
				// If somehow loading the chrome-extension URL fails, use fallback
				logoEl.addEventListener("error", () => { logoEl.src = PM_LOGO_FALLBACK; }, { once:true });
			}
			// Populate + events
			const latlonEl = shadow.querySelector(".latlon");
			const timeEl   = shadow.querySelector(".time");
			const urlEl    = shadow.querySelector(".url");
			const btnOpen  = shadow.querySelector(".open");
			const btnCopyU = shadow.querySelector(".copy-url");
			const btnCopyP = shadow.querySelector(".copy-pm");

			if (latlonEl) latlonEl.textContent = (lat6 && lon6) ? `${lat6}, ${lon6}` : "";
			if (timeEl)   timeEl.textContent   = when ? `• ${when}` : "";
			if (urlEl)    { urlEl.href = href; urlEl.textContent = href; }

			btnOpen?.addEventListener("click", () => window.open(href, "_blank", "noopener"));
			btnCopyU?.addEventListener("click", () => navigator.clipboard?.writeText(href));
			btnCopyP?.addEventListener("click", () => {
				const pm = ts ? `!@ ${lat6},${lon6}; ${ts}` : `!@ ${lat6},${lon6}`;
				navigator.clipboard?.writeText(pm);
			});

			shadow.querySelector(".wrapper")?.addEventListener("auxclick", (e) => {
				if (e.button === 1) window.open(href, "_blank", "noopener");
			});

			return host;

		} catch (_err) {
			// 3) Fallback без Shadow DOM, пак красив и компактен
			const wrap = document.createElement("span");
			wrap.style.cssText = `
      display:inline-flex;align-items:center;gap:8px;
      font:500 13px/1.3 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
      background:linear-gradient(135deg,#f1f5ff,#eef9ff);
      border:1px solid rgba(0,0,0,.06);border-radius:12px;padding:8px 10px;
    `;

			const logo = document.createElement("img");
			logo.alt = "Pingmark";
			logo.src = getLogoURL();
			logo.addEventListener("error", () => { logo.src = PM_LOGO_FALLBACK; }, { once:true });
			logo.style.cssText = "width:18px;height:18px;border-radius:4px;display:block";
			wrap.appendChild(logo);

			const meta = document.createElement("span");
			meta.textContent = (lat6 && lon6) ? `${lat6}, ${lon6}` + (when ? ` • ${when}` : "") : href;
			wrap.appendChild(meta);

			const open = document.createElement("button");
			open.textContent = "Open";
			open.style.cssText = "margin-left:6px";
			open.addEventListener("click", () => window.open(href, "_blank", "noopener"));
			wrap.appendChild(open);

			return wrap;
		}
	}

	// Define the web component if supported
	if (typeof window.customElements !== "undefined" && window.customElements) {
		if (!window.customElements.get(PM_CARD_TAG)) {
			try {
				window.customElements.define(PM_CARD_TAG, PingmarkCard);
			} catch {
			}
		}
	}

	function upgradePingmarkLinks(root) {
		const anchors = (root instanceof Element ? root : document)
			.querySelectorAll('a[href*="pingmark.me/"]');

		anchors.forEach(a => {
			if (a.hasAttribute(PM_UPGRADED_ATTR)) return;

			const href = a.getAttribute("href") || "";
			if (!PM_LINK_RE.test(href)) return;

			// създай Shadow DOM карта и я вмъкни след линка
			const cardHost = renderPingmarkCard(a, href);
			a.insertAdjacentElement("afterend", cardHost);
			a.setAttribute(PM_UPGRADED_ATTR, "1");

			// (по желание) визуално скриване на текста на <a> — изчакай да потвърдиш, че всичко е ОК
			// ако го искаш скрит, махни коментарите по-долу
			if (!a.firstElementChild) {
			  a.style.position = "absolute";
			  a.style.clip = "rect(0 0 0 0)";
			  a.style.clipPath = "inset(50%)";
			  a.style.width = "1px";
			  a.style.height = "1px";
			  a.style.margin = "0";
			  a.style.overflow = "hidden";
			  a.style.whiteSpace = "nowrap";
			}
		});
	}

	function init() {
		if (!document.documentElement) return;

		document.addEventListener("keyup", onKeyup, true);

		try { if (document.body) upgradePingmarkLinks(document); } catch {}

		if (!window.__pm_link_observer__) {
			window.__pm_link_observer__ = new MutationObserver((mutations) => {
				for (const m of mutations) {
					for (const node of m.addedNodes) {
						if (node && node.nodeType === Node.ELEMENT_NODE) {
							try { upgradePingmarkLinks(node); } catch {}
						}
					}
				}
			});
			try {
				window.__pm_link_observer__.observe(
					document.body || document.documentElement,
					{ childList: true, subtree: true }
				);
			} catch {}
		}
	}


	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();