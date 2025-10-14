import Fastify from "fastify";
import cors from "@fastify/cors";
import resolveRoutes from "./routes/resolve.js";
import previewRoutes from "./routes/preview.js";

const server = Fastify({
	logger: {
		level: process.env.LOG_LEVEL || "info",
		transport: process.env.NODE_ENV === "production" ? undefined : { target: "pino-pretty" }
	}
});

await server.register(cors, { origin: true });
await server.register(resolveRoutes, { prefix: "/api" });
await server.register(previewRoutes, { prefix: "/api" });

server.get("/healthz", async () => ({ ok: true }));

const port = Number(process.env.PORT || 5175);
server
	.listen({ port, host: "0.0.0.0" })
	.then(() => console.log(`API on http://localhost:${port}`))
	.catch((e) => { console.error(e); process.exit(1); });