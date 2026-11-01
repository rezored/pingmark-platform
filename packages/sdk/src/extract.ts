// Find every spatial mention in free text: inline tokens, resolver URLs,
// geo: URIs (RFC 5870), and bare "!@" requests for the current location.

import { isValidLatLon, type Precision } from './geo';

export type MentionSource = 'token' | 'url' | 'geo-uri';

export interface PointMention {
	kind: 'point';
	lat: number;
	lon: number;
	ts?: string;
	/** Disclosure level declared by the token (~ / ~~); 'exact' when none. */
	precision: Precision;
	source: MentionSource;
	raw: string;
	index: number;
}

/** A bare "!@" with no coordinates: the author means "where I am now". */
export interface HereMention {
	kind: 'here';
	precision: Precision;
	raw: string;
	index: number;
}

export type Mention = PointMention | HereMention;

const NUM = '[+-]?\\d{1,3}(?:\\.\\d+)?';
// Token must start the text or follow whitespace/opening punctuation.
const BOUNDARY = '(?<=^|[\\s([{"\'«„“‘])';

const TOKEN_RE = new RegExp(`${BOUNDARY}!@(~{0,2})(?:(${NUM}),(${NUM})(?:/([0-9A-Za-z:.+_%-]+))?)?(?![\\w@#])`, 'gu');
const URL_RE = new RegExp(`https?://(?:map\\.)?pingmark\\.me/(${NUM})/(${NUM})(?:/([^\\s/?#]+))?`, 'giu');
const GEO_RE = new RegExp(`geo:(${NUM}),(${NUM})(?:,[+-]?\\d+(?:\\.\\d+)?)?(?:;[^\\s]*)?`, 'giu');

function tildePrecision(tildes: string): Precision {
	return tildes.length === 2 ? 'city' : tildes.length === 1 ? 'area' : 'exact';
}

function safeDecode(s: string): string {
	try {
		return decodeURIComponent(s);
	} catch {
		return s;
	}
}

export function extractMentions(text: string): Mention[] {
	const out: Mention[] = [];

	for (const m of text.matchAll(TOKEN_RE)) {
		const [raw, tildes, latS, lonS, ts] = m;
		const precision = tildePrecision(tildes);
		if (latS === undefined) {
			out.push({ kind: 'here', precision, raw, index: m.index! });
			continue;
		}
		const lat = Number(latS);
		const lon = Number(lonS);
		if (!isValidLatLon(lat, lon)) continue;
		out.push({ kind: 'point', lat, lon, ...(ts && { ts: safeDecode(ts) }), precision, source: 'token', raw, index: m.index! });
	}

	for (const m of text.matchAll(URL_RE)) {
		const [raw, latS, lonS, ts] = m;
		const lat = Number(latS);
		const lon = Number(lonS);
		if (!isValidLatLon(lat, lon)) continue;
		out.push({ kind: 'point', lat, lon, ...(ts && { ts: safeDecode(ts) }), precision: 'exact', source: 'url', raw, index: m.index! });
	}

	for (const m of text.matchAll(GEO_RE)) {
		const [raw, latS, lonS] = m;
		const lat = Number(latS);
		const lon = Number(lonS);
		if (!isValidLatLon(lat, lon)) continue;
		out.push({ kind: 'point', lat, lon, precision: 'exact', source: 'geo-uri', raw, index: m.index! });
	}

	return out.sort((a, b) => a.index - b.index);
}

/** Canonical inline token for a point at a given disclosure level. */
export function formatToken(p: { lat: number; lon: number; ts?: string }, precision: Precision = 'exact'): string {
	const tildes = precision === 'city' ? '~~' : precision === 'area' ? '~' : '';
	const base = `!@${tildes}${p.lat},${p.lon}`;
	return p.ts ? `${base}/${encodeURIComponent(p.ts)}` : base;
}
