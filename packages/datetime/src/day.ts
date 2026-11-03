import type { Day, DayDuration, DayUnit } from './types';

/**
 * Days are stored as their year, month and day, so they read well in logs and JSON. Arithmetic
 * goes through the day number (days since 1970-01-01), which is exact: adding days is addition,
 * the days between two dates is subtraction.
 */

// Same range as JavaScript Date: +/- 100,000,000 days around 1970-01-01.
const MAX_EPOCH_DAY = 100000000;

const isInt = (n: unknown): n is number =>
  typeof n === 'number' && isFinite(n) && Math.floor(n) === n;

const floorDiv = (a: number, b: number): number => Math.floor(a / b);

/**
 * True if the year is a leap year in the proleptic Gregorian calendar.
 *
 * @public
 */
export const isLeapYear = (year: number): boolean =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * Number of days in the month of the year (month is 1-12).
 *
 * @public
 */
export const daysInMonth = (year: number, month: number): number =>
  month === 2 && isLeapYear(year) ? 29 : MONTH_DAYS[month - 1];

// Days since 1970-01-01 for a valid year, month and day (Howard Hinnant's days_from_civil).
const toEpochDay = (y: number, m: number, d: number): number => {
  y -= m <= 2 ? 1 : 0;
  const era = floorDiv(y, 400);
  const yoe = y - era * 400;
  const doy = floorDiv(153 * (m > 2 ? m - 3 : m + 9) + 2, 5) + d - 1;
  const doe = yoe * 365 + floorDiv(yoe, 4) - floorDiv(yoe, 100) + doy;
  return era * 146097 + doe - 719468;
};

