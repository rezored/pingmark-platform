#!/usr/bin/env node
/**
 * Pingmark MCP server: consent-first location for AI assistants.
 *
 * `!@` in a user's message means "where I am". This server lets any MCP client
 * understand that, ask the user for their location with an explicit, precision-
 * limited consent step, and answer local questions using open map data.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
	bearingDegrees,
	coarsen,
	compassDirection,
	distanceMeters,
	extractMentions,
	formatToken,
	isValidLatLon,
	PRECISION_RADIUS_M,
	toGeoURI,
	toURL,
	type Precision
} from '@pingmark/sdk';
import { requestLocationConsent } from './consent.js';
import { CATEGORIES, findNearby, reverseGeocode, type NearbyPlace, type PlaceLevel } from './osm.js';
import { evaluateOpeningHours, needsCountry, placeClock } from './hours.js';

const VERSION = '0.1.0';
const CONSENT_TIMEOUT_MS = Number(process.env.PINGMARK_CONSENT_TIMEOUT_MS) || 90_000;
const PRECISION_ENUM = z.enum(['exact', 'street', 'area', 'city']);

const INSTRUCTIONS = `Pingmark (!@) is an open textual syntax for spatial mentions: "@" names a person, "#" a topic, "!@" a place.

How to treat it:
- A bare "!@" in the user's message means "my current location". "!@~" means "roughly where I am (neighbourhood)", "!@~~" means "my city". Call request_location to obtain it, with a short, honest reason, and the coarsest precision that answers the question.
- "!@lat,lon" tokens, pingmark.me links and geo: URIs are explicit places. Use parse_pingmarks to read them; never ask for the user's location when they already gave a place.
- Never request location unless the user wrote !@ or clearly asked for something location-dependent. If they decline, respect it and do not ask again in the same conversation.
- When you mention a specific place in an answer, include its pingmark token (from format_pingmark or find_nearby) so the user and other tools can resolve it.`;

// ---------- helpers ----------

interface ResolvedPoint {
	lat: number;
	lon: number;
	precision: Precision;
}

const LATLON_RE = /^\s*([+-]?\d{1,3}(?:\.\d+)?)\s*,\s*([+-]?\d{1,3}(?:\.\d+)?)\s*$/;

/** Accepts "lat,lon", a !@ token, a pingmark.me URL or a geo: URI. */
function resolvePoint(input: string): ResolvedPoint {
	const m = input.match(LATLON_RE);
	if (m) {
		const lat = Number(m[1]);
		const lon = Number(m[2]);
		if (isValidLatLon(lat, lon)) return { lat, lon, precision: 'exact' };
	}
	const mention = extractMentions(input).find((x) => x.kind === 'point');
	if (mention && mention.kind === 'point') return { lat: mention.lat, lon: mention.lon, precision: mention.precision };
	if (extractMentions(input).some((x) => x.kind === 'here')) {
		throw new Error('A bare !@ means "the user\'s current location". Call request_location first, then pass the returned token.');
	}
	throw new Error(`Could not read a location from "${input}". Use "lat,lon", a !@lat,lon token, a pingmark.me link or a geo: URI.`);
}

function links(p: { lat: number; lon: number }) {
	return {
		pingmark_url: toURL(p),
		geo_uri: toGeoURI(p),
		openstreetmap: `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}#map=17/${p.lat}/${p.lon}`,
		google_maps: `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`
	};
}

function ok(data: Record<string, unknown>) {
	return {
		content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
		structuredContent: data
	};
}

function fail(message: string) {
	return { content: [{ type: 'text' as const, text: message }], isError: true };
}

function configuredLocation(): ResolvedPoint | null {
	const raw = process.env.PINGMARK_LOCATION;
	if (!raw) return null;
	try {
		return resolvePoint(raw);
	} catch {
		console.error(`[pingmark-mcp] Ignoring invalid PINGMARK_LOCATION: ${raw}`);
		return null;
	}
}

