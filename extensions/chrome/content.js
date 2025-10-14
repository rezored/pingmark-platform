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
	const ATTR = "data-pingmark-type2link";
	const ISO = () => new Date().toISOString(); // UTC ISO-8601
	const round6 = (n) => Number.parseFloat(n).toFixed(6);
	const PM_GLOBAL = "__pm_type2link_installed__";
	if (window[PM_GLOBAL]) {
		// вече е закачен; не инсталирай втори път
		throw new Error("Pingmark Type-to-Link already installed");
	}
	window[PM_GLOBAL] = true;

	const inflight = new WeakMap();       // element -> boolean (тече геолоц. заявка)
	const lastExpansion = new WeakMap();  // element -> { time:number }

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
			// Make sure it's not part of a larger token (require boundary or whitespace before/after)
			// For MVP, accept any last occurrence before caret.
			return {start: idx, end: idx + TRIGGER.length, caret};
		}
		return null;
	}

	function insertLinkInContentEditable(url) {
		const sel = window.getSelection();
		if (!sel || sel.rangeCount === 0) return;
		const range = sel.getRangeAt(0);

		// Replace the "!@" text immediately before caret if present
		// Strategy: collapse to caret, look back in same text node
		let node = range.startContainer;
		let offset = range.startOffset;
		if (node.nodeType === Node.TEXT_NODE) {
			const text = node.nodeValue || "";
			const before = text.slice(0, offset);
			const idx = before.lastIndexOf(TRIGGER);
			if (idx >= 0) {
				// Replace the trigger portion with a link
				const after = text.slice(offset);
				const newBefore = before.slice(0, idx);
				const parent = node.parentNode;

				// Build: newBefore + <a url> + after
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

	async function handleTrigger(el){
		if (inflight.get(el)) return; // предотврати паралелни заявки
		inflight.set(el, true);
		try {
			const coords = await getPosition();
			const ts = ISO();
			const url = buildUrl(coords.latitude, coords.longitude, ts);

			if (el.tagName && (el.tagName.toUpperCase() === "INPUT" || el.tagName.toUpperCase() === "TEXTAREA")){
				const info = findTriggerInInput(el);
				if (info && info.end === info.caret){
					replaceInInput(el, info.start, info.end, url);
				}
			} else if (el.isContentEditable){
				insertLinkInContentEditable(url);
			}

			// отбележи последна успешна експанзия (за дебоунс)
			lastExpansion.set(el, { time: Date.now() });

		} catch (e) {
			// тихо пропускаме при грешка
		} finally {
			inflight.set(el, false);
		}
	}

	function onKeyup(e){
		const el = e.target;
		if (!isEditable(el)) return;

		// лек дебоунс: ако току-що сме разширили, не тригвай повторно
		const last = lastExpansion.get(el);
		if (last && (Date.now() - last.time) < 700) return;

		if (el.tagName && (el.tagName.toUpperCase() === "INPUT" || el.tagName.toUpperCase() === "TEXTAREA")){
			const info = findTriggerInInput(el);
			if (info && info.end === info.caret){
				handleTrigger(el);
			}
		} else if (el.isContentEditable){
			const sel = window.getSelection();
			if (!sel || sel.rangeCount === 0) return;
			const range = sel.getRangeAt(0);
			const node = range.startContainer;
			const offset = range.startOffset;
			if (node && node.nodeType === Node.TEXT_NODE){
				const text = node.nodeValue || "";
				if (text.slice(0, offset).endsWith(TRIGGER)){
					handleTrigger(el);
				}
			}
		}
	}


	function attach(root) {
		const handler = onKeyup;
		root.addEventListener("keyup", handler, true);
		root.setAttribute(ATTR, "1");
	}

	function init(){
		// Един-единствен capture listener на документно ниво
		document.addEventListener("keyup", onKeyup, true);
	}

	if (document.readyState === "loading"){
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();