// Geometry and privacy helpers shared by all Pingmark clients.

/**
 * How precisely a location is disclosed. Coarser levels are produced by
 * rounding coordinates, so the exact point never leaves the device.
 *
 *  exact   ~1 m      (5 decimals)   token: !@
 *  street  ~100 m    (3 decimals)
 *  area    ~1 km     (2 decimals)   token: !@~
 *  city    ~10 km    (1 decimal)    token: !@~~
 */
export type Precision = 'exact' | 'street' | 'area' | 'city';

export const PRECISION_DECIMALS: Record<Precision, number> = {
	exact: 5,
	street: 3,
	area: 2,
	city: 1
};

/** Approximate radius of uncertainty, in metres, introduced by each level. */
export const PRECISION_RADIUS_M: Record<Precision, number> = {
	exact: 1,
	street: 100,
	area: 1000,
	city: 10000
};

export const PRECISIONS: readonly Precision[] = ['exact', 'street', 'area', 'city'];

export function isPrecision(v: unknown): v is Precision {
	return typeof v === 'string' && (PRECISIONS as readonly string[]).includes(v);
}

/** The less precise of two levels: disclosure can only be narrowed, never widened. */
export function coarserPrecision(a: Precision, b: Precision): Precision {
	return PRECISIONS.indexOf(a) >= PRECISIONS.indexOf(b) ? a : b;
}

/**
 * The finest level a coordinate written with this many decimals can support.
 * Four decimals (~10 m) still count as exact, so hand-typed points are not downgraded.
 */
export function precisionForDecimals(decimals: number): Precision {
	return decimals >= 4 ? 'exact' : decimals === 3 ? 'street' : decimals === 2 ? 'area' : 'city';
}

export interface LatLon {
	lat: number;
	lon: number;
}

export function isValidLatLon(lat: number, lon: number): boolean {
	return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

/** Round a point to the given disclosure level. */
export function coarsen<T extends LatLon>(p: T, precision: Precision): T {
	const d = PRECISION_DECIMALS[precision];
	const f = 10 ** d;
	return { ...p, lat: Math.round(p.lat * f) / f, lon: Math.round(p.lon * f) / f };
}

const EARTH_RADIUS_M = 6371008.8;
const toRad = (deg: number): number => (deg * Math.PI) / 180;
const toDeg = (rad: number): number => (rad * 180) / Math.PI;

/** Great-circle distance in metres (haversine). */
export function distanceMeters(a: LatLon, b: LatLon): number {
	const dLat = toRad(b.lat - a.lat);
	const dLon = toRad(b.lon - a.lon);
	const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
	return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing from a to b, degrees clockwise from north (0–360). */
export function bearingDegrees(a: LatLon, b: LatLon): number {
	const y = Math.sin(toRad(b.lon - a.lon)) * Math.cos(toRad(b.lat));
	const x =
		Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
		Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lon - a.lon));
	return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

export function compassDirection(bearing: number): (typeof COMPASS)[number] {
	return COMPASS[Math.round(bearing / 45) % 8];
}
