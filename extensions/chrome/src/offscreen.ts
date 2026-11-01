/**
 * Offscreen document: the only place navigator.geolocation is called.
 * Runs on the extension origin, which holds the "geolocation" permission.
 */

import { MSG_OFFSCREEN_GET_LOCATION, OFFSCREEN_TARGET, type LocationResponse } from './messages';

const GEO_TIMEOUT_MS = 20000;
const GEO_MAX_AGE_MS = 60000;

function getPosition(highAccuracy: boolean): Promise<GeolocationPosition> {
	return new Promise((resolve, reject) => {
		navigator.geolocation.getCurrentPosition(resolve, reject, {
			enableHighAccuracy: highAccuracy,
			maximumAge: GEO_MAX_AGE_MS,
			timeout: highAccuracy ? GEO_TIMEOUT_MS : GEO_TIMEOUT_MS * 2
		});
	});
}

async function locate(): Promise<LocationResponse> {
	if (!('geolocation' in navigator)) return { ok: false, error: 'Geolocation unavailable' };
	try {
		let pos: GeolocationPosition;
		try {
			pos = await getPosition(true);
		} catch (err) {
			// Permission denied will not improve with low accuracy; anything else might.
			if ((err as GeolocationPositionError)?.code === 1) throw err;
			pos = await getPosition(false);
		}
		const { latitude, longitude, accuracy } = pos.coords;
		return { ok: true, latitude, longitude, accuracy };
	} catch (err) {
		const e = err as GeolocationPositionError;
		return { ok: false, error: e?.message || 'Location unavailable' };
	}
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	if (message?.target !== OFFSCREEN_TARGET || message?.type !== MSG_OFFSCREEN_GET_LOCATION) return;
	locate().then(sendResponse);
	return true;
});
