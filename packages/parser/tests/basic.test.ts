import { describe, it, expect } from "vitest";
import { parsePingmarks } from "../src";

describe("parser", () => {
	it("parses lat/lon and builds canonical url", () => {
		const t = "Meet here !@ 42.6977,23.3219; 2025-10-14T12:00:00Z";
		const r = parsePingmarks(t);
		expect(r[0].lat).toBeCloseTo(42.6977, 6);
		expect(r[0].lon).toBeCloseTo(23.3219, 6);
		expect(r[0].url).toContain("https://pingmark.me/42.6977/23.3219");
	});
});