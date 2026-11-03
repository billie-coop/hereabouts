import type { ContextType, FormatWidthType } from '@phensley/cldr-types';
import {
  type Day,
  dayFromInstant,
  dayToEpochDay,
  dayUntil,
  type Instant,
  type TimeOfDay,
  timeOfDayToMillis,
  timeZoneId,
} from '@phensley/datetime';
import type { Part } from '@phensley/decimal';
import type {
  DateFormatAltOptions,
  DateFormatOptions,
  RelativeTimeFieldFormatOptions,
  RelativeTimeFormatOptions,
} from '../common/calendars';
import type { NumberSystemType } from '../common/numbers';
import type { LocaleData } from '../locale-data';
import type { CalendarType } from '../systems/calendars/types';
import {
  formatDate,
  formatDateInterval,
  formatDateIntervalToParts,
  formatDateToParts,
  formatRelativeTime,
  formatRelativeTimeField,
  newGregorianDate,
} from './calendars';

/**
 * Locale-aware formatting for the plain values of `@phensley/datetime`: days, times of day and
 * instants. A day is formatted as that calendar day and a time of day as that wall clock time,
 * with no time zone involved, so the output never shifts by a day or an hour. An instant is a
 * moment, so formatting one always takes the zone to show it in.
 */

/**
 * Options for {@link formatDay}.
 *
 * @public
 */
export interface DayFormatOptions {
  /**
   * Named date format width. Default 'medium' ("Jan 31, 2026" in English) unless a skeleton is
   * given.
   */
  date?: FormatWidthType;

  /**
   * Skeleton of date fields, such as 'yMMMd' or 'MMMEd'; the locale's best pattern is used.
   * Only date fields (era, year, quarter, month, week, day, weekday) are allowed: a time or
   * zone field throws a RangeError.
   */
  skeleton?: string;

  /**
   * Calendar to show the day in, e.g. 'japanese'. Default the locale's calendar.
   */
  ca?: CalendarType;

  /**
   * Numbering system for the digits.
   */
  nu?: NumberSystemType;

  /**
   * Context in which the text is used, for capitalization.
   */
  context?: ContextType;

  /**
   * Alternate field forms.
   */
  alt?: DateFormatAltOptions;
}

/**
 * Options for {@link formatDayInterval}.
 *
 * @public
 */
export interface DayIntervalFormatOptions {
  /**
   * Skeleton of date fields. Default 'yMMMd' ("Jan 1 – 31, 2026" in English).
   */
  skeleton?: string;
  ca?: CalendarType;
  nu?: NumberSystemType;
  context?: ContextType;
  alt?: DateFormatAltOptions;
}

/**
 * Options for {@link formatTimeOfDay}.
 *
 * @public
 */
export interface TimeOfDayFormatOptions {
  /**
   * Skeleton of time fields. Default 'jm': hour and minute in the locale's preferred 12 or 24
   * hour clock ("6:30 AM" in English, "06:30" in German). Use 'jms' to show seconds, 'Hm' to
   * force a 24 hour clock, 'hm' for 12 hours. Only time fields are allowed: a date or zone
   * field throws a RangeError.
   */
  skeleton?: string;
  nu?: NumberSystemType;
  context?: ContextType;
  alt?: DateFormatAltOptions;
}

// The days the shared calendar formatter shows correctly as proleptic Gregorian days: it uses
// the Julian calendar before the 1582 Gregorian reform and stops at the end of 8652.
const FIRST_DAY = dayToEpochDay({ year: 1582, month: 10, day: 15 });
const LAST_DAY = dayToEpochDay({ year: 8652, month: 12, day: 31 });

// Skeleton fields that belong to each kind of value. A day has no time or zone, a time of day
// has no date or zone, so e.g. 'z' would print a made-up "GMT".
const DAY_FIELDS = 'GyYuUrQqMLlwWdDFgEec';
const TIME_FIELDS = 'abBhHkKjJCmsSA';

const checkSkeleton = (skeleton: string | undefined, allowed: string, what: string): void => {
  if (skeleton) {
    for (let i = 0; i < skeleton.length; i++) {
      if (allowed.indexOf(skeleton[i]) === -1) {
        throw new RangeError(
          `Skeleton field '${skeleton[i]}' doesn't apply to a ${what}: ${skeleton}`,
        );
      }
    }
  }
};

// Days and times of day are formatted as Gregorian dates in UTC, where the wall clock is the
// value itself; the locale's week settings apply to week fields. Invalid values throw.
const fromDay = (data: LocaleData, d: Day, t?: TimeOfDay) => {
  const n = dayToEpochDay(d);
  if (n < FIRST_DAY || n > LAST_DAY) {
    throw new RangeError(
      `Days before 1582-10-15 or after 8652-12-31 can't be formatted yet: ${d.year}`,
    );
  }
  if (t) {
    timeOfDayToMillis(t);
  }
  return newGregorianDate(data, {
    year: d.year,
    month: d.month,
    day: d.day,
    hour: t ? t.hour : 0,
    minute: t ? t.minute : 0,
    second: t ? t.second : 0,
    millis: t ? t.millis : 0,
    zoneId: 'Etc/UTC',
  });
};

// `formatDate` reads an unknown zone (or one in another letter case) as UTC and NaN as 1970;
// these functions throw instead, like the rest of the day and instant functions, and pass the
// canonical zone id on. Instants whose day the shared formatter can't show throw too.
const zoned = (instant: Instant, zone: string) => {
  const zoneId = timeZoneId(zone);
  const n = dayToEpochDay(dayFromInstant(instant, zoneId));
  if (n < FIRST_DAY || n > LAST_DAY) {
    throw new RangeError(
      `Instants before 1582-10-15 or after 8652-12-31 can't be formatted yet: ${instant}`,
    );
  }
  return { date: instant, zoneId };
};

