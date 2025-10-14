import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import resolveRoutes from "../apps/api/src/routes/resolve";

describe("api /resolve", () => {
	it("parses pingmark and returns matches", async () => {
		const app = Fastify();
		await app.register(resolveRoutes, { prefix: "/api" });
		const res = await app.inject({
			method: "GET",
			url: "/api/resolve?text=!@%2042.6977,23.3219"
		});
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body).not.toBeNull();
		expect(body.matches?.[0]?.url).toContain("/42.6977/23.3219");
	});
});