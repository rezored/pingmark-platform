# @pingmark/mcp-server

Consent-first location for AI assistants, built on the Pingmark `!@` syntax.

`@` names a person, `#` names a topic, `!@` names a place. With this MCP server, any MCP client (Claude Desktop, Claude Code, Cursor and others) understands `!@` in a prompt:

> **You:** Is there a pharmacy open near me? !@~
> **Assistant:** *(asks for your location; you share it at neighbourhood level)* The closest is "Remedium", about 300 m north, open until 21:00 (!@42.69375,23.32101).

## The syntax the assistant learns

| You write | Meaning |
|---|---|
| `!@` | my current location (exact) |
| `!@~` | roughly where I am (~1 km) |
| `!@~~` | my city (~10 km) |
| `!@42.6977,23.3219` | this specific place |
| `https://pingmark.me/…`, `geo:…` | this specific place |

## Consent and privacy

The server never reads your location on its own. When the assistant needs it, `request_location` opens a one-time page on `127.0.0.1` in your browser:

- It shows **why** the assistant is asking, in the assistant's own words.
- **You** choose the precision: exact, street, neighbourhood or city.
- Coordinates are **rounded in your browser** before they are sent, and rounded again on the server.
- The page accepts one answer, only from itself (Origin check), and expires after 90 seconds.
- Places are described only as precisely as they were shared. A neighbourhood-level location is never turned into a street address.

## Tools

| Tool | What it does |
|---|---|
| `request_location` | Ask the user for their location through the consent page |
| `parse_pingmarks` | Find `!@` tokens, pingmark links, `geo:` URIs and bare `!@` in text |
| `describe_location` | Coordinates to words: neighbourhood, city, region (OpenStreetMap Nominatim) |
| `find_nearby` | Pharmacies, cafés, ATMs, EV chargers and more, nearest first, each with a `!@` token and `open_now` / `closes_at` evaluated in the place's own time zone (public holidays included). Widens the radius automatically when too little is found; `only_open` keeps only places open right now |
| `distance` | Distance, compass direction and walking estimate between two places |
| `format_pingmark` | `!@` token plus pingmark, `geo:`, OpenStreetMap and Google Maps links |

## Install

**Claude Code**

```bash
claude mcp add pingmark -- npx -y @pingmark/mcp-server
```

**Claude Desktop** (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "pingmark": {
      "command": "npx",
      "args": ["-y", "@pingmark/mcp-server"]
    }
  }
}
```

Requires Node.js 18 or newer.

**From source** (this repo)

```bash
npm install
npm run build:mcp
claude mcp add pingmark -- node /absolute/path/to/pingmark-platform/packages/mcp-server/dist/index.js
```

## Configuration

| Variable | Purpose |
|---|---|
| `PINGMARK_LOCATION` | Fixed `lat,lon` to use instead of asking. For headless setups and demos. It is still rounded to the requested precision |
| `PINGMARK_NO_BROWSER` | Don't open the browser. The consent URL is printed to stderr |
| `PINGMARK_CONSENT_TIMEOUT_MS` | How long to wait for the user (default 90000) |
| `PINGMARK_NOMINATIM_URL` | Self-hosted Nominatim |
| `PINGMARK_OVERPASS_URL` | Self-hosted Overpass, or a comma-separated list of endpoints to try |

## Data sources and limits

Map data © OpenStreetMap contributors (ODbL). The public Nominatim and Overpass services are for light use only. The server identifies itself and keeps to 1 request per second per host.

The public Overpass instance is often at capacity. When it fails, the server skips it for 5 minutes (`PINGMARK_OVERPASS_COOLDOWN_MS`) and `find_nearby` uses Nominatim, which is less complete (at most 40 results per category). **Any hosted or commercial deployment must use its own Nominatim and Overpass instances.**

## Dependencies

`opening_hours` (LGPL-3.0) is used unmodified as an npm dependency to evaluate OSM opening hours. `@photostructure/tz-lookup` (CC0) maps coordinates to time zones.

## Tests

```bash
npm run build && npm test                      # offline + opening-hours unit tests
PINGMARK_TEST_ONLINE=1 npm test                # also hits OpenStreetMap
```
