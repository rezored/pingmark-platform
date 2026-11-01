/**
 * Pingmark Type-to-Link Extension
 *
 * Behavior: when the user types the trigger "!@" as a standalone token, a small
 * prompt asks whether to share the current location. Only after an explicit
 * confirmation (click or Tab) is the location read and the token replaced with
 * a pingmark link (latitude, longitude, ISO-8601 UTC timestamp).
 *
 * Privacy rules enforced here:
 * - Never active in password or other non-free-text fields.
 * - The trigger must stand alone (start of text or after whitespace/opening
 *   punctuation) and stays pending only while nothing is typed after it, so
 *   strings like "Pass!@#" or "hey!@john" never fire.
 * - Location is read by the extension (offscreen document), not the page, so
 *   the website never receives geolocation permission.
 */

import { toURL, format, type Pingmark } from '@pingmark/sdk';
import { MSG_GET_LOCATION, type LocationResponse } from './messages';

// ===== Constants =====
const TRIGGER = '!@';
// "!@" at the caret, preceded by start of text, whitespace or opening punctuation.
const TRIGGER_AT_CARET_RE = /(?:^|[\s([{"'«„“‘])!@$/u;
const COORD_PRECISION = 6;
const PM_GLOBAL = '__pm_type2link_installed__';
const PM_UPGRADED_ATTR = 'data-pm-upgraded';
const ERROR_DISPLAY_MS = 2500;

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

// ===== Geolocation (via extension, never via the page) =====
async function requestLocation(): Promise<{ latitude: number; longitude: number }> {
	const res = await chrome.runtime.sendMessage<LocationResponse>({ type: MSG_GET_LOCATION });
	if (!res || !res.ok) throw new Error(res?.error || 'Location unavailable');
	return { latitude: res.latitude, longitude: res.longitude };
}

// ===== Field eligibility =====
type TextField = HTMLInputElement | HTMLTextAreaElement;

// Only free-text fields. Password, email, number, url, tel etc. are excluded:
// a location must never end up in a credential or a structured value.
const ALLOWED_INPUT_TYPES = new Set(['text', 'search']);

function isTextField(el: Element): el is TextField {
	const tag = el.tagName?.toUpperCase();
	if (tag === 'TEXTAREA') return true;
	if (tag === 'INPUT') {
		const type = ((el as HTMLInputElement).type || 'text').toLowerCase();
		return ALLOWED_INPUT_TYPES.has(type);
	}
	return false;
}

function isSensitiveField(el: Element): boolean {
	const ac = (el.getAttribute('autocomplete') || '').toLowerCase();
	return /password|one-time-code|cc-|webauthn/.test(ac);
}

function isEligible(el: Element | null): el is TextField | HTMLElement {
	if (!el || isSensitiveField(el)) return false;
	if (isTextField(el)) return !el.readOnly && !el.disabled;
	return (el as HTMLElement).isContentEditable === true;
}

// ===== Pending trigger tracking =====
// Where the "!@" token sits, so we can verify it is still there after the
// async location lookup instead of inserting at an arbitrary caret position.
type Pending =
	| { kind: 'field'; el: TextField; start: number }
	| { kind: 'editable'; el: HTMLElement; node: Text; start: number };

function detectTrigger(el: Element): Pending | null {
	if (isTextField(el)) {
		const caret = el.selectionStart;
		if (caret == null || caret !== el.selectionEnd) return null;
		if (!TRIGGER_AT_CARET_RE.test(el.value.slice(0, caret))) return null;
		return { kind: 'field', el, start: caret - TRIGGER.length };
	}

	const sel = window.getSelection();
	if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return null;
	const range = sel.getRangeAt(0);
	const node = range.startContainer;
	if (node.nodeType !== Node.TEXT_NODE) return null;
	const before = (node.nodeValue || '').slice(0, range.startOffset);
	if (!TRIGGER_AT_CARET_RE.test(before)) return null;
	return { kind: 'editable', el: el as HTMLElement, node: node as Text, start: range.startOffset - TRIGGER.length };
}

function triggerStillPresent(p: Pending): boolean {
	if (!p.el.isConnected) return false;
	if (p.kind === 'field') return p.el.value.substr(p.start, TRIGGER.length) === TRIGGER;
	return p.node.isConnected && (p.node.nodeValue || '').substr(p.start, TRIGGER.length) === TRIGGER;
}

function triggerRect(p: Pending): DOMRect {
	if (p.kind === 'editable') {
		try {
			const r = document.createRange();
			r.setStart(p.node, p.start);
			r.setEnd(p.node, p.start + TRIGGER.length);
			const rect = r.getBoundingClientRect();
			if (rect.width || rect.height) return rect;
		} catch {
			// fall through to element rect
		}
	}
	return p.el.getBoundingClientRect();
}

// ===== Replacement =====
// Prefer execCommand('insertText'): it goes through the editor's normal input
// pipeline (React/Slate/Draft state, undo stack). Fall back to direct DOM edits.
function replaceTrigger(p: Pending, url: string): boolean {
	if (!triggerStillPresent(p)) return false;
	const end = p.start + TRIGGER.length;

	if (p.kind === 'field') {
		const el = p.el;
		el.focus();
		el.setSelectionRange(p.start, end);
		let ok = false;
		try {
			ok = document.execCommand('insertText', false, url);
		} catch {
			ok = false;
		}
		if (!ok || el.value.substr(p.start, url.length) !== url) {
			el.value = el.value.slice(0, p.start) + url + el.value.slice(end);
			el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: url }));
		}
		const caret = p.start + url.length;
		el.setSelectionRange(caret, caret);
		return true;
	}

	const sel = window.getSelection();
	if (!sel) return false;
	p.el.focus();
	const range = document.createRange();
	range.setStart(p.node, p.start);
	range.setEnd(p.node, end);
	sel.removeAllRanges();
	sel.addRange(range);

	let ok = false;
	try {
		ok = document.execCommand('insertText', false, url);
	} catch {
		ok = false;
	}
	if (!ok) {
		const a = document.createElement('a');
		a.href = url;
		a.textContent = url;
		a.target = '_blank';
		a.rel = 'noopener noreferrer';
		range.deleteContents();
		range.insertNode(a);
		const after = document.createRange();
		after.setStartAfter(a);
		after.collapse(true);
		sel.removeAllRanges();
		sel.addRange(after);
	}
	return true;
}

// ===== Confirmation prompt =====
const PROMPT_STYLES = `
	:host{all:initial}
	.box{position:fixed; z-index:2147483647; display:inline-flex; align-items:center; gap:8px;
		font:500 13px/1.3 system-ui,-apple-system,Segoe UI,Roboto,sans-serif; color:#0b1220;
		background:#fff; border:1px solid rgba(0,0,0,.12); border-radius:10px; padding:6px 8px;
		box-shadow:0 6px 18px rgba(30,80,160,.18)}
	.msg{white-space:nowrap}
	.msg.err{color:#b42318}
	button{appearance:none; font:inherit; border-radius:7px; padding:4px 10px; cursor:pointer;
		border:1px solid #007aff; background:#007aff; color:#fff}
	button.ghost{background:#fff; color:#0b1220; border-color:rgba(0,0,0,.15)}
	button:disabled{opacity:.6; cursor:default}
	kbd{font:11px ui-monospace,monospace; opacity:.6}
	@media (prefers-color-scheme: dark){
		.box{background:#1c2230; color:#e8edf7; border-color:rgba(255,255,255,.14)}
		button.ghost{background:#1c2230; color:#e8edf7; border-color:rgba(255,255,255,.2)}
	}
`;

let pending: Pending | null = null;
let busy = false;
let promptHost: HTMLElement | null = null;
let promptParts: { box: HTMLElement; msg: HTMLElement; share: HTMLButtonElement; cancel: HTMLButtonElement } | null = null;
let errorTimer: number | undefined;

function ensurePrompt(): NonNullable<typeof promptParts> {
	if (promptParts && promptHost?.isConnected) return promptParts;

	promptHost = document.createElement('span');
	promptHost.className = 'pingmark-prompt-host';
	const shadow = promptHost.attachShadow({ mode: 'closed' });
	const style = document.createElement('style');
	style.textContent = PROMPT_STYLES;

	const box = document.createElement('div');
	box.className = 'box';
	box.setAttribute('role', 'dialog');
	box.setAttribute('aria-label', 'Share location with Pingmark');

	const msg = document.createElement('span');
	msg.className = 'msg';

	const share = document.createElement('button');
	share.type = 'button';
	share.textContent = 'Share';
	const tabHint = document.createElement('kbd');
	tabHint.textContent = ' Tab';
	share.appendChild(tabHint);

	const cancel = document.createElement('button');
	cancel.type = 'button';
	cancel.className = 'ghost';
	cancel.textContent = 'Esc';

	// Keep focus and caret in the user's field when clicking the prompt.
	for (const b of [share, cancel]) b.addEventListener('mousedown', (e) => e.preventDefault());
	share.addEventListener('click', () => void confirmShare());
	cancel.addEventListener('click', () => hidePrompt());

	box.append(msg, share, cancel);
	shadow.append(style, box);
	document.documentElement.appendChild(promptHost);

	promptParts = { box, msg, share, cancel };
	return promptParts;
}

function positionPrompt(p: Pending): void {
	const { box } = ensurePrompt();
	const rect = triggerRect(p);
	const top = rect.bottom + 6 + 40 > window.innerHeight ? Math.max(4, rect.top - 44) : rect.bottom + 6;
	const left = Math.min(Math.max(4, rect.left), Math.max(4, window.innerWidth - 260));
	box.style.top = `${top}px`;
	box.style.left = `${left}px`;
}

function showPrompt(p: Pending): void {
	pending = p;
	const parts = ensurePrompt();
	window.clearTimeout(errorTimer);
	parts.msg.className = 'msg';
	parts.msg.textContent = '📍 Share your location here?';
	parts.share.hidden = false;
	parts.share.disabled = false;
	parts.cancel.hidden = false;
	parts.box.hidden = false;
	positionPrompt(p);
}

function showError(text: string): void {
	pending = null;
	const parts = ensurePrompt();
	parts.msg.className = 'msg err';
	parts.msg.textContent = text;
	parts.share.hidden = true;
	parts.cancel.hidden = true;
	parts.box.hidden = false;
	window.clearTimeout(errorTimer);
	errorTimer = window.setTimeout(hidePrompt, ERROR_DISPLAY_MS);
}

function hidePrompt(): void {
	pending = null;
	if (promptParts) promptParts.box.hidden = true;
}

async function confirmShare(): Promise<void> {
	const p = pending;
	if (!p || busy) return;
	busy = true;
	const parts = ensurePrompt();
	parts.share.disabled = true;
	parts.msg.textContent = '📍 Locating…';

	try {
		const coords = await requestLocation();
		const url = buildPingmarkUrl(coords.latitude, coords.longitude, getISO());
		if (replaceTrigger(p, url)) {
			hidePrompt();
		} else {
			showError('The !@ was edited — nothing inserted.');
		}
	} catch (err) {
		showError(`Location unavailable${err instanceof Error && err.message ? `: ${err.message}` : ''}`);
	} finally {
		busy = false;
	}
}

// ===== Event wiring =====
function onInput(e: Event): void {
	if ((e as InputEvent).isComposing || busy) return;
	const target = e.target as Element | null;
	// For contentEditable, input fires on the editing host; use the active element.
	const el = target && isTextField(target) ? target : (document.activeElement as Element | null);
	if (!isEligible(el)) {
		if (pending) hidePrompt();
		return;
	}
	const p = detectTrigger(el);
	if (p) showPrompt(p);
	else if (pending) hidePrompt();
}

function onKeydown(e: KeyboardEvent): void {
	if (!pending || busy) return;
	if (e.key === 'Escape') {
		e.preventDefault();
		e.stopPropagation();
		hidePrompt();
	} else if (e.key === 'Tab' && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) {
		e.preventDefault();
		e.stopPropagation();
		void confirmShare();
	}
}

function onFocusOut(e: FocusEvent): void {
	if (pending && !busy && e.target === pending.el) hidePrompt();
}

function onViewportChange(): void {
	if (pending) positionPrompt(pending);
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

		// Never touch links inside an editor: injecting the card there would
		// become part of the user's message or corrupt the editor's state.
		if ((a as HTMLElement).isContentEditable) return;

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

	document.addEventListener('input', onInput, true);
	document.addEventListener('keydown', onKeydown, true);
	document.addEventListener('focusout', onFocusOut, true);
	window.addEventListener('scroll', onViewportChange, true);
	window.addEventListener('resize', onViewportChange);

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
