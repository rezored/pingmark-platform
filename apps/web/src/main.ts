import { renderMap } from "./map";
import { canonical } from "./lib/url";

function parsePath() {
	const clean = location.pathname.replace(/\/+$/, "");
	const parts = clean.split("/").filter(Boolean);
	if (parts.length < 2) return null;
	const [latS, lonS, tsS] = parts;
	const lat = Number(latS), lon = Number(lonS);
	if (isNaN(lat) || isNaN(lon)) return null;
	const ts = tsS ? Number(tsS) : undefined;
	return { lat, lon, ts };
}

function copy(text: string) { navigator.clipboard?.writeText(text).catch(() => {}); }

const root = document.getElementById("app")!;
const data = parsePath();

if (!data) {
	root.innerHTML = `<div style="padding:24px">
    <h1>Pingmark</h1>
    <p>Provide a path <span class="code">/lat/lon[/timestamp]</span> to render a map.</p>
  </div>`;
} else {
	const { lat, lon, ts } = data;
	const url = canonical(lat, lon, ts);
	root.innerHTML = `
    <div class="toolbar">
      <strong>Pingmark:</strong>
      <span class="code">!@ ${lat},${lon}${ts ? `; ${ts}` : ""}</span>
      <button id="copy">Copy URL</button>
      <a class="code" href="/" style="margin-left:auto">Home</a>
    </div>
    <div id="map"></div>
  `;
	const mapEl = document.getElementById("map")!;
	renderMap(mapEl, lat, lon);
	document.getElementById("copy")?.addEventListener("click", () => copy(url));
}