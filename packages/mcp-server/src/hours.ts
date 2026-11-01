// "Is it open now?" evaluated in the place's own time zone, not the server's.
//
// opening_hours.js evaluates against a JS Date in the *process* time zone, so we
// build a Date whose local wall-clock fields equal the place's wall-clock time,
// evaluate, and read results back as wall-clock fields.

import OpeningHours from 'opening_hours';
import tzlookup from '@photostructure/tz-lookup';

export interface PlaceClock {
	time_zone: string;
	/** e.g. "Sun 18:22" in the place's time zone. */
	local_time: string;
	/** Process-local Date carrying the place's wall-clock time. */
	wall: Date;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const pad = (n: number): string => String(n).padStart(2, '0');

export function placeClock(lat: number, lon: number, now: Date = new Date()): PlaceClock {
	let time_zone: string;
	try {
		time_zone = tzlookup(lat, lon);
	} catch {
		time_zone = 'UTC';
	}
	const parts = Object.fromEntries(
		new Intl.DateTimeFormat('en-US', {
			timeZone: time_zone,
			hourCycle: 'h23',
			year: 'numeric',
			month: 'numeric',
			day: 'numeric',
			hour: 'numeric',
			minute: 'numeric',
			second: 'numeric'
		})
			.formatToParts(now)
			.map((p) => [p.type, p.value])
	);
	const wall = new Date(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
	return { time_zone, wall, local_time: formatWall(wall) };
}

function formatWall(d: Date): string {
	return `${WEEKDAYS[d.getDay()]} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export interface OpenState {
	/** true/false when known; null when the hours can't be evaluated or are marked unknown. */
	open_now: boolean | null;
	/** Next opening or closing, as wall-clock time at the place, e.g. "Sun 20:00". */
	closes_at?: string;
	opens_at?: string;
	hours_comment?: string;
	hours_error?: string;
}

/**
 * Evaluate an OSM opening_hours value at the place's current local time.
 * countryCode enables public-holiday rules (PH); without it such values return null.
 */
export function evaluateOpeningHours(
	value: string | undefined,
	lat: number,
	lon: number,
	clock: PlaceClock,
	countryCode?: string
): OpenState {
	if (!value) return { open_now: null };
	try {
		const oh = new OpeningHours(
			value,
			{ lat, lon, address: { country_code: (countryCode || '').toLowerCase(), state: '' } },
			{ mode: 0, tag_key: 'opening_hours', map_value: true, warnings_severity: undefined, locale: 'en' }
		);
		const comment = oh.getComment(clock.wall);
		if (oh.getUnknown(clock.wall)) return { open_now: null, ...(comment && { hours_comment: comment }) };

		const open = oh.getState(clock.wall);
		// Look at most 8 days ahead for the next change.
		const next = oh.getNextChange(clock.wall, new Date(clock.wall.getTime() + 8 * 86400_000));
		const nextLabel = next ? formatWall(next) : undefined;
		return {
			open_now: open,
			...(nextLabel && (open ? { closes_at: nextLabel } : { opens_at: nextLabel })),
			...(comment && { hours_comment: comment })
		};
	} catch (err) {
		return { open_now: null, hours_error: String((err as Error)?.message ?? err).split('\n')[0].slice(0, 160) };
	}
}

/** Whether evaluating this value needs a country (public holidays, school holidays). */
export function needsCountry(value: string | undefined): boolean {
	return !!value && /\b(PH|SH)\b/.test(value);
}
