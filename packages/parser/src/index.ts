import type { ParsedPingmark } from "./types.js";

export const LAT = "-?\\d{1,2}(?:\\.\\d+)?";
export const LON = "-?\\d{1,3}(?:\\.\\d+)?";
export const TS_ISO = /\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?Z?/;
export const TS_UNIX = /\\d{10}(?:\\d{3})?/; // sec or ms

const RE = new RegExp(
	`(?:^|\\W)!@\\s*(${LAT})\\s*,\\s*(${LON})(?:\\s*[;|,]\\s*(${TS_ISO.source}|${TS_UNIX.source}))?(?=\\b|$)`,
	"g"
);

function clamp(n: number, min: number, max: number) { return Math.min(Math.max(n, min), max); }

function normalizeLatLon(lat: number, lon: number) {
	const nLat = clamp(lat, -90, 90);
	let nLon = lon;
	nLon = ((((nLon + 180) % 360) + 360) % 360) - 180;
	return { lat: Number(nLat.toFixed(6)), lon: Number(nLon.toFixed(6)) };
}

function normalizeTs(ts: string | undefined): number | undefined {
	if (!ts) return undefined;
	if (TS_UNIX.test(ts)) return ts.length > 10 ? Math.floor(Number(ts) / 1000) : Number(ts);
	if (TS_ISO.test(ts)) {
		const d = new Date(ts);
		if (!isNaN(d.getTime())) return Math.floor(d.getTime() / 1000);
	}
	return undefined;
}

export function parsePingmarks(text: string, origin = "https://pingmark.me"): ParsedPingmark[] {
	const out: ParsedPingmark[] = [];
	for (const m of text.matchAll(RE)) {
		const raw = m[0];
		const lat = Number(m[1]);
		const lon = Number(m[2]);
		const tsRaw: string | undefined = m[3];
		if (isNaN(lat) || isNaN(lon)) continue;
		if (lat < -90 || lat > 90) continue;
		if (lon < -180 || lon > 180) continue;
		const { lat: nLat, lon: nLon } = normalizeLatLon(lat, lon);
		const ts = normalizeTs(tsRaw);
		const url = `${origin}/${nLat}/${nLon}${ts ? `/${ts}` : ""}`;
		out.push({ raw, lat: nLat, lon: nLon, timestamp: ts, url });
	}
	return out;
}

export function firstPingmark(text: string, origin?: string) {
	return parsePingmarks(text, origin)[0];
}