const PLACE_LEVEL_FOR: Record<Precision, PlaceLevel> = {
	exact: 'street',
	street: 'street',
	area: 'neighbourhood',
	city: 'city'
};

// ---------- server ----------

const server = new McpServer({ name: 'pingmark', version: VERSION }, { instructions: INSTRUCTIONS });

server.registerTool(
	'request_location',
	{
		title: 'Ask the user to share their location',
		description:
			'Asks the user, in their browser, to share their current location for this request. The user sees your reason and chooses the precision; ' +
			'coordinates are rounded before they reach you. Use when the user wrote !@ (or !@~ / !@~~) or asked something that needs where they are. ' +
			'Ask for the coarsest precision that works: "city" for weather or news, "area" for nearby places, "exact" only for directions or meeting points.',
		inputSchema: {
			reason: z
				.string()
				.min(3)
				.max(300)
				.describe('One sentence shown to the user explaining why you need the location, in the user\'s language.'),
			precision: PRECISION_ENUM.default('area').describe('Suggested precision. The user may choose a different one.')
		},
		annotations: { readOnlyHint: true, openWorldHint: false }
	},
	async ({ reason, precision }) => {
		const fixed = configuredLocation();
		const result = fixed
			? ({ status: 'shared', ...coarsen(fixed, precision), precision } as const)
			: await requestLocationConsent({ reason, suggestedPrecision: precision, timeoutMs: CONSENT_TIMEOUT_MS });

		switch (result.status) {
			case 'shared': {
				const p = { lat: result.lat, lon: result.lon };
				return ok({
					status: 'shared',
					source: fixed ? 'configured (PINGMARK_LOCATION)' : 'user consent',
					token: formatToken(p, result.precision),
					lat: result.lat,
					lon: result.lon,
					precision: result.precision,
					uncertainty_m: Math.max(PRECISION_RADIUS_M[result.precision], 'accuracy_m' in result ? (result.accuracy_m ?? 0) : 0),
					...links(p),
					note: 'Use this location only for the current request. Do not repeat raw coordinates back to the user unless useful.'
				});
			}
			case 'declined':
				return ok({ status: 'declined', note: 'The user chose not to share their location. Answer without it and do not ask again.' });
			case 'timeout':
				return ok({
					status: 'timeout',
					note: 'The user did not respond to the location prompt. Ask them to name a place instead, or to type !@ again when ready.'
				});
			default:
				return fail(`Could not request location: ${result.message}`);
		}
	}
);

server.registerTool(
	'parse_pingmarks',
	{
		title: 'Find spatial mentions in text',
		description:
			'Extracts every Pingmark mention from text: !@lat,lon tokens (with ~ precision markers), pingmark.me links, geo: URIs, and bare !@ requests for the current location.',
		inputSchema: { text: z.string().max(20000).describe('Text to scan, usually the user\'s message.') },
		annotations: { readOnlyHint: true, openWorldHint: false }
	},
	async ({ text }) => {
		const mentions = extractMentions(text);
		return ok({
			count: mentions.length,
			wants_current_location: mentions.some((m) => m.kind === 'here'),
			mentions: mentions.map((m) =>
				m.kind === 'here'
					? { kind: 'here', precision: m.precision, raw: m.raw, hint: 'Call request_location with this precision.' }
					: { kind: 'point', lat: m.lat, lon: m.lon, ts: m.ts, precision: m.precision, source: m.source, raw: m.raw, ...links(m) }
			)
		});
	}
);

