export function canonical(lat: number, lon: number, ts?: number) {
	const L = Number(lat.toFixed(6));
	const G = Number(lon.toFixed(6));
	return `https://pingmark.me/${L}/${G}${ts ? `/${ts}` : ""}`;
}