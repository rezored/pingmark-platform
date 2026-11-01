// OpenStreetMap lookups: Nominatim (reverse geocoding) and Overpass (nearby POIs).
// Both public services have usage policies: identify the app, stay at ~1 req/s,
// no bulk use. Endpoints can be pointed at self-hosted instances via env vars.

import { distanceMeters, type LatLon } from '@pingmark/sdk';

const USER_AGENT = 'pingmark-mcp/0.1 (+https://pingmark.me)';
const NOMINATIM_URL = process.env.PINGMARK_NOMINATIM_URL || 'https://nominatim.openstreetmap.org';
// Comma-separated list; tried in order. The public instance is often at
// capacity and asks automated users to self-host, so production deployments
// should point this at their own Overpass instance.
const OVERPASS_URLS = (process.env.PINGMARK_OVERPASS_URL || 'https://overpass-api.de/api/interpreter')
	.split(',')
	.map((u) => u.trim())
	.filter(Boolean);
const REQUEST_TIMEOUT_MS = 20000;
// Fail fast: a healthy Overpass answers small "around" queries in 1–3 s.
const OVERPASS_TIMEOUT_MS = 6000;
const OVERPASS_RETRY_DELAY_MS = 1000;
// After a failure, skip Overpass for a while instead of paying the timeout on every call.
const OVERPASS_COOLDOWN_MS = Number(process.env.PINGMARK_OVERPASS_COOLDOWN_MS) || 5 * 60_000;
let overpassDownUntil = 0;

class OverpassSkipped extends Error {
	constructor() {
		super('Overpass skipped (recently unavailable)');
	}
}

class HttpError extends Error {
	constructor(public readonly status: number, message: string) {
		super(message);
	}
}

// Simple per-host throttle: at most one request per second.
const lastCall = new Map<string, number>();
async function throttle(host: string): Promise<void> {
	const wait = (lastCall.get(host) ?? 0) + 1000 - Date.now();
	if (wait > 0) await new Promise((r) => setTimeout(r, wait));
	lastCall.set(host, Date.now());
}

async function fetchJson(url: string, init: RequestInit = {}, timeoutMs = REQUEST_TIMEOUT_MS): Promise<unknown> {
	await throttle(new URL(url).host);
	const res = await fetch(url, {
		...init,
		headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...(init.headers || {}) },
		signal: AbortSignal.timeout(timeoutMs)
	});
	if (!res.ok) throw new HttpError(res.status, `${new URL(url).host} responded ${res.status} ${res.statusText}`);
	return res.json();
}

// ---------- Reverse geocoding ----------

export type PlaceLevel = 'street' | 'neighbourhood' | 'city' | 'region' | 'country';

// Nominatim zoom per level (see Nominatim reverse API docs).
const ZOOM: Record<PlaceLevel, number> = { street: 17, neighbourhood: 15, city: 10, region: 5, country: 3 };

export interface PlaceDescription {
	label: string;
	level: PlaceLevel;
	address: Record<string, string>;
	country_code?: string;
}

export async function reverseGeocode(p: LatLon, level: PlaceLevel, language = 'en'): Promise<PlaceDescription> {
	const url = new URL('/reverse', NOMINATIM_URL);
	url.searchParams.set('format', 'jsonv2');
	url.searchParams.set('lat', String(p.lat));
	url.searchParams.set('lon', String(p.lon));
	url.searchParams.set('zoom', String(ZOOM[level]));
	url.searchParams.set('addressdetails', '1');
	url.searchParams.set('accept-language', language);

	const data = (await fetchJson(url.toString())) as {
		display_name?: string;
		address?: Record<string, string>;
		error?: string;
	};
	if (data.error) throw new Error(`Nominatim: ${data.error}`);
	const address = data.address ?? {};
	return {
		label: data.display_name ?? 'Unknown place',
		level,
		address,
		country_code: address.country_code
	};
}

// ---------- Nearby search ----------

