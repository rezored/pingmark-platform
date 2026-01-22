// src/parse.ts
var PM_RE = /!@\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)(?:\/([A-Za-z0-9:.+_-]+))?/;
function parse(text) {
  const m = text.match(PM_RE);
  if (!m) return null;
  const lat = Number(m[1]), lon = Number(m[2]);
  const ts = m[3];
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return ts ? { lat, lon, ts } : { lat, lon };
}
function parseFromPath(segments) {
  const [latS, lonS, ts] = segments;
  const lat = Number(latS), lon = Number(lonS);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error("Invalid coordinates");
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) throw new Error("Out of range");
  return ts ? { lat, lon, ts: decodeURIComponent(ts) } : { lat, lon };
}

// src/url.ts
function format(p) {
  const base = `!@${p.lat},${p.lon}`;
  return p.ts ? `${base}/${p.ts}` : base;
}
function toURL(p, base = "https://map.pingmark.me") {
  const path = p.ts ? `/${p.lat}/${p.lon}/${encodeURIComponent(p.ts)}` : `/${p.lat}/${p.lon}`;
  return `${base}${path}`;
}
function toGeoURI(p) {
  return `geo:${p.lat},${p.lon}`;
}
export {
  format,
  parse,
  parseFromPath,
  toGeoURI,
  toURL
};
