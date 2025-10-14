import {FastifyInstance} from "fastify";

const HTML = (lat: number, lon: number) => `<!doctype html>
<html><head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <style>#map{height:100vh;margin:0}</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  const map = L.map('map').setView([${lat}, ${lon}], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
  L.marker([${lat}, ${lon}]).addTo(map);
</script>
</body></html>`;

export default async function routes(f: FastifyInstance) {
	f.get<{ Params: { lat: string; lon: string } }>("/preview/:lat/:lon", async (req, reply) => {
		const lat = Number(req.params.lat), lon = Number(req.params.lon);
		reply.header("content-type", "text/html; charset=utf-8");
		return HTML(lat, lon);
	});
}