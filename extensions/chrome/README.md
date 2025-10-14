# Pingmark Type-to-Link (Chrome, MV3)

**Goal**: When you type `!@`, automatically insert your current coordinates **and** an ISO-8601 UTC timestamp as a **link**.

- In `<input>`/`<textarea>`: `!@` expands to a full URL (plain text), e.g. `https://pingmark.me/42.697700/23.321900/2025-10-14T18:00:00.000Z`
- In rich text (`contentEditable`): `!@` becomes a clickable `<a>` with the same URL.

This follows your PPS design: `!@` is the trigger; the client generates the lat/lon and optional timestamp locally. The resolver URL format is `https://pingmark.me/<latitude>/<longitude>[/<timestamp>]`.

## Install (Developer Mode)
1. Unzip and go to `chrome://extensions`.
2. Enable **Developer mode** and click **Load unpacked**.
3. Select the folder.

Geolocation prompts will come from the page origin the first time `!@` is expanded.

## Notes
- Rounds lat/lon to 6 decimals.
- Uses `navigator.geolocation.getCurrentPosition` with a 10s timeout.
- Minimal UI (no popups/options). If geolocation fails, `!@` stays unchanged.
- Works in most editors and inputs; for very custom editors, behavior depends on how they handle text.

## Roadmap
- Options (toggle timestamp, choose ISO vs epoch).
- One-shot permission/status indicator.
- Batch replace of `!@` in static pages.