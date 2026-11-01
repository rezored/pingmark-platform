/**
 * Service worker: brokers location requests from content scripts to an
 * offscreen document. Geolocation is requested under the *extension's* own
 * permission, so typing !@ on a site never grants that site location access.
 */

import { MSG_GET_LOCATION, MSG_OFFSCREEN_GET_LOCATION, OFFSCREEN_TARGET, type LocationResponse } from './messages';

const OFFSCREEN_URL = 'offscreen.html';

let creating: Promise<void> | null = null;

async function ensureOffscreenDocument(): Promise<void> {
	if (await chrome.offscreen.hasDocument()) return;
	if (!creating) {
		creating = chrome.offscreen
			.createDocument({
				url: OFFSCREEN_URL,
				reasons: [chrome.offscreen.Reason.GEOLOCATION],
				justification: 'Read the device location when the user confirms a !@ pingmark.'
			})
			.finally(() => {
				creating = null;
			});
	}
	await creating;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	if (message?.type !== MSG_GET_LOCATION) return;

	(async () => {
		try {
			await ensureOffscreenDocument();
			const res = await chrome.runtime.sendMessage<LocationResponse>({
				type: MSG_OFFSCREEN_GET_LOCATION,
				target: OFFSCREEN_TARGET
			});
			sendResponse(res ?? { ok: false, error: 'No response from offscreen document' });
		} catch (err) {
			sendResponse({ ok: false, error: String(err) } satisfies LocationResponse);
		}
	})();

	return true; // async response
});