// Year, month and day for a day number (Howard Hinnant's civil_from_days).
const fromEpochDay = (z: number): Day => {
  z += 719468;
  const era = floorDiv(z, 146097);
  const doe = z - era * 146097;
  const yoe = floorDiv(
    doe - floorDiv(doe, 1460) + floorDiv(doe, 36524) - floorDiv(doe, 146096),
    365,
  );
  const doy = doe - (365 * yoe + floorDiv(yoe, 4) - floorDiv(yoe, 100));
  const mp = floorDiv(5 * doy + 2, 153);
  const day = doy - floorDiv(153 * mp + 2, 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  return { year: yoe + era * 400 + (month <= 2 ? 1 : 0), month, day };
};

const inRange = (n: number): boolean => n >= -MAX_EPOCH_DAY && n <= MAX_EPOCH_DAY;

const valid = (year: number, month: number, d: number): boolean =>
  isInt(year) &&
  isInt(month) &&
  isInt(d) &&
  month >= 1 &&
  month <= 12 &&
  d >= 1 &&
  d <= daysInMonth(year, month) &&
  inRange(toEpochDay(year, month, d));

const checked = (n: number): Day => {
  if (!inRange(n)) {
    throw new RangeError(`Day out of range: ${n} days from 1970-01-01`);
  }
  return fromEpochDay(n);
};

const invalid = (d: unknown): RangeError => {
  let shown: string;
  try {
    shown = JSON.stringify(d);
  } catch {
    shown = String(d);
  }
  return new RangeError(`Invalid day: ${shown}`);
};

/**
 * Throws a RangeError unless `d` is a valid day, and returns its day number. Every function
 * that takes a Day checks it, so a hand-built or deserialized `{ month: 2, day: 30 }` fails
 * loudly instead of rolling over.
 */
const epochOf = (d: Day): number => {
  if (typeof d !== 'object' || d === null || !valid(d.year, d.month, d.day)) {
    throw invalid(d);
  }
  return toEpochDay(d.year, d.month, d.day);
};

/**
 * Create a day from its year, month (1-12) and day of month (1-31). Throws a RangeError if the
 * day doesn't exist, such as 2026-02-30. (JavaScript Date silently rolls that over to March.)
 *
 * @public
 */
export const day = (year: number, month: number, dayOfMonth: number): Day => {
  if (!valid(year, month, dayOfMonth)) {
    throw new RangeError(`Invalid day: ${year}-${month}-${dayOfMonth}`);
  }
  return { year, month, day: dayOfMonth };
};

/**
 * True if the value is a valid {@link Day}: an object with integer `year`, `month` and `day`
 * fields that name a day that exists.
 *
 * @public
 */
export const isDay = (v: unknown): v is Day => {
  const d = v as Day;
  return typeof d === 'object' && d !== null && valid(d.year, d.month, d.day);
};

/**
 * The day number: days since 1970-01-01 (negative before it).
 *
 * @public
 */
export const dayToEpochDay = (d: Day): number => epochOf(d);

/**
 * The day for a day number (days since 1970-01-01).
 *
 * @public
 */
export const dayFromEpochDay = (n: number): Day => {
  if (!isInt(n)) {
    throw new RangeError(`Day number must be an integer: ${n}`);
  }
  return checked(n);
};

const pad = (n: number, w: number): string => {
  let s = String(n);
  while (s.length < w) {
    s = '0' + s;
  }
  return s;
};

const DAY_RE = /^([+-]\d{6}|\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parse an ISO 8601 calendar date, `YYYY-MM-DD` (or `±YYYYYY-MM-DD` for years outside
 * 0000-9999), as stored in a database `date` column. Returns undefined if the text isn't in
 * that form or names a day that doesn't exist. No time zone is involved.
 *
 * @public
 */
export const dayParse = (s: string): Day | undefined => {
  const m = typeof s === 'string' ? DAY_RE.exec(s) : null;
  if (!m || m[1] === '-000000') {
    return undefined;
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  const d = Number(m[3]);
  return valid(year, month, d) ? { year, month, day: d } : undefined;
};

/**
 * Like {@link dayParse}, but throws a RangeError if the text isn't a valid day.
 *
 * @public
 */
export const dayFromString = (s: string): Day => {
  const d = dayParse(s);
  if (!d) {
    throw new RangeError(`Invalid day: ${JSON.stringify(s)}`);
  }
  return d;
};

/**
 * Format as ISO 8601 `YYYY-MM-DD` (`±YYYYYY-MM-DD` for years outside 0000-9999).
 *
 * @public
 */
export const dayToString = (d: Day): string => {
  epochOf(d);
  const y = d.year;
  const year = y >= 0 && y <= 9999 ? pad(y, 4) : (y < 0 ? '-' : '+') + pad(Math.abs(y), 6);
  return `${year}-${pad(d.month, 2)}-${pad(d.day, 2)}`;
};

/**
 * Day number of a valid day plus a number of months (clamping the day of month to the end of a
 * shorter month) and then days. Not range checked: callers check the result they return, so an
 * intermediate value outside the supported range never throws by itself.
 */
const addEpoch = (d: Day, months: number, days: number): number => {
  let y = d.year;
  let m = d.month;
  let dd = d.day;
  if (months) {
    const total = y * 12 + (m - 1) + months;
    y = floorDiv(total, 12);
    m = total - y * 12 + 1;
    dd = Math.min(dd, daysInMonth(y, m));
  }
  return toEpochDay(y, m, dd) + days;
};

const intOf = (n: number | undefined, name: string): number => {
  if (n === undefined) {
    return 0;
  }
  if (!isInt(n)) {
    throw new RangeError(`Duration ${name} must be an integer: ${n}`);
  }
  return n;
};

/**
 * Add a calendar duration. Years and months are added first, clamping the day of month to the
 * end of a shorter month (2026-01-31 plus 1 month is 2026-02-28), then weeks and days. This
 * matches date-fns `add` and Temporal `PlainDate.add`. Durations must be integers.
 *
 * @public
 */
export const dayAdd = (d: Day, duration: DayDuration): Day => {
  epochOf(d);
  const months = intOf(duration.years, 'years') * 12 + intOf(duration.months, 'months');
  const days = intOf(duration.weeks, 'weeks') * 7 + intOf(duration.days, 'days');
  return months || days ? checked(addEpoch(d, months, days)) : d;
};

/**
 * Subtract a calendar duration: {@link dayAdd} with every field negated.
 *
 * @public
 */
export const daySubtract = (d: Day, duration: DayDuration): Day =>
  dayAdd(d, {
    years: -intOf(duration.years, 'years'),
    months: -intOf(duration.months, 'months'),
    weeks: -intOf(duration.weeks, 'weeks'),
    days: -intOf(duration.days, 'days'),
  });

/**
 * Compare two days: -1 if `a` is before `b`, 0 if they are the same day, 1 if after. Works as a
 * sort comparator: `days.sort(dayCompare)`.
 *
 * @public
 */
export const dayCompare = (a: Day, b: Day): number => {
  const c = epochOf(a) - epochOf(b);
  return c < 0 ? -1 : c > 0 ? 1 : 0;
};

/**
 * True if `a` and `b` are the same day.
 *
 * @public
 */
export const dayEquals = (a: Day, b: Day): boolean => dayCompare(a, b) === 0;

/**
 * True if `a` is before `b`.
 *
 * @public
 */
export const dayIsBefore = (a: Day, b: Day): boolean => dayCompare(a, b) < 0;

/**
 * True if `a` is after `b`.
 *
 * @public
 */
export const dayIsAfter = (a: Day, b: Day): boolean => dayCompare(a, b) > 0;

/**
 * Whole units from `from` to `to`: positive if `to` is later, negative if earlier.
 *
 * - `days` (default): the difference in day numbers, so `dayUntil(today, due)` is the number of
 *   days left before a due date.
 * - `weeks`: whole weeks (days / 7, rounded toward zero).
 * - `months` / `years`: the largest whole number of months (years) that can be added to `from`
 *   with {@link dayAdd} without passing `to`. So 2026-01-31 to 2026-02-28 is 1 month, and
 *   2026-01-15 to 2026-02-14 is 0 months. Because of month-end clamping this can differ from
 *   date-fns `differenceInMonths` / `differenceInYears` at month ends: 2024-02-29 to 2025-02-28
 *   is 1 year here (adding a year to Feb 29 gives Feb 28) and 0 in date-fns.
 *
 * @public
 */
export const dayUntil = (from: Day, to: Day, unit: DayUnit = 'days'): number => {
  const a = epochOf(from);
  const b = epochOf(to);
  switch (unit) {
    case 'weeks': {
      const n = b - a;
      return n < 0 ? Math.ceil(n / 7) : Math.floor(n / 7);
    }
    case 'months':
    case 'years': {
      const sign = b > a ? 1 : b < a ? -1 : 0;
      if (sign === 0) {
        return 0;
      }
      // Start from the difference in calendar months, then step back while adding that many
      // months to `from` passes `to` (at most once, because of end-of-month clamping).
      let m = (to.year - from.year) * 12 + (to.month - from.month);
      if (unit === 'years') {
        m -= m % 12;
      }
      const step = unit === 'years' ? 12 : 1;
      while (m !== 0 && (addEpoch(from, m, 0) - b) * sign > 0) {
        m -= sign * step;
      }
      return unit === 'years' ? m / 12 : m;
    }
    default:
      return b - a;
  }
};

/**
 * Day of the week, 1 = Sunday through 7 = Saturday. This is the CLDR numbering used by
 * `firstDayOfWeek(locale)`, so `dayOfWeek(d) === firstDayOfWeek(en)` tests for the first day
 * of the locale's week. (JavaScript `Date.getDay()` and date-fns `getDay()` are this minus 1.)
 *
 * @public
 */
export const dayOfWeek = (d: Day): number => {
  // 1970-01-01 was a Thursday (5).
  const n = (epochOf(d) + 4) % 7;
  return (n < 0 ? n + 7 : n) + 1;
};

/**
 * Day of the year, 1-366.
 *
 * @public
 */
export const dayOfYear = (d: Day): number => epochOf(d) - toEpochDay(d.year, 1, 1) + 1;

/**
 * Number of days in the day's month.
 *
 * @public
 */
export const dayDaysInMonth = (d: Day): number => {
  epochOf(d);
  return daysInMonth(d.year, d.month);
};

/**
 * True if the day falls in a leap year.
 *
 * @public
 */
export const dayIsLeapYear = (d: Day): boolean => {
  epochOf(d);
  return isLeapYear(d.year);
};

const checkFirstDay = (firstDay: number): void => {
  if (!isInt(firstDay) || firstDay < 1 || firstDay > 7) {
    throw new RangeError(`First day of week must be 1 (Sunday) through 7 (Saturday): ${firstDay}`);
  }
};

/**
 * The first day of the week containing `d`. `firstDay` is the day the week starts on, 1 = Sunday
 * through 7 = Saturday; pass `firstDayOfWeek(locale)` for the locale's week.
 *
 * @public
 */
export const dayStartOfWeek = (d: Day, firstDay: number): Day => {
  checkFirstDay(firstDay);
  const back = (dayOfWeek(d) - firstDay + 7) % 7;
  return back ? checked(epochOf(d) - back) : d;
};

/**
 * The last day of the week containing `d`. See {@link dayStartOfWeek}.
 *
 * @public
 */
export const dayEndOfWeek = (d: Day, firstDay: number): Day =>
  checked(epochOf(dayStartOfWeek(d, firstDay)) + 6);

/**
 * The first day of the day's month or year.
 *
 * @public
 */
export const dayStartOf = (d: Day, unit: 'month' | 'year'): Day => {
  epochOf(d);
  return unit === 'year' ? day(d.year, 1, 1) : day(d.year, d.month, 1);
};

/**
 * The last day of the day's month or year.
 *
 * @public
 */
export const dayEndOf = (d: Day, unit: 'month' | 'year'): Day => {
  epochOf(d);
  return unit === 'year' ? day(d.year, 12, 31) : day(d.year, d.month, daysInMonth(d.year, d.month));
};

/**
 * Every day from `start` to `end`, both included, in steps of `step` (default one day). Each
 * step is added to `start`, not to the previous day, so monthly steps from the 31st stay on the
 * last day of shorter months without drifting. Returns an empty array if `end` is before
 * `start`.
 *
 * For the weeks of a month view, start from {@link dayStartOfWeek}:
 * `dayRange(dayStartOfWeek(first, firstDay), last, { weeks: 1 })`.
 *
 * @public
 */
export const dayRange = (start: Day, end: Day, step: DayDuration = { days: 1 }): Day[] => {
  epochOf(start);
  const last = epochOf(end);
  const months = intOf(step.years, 'years') * 12 + intOf(step.months, 'months');
  const days = intOf(step.weeks, 'weeks') * 7 + intOf(step.days, 'days');
  if (
    !isFinite(months) ||
    !isFinite(days) ||
    months < 0 ||
    days < 0 ||
    (months === 0 && days === 0)
  ) {
    throw new RangeError('Range step must be positive');
  }
  const r: Day[] = [];
  for (let i = 0; ; i++) {
    // Between start and end, so always in range; the first one past the end is never built.
    // A step too big to represent ends the range like any step past the end.
    const n = addEpoch(start, months ? months * i : 0, days ? days * i : 0);
    if (!(n <= last)) {
      return r;
    }
    r.push(fromEpochDay(n));
  }
};
