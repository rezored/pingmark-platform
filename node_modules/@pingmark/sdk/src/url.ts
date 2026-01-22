import { Pingmark } from './types';

export function format(p: Pingmark): string {
	const base = `!@${p.lat},${p.lon}`;
	return p.ts ? `${base}/${p.ts}` : base;
}
export function toURL(p: Pingmark, base = 'https://map.pingmark.me'): string {
	const path = p.ts ? `/${p.lat}/${p.lon}/${encodeURIComponent(p.ts)}` : `/${p.lat}/${p.lon}`;
	return `${base}${path}`;
}
export function toGeoURI(p: Pingmark): string {
	// geo: URI по RFC 5870
	return `geo:${p.lat},${p.lon}`;
}