server.registerTool(
	'describe_location',
	{
		title: 'Describe a location in words',
		description:
			'Turns a location into a human-readable place (street, neighbourhood, city, region or country) using OpenStreetMap. ' +
			'The level defaults to match the location\'s precision, so a coarse location is never described more precisely than it was shared.',
		inputSchema: {
			location: z.string().describe('"lat,lon", a !@ token, a pingmark.me link or a geo: URI.'),
			level: z.enum(['street', 'neighbourhood', 'city', 'region', 'country']).optional(),
			language: z.string().max(10).default('en').describe('Language for place names, e.g. "bg" or "en".')
		},
		annotations: { readOnlyHint: true, openWorldHint: true }
	},
	async ({ location, level, language }) => {
		try {
			const p = resolvePoint(location);
			const finest = PLACE_LEVEL_FOR[p.precision];
			const order: PlaceLevel[] = ['street', 'neighbourhood', 'city', 'region', 'country'];
			// Never describe more precisely than the location was disclosed.
			const chosen = level && order.indexOf(level) >= order.indexOf(finest) ? level : finest;
			const place = await reverseGeocode(p, chosen, language);
			return ok({ ...place, precision: p.precision, attribution: '© OpenStreetMap contributors' });
		} catch (err) {
			return fail((err as Error).message);
		}
	}
);

const DEFAULT_MAX_RADIUS_M = 20000;
const RADIUS_GROWTH = 2.5;

server.registerTool(
	'find_nearby',
	{
		title: 'Find places near a location',
		description:
			'Finds nearby places from OpenStreetMap, nearest first, each with a pingmark token and an open_now flag evaluated in the place\'s local time. ' +
			'If too few places are found, the search radius grows automatically (up to max_radius_m). ' +
			'Set only_open=true when the user asks for something open now. Opening hours come from OSM and may be outdated; say so when it matters.',
		inputSchema: {
			location: z.string().describe('"lat,lon", a !@ token, a pingmark.me link or a geo: URI.'),
			category: z.enum(Object.keys(CATEGORIES) as [string, ...string[]]).optional(),
			osm_tags: z.array(z.string()).max(5).optional().describe('Raw OSM tag filters, e.g. ["amenity=vending_machine"]. Used if no category.'),
			name_contains: z.string().max(100).optional(),
			only_open: z.boolean().default(false).describe('Return only places known to be open right now.'),
			radius_m: z.number().int().min(50).max(20000).default(1000).describe('Starting radius.'),
			max_radius_m: z.number().int().min(50).max(50000).default(DEFAULT_MAX_RADIUS_M).describe('Upper bound for automatic expansion. Set equal to radius_m to disable expansion.'),
			limit: z.number().int().min(1).max(25).default(10)
		},
		annotations: { readOnlyHint: true, openWorldHint: true }
	},
	async ({ location, category, osm_tags, name_contains, only_open, radius_m, max_radius_m, limit }) => {
		try {
			const p = resolvePoint(location);
			const filters = category ? CATEGORIES[category] : osm_tags;
			if (!filters?.length) return fail('Give a category or at least one osm_tags filter.');

			const clock = placeClock(p.lat, p.lon);
			let countryForCenter: string | undefined;
			let countryLookedUp = false;

			const annotate = async (places: NearbyPlace[]) => {
				if (!countryLookedUp && places.some((pl) => !pl.country_code && needsCountry(pl.tags.opening_hours))) {
					countryLookedUp = true;
					try {
						countryForCenter = (await reverseGeocode(p, 'country')).country_code;
					} catch {
						// Without a country, holiday rules evaluate to unknown.
					}
				}
				return places.map((pl) => ({
					...pl,
					...evaluateOpeningHours(pl.tags.opening_hours, pl.lat, pl.lon, clock, pl.country_code ?? countryForCenter)
				}));
			};

			// A coarse location cannot support a search smaller than its own uncertainty.
			const maxRadius = Math.max(max_radius_m, radius_m);
			let radius = Math.min(Math.max(radius_m, PRECISION_RADIUS_M[p.precision] * 1.5), maxRadius);
			const tried: number[] = [];
			const wanted = Math.min(limit, 3);
			let source: 'overpass' | 'nominatim' = 'overpass';
			let results: Awaited<ReturnType<typeof annotate>> = [];

			for (;;) {
				tried.push(Math.round(radius));
				const found = await findNearby(p, filters, radius, name_contains);
				source = found.source;
				const annotated = await annotate(found.places);
				results = only_open ? annotated.filter((pl) => pl.open_now === true) : annotated;
				if (results.length >= wanted || radius >= maxRadius) break;
				radius = Math.min(radius * RADIUS_GROWTH, maxRadius);
			}

			const places = results.slice(0, limit);
			const notes: string[] = [];
			if (tried.length > 1) notes.push(`Too few results nearby, so the radius was widened: ${tried.join(' → ')} m.`);
			if (p.precision !== 'exact') notes.push(`The user's location is approximate (±${PRECISION_RADIUS_M[p.precision]} m); distances are rough.`);
			if (!places.length) notes.push(only_open ? 'Nothing known to be open within range. Places without opening hours in OSM were excluded.' : 'Nothing found within range in OpenStreetMap.');
			if (source === 'nominatim') notes.push('Live map query was unavailable; results come from a less complete fallback and may miss places.');

			return ok({
				center: { lat: p.lat, lon: p.lon, precision: p.precision },
				local_time: clock.local_time,
				time_zone: clock.time_zone,
				radius_m: tried[tried.length - 1],
				count: places.length,
				places: places.map(({ country_code: _cc, ...pl }) => ({
					...pl,
					token: formatToken({ lat: pl.lat, lon: pl.lon }),
					pingmark_url: toURL(pl)
				})),
				notes,
				data_source: source,
				attribution: '© OpenStreetMap contributors'
			});
		} catch (err) {
			return fail(`Nearby search is temporarily unavailable (${(err as Error).message}). Tell the user and suggest trying again shortly.`);
		}
	}
);

