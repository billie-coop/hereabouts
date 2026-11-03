import { dayFromEpochDay, dayToEpochDay, dayToString, isDay } from './day';
import { isTimeOfDay, timeOfDayFromMillis, timeOfDayToMillis } from './time-of-day';
import type { Instant } from './types';
import { checkInstant, MAX_INSTANT, timeZoneId, timeZoneOffset, wallToInstant } from './zone';

const MS_PER_DAY = 86400000;

// date [T or space] time [offset]
const INSTANT_RE = new RegExp(
  '^([+-]\\d{6}|\\d{4})-(\\d{2})-(\\d{2})[Tt ]' +
    '(\\d{2}):(\\d{2})(?::(\\d{2})(?:[.,](\\d{1,9}))?)?' +
    '(?:([Zz])|([+-])(\\d{2})(?::?(\\d{2})(?::(\\d{2}))?)?)?$',
);

/**
 * Parse an ISO 8601 date and time into an instant: `2026-01-31T09:00:00Z`,
 * `2026-01-31T09:00:00.123-08:00`, `2026-01-31 09:00+0530`, ...
 *
 * Text without a UTC offset or `Z` is a wall clock time, so it needs a zone: pass `zone` to read
 * it there (clock changes resolved as {@link dayAtTime} 'compatible'), otherwise it is rejected.
 * A date alone is a {@link Day}, not an instant: use `dayParse`. Returns undefined for text
 * that isn't valid (including `24:00` and partial forms such as `2026-01`), unlike `Date.parse`,
 * which accepts many forms and reads a date alone as UTC midnight. An unknown `zone` throws a
 * RangeError, like every function that takes a zone. Offsets may include seconds
 * (`+00:09:21`), as historical ones do.
 *
 * @public
 */
export const instantParse = (s: string, zone?: string): Instant | undefined => {
  const m = typeof s === 'string' ? INSTANT_RE.exec(s) : null;
  if (!m || m[1] === '-000000') {
    return undefined;
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  const dd = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = m[6] ? Number(m[6]) : 0;
  const millis = m[7] ? Number((m[7] + '00').slice(0, 3)) : 0;
  const d = { year, month, day: dd };
  const t = { hour, minute, second, millis };
  if (!isDay(d) || !isTimeOfDay(t)) {
    return undefined;
  }

  // Wall clock milliseconds; only the final instant is range checked.
  const wall = dayToEpochDay(d) * MS_PER_DAY + timeOfDayToMillis(t);
  let r: number;
  if (m[8]) {
    r = wall;
  } else if (m[9]) {
    const oh = Number(m[10]);
    const om = m[11] ? Number(m[11]) : 0;
    const os = m[12] ? Number(m[12]) : 0;
    if (oh > 23 || om > 59 || os > 59) {
      return undefined;
    }
    r = wall - ((oh * 60 + om) * 60 + os) * 1000 * (m[9] === '-' ? -1 : 1);
  } else if (zone !== undefined) {
    r = wallToInstant(wall, timeZoneId(zone), 'compatible');
  } else {
    return undefined;
  }
  return isFinite(r) && Math.abs(r) <= MAX_INSTANT ? r : undefined;
};

const pad = (n: number, w: number): string => {
  let s = String(n);
  while (s.length < w) {
    s = '0' + s;
  }
  return s;
};

/**
 * Format an instant as ISO 8601 with milliseconds. Without a zone it is in UTC
 * (`2026-01-31T17:00:00.000Z`, the same as `Date.toISOString()` for whole milliseconds); with a
 * zone it is that zone's wall clock time and offset (`2026-01-31T09:00:00.000-08:00`). An offset
 * with seconds is written with them (`+00:09:21`), so the text always parses back to the same
 * instant.
 *
 * @public
 */
export const instantToString = (instant: Instant, zone?: string): string => {
  checkInstant(instant);
  const offset = zone === undefined ? 0 : timeZoneOffset(zone, instant);
  const wall = Math.floor(instant + offset);
  const n = Math.floor(wall / MS_PER_DAY);
  const t = timeOfDayFromMillis(wall - n * MS_PER_DAY);
  const time = `${pad(t.hour, 2)}:${pad(t.minute, 2)}:${pad(t.second, 2)}.${pad(t.millis, 3)}`;
  let suffix = 'Z';
  if (zone !== undefined) {
    // Historical offsets can include seconds (Paris was +00:09:21 until 1911); keep them, as
    // Temporal does, so the text still names the same instant.
    const secs = Math.round(Math.abs(offset) / 1000);
    suffix = `${offset < 0 ? '-' : '+'}${pad(Math.floor(secs / 3600), 2)}:${pad(Math.floor(secs / 60) % 60, 2)}`;
    if (secs % 60) {
      suffix += `:${pad(secs % 60, 2)}`;
    }
  }
  return `${dayToString(dayFromEpochDay(n))}T${time}${suffix}`;
};