/** Friendly category names mapped to OSM tag filters. */
export const CATEGORIES: Record<string, string[]> = {
	pharmacy: ['amenity=pharmacy'],
	hospital: ['amenity=hospital', 'amenity=clinic'],
	doctor: ['amenity=doctors', 'amenity=clinic'],
	dentist: ['amenity=dentist'],
	cafe: ['amenity=cafe'],
	restaurant: ['amenity=restaurant'],
	fast_food: ['amenity=fast_food'],
	bar: ['amenity=bar', 'amenity=pub'],
	atm: ['amenity=atm'],
	bank: ['amenity=bank'],
	fuel: ['amenity=fuel'],
	ev_charging: ['amenity=charging_station'],
	parking: ['amenity=parking'],
	toilets: ['amenity=toilets'],
	drinking_water: ['amenity=drinking_water'],
	supermarket: ['shop=supermarket', 'shop=convenience'],
	bakery: ['shop=bakery'],
	hotel: ['tourism=hotel', 'tourism=guest_house', 'tourism=hostel'],
	attraction: ['tourism=attraction', 'tourism=museum', 'historic=monument'],
	museum: ['tourism=museum'],
	police: ['amenity=police'],
	post_office: ['amenity=post_office'],
	public_transport: ['public_transport=stop_position', 'highway=bus_stop', 'railway=station', 'railway=tram_stop'],
	playground: ['leisure=playground'],
	park: ['leisure=park'],
	gym: ['leisure=fitness_centre']
};

export interface NearbyPlace {
	name: string;
	country_code?: string;
	lat: number;
	lon: number;
	distance_m: number;
	tags: Record<string, string>;
	osm: string;
}

const TAG_RE = /^[a-z_:]+=[\w\-:;. ]+$/i;
const USEFUL_TAGS = [
	'amenity', 'shop', 'tourism', 'leisure', 'cuisine', 'opening_hours', 'phone', 'website',
	'addr:street', 'addr:housenumber', 'addr:city', 'wheelchair', 'brand', 'operator'
];

interface RawPlace {
	lat: number;
	lon: number;
	country_code?: string;
	tags: Record<string, string>;
	osm: string;
}

async function overpassNearby(center: LatLon, filters: string[], radiusM: number, max: number): Promise<RawPlace[]> {
	const around = `(around:${Math.round(radiusM)},${center.lat},${center.lon})`;
	const clauses = filters
		.map((f) => {
			const [k, v] = f.split('=');
			return `nwr["${k}"="${v}"]${around};`;
		})
		.join('');
	const query = `[out:json][timeout:10];(${clauses});out center tags ${max};`;
	const body = new URLSearchParams({ data: query }).toString();

	if (Date.now() < overpassDownUntil) throw new OverpassSkipped();

	let lastErr: unknown;
	for (const endpoint of OVERPASS_URLS) {
		for (let attempt = 0; attempt < 2; attempt++) {
			// Retry once, and only after a quick HTTP error (429/502/504);
			// a timeout means the server is saturated, so move on.
			if (attempt > 0) {
				if (!(lastErr instanceof HttpError)) break;
				await new Promise((r) => setTimeout(r, OVERPASS_RETRY_DELAY_MS));
			}
			try {
				const data = (await fetchJson(
					endpoint,
					{ method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body },
					OVERPASS_TIMEOUT_MS
				)) as {
					elements?: Array<{ type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }>;
				};
				const out: RawPlace[] = [];
				for (const el of data.elements ?? []) {
					const lat = el.lat ?? el.center?.lat;
					const lon = el.lon ?? el.center?.lon;
					if (lat === undefined || lon === undefined) continue;
					out.push({ lat, lon, tags: el.tags ?? {}, osm: `https://www.openstreetmap.org/${el.type}/${el.id}` });
				}
				return out;
			} catch (err) {
				lastErr = err;
			}
		}
	}
	overpassDownUntil = Date.now() + OVERPASS_COOLDOWN_MS;
	throw lastErr instanceof Error ? lastErr : new Error('Overpass unavailable');
}

