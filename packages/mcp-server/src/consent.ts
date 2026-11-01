// Consent-first location capture.
//
// The MCP server cannot (and should not) read the device location on its own.
// Instead it opens a one-time page on 127.0.0.1 in the user's browser. The user
// sees why the assistant is asking, picks how precise to be, and clicks Share.
// Coordinates are rounded in the browser before they are sent, so a coarse
// choice never exposes the exact point, not even to this local process.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { coarsen, isPrecision, isValidLatLon, PRECISION_DECIMALS, PRECISION_RADIUS_M, type Precision } from '@pingmark/sdk';

export type ConsentResult =
	| { status: 'shared'; lat: number; lon: number; precision: Precision; accuracy_m?: number }
	| { status: 'declined' }
	| { status: 'timeout' }
	| { status: 'error'; message: string };

export interface ConsentOptions {
	reason: string;
	suggestedPrecision: Precision;
	timeoutMs: number;
}

const MAX_BODY_BYTES = 4096;

function escapeHtml(s: string): string {
	return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function openBrowser(url: string): void {
	const [cmd, args] =
		process.platform === 'win32'
			? ['cmd', ['/c', 'start', '""', url]]
			: process.platform === 'darwin'
				? ['open', [url]]
				: ['xdg-open', [url]];
	try {
		const child = spawn(cmd, args as string[], { stdio: 'ignore', detached: true, windowsHide: true });
		child.on('error', () => {});
		child.unref();
	} catch {
		// The URL is also logged to stderr; the user can open it manually.
	}
}

function readBody(req: IncomingMessage): Promise<string> {
	return new Promise((resolve, reject) => {
		let size = 0;
		const chunks: Buffer[] = [];
		req.on('data', (c: Buffer) => {
			size += c.length;
			if (size > MAX_BODY_BYTES) {
				reject(new Error('Body too large'));
				req.destroy();
				return;
			}
			chunks.push(c);
		});
		req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
		req.on('error', reject);
	});
}

function page(opts: ConsentOptions): string {
	const radios = (['exact', 'street', 'area', 'city'] as Precision[])
		.map((p) => {
			const checked = p === opts.suggestedPrecision ? ' checked' : '';
			return `<label class="opt"><input type="radio" name="precision" value="${p}"${checked}><span data-i18n="p_${p}"></span></label>`;
		})
		.join('');

	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pingmark: share location?</title>
<style>
:root{--bg:#f6f8fc;--card:#fff;--fg:#0b1220;--muted:#5b6475;--line:rgba(0,0,0,.1);--accent:#007aff;--err:#b42318;--ok:#067647}
@media (prefers-color-scheme: dark){:root{--bg:#0e131d;--card:#171e2b;--fg:#e8edf7;--muted:#9aa4b8;--line:rgba(255,255,255,.12);--ok:#47cd89;--err:#f97066}}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:16px}
.card{width:100%;max-width:440px;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:24px}
h1{font-size:19px;margin:0 0 4px}
.muted{color:var(--muted);font-size:13px}
.reason{margin:16px 0;padding:12px 14px;border-left:3px solid var(--accent);background:rgba(0,122,255,.07);border-radius:6px;white-space:pre-wrap;word-break:break-word}
fieldset{border:0;padding:0;margin:16px 0}
legend{font-weight:600;margin-bottom:8px}
.opt{display:flex;gap:10px;align-items:center;padding:8px 10px;border:1px solid var(--line);border-radius:10px;margin-bottom:6px;cursor:pointer}
.opt:has(input:checked){border-color:var(--accent)}
.row{display:flex;gap:8px;margin-top:16px}
button{flex:1;font:inherit;font-weight:600;padding:10px 14px;border-radius:10px;border:1px solid var(--accent);background:var(--accent);color:#fff;cursor:pointer}
button.ghost{background:transparent;color:var(--fg);border-color:var(--line)}
button:disabled{opacity:.55;cursor:default}
#status{margin-top:14px;min-height:1.5em}
.ok{color:var(--ok)}.err{color:var(--err)}
code{font:13px ui-monospace,monospace}
</style>
</head>
<body>
<main class="card">
	<h1>📍 <span data-i18n="title"></span></h1>
	<div class="muted" data-i18n="sub"></div>
	<div class="reason">${escapeHtml(opts.reason)}</div>
	<fieldset>
		<legend data-i18n="how"></legend>
		${radios}
	</fieldset>
	<div class="row">
		<button id="share" type="button" data-i18n="share"></button>
		<button id="decline" type="button" class="ghost" data-i18n="decline"></button>
	</div>
	<div id="status" role="status"></div>
	<p class="muted" data-i18n="note"></p>
</main>
<script>
const T = {
	en: {
		title: 'Share your location?', sub: 'Your AI assistant is asking, through Pingmark:',
		how: 'How precise?', p_exact: 'Exact (~1 m)', p_street: 'Street (~100 m)', p_area: 'Neighbourhood (~1 km)', p_city: 'City (~10 km)',
		share: 'Share', decline: 'Don\\'t share', locating: 'Locating…', shared: 'Shared. You can close this tab.',
		declined: 'Not shared. You can close this tab.', failed: 'Could not get location: ',
		note: 'Coordinates are rounded in this browser before they are sent. This page works only once.'
	},
	bg: {
		title: 'Да споделиш ли локацията си?', sub: 'Твоят ИИ асистент пита чрез Pingmark:',
		how: 'Колко точно?', p_exact: 'Точно (~1 м)', p_street: 'Улица (~100 м)', p_area: 'Квартал (~1 км)', p_city: 'Град (~10 км)',
		share: 'Сподели', decline: 'Не споделяй', locating: 'Определям локацията…', shared: 'Споделено. Можеш да затвориш таба.',
		declined: 'Не е споделено. Можеш да затвориш таба.', failed: 'Неуспешно определяне на локацията: ',
		note: 'Координатите се закръглят в този браузър, преди да бъдат изпратени. Страницата работи само веднъж.'
	}
};
const L = (navigator.language || 'en').toLowerCase().startsWith('bg') ? T.bg : T.en;
document.documentElement.lang = L === T.bg ? 'bg' : 'en';
document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = L[el.dataset.i18n]; });

const DECIMALS = ${JSON.stringify(PRECISION_DECIMALS)};
const RADIUS = ${JSON.stringify(PRECISION_RADIUS_M)};
const statusEl = document.getElementById('status');
const shareBtn = document.getElementById('share');
const declineBtn = document.getElementById('decline');
const setStatus = (text, cls) => { statusEl.textContent = text; statusEl.className = cls || ''; };
const done = () => { shareBtn.disabled = true; declineBtn.disabled = true; document.querySelectorAll('input').forEach(i => i.disabled = true); };
const post = (body) => fetch(location.pathname, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d;

shareBtn.addEventListener('click', () => {
	const precision = document.querySelector('input[name=precision]:checked').value;
	shareBtn.disabled = true;
	setStatus(L.locating);
	navigator.geolocation.getCurrentPosition(async (pos) => {
		const d = DECIMALS[precision];
		const lat = round(pos.coords.latitude, d), lon = round(pos.coords.longitude, d);
		const accuracy = Math.max(Math.round(pos.coords.accuracy || 0), RADIUS[precision]);
		try {
			const r = await post({ action: 'share', lat, lon, precision, accuracy });
			if (!r.ok) throw new Error(await r.text());
			done();
			setStatus(L.shared + ' (' + lat + ', ' + lon + ')', 'ok');
		} catch (e) { shareBtn.disabled = false; setStatus(L.failed + e.message, 'err'); }
	}, (err) => {
		shareBtn.disabled = false;
		setStatus(L.failed + err.message, 'err');
	}, { enableHighAccuracy: precision === 'exact' || precision === 'street', timeout: 20000, maximumAge: 60000 });
});

declineBtn.addEventListener('click', async () => {
	try { await post({ action: 'decline' }); } catch {}
	done();
	setStatus(L.declined);
});
</script>
</body>
</html>`;
}

export function requestLocationConsent(opts: ConsentOptions): Promise<ConsentResult> {
	return new Promise((resolve) => {
		const sessionId = randomBytes(16).toString('hex');
		const path = `/s/${sessionId}`;
		let settled = false;
		let origin = '';

		const finish = (result: ConsentResult): void => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			// Let the in-flight response flush before closing.
			setTimeout(() => server.close(), 250);
			resolve(result);
		};

		const send = (res: ServerResponse, status: number, body: string, type = 'text/plain; charset=utf-8'): void => {
			res.writeHead(status, {
				'Content-Type': type,
				'Cache-Control': 'no-store',
				'X-Content-Type-Options': 'nosniff',
				'Referrer-Policy': 'no-referrer'
			});
			res.end(body);
		};

		const server = createServer(async (req, res) => {
			try {
				if (req.url !== path) return send(res, 404, 'Not found');
				if (settled) return send(res, 410, 'This request has already been answered.');

				if (req.method === 'GET') {
					return send(res, 200, page(opts), 'text/html; charset=utf-8');
				}

				if (req.method === 'POST') {
					// Only the page we served may answer (blocks other local sites).
					if (req.headers.origin !== origin) return send(res, 403, 'Forbidden');
					const body = JSON.parse(await readBody(req)) as Record<string, unknown>;

					if (body.action === 'decline') {
						send(res, 200, 'ok');
						return finish({ status: 'declined' });
					}
					if (body.action === 'share') {
						const lat = Number(body.lat);
						const lon = Number(body.lon);
						const precision = body.precision;
						if (!isPrecision(precision) || !isValidLatLon(lat, lon)) return send(res, 400, 'Invalid location');
						// Re-apply rounding server-side in case the page was tampered with.
						const p = coarsen({ lat, lon }, precision);
						const accuracy = Number(body.accuracy);
						send(res, 200, 'ok');
						return finish({
							status: 'shared',
							lat: p.lat,
							lon: p.lon,
							precision,
							...(Number.isFinite(accuracy) && accuracy > 0 && { accuracy_m: Math.round(accuracy) })
						});
					}
					return send(res, 400, 'Unknown action');
				}

				return send(res, 405, 'Method not allowed');
			} catch (err) {
				send(res, 400, 'Bad request');
			}
		});

		const timer = setTimeout(() => finish({ status: 'timeout' }), opts.timeoutMs);

		server.on('error', (err) => finish({ status: 'error', message: err.message }));
		server.listen(0, '127.0.0.1', () => {
			const addr = server.address();
			if (!addr || typeof addr === 'string') return finish({ status: 'error', message: 'Could not bind local port' });
			origin = `http://127.0.0.1:${addr.port}`;
			const url = `${origin}${path}`;
			console.error(`[pingmark-mcp] Location consent page: ${url}`);
			if (!process.env.PINGMARK_NO_BROWSER) openBrowser(url);
		});
	});
}
