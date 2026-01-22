/**
 * Pingmark Type-to-Link Extension
 *
 * Behavior: When the user types the trigger "!@", the extension grabs current
 * geolocation and replaces the token with a pingmark link that includes
 * latitude, longitude, and an ISO-8601 UTC timestamp.
 *
 * - In <input>/<textarea>: replaces "!@" with the canonical URL.
 * - In contentEditable: inserts an <a> element at the caret.
 * - Uses page-origin geolocation permission.
 */

import { toURL, format, type Pingmark } from '@pingmark/sdk';

// ===== Constants =====
const TRIGGER = '!@';
const DEBOUNCE_MS = 700;
const GEO_TIMEOUT_MS = 10000;
const COORD_PRECISION = 6;
const PM_GLOBAL = '__pm_type2link_installed__';
const PM_UPGRADED_ATTR = 'data-pm-upgraded';

// Regex to match pingmark.me URLs and extract lat/lon/timestamp
const PM_LINK_RE = /^https?:\/\/(?:map\.)?pingmark\.me\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)(?:\/([^/?#]+))?$/i;

// 1x1 transparent PNG fallback
const PM_LOGO_FALLBACK = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHmQJdV5XvkgAAAABJRU5ErkJggg==';

// Extend Window interface for our globals
declare global {
	interface Window {
		[PM_GLOBAL]?: boolean;
		__pm_link_observer__?: MutationObserver;
	}
}

// ===== Singleton Guard =====
if (window[PM_GLOBAL]) {
	throw new Error('Pingmark Type-to-Link already installed');
}
window[PM_GLOBAL] = true;

// ===== Runtime State =====
const inflight = new WeakMap<Element, boolean>();
const lastExpansion = new WeakMap<Element, { time: number }>();

// Safe WeakMap helpers (defensive against pages that tamper with globals)
function wmGet<K extends object, V>(wm: WeakMap<K, V>, key: K): V | undefined {
	try {
		return wm?.get?.(key);
	} catch {
		return undefined;
	}
}

function wmSet<K extends object, V>(wm: WeakMap<K, V>, key: K, val: V): void {
	try {
		wm?.set?.(key, val);
	} catch {
		// Ignore errors
	}
}

// ===== Utilities =====
const round = (n: number): string => n.toFixed(COORD_PRECISION);
const getISO = (): string => new Date().toISOString();

function getLogoURL(): string {
	try {
		if (typeof chrome !== 'undefined' && chrome?.runtime?.getURL) {
			const url = chrome.runtime.getURL('icons/icon48.png');
			if (url && !/^chrome-extension:\/\/invalid/i.test(url)) return url;
		}
	} catch {
		// Ignore errors
	}
	return PM_LOGO_FALLBACK;
}

// ===== URL Building (using SDK) =====
function buildPingmarkUrl(lat: number, lon: number, ts: string): string {
	const pingmark: Pingmark = {
		lat: parseFloat(round(lat)),
		lon: parseFloat(round(lon)),
		ts
	};
	// Use map.pingmark.me so the link displays the location on the map
	return toURL(pingmark, 'https://map.pingmark.me');
}

// Format pingmark text (using SDK)
function formatPingmark(lat: string, lon: string, ts?: string): string {
	const pingmark: Pingmark = {
		lat: parseFloat(lat),
		lon: parseFloat(lon),
		...(ts && { ts })
	};
	return format(pingmark);
}

// ===== Geolocation =====
interface Coords {
	latitude: number;
	longitude: number;
}

function getPosition(): Promise<Coords> {
	return new Promise((resolve, reject) => {
		if (!('geolocation' in navigator)) {
			reject(new Error('Geolocation unavailable'));
			return;
		}
		navigator.geolocation.getCurrentPosition(
			(pos) => resolve(pos.coords),
			(err) => reject(err),
			{ enableHighAccuracy: true, maximumAge: 0, timeout: GEO_TIMEOUT_MS }
		);
	});
}

// ===== DOM Helpers =====
function isEditable(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement | HTMLElement {
	if (!el) return false;
	const tag = el.tagName?.toUpperCase();
	if (!tag) return false;

	if (tag === 'TEXTAREA') return true;
	if (tag === 'INPUT') {
		const input = el as HTMLInputElement;
		const type = (input.type || 'text').toLowerCase();
		return ['text', 'search', 'url', 'email', 'tel', 'number', 'password'].includes(type);
	}
	if ((el as HTMLElement).isContentEditable) return true;
	return false;
}

function replaceInInput(el: HTMLInputElement | HTMLTextAreaElement, start: number, end: number, text: string): void {
	const val = el.value;
	const before = val.slice(0, start);
	const after = val.slice(end);
	const newVal = before + text + after;
	const newCaret = before.length + text.length;
	el.value = newVal;
	el.dispatchEvent(new InputEvent('input', { bubbles: true }));
	el.setSelectionRange(newCaret, newCaret);
}

interface TriggerInfo {
	start: number;
	end: number;
	caret: number;
}

function findTriggerInInput(el: HTMLInputElement | HTMLTextAreaElement): TriggerInfo | null {
	const caret = el.selectionStart ?? 0;
	const upto = el.value.slice(0, caret);
	const idx = upto.lastIndexOf(TRIGGER);
	if (idx >= 0) {
		return { start: idx, end: idx + TRIGGER.length, caret };
	}
	return null;
}

function insertLinkInContentEditable(url: string): boolean {
	const sel = window.getSelection();
	if (!sel || sel.rangeCount === 0) return false;
	const range = sel.getRangeAt(0);

	const node = range.startContainer;
	const offset = range.startOffset;

	if (node && node.nodeType === Node.TEXT_NODE) {
		const text = node.nodeValue || '';
		const before = text.slice(0, offset);
		const idx = before.lastIndexOf(TRIGGER);

		if (idx >= 0) {
			const after = text.slice(offset);
			const newBefore = before.slice(0, idx);
			const parent = node.parentNode;
			if (!parent) return false;

			const frag = document.createDocumentFragment();
			if (newBefore) frag.append(new Text(newBefore));

			const a = document.createElement('a');
			a.href = url;
			a.textContent = url;
			a.target = '_blank';
			a.rel = 'noopener noreferrer';
			frag.append(a);

			if (after) frag.append(new Text(after));

			parent.replaceChild(frag, node);

			const r = document.createRange();
			r.setStartAfter(a);
			r.collapse(true);
			sel.removeAllRanges();
			sel.addRange(r);
			return true;
		}
	}

	// Fallback: insert link at caret
	const a = document.createElement('a');
	a.href = url;
	a.textContent = url;
	a.target = '_blank';
	a.rel = 'noopener noreferrer';
	range.deleteContents();
	range.insertNode(a);
	range.setStartAfter(a);
	range.collapse(true);
	sel.removeAllRanges();
	sel.addRange(range);
	return true;
}

// ===== Trigger Handler =====
async function handleTrigger(el: Element): Promise<void> {
	if (!el) return;
	if (wmGet(inflight, el)) return;
	wmSet(inflight, el, true);

	try {
		const coords = await getPosition();
		const ts = getISO();
		const url = buildPingmarkUrl(coords.latitude, coords.longitude, ts);

		const tag = el.tagName?.toUpperCase();
		if (tag === 'INPUT' || tag === 'TEXTAREA') {
			const input = el as HTMLInputElement | HTMLTextAreaElement;
			const info = findTriggerInInput(input);
			if (info && info.end === info.caret) {
				replaceInInput(input, info.start, info.end, url);
			}
		} else if ((el as HTMLElement).isContentEditable) {
			insertLinkInContentEditable(url);
		}

		wmSet(lastExpansion, el, { time: Date.now() });
	} catch {
		// Silent fail - geolocation may be denied
	} finally {
		wmSet(inflight, el, false);
	}
}

function onKeyup(e: KeyboardEvent): void {
	const el = e.target as Element;
	if (!el || !isEditable(el)) return;

	const last = wmGet(lastExpansion, el);
	if (last && Date.now() - last.time < DEBOUNCE_MS) return;

	const tag = el.tagName?.toUpperCase();
	if (tag === 'INPUT' || tag === 'TEXTAREA') {
		const input = el as HTMLInputElement | HTMLTextAreaElement;
		const info = findTriggerInInput(input);
		if (info && info.end === info.caret) {
			handleTrigger(el);
		}
	} else if ((el as HTMLElement).isContentEditable) {
		const sel = window.getSelection();
		if (!sel || sel.rangeCount === 0) return;
		const range = sel.getRangeAt(0);
		const node = range.startContainer;
		const offset = range.startOffset;
		if (node && node.nodeType === Node.TEXT_NODE) {
			const text = node.nodeValue || '';
			if (text.slice(0, offset).endsWith(TRIGGER)) {
				handleTrigger(el);
			}
		}
	}
}

// ===== Link Preview Card =====
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
	.meta{display:flex;flex-direction:column;gap:2px;min-width:0}
	.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
	.latlon{font-weight:600;white-space:nowrap}
	.time{opacity:.7;white-space:nowrap}
	.hidden{display:none}
	.logo{width:18px;height:18px;display:inline-block;border-radius:4px;overflow:hidden}
	.logo img{display:block;width:100%;height:100%;object-fit:cover}
	.iconbar{display:inline-flex;gap:6px;align-items:center}
	.iconbtn{appearance:none;border:1px solid rgba(0,0,0,.08); background:#fff; border-radius:8px;
		width:28px;height:28px; display:inline-flex; align-items:center; justify-content:center; cursor:pointer}
	.iconbtn:hover{background:#f6f8ff}
	.iconbtn svg{width:16px;height:16px;display:block}
`;

const ICON_PATHS = {
	open: 'M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3zM5 5h6v2H7v10h10v-4h2v6H5V5z',
	copy: 'M16 1H4c-1.1 0-2 .9-2 2v12h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z',
	check: 'M3 12l5 5L21 4l-1.41-1.41L8 14.17 4.41 10.6 3 12z'
};

function createSvgIcon(pathD: string): SVGSVGElement {
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	svg.setAttribute('viewBox', '0 0 24 24');
	svg.setAttribute('aria-hidden', 'true');
	const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
	path.setAttribute('fill', 'currentColor');
	path.setAttribute('d', pathD);
	svg.appendChild(path);
	return svg;
}

function createElement<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	attrs: Record<string, string> = {},
	children: (Node | null)[] = []
): HTMLElementTagNameMap[K] {
	const el = document.createElement(tag);
	for (const [key, value] of Object.entries(attrs)) {
		if (key === 'className') el.className = value;
		else el.setAttribute(key, value);
	}
	for (const child of children) {
		if (child) el.appendChild(child);
	}
	return el;
}

interface ParsedLink {
	lat: string;
	lon: string;
	ts: string;
	when: string;
}

function parsePingmarkUrl(href: string): ParsedLink | null {
	const m = href.match(PM_LINK_RE);
	if (!m) return null;

	const [, lat, lon, rawTs] = m;
	const lat6 = parseFloat(lat).toFixed(COORD_PRECISION);
	const lon6 = parseFloat(lon).toFixed(COORD_PRECISION);
	const ts = rawTs || '';
	let when = '';

	if (ts) {
		let d: Date;
		if (/^\d{10}$/.test(ts)) d = new Date(Number(ts) * 1000);
		else if (/^\d{13}$/.test(ts)) d = new Date(Number(ts));
		else d = new Date(ts);

		if (!isNaN(d.getTime())) {
			const abs = d.toLocaleString();
			const diff = (Date.now() - d.getTime()) / 1000;

			if (typeof Intl !== 'undefined' && Intl.RelativeTimeFormat) {
				const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
				const units: [Intl.RelativeTimeFormatUnit, number][] = [
					['year', 31536000],
					['month', 2592000],
					['day', 86400],
					['hour', 3600],
					['minute', 60],
					['second', 1]
				];

				for (const [unit, sec] of units) {
					if (Math.abs(diff) >= sec || unit === 'second') {
						const rel = rtf.format(-Math.round(diff / sec), unit);
						when = `${abs} (${rel})`;
						break;
					}
				}
			} else {
				when = abs;
			}
		}
	}

	return { lat: lat6, lon: lon6, ts, when };
}

function renderPingmarkCard(href: string): HTMLElement {
	const parsed = parsePingmarkUrl(href);

	if (!parsed) {
		const span = document.createElement('span');
		span.textContent = href || '';
		return span;
	}

	const { lat, lon, ts, when } = parsed;

	try {
		const host = document.createElement('span');
		host.className = 'pingmark-card-host';
		host.style.display = 'inline-block';
		host.style.verticalAlign = 'middle';
		const shadow = host.attachShadow({ mode: 'open' });

		// Add styles
		if ('adoptedStyleSheets' in shadow && 'CSSStyleSheet' in window) {
			const sheet = new CSSStyleSheet();
			sheet.replaceSync(PM_STYLES);
			shadow.adoptedStyleSheets = [sheet];
		} else {
			const style = document.createElement('style');
			style.textContent = PM_STYLES;
			shadow.appendChild(style);
		}

		// Build DOM programmatically
		const logoImg = createElement('img', { alt: 'Pingmark', src: getLogoURL() });
		logoImg.addEventListener('error', () => { logoImg.src = PM_LOGO_FALLBACK; }, { once: true });
		const logoSpan = createElement('span', { className: 'logo', part: 'logo' }, [logoImg]);

		const latlonEl = createElement('span', { className: 'latlon', part: 'latlon' });
		latlonEl.textContent = `${lat}, ${lon}`;

		const timeEl = createElement('span', { className: 'time', part: 'time' });
		timeEl.textContent = when ? `• ${when}` : '';

		const rowSpan = createElement('span', { className: 'row' }, [latlonEl, timeEl]);

		const urlEl = createElement('a', {
			className: 'url hidden',
			part: 'url',
			target: '_blank',
			rel: 'noopener noreferrer',
			href
		});
		urlEl.textContent = href;

		const metaSpan = createElement('span', { className: 'meta', part: 'meta' }, [rowSpan, urlEl]);

		// Icon buttons
		const btnOpen = createElement('button', { className: 'iconbtn open', type: 'button', title: 'Open' }, [createSvgIcon(ICON_PATHS.open)]);
		const btnCopyUrl = createElement('button', { className: 'iconbtn copy-url', type: 'button', title: 'Copy URL' }, [createSvgIcon(ICON_PATHS.copy)]);
		const btnCopyPm = createElement('button', { className: 'iconbtn copy-pm', type: 'button', title: 'Copy Pingmark' }, [createSvgIcon(ICON_PATHS.check)]);

		const actionsSpan = createElement('span', { className: 'actions iconbar', part: 'actions' }, [btnOpen, btnCopyUrl, btnCopyPm]);

		const wrapper = createElement('span', {
			className: 'wrapper',
			part: 'wrapper',
			role: 'group',
			'aria-label': 'Pingmark preview'
		}, [logoSpan, metaSpan, actionsSpan]);

		shadow.appendChild(wrapper);

		// Event listeners
		btnOpen.addEventListener('click', () => window.open(href, '_blank', 'noopener'));
		btnCopyUrl.addEventListener('click', () => {
			navigator.clipboard?.writeText(href).catch(() => {});
		});
		btnCopyPm.addEventListener('click', () => {
			const pm = formatPingmark(lat, lon, ts || undefined);
			navigator.clipboard?.writeText(pm).catch(() => {});
		});

		wrapper.addEventListener('auxclick', (e: MouseEvent) => {
			if (e.button === 1) window.open(href, '_blank', 'noopener');
		});

		return host;
	} catch {
		// Fallback without Shadow DOM
		const wrap = document.createElement('span');
		wrap.style.cssText = `
			display:inline-flex;align-items:center;gap:8px;
			font:500 13px/1.3 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
			background:linear-gradient(135deg,#f1f5ff,#eef9ff);
			border:1px solid rgba(0,0,0,.06);border-radius:12px;padding:8px 10px;
		`;

		const logo = document.createElement('img');
		logo.alt = 'Pingmark';
		logo.src = getLogoURL();
		logo.addEventListener('error', () => { logo.src = PM_LOGO_FALLBACK; }, { once: true });
		logo.style.cssText = 'width:18px;height:18px;border-radius:4px;display:block';
		wrap.appendChild(logo);

		const meta = document.createElement('span');
		meta.textContent = `${lat}, ${lon}${when ? ` • ${when}` : ''}`;
		wrap.appendChild(meta);

		const open = document.createElement('button');
		open.textContent = 'Open';
		open.style.cssText = 'margin-left:6px';
		open.addEventListener('click', () => window.open(href, '_blank', 'noopener'));
		wrap.appendChild(open);

		return wrap;
	}
}

// ===== Link Upgrade =====
function upgradePingmarkLinks(root: Element | Document): void {
	const container = root instanceof Element ? root : document;
	const anchors = container.querySelectorAll('a[href*="pingmark.me/"]');

	anchors.forEach((a) => {
		if (a.hasAttribute(PM_UPGRADED_ATTR)) return;

		const href = a.getAttribute('href') || '';
		if (!PM_LINK_RE.test(href)) return;

		const cardHost = renderPingmarkCard(href);
		a.insertAdjacentElement('afterend', cardHost);
		a.setAttribute(PM_UPGRADED_ATTR, '1');

		// Visually hide the original anchor
		if (!a.firstElementChild) {
			const anchor = a as HTMLElement;
			anchor.style.position = 'absolute';
			anchor.style.clip = 'rect(0 0 0 0)';
			anchor.style.clipPath = 'inset(50%)';
			anchor.style.width = '1px';
			anchor.style.height = '1px';
			anchor.style.margin = '0';
			anchor.style.overflow = 'hidden';
			anchor.style.whiteSpace = 'nowrap';
		}
	});
}

// ===== Initialization =====
function init(): void {
	if (!document.documentElement) return;

	document.addEventListener('keyup', onKeyup, true);

	try {
		if (document.body) upgradePingmarkLinks(document);
	} catch {
		// Ignore initial upgrade errors
	}

	if (!window.__pm_link_observer__) {
		// Throttled MutationObserver using requestAnimationFrame
		const pendingNodes = new Set<Element>();
		let rafScheduled = false;

		const processPendingNodes = (): void => {
			rafScheduled = false;
			if (pendingNodes.size === 0) return;

			const nodesToProcess = Array.from(pendingNodes);
			pendingNodes.clear();

			for (const node of nodesToProcess) {
				try {
					if (!node.isConnected) continue;
					upgradePingmarkLinks(node);
				} catch {
					// Ignore upgrade errors
				}
			}
		};

		const scheduleProcess = (): void => {
			if (!rafScheduled) {
				rafScheduled = true;
				requestAnimationFrame(processPendingNodes);
			}
		};

		window.__pm_link_observer__ = new MutationObserver((mutations) => {
			for (const m of mutations) {
				for (const node of m.addedNodes) {
					if (node && node.nodeType === Node.ELEMENT_NODE) {
						const el = node as Element;
						if (el.classList?.contains('pingmark-card-host')) continue;
						pendingNodes.add(el);
					}
				}
			}
			if (pendingNodes.size > 0) {
				scheduleProcess();
			}
		});

		try {
			window.__pm_link_observer__.observe(
				document.body || document.documentElement,
				{ childList: true, subtree: true }
			);
		} catch {
			// Ignore observer errors
		}
	}
}

// Start
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', init);
} else {
	init();
}
