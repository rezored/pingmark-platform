"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  format: () => format,
  parse: () => parse,
  parseFromPath: () => parseFromPath,
  toGeoURI: () => toGeoURI,
  toURL: () => toURL
});
module.exports = __toCommonJS(index_exports);

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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  format,
  parse,
  parseFromPath,
  toGeoURI,
  toURL
});
