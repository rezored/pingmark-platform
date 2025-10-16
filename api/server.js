import Fastify from "fastify";
import cors from "@fastify/cors";

// Simple pingmark parser (embedded)
const TS_ISO = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?/;
const TS_UNIX = /^(\d{10})(\d{3})?$/;

function parsePingmarks(text) {
    const matches = [];
    const regex = /!@\s*([+-]?\d+\.?\d*)\s*,\s*([+-]?\d+\.?\d*)(?:\s*;\s*([^,\s]+))?/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
        const lat = parseFloat(match[1]);
        const lon = parseFloat(match[2]);
        const timestamp = match[3] ? normalizeTimestamp(match[3]) : undefined;

        if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
            matches.push({
                lat,
                lon,
                timestamp,
                text: match[0],
                startIndex: match.index,
                endIndex: match.index + match[0].length
            });
        }
    }

    return matches;
}

function normalizeTimestamp(ts) {
    if (!ts) return undefined;
    if (typeof ts === 'number') return Math.floor(ts);
    const s = String(ts).trim();
    if (TS_UNIX.test(s)) return s.length > 10 ? Math.floor(Number(s) / 1000) : Number(s);
    if (TS_ISO.test(s)) {
        const t = Date.parse(s);
        if (!isNaN(t)) return Math.floor(t / 1000);
    }
    return undefined;
}

// Create Fastify server
const server = Fastify({
    logger: {
        level: process.env.LOG_LEVEL || "info",
        transport: process.env.NODE_ENV === "production" ? undefined : { target: "pino-pretty" }
    }
});

// Register CORS
await server.register(cors, {
    origin: [
        'https://pingmark.me',
        'https://www.pingmark.me',
        'https://map.pingmark.me',
        'https://api.pingmark.me',
        'http://localhost:5173', // Landing dev
        'http://localhost:5174', // Viewer dev
        'http://localhost:5175'  // API dev
    ],
    credentials: true
});

// API Routes
server.get("/api/resolve", async (req, reply) => {
    const q = req.query;
    if (!q.text || !q.text.trim()) {
        return reply.code(400).send({ error: "Missing query param 'text' with a string containing a pingmark." });
    }
    const hits = parsePingmarks(q.text);
    if (!hits.length) {
        return reply.code(404).send({ error: "No pingmark found", sample: "!@ 42.6977,23.3219; 2025-10-14T12:00:00Z" });
    }
    return { matches: hits };
});

server.get("/:lat/:lon/:ts?", async (req, reply) => {
    const { lat, lon, ts } = req.params;
    const nLat = Number(lat), nLon = Number(lon);
    if (isNaN(nLat) || isNaN(nLon) || nLat < -90 || nLat > 90 || nLon < -180 || nLon > 180) {
        return reply.code(400).send({ error: "Invalid coordinates" });
    }
    const tsSec = normalizeTimestamp(ts);
    const url = `https://map.pingmark.me/${nLat.toFixed(6)}/${nLon.toFixed(6)}${tsSec ? `/${tsSec}` : ""}`;
    return { lat: Number(nLat.toFixed(6)), lon: Number(nLon.toFixed(6)), timestamp: tsSec, url };
});

// Health check
server.get("/healthz", async () => ({ ok: true }));

// Start server
const port = Number(process.env.PORT || 4102);
server
    .listen({ port, host: "0.0.0.0" })
    .then(() => console.log(`Pingmark API running on http://localhost:${port}`))
    .catch((e) => { console.error(e); process.exit(1); });
