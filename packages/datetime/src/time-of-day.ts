import type { TimeOfDay } from './types';

const MS_PER_DAY = 86400000;

const isInt = (n: unknown): n is number =>
  typeof n === 'number' && isFinite(n) && Math.floor(n) === n;

const valid = (h: number, m: number, s: number, ms: number): boolean =>
  isInt(h) &&
  isInt(m) &&
  isInt(s) &&
  isInt(ms) &&
  h >= 0 &&
  h <= 23 &&
  m >= 0 &&
  m <= 59 &&
  s >= 0 &&
  s <= 59 &&
  ms >= 0 &&
  ms <= 999;

/**
 * Create a wall clock time from hour (0-23), minute, second and milliseconds. Throws a
 * RangeError if a field is out of range.
 *
 * @public
 */
export const timeOfDay = (
  hour: number,
  minute: number = 0,
  second: number = 0,
  millis: number = 0,
): TimeOfDay => {
  if (!valid(hour, minute, second, millis)) {
    throw new RangeError(`Invalid time of day: ${hour}:${minute}:${second}.${millis}`);
  }
  return { hour, minute, second, millis };
};

/**
 * True if the value is a valid {@link TimeOfDay}.
 *
 * @public
 */
export const isTimeOfDay = (v: unknown): v is TimeOfDay => {
  const t = v as TimeOfDay;
  return typeof t === 'object' && t !== null && valid(t.hour, t.minute, t.second, t.millis);
};

/**
 * Throws a RangeError unless `t` is a valid time of day, and returns its milliseconds since
 * midnight. Every function that takes a TimeOfDay checks it, so `{ hour: 24 }` fails loudly
 * instead of rolling over to the next day.
 */
const millisOf = (t: TimeOfDay): number => {
  if (!isTimeOfDay(t)) {
    let shown: string;
    try {
      shown = JSON.stringify(t);
    } catch {
      shown = String(t);
    }
    throw new RangeError(`Invalid time of day: ${shown}`);
  }
  return ((t.hour * 60 + t.minute) * 60 + t.second) * 1000 + t.millis;
};

/**
 * Milliseconds since midnight, 0 to 86,399,999.
 *
 * @public
 */
export const timeOfDayToMillis = (t: TimeOfDay): number => millisOf(t);

/**
 * The time of day for a number of milliseconds since midnight (0 to 86,399,999).
 *
 * @public
 */
export const timeOfDayFromMillis = (ms: number): TimeOfDay => {
  if (!isInt(ms) || ms < 0 || ms >= MS_PER_DAY) {
    throw new RangeError(
      `Milliseconds since midnight must be an integer from 0 to 86399999: ${ms}`,
    );
  }
  const millis = ms % 1000;
  const s = (ms - millis) / 1000;
  return { hour: Math.floor(s / 3600), minute: Math.floor(s / 60) % 60, second: s % 60, millis };
};

const TIME_RE = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?$/;

/**
 * Parse an ISO 8601 time, `HH:MM`, `HH:MM:SS` or `HH:MM:SS.fff` (up to 9 fraction digits,
 * truncated to milliseconds), as stored in a database `time` column. Returns undefined if the
 * text isn't in that form or a field is out of range.
 *
 * @public
 */
export const timeOfDayParse = (s: string): TimeOfDay | undefined => {
  const m = typeof s === 'string' ? TIME_RE.exec(s) : null;
  if (!m) {
    return undefined;
  }
  const h = Number(m[1]);
  const min = Number(m[2]);
  const sec = m[3] ? Number(m[3]) : 0;
  const ms = m[4] ? Number((m[4] + '00').slice(0, 3)) : 0;
  return valid(h, min, sec, ms) ? { hour: h, minute: min, second: sec, millis: ms } : undefined;
};

/**
 * Like {@link timeOfDayParse}, but throws a RangeError if the text isn't a valid time.
 *
 * @public
 */
export const timeOfDayFromString = (s: string): TimeOfDay => {
  const t = timeOfDayParse(s);
  if (!t) {
    throw new RangeError(`Invalid time of day: ${JSON.stringify(s)}`);
  }
  return t;
};

const pad = (n: number, w: number): string => {
  let s = String(n);
  while (s.length < w) {
    s = '0' + s;
  }
  return s;
};

/**
 * Format as ISO 8601, in the shortest form that keeps every field: `06:30`, `06:30:15` or
 * `06:30:15.250`.
 *
 * @public
 */
export const timeOfDayToString = (t: TimeOfDay): string => {
  millisOf(t);
  let r = `${pad(t.hour, 2)}:${pad(t.minute, 2)}`;
  if (t.second || t.millis) {
    r += `:${pad(t.second, 2)}`;
    if (t.millis) {
      r += `.${pad(t.millis, 3)}`;
    }
  }
  return r;
};

/**
 * Compare two times of day: -1 if `a` is earlier, 0 if equal, 1 if later.
 *
 * @public
 */
export const timeOfDayCompare = (a: TimeOfDay, b: TimeOfDay): number => {
  const c = millisOf(a) - millisOf(b);
  return c < 0 ? -1 : c > 0 ? 1 : 0;
};
