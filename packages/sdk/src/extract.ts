// Find every spatial mention in free text: inline tokens, resolver URLs,
// geo: URIs (RFC 5870), and bare "!@" requests for the current location.

import { isValidLatLon, PRECISION_DECIMALS, precisionForDecimals, type Precision } from './geo';

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

// The lookahead stops backtracking into a partial number: "23.45x" must not
// be read as 23. A trailing sentence period ("…23.4.") is still allowed.
const NUM = '[+-]?\\d{1,3}(?:\\.\\d+)?(?!\\.?\\d)';
// Token must start the text or follow whitespace/opening punctuation.
const BOUNDARY = '(?<=^|[\\s([{"\'«„“‘])';

const TOKEN_RE = new RegExp(`${BOUNDARY}!@(~{0,2})(?:(${NUM}),(${NUM})(?:/([0-9A-Za-z:.+_%-]+))?)?(?![\\w@#])`, 'gu');
const URL_RE = new RegExp(`https?://(?:map\\.)?pingmark\\.me/(${NUM})/(${NUM})(?:/([^\\s/?#]+))?`, 'giu');
const GEO_RE = new RegExp(`geo:(${NUM}),(${NUM})(?:,[+-]?\\d+(?:\\.\\d+)?)?(?:;[^\\s]*)?`, 'giu');

function tildePrecision(tildes: string): Precision {
	return tildes.length === 2 ? 'city' : tildes.length === 1 ? 'area' : 'exact';
}

const decimals = (s: string): number => s.split('.')[1]?.length ?? 0;

/**
 * A token without ~ is never more precise than its digits allow, so
 * "!@43.123,25.654" (street level has no ~ marker) reads back as 'street'.
 * With ~ the marker decides: formatting may drop trailing zeros ("42.7").
 */
function tokenPrecision(tildes: string, latS: string, lonS: string): Precision {
	if (tildes) return tildePrecision(tildes);
	return precisionForDecimals(Math.min(decimals(latS), decimals(lonS)));
}

/** Keep at least `min` decimals, so the written digits still carry the precision. */
function withDecimals(v: number, min: number): string {
	const s = String(v);
	return decimals(s) >= min || s.includes('e') ? s : v.toFixed(min);
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
		if (latS === undefined) {
			out.push({ kind: 'here', precision: tildePrecision(tildes), raw, index: m.index! });
			continue;
		}
		const precision = tokenPrecision(tildes, latS, lonS);
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
	// Without ~ the reader infers precision from the digits, so keep them.
	const fmt = (v: number): string => (tildes ? String(v) : withDecimals(v, PRECISION_DECIMALS[precision]));
	const base = `!@${tildes}${fmt(p.lat)},${fmt(p.lon)}`;
	return p.ts ? `${base}/${encodeURIComponent(p.ts)}` : base;
}
