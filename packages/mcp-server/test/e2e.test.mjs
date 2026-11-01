// End-to-end: spawn the built server over stdio and drive it with the MCP client.
// Run `npm run build` first. Set PINGMARK_TEST_ONLINE=1 to include OpenStreetMap calls.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const SERVER = fileURLToPath(new URL('../dist/index.js', import.meta.url));
const ONLINE = process.env.PINGMARK_TEST_ONLINE === '1';

async function connect(env = {}) {
	const transport = new StdioClientTransport({
		command: process.execPath,
		args: [SERVER],
		env: { ...process.env, PINGMARK_NO_BROWSER: '1', ...env },
		stderr: 'pipe'
	});
	const client = new Client({ name: 'pingmark-e2e', version: '0' });
	await client.connect(transport);
	return { client, transport };
}

async function call(client, name, args) {
	const r = await client.callTool({ name, arguments: args });
	return { ...r, data: r.structuredContent };
}

function consentUrl(transport) {
	return new Promise((resolve) => {
		transport.stderr.on('data', (b) => {
			const m = String(b).match(/consent page: (http:\/\/127\.0\.0\.1:\d+\/s\/[0-9a-f]+)/);
			if (m) resolve(m[1]);
		});
	});
}

function post(url, body, origin = new URL(url).origin) {
	return fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Origin: origin },
		body: JSON.stringify(body)
	});
}

test('lists tools and exposes instructions', async () => {
	const { client } = await connect();
	const { tools } = await client.listTools();
	assert.deepEqual(tools.map((t) => t.name).sort(), [
		'describe_location', 'distance', 'find_nearby', 'format_pingmark', 'parse_pingmarks', 'request_location'
	]);
	assert.match(client.getInstructions() ?? '', /!@/);
	await client.close();
});

test('parse_pingmarks finds tokens, links, geo URIs and bare !@, ignores passwords', async () => {
	const { client } = await connect();
	const { data } = await call(client, 'parse_pingmarks', {
		text: 'аптека наблизо !@~ или при !@42.6977,23.3219, виж https://map.pingmark.me/43.0842/25.655 geo:43.2,27.9 Pass!@# hey!@john'
	});
	assert.equal(data.wants_current_location, true);
	assert.deepEqual(
		data.mentions.map((m) => `${m.kind}:${m.source ?? '-'}:${m.precision}`),
		['here:-:area', 'point:token:exact', 'point:url:exact', 'point:geo-uri:exact']
	);
	await client.close();
});

test('distance and format_pingmark', async () => {
	const { client } = await connect();
	const d = await call(client, 'distance', { from: '!@42.6977,23.3219', to: 'geo:43.0842,25.655' });
	assert.ok(d.data.distance_km > 190 && d.data.distance_km < 200, `got ${d.data.distance_km}`);
	assert.equal(d.data.direction, 'E');
	const f = await call(client, 'format_pingmark', { lat: 42.697712, lon: 23.321934, precision: 'area' });
	assert.equal(f.data.token, '!@~42.7,23.32');
	await client.close();
});

test('bare !@ passed as a location is rejected with guidance', async () => {
	const { client } = await connect();
	const r = await call(client, 'distance', { from: '!@', to: '42,23' });
	assert.equal(r.isError, true);
	assert.match(r.content[0].text, /request_location/);
	await client.close();
});

test('request_location uses PINGMARK_LOCATION and coarsens it', async () => {
	const { client } = await connect({ PINGMARK_LOCATION: '42.697712,23.321934' });
	const { data } = await call(client, 'request_location', { reason: 'Find a pharmacy', precision: 'city' });
	assert.equal(data.status, 'shared');
	assert.equal(data.token, '!@~~42.7,23.3');
	assert.equal(data.uncertainty_m, 10000);
	await client.close();
});

test('consent page: escapes reason, blocks foreign origins, rounds server-side, single use', async () => {
	const { client, transport } = await connect();
	const urlP = consentUrl(transport);
	const resultP = call(client, 'request_location', { reason: 'Тест <script>x</script>', precision: 'area' });
	const url = await urlP;

	const html = await (await fetch(url)).text();
	assert.match(html, /Тест &lt;script&gt;x&lt;\/script&gt;/);

	assert.equal((await post(url, { action: 'decline' }, 'http://evil.example')).status, 403);
	assert.equal((await post(url, { action: 'share', lat: 999, lon: 0, precision: 'area' })).status, 400);
	// Page claims "area" but sends exact coordinates: the server must still round.
	assert.equal((await post(url, { action: 'share', lat: 42.697712, lon: 23.321934, precision: 'area', accuracy: 20 })).status, 200);

	const { data } = await resultP;
	assert.equal(data.status, 'shared');
	assert.equal(data.token, '!@~42.7,23.32');
	assert.equal(data.uncertainty_m, 1000);
	await client.close();
});

test('consent page: decline', async () => {
	const { client, transport } = await connect();
	const urlP = consentUrl(transport);
	const resultP = call(client, 'request_location', { reason: 'Weather', precision: 'city' });
	const url = await urlP;
	assert.equal((await post(url, { action: 'decline' })).status, 200);
	const { data } = await resultP;
	assert.equal(data.status, 'declined');
	await client.close();
});

const onlineOpts = { skip: !ONLINE && 'set PINGMARK_TEST_ONLINE=1', timeout: 90_000 };

test('online: describe_location never exceeds the shared precision', onlineOpts, async () => {
	const { client } = await connect();
	try {
		const place = await call(client, 'describe_location', { location: '!@~42.6977,23.3219', language: 'bg', level: 'street' });
		assert.ok(!place.isError, place.content?.[0]?.text);
		assert.match(place.data.label, /София|Sofia/);
		assert.equal(place.data.level, 'neighbourhood', 'coarse input must not be described at street level');
	} finally {
		await client.close();
	}
});

test('online: find_nearby returns sorted places with pingmark tokens', onlineOpts, async () => {
	const { client } = await connect();
	try {
		const near = await call(client, 'find_nearby', { location: '42.6977,23.3219', category: 'pharmacy', radius_m: 800, limit: 3 });
		assert.ok(!near.isError, near.content?.[0]?.text);
		assert.ok(near.data.count > 0, 'expected pharmacies in central Sofia');
		assert.ok(near.data.places.every((p, i, a) => i === 0 || a[i - 1].distance_m <= p.distance_m), 'sorted by distance');
		assert.ok(near.data.places.every((p) => p.distance_m <= 800), 'within radius');
		assert.match(near.data.places[0].token, /^!@42\./);
		assert.match(near.data.time_zone, /Europe\/Sofia/);
		assert.ok(near.data.places.every((p) => p.open_now === true || p.open_now === false || p.open_now === null));
		console.log(`  find_nearby source: ${near.data.data_source}; nearest: ${near.data.places[0].name} (${near.data.places[0].distance_m} m)`);
	} finally {
		await client.close();
	}
});
