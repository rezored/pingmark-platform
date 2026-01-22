import { Pingmark } from './types';

const PM_RE = /!@\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)(?:\/([A-Za-z0-9:.+_-]+))?/;

export function parse(text: string): Pingmark | null {
	const m = text.match(PM_RE);
	if (!m) return null;
	const lat = Number(m[1]), lon = Number(m[2]);
	const ts = m[3];
	if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
	if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
	return ts ? { lat, lon, ts } : { lat, lon };
}

export function parseFromPath(segments: string[]): Pingmark {
	const [latS, lonS, ts] = segments;
	const lat = Number(latS), lon = Number(lonS);
	if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error('Invalid coordinates');
	if (lat < -90 || lat > 90 || lon < -180 || lon > 180) throw new Error('Out of range');
	return ts ? { lat, lon, ts: decodeURIComponent(ts) } : { lat, lon };
}