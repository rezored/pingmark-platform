// Unit tests for open-now evaluation. Bundles src/hours.ts on the fly with esbuild.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = `${root}test/.tmp/hours.mjs`;
let H;

before(async () => {
	mkdirSync(`${root}test/.tmp`, { recursive: true });
	await esbuild.build({
		entryPoints: [`${root}src/hours.ts`],
		bundle: true,
		format: 'esm',
		platform: 'node',
		packages: 'external',
		outfile: out,
		logLevel: 'silent'
	});
	H = await import(pathToFileURL(out).href);
});

const SOFIA = { lat: 43.12, lon: 25.68 };
const TOKYO = { lat: 35.68, lon: 139.69 };
// Sunday 1 Nov 2026, 16:22 UTC = 18:22 in Bulgaria (EET), 01:22 Monday in Tokyo.
const SUNDAY_EVENING = new Date('2026-11-01T16:22:00Z');

const at = (place, value, now = SUNDAY_EVENING, cc) =>
	H.evaluateOpeningHours(value, place.lat, place.lon, H.placeClock(place.lat, place.lon, now), cc);

test('local time is computed in the place time zone', () => {
	const c = H.placeClock(SOFIA.lat, SOFIA.lon, SUNDAY_EVENING);
	assert.equal(c.time_zone, 'Europe/Sofia');
	assert.equal(c.local_time, 'Sun 18:22');
	assert.equal(H.placeClock(TOKYO.lat, TOKYO.lon, SUNDAY_EVENING).local_time, 'Mon 01:22');
});

test('closed on Sunday evening, with next opening', () => {
	assert.deepEqual(at(SOFIA, 'Mo-Fr 07:30-20:30; Sa 08:30-20:00; Su 09:00-17:00'), { open_now: false, opens_at: 'Mon 07:30' });
});

test('open every day until 20:00', () => {
	assert.deepEqual(at(SOFIA, 'Mo-Su 08:00-20:00'), { open_now: true, closes_at: 'Sun 20:00' });
});

test('same instant, other side of the world: closed', () => {
	assert.deepEqual(at(TOKYO, 'Mo-Su 08:00-20:00'), { open_now: false, opens_at: 'Mon 08:00' });
});

test('24/7 is open with no next change', () => {
	assert.deepEqual(at(SOFIA, '24/7'), { open_now: true });
});

test('public holidays need a country; with one, Christmas is closed', () => {
	const christmasNoon = new Date('2026-12-25T10:00:00Z'); // Friday 12:00 in Sofia
	assert.equal(at(SOFIA, 'Mo-Fr 08:00-20:00; PH off', christmasNoon, 'bg').open_now, false);
	assert.equal(at(SOFIA, 'Mo-Fr 08:00-20:00; PH off', new Date('2026-12-28T10:00:00Z'), 'bg').open_now, true);
});

test('missing or unparseable hours are unknown, never guessed', () => {
	assert.deepEqual(at(SOFIA, undefined), { open_now: null });
	const bad = at(SOFIA, 'понеделник до петък от 9');
	assert.equal(bad.open_now, null);
	assert.ok(bad.hours_error);
});
