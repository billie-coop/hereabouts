import { tzFromUTC, tzResolveId } from '@phensley/timezone';
import { dayFromEpochDay, dayToEpochDay } from './day';
import { timeOfDayFromMillis, timeOfDayToMillis } from './time-of-day';
import type { Day, Disambiguation, Instant, TimeOfDay } from './types';

/**
 * The only functions that take a time zone. Everything else in this package is plain integer
 * math on days and times of day; daylight saving time is handled here and nowhere else.
 *
 * Zones are IANA ids such as 'America/Vancouver'. Aliases ('Asia/Calcutta') and any letter case
 * are accepted. An unknown zone throws a RangeError: silently falling back to UTC is how
 * off-by-one-day bugs start.
 *
 * Instants are milliseconds; a fractional instant is floored to the millisecond before it
 * (also before 1970, where Date truncates toward 1970 instead). NaN, Infinity and instants
 * outside JavaScript Date's range throw.
 */

const MS_PER_DAY = 86400000;

/**
 * Same range as JavaScript Date.
 *
 * @internal
 */
export const MAX_INSTANT = 8.64e15;

/**
 * @internal
 */
export const checkInstant = (instant: Instant): void => {
  if (typeof instant !== 'number' || !isFinite(instant) || Math.abs(instant) > MAX_INSTANT) {
    throw new RangeError(`Invalid instant: ${instant}`);
  }
};

/**
 * The canonical IANA id for a zone id or alias in any letter case ('asia/calcutta' ->
 * 'Asia/Kolkata'). Throws a RangeError for an unknown zone.
 *
 * @public
 */
export const timeZoneId = (zone: string): string => {
  // The tz data indexes canonical spellings, aliases and their lower case forms.
  const id =
    typeof zone === 'string' ? tzResolveId(zone) || tzResolveId(zone.toLowerCase()) : undefined;
  if (!id) {
    throw new RangeError(`Unknown time zone: ${JSON.stringify(zone)}`);
  }
  return id;
};

// Offset lookup without the instant check, for the probes in dayAtTime that may step just
// outside the supported range.
const offsetAt = (zone: string, t: number): number => {
  const info = tzFromUTC(timeZoneId(zone), t);
  if (!info) {
    throw new RangeError(`Unknown time zone: ${JSON.stringify(zone)}`);
  }
  return info.offset;
};

/**
 * The zone's offset from UTC, in milliseconds, at an instant. Throws a RangeError for an
 * unknown zone or an invalid instant.
 *
 * @public
 */
export const timeZoneOffset = (zone: string, instant: Instant): number => {
  checkInstant(instant);
  return offsetAt(zone, instant);
};

/**
 * The time zone the device or server is set to, as a canonical IANA id, or undefined if the
 * platform doesn't report one this package's time zone data knows. Servers commonly report
 * 'Etc/UTC'.
 *
 * @public
 */
