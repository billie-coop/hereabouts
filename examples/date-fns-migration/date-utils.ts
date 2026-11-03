/**
 * A replacement for an app's date helper module (`@billie-coop/date-utils`) that used date-fns,
 * built on `@billie-coop/hereabouts/datetime` instead. The `DateUtils` object keeps the same names, arguments
 * and results, so code that calls `DateUtils.*` doesn't change. Under the hood every date string
 * is a `Day` (no time, no zone) and "today" is asked for in the device's zone.
 *
 * Not a whole-module drop-in: the old module also re-exported date-fns functions (`format`,
 * `addDays`, `startOfWeek`, ...). Code that imports those has to move to `@billie-coop/hereabouts/datetime`
 * in the same change; see the table in README.md.
 *
 * New code should use `@billie-coop/hereabouts/datetime` directly (`Day`, `dayToday(zone)`, `dayAtTime`, ...):
 * it never goes through a JavaScript `Date`, so it can't shift by a day.
 *
 * Differences from the date-fns version:
 * - A string that looks like `YYYY-MM-DD` but names a day that doesn't exist (`2025-02-30`)
 *   is invalid. The date-fns version rolled it over to March 2nd.
 * - Timestamps are parsed by `instantParse`: ISO 8601 date and time, with or without an offset
 *   (without one it is read in the device's zone). date-fns `parseISO` also accepted partial
 *   forms such as `2025-12` or `20251208`, and `T24:00`.
 * - For a timestamp input (not a date), `getDaysUntil` counts calendar days (date-fns counted
 *   whole 24-hour periods) and `isThisWeek` includes all of Saturday (date-fns stopped at
 *   Saturday 00:00).
 */
import type { Day } from '@billie-coop/hereabouts/datetime';
import {
  day,
  dayAdd,
  dayCompare,
  dayFromInstant,
  dayParse,
  dayStartOfWeek,
  dayToday,
  dayToString,
  dayUntil,
  instantParse,
  systemTimeZone,
  timeOfDayFromInstant,
} from '@billie-coop/hereabouts/datetime';

/**
 * The device's time zone, or undefined if the platform doesn't report an IANA zone the time
 * zone data knows (e.g. Node with a POSIX `TZ=UTC+8`). Then the helpers below fall back to the
 * host's local clock, as the date-fns version did, rather than assume UTC.
 */
export const localZone = (): string | undefined => systemTimeZone();

/** The day the host's local clock shows at an instant. */
const hostDay = (ms: number): Day => {
  const date = new Date(ms);
  return day(date.getFullYear(), date.getMonth() + 1, date.getDate());
};

/** Today on the device. */
const today = (): Day => {
  const zone = localZone();
  return zone ? dayToday(zone) : hostDay(Date.now());
};

/** Parse an ISO timestamp; without an offset it is read in the device's zone. */
const parseInstant = (s: string): number | undefined => {
  const zone = localZone();
  if (zone) return instantParse(s, zone);
  const withOffset = instantParse(s);
  if (withOffset !== undefined) return withOffset;
  // No offset and no known zone: read the wall clock fields with the host's local clock.
  const wall = instantParse(s, 'Etc/UTC');
  if (wall === undefined) return undefined;
  const w = new Date(wall);
  const local = new Date(2000, 0, 1);
  local.setFullYear(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate());
  local.setHours(w.getUTCHours(), w.getUTCMinutes(), w.getUTCSeconds(), w.getUTCMilliseconds());
  return local.getTime();
};

/** A date string (YYYY-MM-DD, or an ISO timestamp) as the day it names on the device. */
const toDay = (dateString: string): Day | undefined => {
  const d = dayParse(dateString);
  if (d) return d;
  const instant = parseInstant(dateString);
  if (instant === undefined) return undefined;
  const zone = localZone();
  return zone ? dayFromInstant(instant, zone) : hostDay(instant);
};

/** Local midnight on a day, as a JavaScript Date (for the Date-returning API). */
const localMidnight = (d: Day): Date => {
  const date = new Date(2000, 0, 1);
  date.setFullYear(d.year, d.month - 1, d.day);
  return date;
};

const INVALID = 'NaN-NaN-NaN'; // what the date-fns version produced for invalid input

/**
 * Add days or months to a date string, returning YYYY-MM-DD. Fractional amounts behave as in
 * date-fns, which added them to the day of month (or month) and let `Date` truncate the sum:
 * +1.5 days is +1, -1.5 days is -2. NaN or Infinity gives INVALID.
 */
const addTo = (dateString: string, amount: number, unit: 'days' | 'months'): string => {
  const d = toDay(dateString);
  if (!d || !Number.isFinite(amount)) return INVALID;
  const base = unit === 'days' ? d.day : d.month; // date-fns: setDate(day + n) / setMonth(month0 + n + 1)
  const whole = Math.trunc(base + amount) - base;
  return dayToString(dayAdd(d, { [unit]: whole }));
};

export type DateGroup =
  | 'overdue'
  | 'today'
  | 'tomorrow'
  | 'thisWeek'
  | 'nextWeek'
  | 'thisMonth'
  | 'later';

/**
 * Centralized date utilities. Date strings are YYYY-MM-DD; "today" is in the device's zone.
 */
