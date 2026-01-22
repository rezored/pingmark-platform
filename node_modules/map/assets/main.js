import { parseFromPath, toGeoURI } from '@pingmark/sdk';

function parsePath() {
	const parts = location.pathname.replace(/^\/+|\/+$/g, '').split('/');
	// Позволяваме lat/lon/optional ts (числов UNIX сек)
	if (parts.length >= 2) {
		const [latS, lonS, tsS] = parts;
		// Използваме SDK валидатора за lat/lon; ts оставяме като string → number
		const p = parseFromPath([latS, lonS, tsS].filter(Boolean));
		return { lat: p.lat, lon: p.lon, timestamp: tsS ? Number(tsS) : undefined };
	}
	return null;
}

function canonicalUrl(lat, lon, timestamp) {
	const lat6 = Number(lat).toFixed(6);
	const lon6 = Number(lon).toFixed(6);
	return `/${lat6}/${lon6}${timestamp ? `/${timestamp}` : ''}`;
}

async function copyToClipboard(text) {
	try { await navigator.clipboard.writeText(text); return true; }
	catch { return false; }
}

class MapViewerApp {
	constructor() {
		this.map = null;
		this.marker = null;
		this.currentLocation = null;
		this.init();
	}

	init() {
		const location = parsePath();
		if (!location) { this.showError(); return; }
		this.currentLocation = location;
		this.render();
	}

	showError() {
		const app = document.getElementById('app');
		app.innerHTML = `
      <div class="error">
        <h1>Invalid Location</h1>
        <p>Please provide valid coordinates in the URL format:</p>
        <p><code>/latitude/longitude[/timestamp]</code></p>
        <a href="https://pingmark.me" class="btn btn-primary">Go to Pingmark</a>
      </div>
    `;
	}

	render() {
		if (!this.currentLocation) return;

		const { lat, lon, timestamp } = this.currentLocation;
		const app = document.getElementById('app');

		app.innerHTML = `
      <div id="toolbar"></div>
      <div id="map"></div>
      <div id="floating-actions"></div>
    `;

		this.initToolbar(lat, lon, timestamp);
		this.initMap(lat, lon, timestamp);
		this.renderFloatingActions();
	}

	initToolbar(lat, lon, timestamp) {
		const toolbar = document.getElementById('toolbar');
		const tsText = timestamp ? new Date(timestamp * 1000).toLocaleString() : '';

		toolbar.innerHTML = `
      <div class="coordinates">${lat.toFixed(6)}, ${lon.toFixed(6)}</div>
      ${tsText ? `<div class="timestamp">${tsText}</div>` : ''}
      <div class="actions">
        <button class="btn" id="copy-btn">Copy Link</button>
        <button class="btn" id="share-btn">Share</button>
        <a class="btn" id="open-geo"   target="_blank" rel="noopener">Open (geo:)</a>
        <a class="btn" id="open-apple" target="_blank" rel="noopener">Apple Maps</a>
        <a class="btn" id="open-gmaps" target="_blank" rel="noopener">Google Maps</a>
      </div>
    `;

		document.getElementById('copy-btn').addEventListener('click', () => this.copyLink());
		document.getElementById('share-btn').addEventListener('click', () => this.shareLink());

		// Deeplinks (чисто на клиента, без API)
		const geo = toGeoURI({ lat, lon });
		document.getElementById('open-geo').href   = geo;
		document.getElementById('open-apple').href = `https://maps.apple.com/?ll=${lat},${lon}`;
		document.getElementById('open-gmaps').href = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
	}

	initMap(lat, lon, timestamp) {
		this.map = L.map('map', { zoomControl: true, attributionControl: true }).setView([lat, lon], 15);

		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			maxZoom: 19,
			attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
		}).addTo(this.map);

		const pingIcon = L.icon({
			iconUrl: '/images/pingmark_logo_icon.png',
			iconSize: [36, 44],
			iconAnchor: [18, 44],
			popupAnchor: [0, -44]
		});

		this.marker = L.marker([lat, lon], { icon: pingIcon }).addTo(this.map);

		const popupHtml = this.createPopupContent(lat, lon, timestamp);
		this.marker.bindPopup(popupHtml).openPopup();

		window.addEventListener('resize', () => setTimeout(() => this.map.invalidateSize(), 0));
	}

	createPopupContent(lat, lon, timestamp) {
		let html = `
      <div style="text-align:center;">
        <div style="font-weight:600;color:#dc2626;margin-bottom:8px;">📍 Pingmark Location</div>
        <div style="font-family:'Monaco','Menlo','Ubuntu Mono',monospace;font-size:12px;color:#374151;">
          ${lat.toFixed(6)}, ${lon.toFixed(6)}
        </div>
    `;
		if (timestamp) {
			const d = new Date(timestamp * 1000);
			if (!isNaN(d.getTime())) {
				html += `<div style="font-size:11px;color:#6b7280;margin-top:4px;">${d.toLocaleString()}</div>`;
			}
		}
		html += `</div>`;
		return html;
	}

	renderFloatingActions() {
		if (!this.currentLocation) return;
		const { lat, lon } = this.currentLocation;
		const fa = document.getElementById('floating-actions');

		fa.innerHTML = `
      <a href="https://www.google.com/maps/search/?api=1&query=${lat},${lon}"
         target="_blank" class="floating-btn primary" rel="noopener">Open in Google Maps</a>
      <a href="https://router.project-osrm.org/route/v1/driving/${lon},${lat};${lon},${lat}?overview=full"
         target="_blank" class="floating-btn" rel="noopener">Get Directions</a>
    `;
	}

	async copyLink() {
		const { lat, lon, timestamp } = this.currentLocation;
		const url = `https://map.pingmark.me${canonicalUrl(lat, lon, timestamp)}`;
		const ok = await copyToClipboard(url);
		ok ? this.flashBtn('copy-btn', 'Copied!', '#10b981') : this.flashBtn('copy-btn', 'Error', '#ef4444');
	}

	async shareLink() {
		const { lat, lon, timestamp } = this.currentLocation;
		const url = `https://map.pingmark.me${canonicalUrl(lat, lon, timestamp)}`;
		if (navigator.share) {
			try {
				await navigator.share({ title: 'Pingmark Location', text: `Check this: ${lat.toFixed(6)}, ${lon.toFixed(6)}`, url });
			} catch { this.copyLink(); }
		} else {
			this.copyLink();
		}
	}

	flashBtn(id, text, color) {
		const btn = document.getElementById(id);
		const old = btn.textContent;
		const oldBg = btn.style.background;
		const oldColor = btn.style.color;
		const oldBorder = btn.style.borderColor;

		btn.textContent = text;
		btn.style.background = color;
		btn.style.color = '#fff';
		btn.style.borderColor = color;

		setTimeout(() => {
			btn.textContent = old;
			btn.style.background = oldBg;
			btn.style.color = oldColor;
			btn.style.borderColor = oldBorder;
		}, 1600);
	}
}

document.addEventListener('DOMContentLoaded', () => new MapViewerApp());