// Fallback: Nominatim structured search by POI type inside a bounding box.
// Less complete than Overpass (max 40 results per type) but far more available.
async function nominatimNearby(center: LatLon, filters: string[], radiusM: number): Promise<RawPlace[]> {
	const dLat = radiusM / 111320;
	const dLon = radiusM / (111320 * Math.max(0.01, Math.cos((center.lat * Math.PI) / 180)));
	const viewbox = [center.lon - dLon, center.lat + dLat, center.lon + dLon, center.lat - dLat].join(',');
	const out: RawPlace[] = [];
	for (const f of filters) {
		const [key, value] = f.split('=');
		const url = new URL('/search', NOMINATIM_URL);
		url.searchParams.set('format', 'jsonv2');
		url.searchParams.set('amenity', value);
		url.searchParams.set('viewbox', viewbox);
		url.searchParams.set('bounded', '1');
		url.searchParams.set('limit', '40');
		url.searchParams.set('extratags', '1');
		url.searchParams.set('addressdetails', '1');
		const data = (await fetchJson(url.toString())) as Array<{
			lat: string; lon: string; name?: string; category?: string; type?: string; osm_type?: string; osm_id?: number;
			extratags?: Record<string, string> | null; address?: Record<string, string>;
		}>;
		for (const r of data) {
			if (r.category !== key || r.type !== value) continue;
			const tags: Record<string, string> = { ...(r.extratags ?? {}), [key]: value };
			if (r.name) tags.name = r.name;
			if (r.address?.road) tags['addr:street'] = r.address.road;
			if (r.address?.house_number) tags['addr:housenumber'] = r.address.house_number;
			if (r.address?.city) tags['addr:city'] = r.address.city;
			out.push({ lat: Number(r.lat), lon: Number(r.lon), country_code: r.address?.country_code, tags, osm: `https://www.openstreetmap.org/${r.osm_type}/${r.osm_id}` });
		}
	}
	return out;
}

/** All matching places within radiusM, nearest first. */
export async function findNearby(
	center: LatLon,
	filters: string[],
	radiusM: number,
	nameContains?: string
): Promise<{ places: NearbyPlace[]; source: 'overpass' | 'nominatim' }> {
	for (const f of filters) if (!TAG_RE.test(f)) throw new Error(`Invalid OSM tag filter: ${f}`);

	let raw: RawPlace[];
	let source: 'overpass' | 'nominatim' = 'overpass';
	try {
		raw = await overpassNearby(center, filters, radiusM, 100);
	} catch (err) {
		if (!(err instanceof OverpassSkipped)) {
			console.error(`[pingmark-mcp] Overpass failed (${(err as Error).message}); using Nominatim for ${OVERPASS_COOLDOWN_MS / 60000} min`);
		}
		raw = await nominatimNearby(center, filters, radiusM);
		source = 'nominatim';
	}

	const needle = nameContains?.toLocaleLowerCase();
	const seen = new Set<string>();
	const places: NearbyPlace[] = [];
	for (const r of raw) {
		if (seen.has(r.osm)) continue;
		seen.add(r.osm);
		const name = r.tags.name || r.tags.brand || r.tags.operator || '';
		if (needle && !name.toLocaleLowerCase().includes(needle)) continue;
		const distance_m = Math.round(distanceMeters(center, r));
		if (distance_m > radiusM) continue;
		const tags: Record<string, string> = {};
		for (const k of USEFUL_TAGS) if (r.tags[k]) tags[k] = r.tags[k];
		places.push({ name: name || '(unnamed)', lat: r.lat, lon: r.lon, country_code: r.country_code, distance_m, tags, osm: r.osm });
	}
	places.sort((a, b) => a.distance_m - b.distance_m);
	return { places, source };
}