const EPOCH_DAY: Day = { year: 1970, month: 1, day: 1 };

const dayOptions = (options?: DayFormatOptions): DateFormatOptions => {
  const o = options || {};
  checkSkeleton(o.skeleton, DAY_FIELDS, 'day');
  return {
    date: o.skeleton ? undefined : o.date || 'medium',
    skeleton: o.skeleton,
    ca: o.ca,
    nu: o.nu,
    context: o.context,
    alt: o.alt,
  };
};

const timeOptions = (options?: TimeOfDayFormatOptions): DateFormatOptions => {
  const o = options || {};
  checkSkeleton(o.skeleton, TIME_FIELDS, 'time of day');
  return { skeleton: o.skeleton || 'jm', nu: o.nu, context: o.context, alt: o.alt };
};

const intervalOptions = (options?: DayIntervalFormatOptions) => {
  const o = options || {};
  checkSkeleton(o.skeleton, DAY_FIELDS, 'day');
  return { skeleton: o.skeleton || 'yMMMd', ca: o.ca, nu: o.nu, context: o.context, alt: o.alt };
};

/**
 * Format a day, e.g. "Jan 31, 2026" / "31.01.2026". See {@link DayFormatOptions}. Throws a
 * RangeError for an invalid day, and for days before 1582-10-15 or after 8652-12-31, which the
 * shared calendar formatter can't yet show as proleptic Gregorian days.
 *
 * @public
 */
export const formatDay = (data: LocaleData, d: Day, options?: DayFormatOptions): string =>
  formatDate(data, fromDay(data, d), dayOptions(options));

/**
 * Format a day to an array of parts.
 *
 * @public
 */
export const formatDayToParts = (data: LocaleData, d: Day, options?: DayFormatOptions): Part[] =>
  formatDateToParts(data, fromDay(data, d), dayOptions(options));

/**
 * Format the days from `start` to `end`, e.g. "Jan 1 – 31, 2026". Fields the two days share are
 * shown once, following the locale's interval patterns.
 *
 * @public
 */
export const formatDayInterval = (
  data: LocaleData,
  start: Day,
  end: Day,
  options?: DayIntervalFormatOptions,
): string =>
  formatDateInterval(data, fromDay(data, start), fromDay(data, end), intervalOptions(options));

/**
 * Format the days from `start` to `end` to an array of parts.
 *
 * @public
 */
export const formatDayIntervalToParts = (
  data: LocaleData,
  start: Day,
  end: Day,
  options?: DayIntervalFormatOptions,
): Part[] =>
  formatDateIntervalToParts(
    data,
    fromDay(data, start),
    fromDay(data, end),
    intervalOptions(options),
  );

/**
 * Format a time of day, e.g. "6:30 AM" / "06:30". See {@link TimeOfDayFormatOptions}.
 *
 * @public
 */
export const formatTimeOfDay = (
  data: LocaleData,
  t: TimeOfDay,
  options?: TimeOfDayFormatOptions,
): string => formatDate(data, fromDay(data, EPOCH_DAY, t), timeOptions(options));

/**
 * Format a time of day to an array of parts.
 *
 * @public
 */
export const formatTimeOfDayToParts = (
  data: LocaleData,
  t: TimeOfDay,
  options?: TimeOfDayFormatOptions,
): Part[] => formatDateToParts(data, fromDay(data, EPOCH_DAY, t), timeOptions(options));

/**
 * Describe a day relative to another in words: "today", "tomorrow", "yesterday", "in 3 days",
 * "3 days ago" (in the locale's language; some have words for two days away, like German
 * "übermorgen"). `relativeTo` is usually `dayToday(zone)`.
 *
 * @public
 */
export const formatDayRelative = (
  data: LocaleData,
  d: Day,
  relativeTo: Day,
  options?: RelativeTimeFieldFormatOptions,
): string => formatRelativeTimeField(data, dayUntil(relativeTo, d), 'day', options);

/**
 * Format an instant as seen in `zone`. The zone is required: the same instant is a different
 * day and time in different places. Default `{ date: 'full' }` as for `formatDate`. Throws a
 * RangeError for an unknown zone, an invalid instant, or one whose day in `zone` is before
 * 1582-10-15 or after 8652-12-31.
 *
 * @public
 */
export const formatInstant = (
  data: LocaleData,
  instant: Instant,
  zone: string,
  options?: DateFormatOptions,
): string => formatDate(data, zoned(instant, zone), options);

/**
 * Format an instant to an array of parts. See {@link formatInstant}.
 *
 * @public
 */
export const formatInstantToParts = (
  data: LocaleData,
  instant: Instant,
  zone: string,
  options?: DateFormatOptions,
): Part[] => formatDateToParts(data, zoned(instant, zone), options);

/**
 * How long ago or how far ahead `instant` is from `relativeTo`, in the largest sensible unit:
 * "2 hours ago", "in 3 days", "yesterday". Calendar units (days, months) are counted on the
 * wall clock in `zone`. `relativeTo` is usually `Date.now()`.
 *
 * @public
 */
export const formatInstantRelative = (
  data: LocaleData,
  instant: Instant,
  relativeTo: Instant,
  zone: string,
  options?: RelativeTimeFormatOptions,
): string => formatRelativeTime(data, zoned(relativeTo, zone), zoned(instant, zone), options);