export const systemTimeZone = (): string | undefined => {
  let id: string | undefined;
  try {
    id = new Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
  return id ? tzResolveId(id) : undefined;
};

/**
 * Wall clock milliseconds (as if the zone were UTC) for an instant.
 */
const toWall = (instant: Instant, zone: string): number => {
  checkInstant(instant);
  return instant + timeZoneOffset(zone, instant);
};

/**
 * The day it is in `zone` at `instant`. For "today", see {@link dayToday}.
 *
 * @public
 */
export const dayFromInstant = (instant: Instant, zone: string): Day =>
  dayFromEpochDay(Math.floor(toWall(instant, zone) / MS_PER_DAY));

/**
 * The wall clock time in `zone` at `instant`.
 *
 * @public
 */
export const timeOfDayFromInstant = (instant: Instant, zone: string): TimeOfDay => {
  const wall = Math.floor(toWall(instant, zone));
  return timeOfDayFromMillis(wall - Math.floor(wall / MS_PER_DAY) * MS_PER_DAY);
};

/**
 * Today's date in `zone`. `now` defaults to `Date.now()`; pass it to make code testable.
 *
 * Which zone "today" is in is a product decision: the user's zone for "is my invoice overdue?",
 * the customer's zone for "is it overdue for them?". A server usually runs in UTC, so code that
 * asks the system for today gets the wrong day for much of the world.
 *
 * @public
 */
export const dayToday = (zone: string, now: Instant = Date.now()): Day => dayFromInstant(now, zone);

/**
 * Options for {@link dayAtTime}.
 *
 * @public
 */
export interface DayAtTimeOptions {
  /**
   * What to do when the time is skipped or repeated because the clocks change that day.
   * Default 'compatible'.
   */
  disambiguation?: Disambiguation;
}

// The instants at which the wall clock in `zone` reads `wall` (wall clock milliseconds, as if
// the zone were UTC), sorted: one normally, two when the clocks went back over it, none when
// they went forward over it. Offsets are probed a day before and a day after, so one of them
// applies unless the zone changed its offset more than once within two days (no zone does).
const resolveWall = (wall: number, zone: string): [number[], number, number] => {
  const before = offsetAt(zone, wall - MS_PER_DAY);
  const after = offsetAt(zone, wall + MS_PER_DAY);
  const candidates: number[] = [];
  const consider = (offset: number) => {
    const t = wall - offset;
    if (offsetAt(zone, t) === offset && candidates.indexOf(t) === -1) {
      candidates.push(t);
    }
  };
  consider(before);
  consider(after);
  candidates.sort((a, b) => a - b);
  return [candidates, before, after];
};

const result = (t: number): Instant => {
  if (Math.abs(t) > MAX_INSTANT) {
    throw new RangeError(`Instant out of range: ${t}`);
  }
  return t;
};

/**
 * The instant when the wall clock in `zone` shows `time` on day `d`: "9:00 on the due date in
 * Tokyo". When the clocks change that day the time can be skipped (02:30 on a spring-forward
 * day) or happen twice (01:30 on a fall-back day); `options.disambiguation` decides, with the
 * same rules as JavaScript Temporal.
 *
 * Use this to schedule: store the day (or a rule that picks days), the time of day and, for a
 * pinned schedule, the zone; compute the instant when needed. Don't store the instant as the
 * source of truth: time zone rules change, and a repeating time isn't every 24 hours.
 *
 * @public
 */
export const dayAtTime = (
  d: Day,
  time: TimeOfDay,
  zone: string,
  options?: DayAtTimeOptions,
): Instant =>
  result(
    wallToInstant(
      dayToEpochDay(d) * MS_PER_DAY + timeOfDayToMillis(time),
      zone,
      (options && options.disambiguation) || 'compatible',
    ),
  );

/**
 * The instant for wall clock milliseconds in `zone` (see {@link dayAtTime}), without the final
 * range check, so callers can decide how to report an out-of-range result.
 *
 * @internal
 */
export const wallToInstant = (wall: number, zone: string, mode: Disambiguation): number => {
  const [candidates, before, after] = resolveWall(wall, zone);

  if (candidates.length === 1) {
    return candidates[0];
  }
  if (candidates.length > 1) {
    // Repeated: the clocks went back, so this wall time happens twice.
    switch (mode) {
      case 'reject':
        throw new RangeError(`Time happens twice in ${zone} that day`);
      case 'later':
        return candidates[candidates.length - 1];
      default:
        return candidates[0];
    }
  }

  // Skipped: the clocks went forward over this wall time. Read with the offset from before
  // the change it lands after the gap (02:30 -> 03:30); with the offset from after, before it.
  switch (mode) {
    case 'reject':
      throw new RangeError(`Time doesn't exist in ${zone} that day`);
    case 'earlier':
      return wall - after;
    default:
      return wall - before;
  }
};

/**
 * The first instant of day `d` in `zone`: midnight, or when a clock change skips midnight, the
 * moment the clocks jump to (e.g. 01:00, or 00:30 if they jumped from 23:30 to 00:30).
 *
 * @public
 */
export const dayStartInstant = (d: Day, zone: string): Instant => {
  const n = dayToEpochDay(d);
  const wall = n * MS_PER_DAY;
  const [candidates, before, after] = resolveWall(wall, zone);
  if (candidates.length) {
    return result(candidates[0]);
  }
  // Midnight was skipped. Find the first instant whose local day is `d`: at `wall - after` the
  // clock still reads the previous day, at `wall - before` it already reads `d`.
  const localDay = (t: number) => Math.floor((t + offsetAt(zone, t)) / MS_PER_DAY);
  let lo = wall - after;
  let hi = wall - before;
  while (hi - lo > 1) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (localDay(mid) >= n) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return result(hi);
};
