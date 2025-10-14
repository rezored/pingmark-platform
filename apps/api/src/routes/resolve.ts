import {FastifyInstance} from "fastify";
import {parsePingmarks} from "@pingmark/parser";

export default async function routes(f: FastifyInstance) {
	f.get("/resolve", async (req, reply) => {
		const q = req.query as { text?: string };
		if (!q.text || !q.text.trim()) {
			return reply.code(400).send({error: "Missing query param 'text' with a string containing a pingmark."});
		}
		const hits = parsePingmarks(q.text);
		if (!hits.length) {
			return reply.code(404).send({error: "No pingmark found", sample: "!@ 42.6977,23.3219; 2025-10-14T12:00:00Z"});
		}
		return {matches: hits};
	});
	
	f.get<{ Params: { lat: string; lon: string; ts?: string } }>("/:lat/:lon/:ts?", async (req, reply) => {
		const {lat, lon, ts} = req.params;
		const nLat = Number(lat), nLon = Number(lon);
		if (isNaN(nLat) || isNaN(nLon) || nLat < -90 || nLat > 90 || nLon < -180 || nLon > 180) {
			return reply.code(400).send({error: "Invalid coordinates"});
		}
		const url = `https://pingmark.me/${nLat.toFixed(6)}/${nLon.toFixed(6)}${ts ? `/${Number(ts)}` : ""}`;
		return {lat: Number(nLat.toFixed(6)), lon: Number(nLon.toFixed(6)), timestamp: ts ? Number(ts) : undefined, url};
	});
}