export const DateUtils = {
  // ============= Parsing & Validation =============

  /** Parse a date string (YYYY-MM-DD) to a Date at local midnight. */
  parseDate(dateString: string): Date {
    return DateUtils.parseDateSafe(dateString);
  },

  /** Check if a value is a valid date (a valid date string, or a valid Date). */
  isValidDate(date: unknown): boolean {
    if (typeof date === 'string') {
      return toDay(date) !== undefined;
    }
    return date instanceof Date && !Number.isNaN(date.getTime());
  },

  // ============= Today Calculations =============

  /** Today at local midnight. */
  getToday(): Date {
    return localMidnight(today());
  },

  /** Today as YYYY-MM-DD. */
  getTodayString(): string {
    return dayToString(today());
  },

  /** The current moment. */
  getNow(): Date {
    return new Date();
  },

  /** Current local hour (0-23). */
  getCurrentHour(): number {
    const zone = localZone();
    return zone ? timeOfDayFromInstant(Date.now(), zone).hour : new Date().getHours();
  },

  // ============= Comparisons =============

  /** True if the date is before today. */
  isOverdue(dateString: string): boolean {
    const d = toDay(dateString);
    return d !== undefined && dayCompare(d, today()) < 0;
  },

  /** True if the date is today. */
  isToday(dateString: string): boolean {
    return DateUtils.getDaysUntil(dateString) === 0;
  },

  /** True if the date is tomorrow. */
  isTomorrow(dateString: string): boolean {
    return DateUtils.getDaysUntil(dateString) === 1;
  },

  /** True if the date is in the current Sunday-to-Saturday week. */
  isThisWeek(dateString: string): boolean {
    const d = toDay(dateString);
    if (!d) return false;
    const start = dayStartOfWeek(today(), 1);
    const n = dayUntil(start, d);
    return n >= 0 && n <= 6;
  },

  /** Days until the date (negative if past; NaN for an invalid date). */
  getDaysUntil(dateString: string): number {
    const d = toDay(dateString);
    return d ? dayUntil(today(), d) : Number.NaN;
  },

  /** Days overdue (0 if not overdue). */
  getDaysOverdue(dateString: string): number {
    const daysUntil = DateUtils.getDaysUntil(dateString);
    return daysUntil < 0 ? Math.abs(daysUntil) : 0;
  },

  // ============= Date Arithmetic =============

  /** Add days to a date string, returning YYYY-MM-DD. */
  addDays(args: { dateString: string; days: number }): string {
    return addTo(args.dateString, args.days, 'days');
  },

  /** Add weeks to a date string, returning YYYY-MM-DD. */
  addWeeks(args: { dateString: string; weeks: number }): string {
    return addTo(args.dateString, args.weeks * 7, 'days');
  },

  /** Add months to a date string, returning YYYY-MM-DD (clamped to the end of shorter months). */
  addMonths(args: { dateString: string; months: number }): string {
    return addTo(args.dateString, args.months, 'months');
  },

  // ============= Grouping Helpers =============

  /** The display group for a date. */
  getDateGroup(dateString: string): DateGroup {
    const daysUntil = DateUtils.getDaysUntil(dateString);
    if (daysUntil < 0) return 'overdue';
    if (daysUntil === 0) return 'today';
    if (daysUntil === 1) return 'tomorrow';
    if (daysUntil <= 7) return 'thisWeek';
    if (daysUntil <= 14) return 'nextWeek';
    if (daysUntil <= 30) return 'thisMonth';
    return 'later';
  },

  /** Sort date strings chronologically (oldest first). */
  sortByDate(dates: string[]): string[] {
    return [...dates].sort(
      (a, b) => DateUtils.parseDateSafe(a).getTime() - DateUtils.parseDateSafe(b).getTime(),
    );
  },

  /** Group dates by their display category, each group sorted. */
  groupDates(dates: string[]): Record<DateGroup, string[]> {
    const groups: Record<DateGroup, string[]> = {
      overdue: [],
      today: [],
      tomorrow: [],
      thisWeek: [],
      nextWeek: [],
      thisMonth: [],
      later: [],
    };
    for (const date of dates) {
      groups[DateUtils.getDateGroup(date)].push(date);
    }
    for (const group of Object.keys(groups) as DateGroup[]) {
      groups[group] = DateUtils.sortByDate(groups[group]);
    }
    return groups;
  },

  // ============= Storage Format =============

  /** The moment a Unix ms timestamp names. */
  fromTimestamp(timestampMs: number): Date {
    return new Date(timestampMs);
  },

  /** A Date's local calendar day as YYYY-MM-DD. */
  toStorageFormat(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /** True if two date strings are the same day. */
  isSameDay(dateString1: string, dateString2: string): boolean {
    const a = toDay(dateString1);
    const b = toDay(dateString2);
    return a !== undefined && b !== undefined && dayCompare(a, b) === 0;
  },

  // ============= Safe Date Parsing =============

  /**
   * Parse a date string as a Date: YYYY-MM-DD at local midnight, a timestamp at its moment.
   * Invalid input gives an invalid Date.
   */
  parseDateSafe(dateString: string): Date {
    const d = dayParse(dateString);
    if (d) return localMidnight(d);
    const instant = parseInstant(dateString);
    return new Date(instant === undefined ? Number.NaN : instant);
  },

  /** Parse a date string and return local midnight of its day. */
  parseDateStartOfDay(dateString: string): Date {
    const d = toDay(dateString);
    return d ? localMidnight(d) : new Date(Number.NaN);
  },

  /** True if a date string is today. */
  isDateToday(dateString: string): boolean {
    return DateUtils.isToday(dateString);
  },

  /** True if a date string is before today. */
  isDateOverdue(dateString: string): boolean {
    return DateUtils.isOverdue(dateString);
  },
};
