// Message contract between content script, service worker and offscreen document.

export const MSG_GET_LOCATION = 'pm:getLocation';
export const MSG_OFFSCREEN_GET_LOCATION = 'pm:offscreen:getLocation';
export const OFFSCREEN_TARGET = 'pm-offscreen';

export type LocationResponse =
	| { ok: true; latitude: number; longitude: number; accuracy: number }
	| { ok: false; error: string };
