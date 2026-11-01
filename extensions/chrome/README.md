# Pingmark Type-to-Link (Chrome, MV3)

Type `!@`, confirm, and the token becomes a link with your current coordinates and an ISO-8601 UTC timestamp, e.g.
`https://map.pingmark.me/42.6977/23.3219/2025-10-14T18%3A00%3A00.000Z`.

## How it works

1. Type `!@` as a standalone token: at the start of the text, after a space, or after an opening bracket/quote.
2. A small prompt appears: **📍 Share your location here?** Press **Tab** or click **Share** to confirm. Press **Esc**, or just keep typing, to dismiss.
3. Only after you confirm does the extension read the location and replace `!@` with the link.

## Privacy rules

- **Never in sensitive fields.** The extension works only in `<textarea>`, `<input type="text|search">` and rich-text editors. It skips password, email, number, URL and phone fields, and fields with `autocomplete` set to password, one-time-code or credit-card values.
- **No accidental triggers.** `Pass!@#`, `hey!@john` and `Arrived!@` do nothing: the token must stand alone, and typing anything after it cancels the prompt.
- **No permission leaks to websites.** Location is read by the extension itself, in an offscreen document under the extension's `geolocation` permission. The website you type on never gets location access.
- **Explicit consent every time.** Nothing is read until you confirm.

## Build and install (Developer Mode)

```bash
npm install          # from the repo root (workspaces)
npm run build:extension
```

1. Open `chrome://extensions` and enable **Developer mode**.
2. Click **Load unpacked** and select `extensions/chrome`.

Requires Chrome 116+. On install, Chrome shows the "Detect your physical location" permission.

## Files

- `src/content.ts`: trigger detection, confirmation prompt, replacement, link preview cards
- `src/background.ts`: service worker that brokers location requests
- `src/offscreen.ts` + `offscreen.html`: the only place `navigator.geolocation` is called