server.registerTool(
	'distance',
	{
		title: 'Distance and direction between two places',
		description: 'Straight-line distance, compass direction and rough walking time between two locations.',
		inputSchema: {
			from: z.string().describe('"lat,lon", a !@ token, a pingmark.me link or a geo: URI.'),
			to: z.string().describe('"lat,lon", a !@ token, a pingmark.me link or a geo: URI.')
		},
		annotations: { readOnlyHint: true, openWorldHint: false }
	},
	async ({ from, to }) => {
		try {
			const a = resolvePoint(from);
			const b = resolvePoint(to);
			const meters = distanceMeters(a, b);
			const bearing = bearingDegrees(a, b);
			const uncertainty = PRECISION_RADIUS_M[a.precision] + PRECISION_RADIUS_M[b.precision];
			return ok({
				distance_m: Math.round(meters),
				distance_km: Math.round(meters / 100) / 10,
				bearing_deg: Math.round(bearing),
				direction: compassDirection(bearing),
				// Straight-line × 1.3 detour factor at 5 km/h.
				walking_minutes_estimate: Math.round(((meters * 1.3) / 5000) * 60),
				uncertainty_m: uncertainty > 2 ? uncertainty : 0,
				note: 'Straight-line distance; real routes are longer.'
			});
		} catch (err) {
			return fail((err as Error).message);
		}
	}
);

server.registerTool(
	'format_pingmark',
	{
		title: 'Make a pingmark for a place',
		description: 'Creates the canonical !@ token and shareable links (pingmark, geo: URI, OpenStreetMap, Google Maps) for coordinates.',
		inputSchema: {
			lat: z.number().min(-90).max(90),
			lon: z.number().min(-180).max(180),
			timestamp: z.string().max(40).optional().describe('ISO-8601 UTC time, if the moment matters.'),
			precision: PRECISION_ENUM.default('exact')
		},
		annotations: { readOnlyHint: true, openWorldHint: false }
	},
	async ({ lat, lon, timestamp, precision }) => {
		const p = { ...coarsen({ lat, lon }, precision), ...(timestamp && { ts: timestamp }) };
		return ok({ token: formatToken(p, precision), precision, ...links(p) });
	}
);

async function main(): Promise<void> {
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error(`[pingmark-mcp] v${VERSION} ready on stdio`);
}

main().catch((err) => {
	console.error('[pingmark-mcp] fatal:', err);
	process.exit(1);
});
