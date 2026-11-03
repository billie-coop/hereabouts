import {
  DateTimePatternField,
  type DateTimePatternFieldType,
  type MetaZoneType,
} from '../../../types';
import { getTZC } from '../../internals/calendars/zoneutil';
import { INTERNAL_NUMBERING, numberingFormatString } from '../numbering/decimal';
import { CalendarConstants } from './constants';
import { newDate } from './core';
import { DateField } from './fields';
import { gregorianCalendar } from './gregorian';
import type { TimePeriodField } from './interval';
import type { CalendarDate, CalendarDateFields, CalendarType } from './types';

const zeropad = (n: number, w: number): string =>
  numberingFormatString(INTERNAL_NUMBERING, n, false, w);

/**
 * @public
 */
export type CalendarDateModFields = keyof Pick<
  CalendarDateFields,
  'year' | 'month' | 'day' | 'hour' | 'minute' | 'second'
>;

/**
 * @public
 */
export interface TimeStringOptions {
  /**
   * Include timezone identifier.
   */
  includeZoneId?: boolean;

  /**
   * Include timezone offset.
   */
  includeZoneOffset?: boolean;

  /**
   * Only output milliseconds if non-zero.
   */
  optionalMilliseconds?: boolean;
}

/**
 * @public
 */
export interface DateDiffOptions {
  /**
   * Calculate weeks.
   */
  includeWeeks?: boolean;

  /**
   * Rollup result into the given fields.
   */
  fields?: TimePeriodField[];

  /**
   * Rollup fractional fields.
   */
  rollupFractional?: boolean;
}

/**
 * Implementation order, based on calendar preference data and ease of implementation.
 * https://github.com/unicode-cldr/cldr-core/blob/master/supplemental/calendarPreferenceData.json
 *
 * Complete:
 *  gregorian           - widely used worldwide
 *  persian             - primary in AF, IR
 *  japanese            - secondary in JP, based on gregorian
 *  iso8601             - based on gregorian
 *  buddhist            - primary in TH
 *
 * Next:
 *  islamic-umalqura    - primary in SA
 *  chinese             - secondary in CN, CX, HK, MO, SG, TW
 *  islamic             - secondary in many locales
 *  dangi               - secondary in KO, based on chinese
 *
 * Rest TBD
 *
 * Calendar calculations are compatible with those in the Unicode ICU project.
 */

const { floor } = Math;

/**
 * @internal
 */
export type CalendarFromUnixEpoch<T> = (
  epoch: number,
  zoneId: string,
  firstDay: number,
  minDays: number,
) => T;

const differenceFields: [number, DateTimePatternFieldType][] = [
  [DateField.ERA, DateTimePatternField.ERA],
  [DateField.YEAR, DateTimePatternField.YEAR],
  [DateField.MONTH, DateTimePatternField.MONTH],
  [DateField.DAY_OF_MONTH, DateTimePatternField.DAY],
  [DateField.AM_PM, DateTimePatternField.DAYPERIOD],
  [DateField.HOUR, DateTimePatternField.HOUR24],
  [DateField.MINUTE, DateTimePatternField.MINUTE],
  [DateField.SECOND, DateTimePatternField.SECOND],
];

/**
 * Calendar type for this date, e.g. 'gregory' for Gregorian.
 *
 * @public
 */
export const dateType = (d: CalendarDate): CalendarType => d.calendar.type;

/**
 * Returns a formatted ISO-8601 string of the date in UTC. Note that this
 * always returns a date in the Gregorian calendar.
 *
 * @public
 */
export const dateToISOString = (d: CalendarDate): string => toISOString(d, true);

/**
 * Returns a formatted ISO 8601 string of the date with local timezone offset.
 * Note that this always returns a date in the Gregorian calendar.
 *
 * @public
 */
export const dateToLocalISOString = (d: CalendarDate): string => toISOString(d, false);

/**
 * Unix epoch with no timezone offset.
 *
 * @public
 */
export const dateUnixEpoch = (d: CalendarDate): number =>
  d.fields[DateField.LOCAL_MILLIS] - d.zoneInfo.offset;

/**
 * First day of week.
 *
 * @public
 */
export const dateFirstDayOfWeek = (d: CalendarDate): number => d.firstDay;

/**
 * Minimum days in the first week.
 *
 * @public
 */
export const dateMinDaysInFirstWeek = (d: CalendarDate): number => d.minDays;

/**
 * Returns a floating point number representing the real Julian Day, UTC.
 *
 * @public
 */
export const dateJulianDay = (d: CalendarDate): number => {
  const ms = (d.fields[DateField.MILLIS_IN_DAY] - d.zoneInfo.offset) / CalendarConstants.ONE_DAY_MS;
  return d.fields[DateField.JULIAN_DAY] - 0.5 + ms;
};

/**
 * CLDR's modified Julian day used as the basis for all date calculations.
 *
 * @public
 */
export const dateModifiedJulianDay = (d: CalendarDate): number => d.fields[DateField.JULIAN_DAY];

/**
 * Era
 *
 * @public
 */
export const dateEra = (d: CalendarDate): number => d.fields[DateField.ERA];

/**
 * Extended year.
 *
 * @public
 */
export const dateExtendedYear = (d: CalendarDate): number => d.fields[DateField.EXTENDED_YEAR];

/**
 * Year.
 *
 * @public
 */
export const dateYear = (d: CalendarDate): number => d.fields[DateField.YEAR];

/**
 * Related year.
 *
 * @public
 */
export const dateRelatedYear = (d: CalendarDate): number =>
  d.fields[DateField.EXTENDED_YEAR] + d.calendar.relatedYearOffset;

/**
 * Year of week of year.
 *
 * @public
 */
export const dateYearOfWeekOfYear = (d: CalendarDate): number =>
  weekOfYear(d, d.firstDay, d.minDays)[1];

/**
 * Week of year.
 *
 * @public
 */
export const dateWeekOfYear = (d: CalendarDate): number => weekOfYear(d, d.firstDay, d.minDays)[0];

/**
 * Year of week of year ISO.
 *
 * @public
 */
export const dateYearOfWeekOfYearISO = (d: CalendarDate): number => weekOfYear(d, 2, 4)[1];

/**
 * Week of year ISO.
 *
 * @public
 */
export const dateWeekOfYearISO = (d: CalendarDate): number => weekOfYear(d, 2, 4)[0];

/**
 * Ordinal month, one-based, e.g. Gregorian JANUARY = 1.
 *
 * @public
 */
export const dateMonth = (d: CalendarDate): number => d.fields[DateField.MONTH];

/**
 * Returns the week of the month computed using the locale's 'first day
 * of week' and 'minimal days in first week' where applicable.
 *
 * For example, for the United States, weeks start on Sunday.
 * Saturday 9/1/2018 would be in week 1, and Sunday 9/2/2018 would
 * begin week 2.
 *
 *         September
 *   Su Mo Tu We Th Fr Sa
 *                      1
 *    2  3  4  5  6  7  8
 *    9 10 11 12 13 14 15
 *   16 17 18 19 20 21 22
 *   23 24 25 26 27 28 29
 *   30
 *
 * @public
 */
export const dateWeekOfMonth = (d: CalendarDate): number => {
  const dom = d.fields[DateField.DAY_OF_MONTH];
  return weekNumber(d.firstDay, d.minDays, dom, dom, d.fields[DateField.DAY_OF_WEEK]);
};

/**
 * Day of year.
 *
 * @public
 */
export const dateDayOfYear = (d: CalendarDate): number => d.fields[DateField.DAY_OF_YEAR];

/**
 * Day of the week. 1 = SUNDAY, 2 = MONDAY, ..., 7 = SATURDAY
 *
 * @public
 */
export const dateDayOfWeek = (d: CalendarDate): number => d.fields[DateField.DAY_OF_WEEK];

/**
 * Ordinal day of the week. 1 if this is the 1st day of the week,
 * 2 if the 2nd, etc. Depends on the local starting day of the week.
 *
 * @public
 */
export const dateOrdinalDayOfWeek = (d: CalendarDate): number => {
  const weekday = d.fields[DateField.DAY_OF_WEEK];
  return ((7 - d.firstDay + weekday) % 7) + 1;
};

/**
 * Ordinal number indicating the day of the week in the current month.
 * The result of this method can be used to format messages like
 * "2nd Sunday in August".
 *
 * @public
 */
export const dateDayOfWeekInMonth = (d: CalendarDate): number =>
  (((d.fields[DateField.DAY_OF_MONTH] - 1) / 7) | 0) + 1;

/**
 * Day of month.
 *
 * @public
 */
export const dateDayOfMonth = (d: CalendarDate): number => d.fields[DateField.DAY_OF_MONTH];

/**
 * Is AM.
 *
 * @public
 */
export const dateIsAM = (d: CalendarDate): boolean => d.fields[DateField.AM_PM] === 0;

/**
 * Indicates the hour of the morning or afternoon, used for the 12-hour
 * clock (0 - 11). Noon and midnight are 0, not 12.
 *
 * @public
 */
export const dateHour = (d: CalendarDate): number => d.fields[DateField.HOUR];

/**
 * Indicates the hour of the day, used for the 24-hour clock (0 - 23).
 * Noon is 12 and midnight is 0.
 *
 * @public
 */
export const dateHourOfDay = (d: CalendarDate): number => d.fields[DateField.HOUR_OF_DAY];

/**
 * Indicates the minute of the hour (0 - 59).
 *
 * @public
 */
export const dateMinute = (d: CalendarDate): number => d.fields[DateField.MINUTE];

/**
 * Indicates the second of the minute (0 - 59).
 *
 * @public
 */
export const dateSecond = (d: CalendarDate): number => d.fields[DateField.SECOND];

/**
 * Milliseconds.
 *
 * @public
 */
export const dateMilliseconds = (d: CalendarDate): number => d.fields[DateField.MILLIS];

/**
 * Milliseconds in day.
 *
 * @public
 */
export const dateMillisecondsInDay = (d: CalendarDate): number => d.fields[DateField.MILLIS_IN_DAY];

/**
 * Metazone (CLDR) identifier.
 *
 * @public
 */
export const dateMetaZoneId = (d: CalendarDate): MetaZoneType =>
  d.zoneInfo.metazoneid as MetaZoneType;

/**
 * Timezone identifier.
 *
 * @public
 */
export const dateTimeZoneId = (d: CalendarDate): string => d.zoneInfo.zoneid;

/**
 * Timezone stable identifier (CLDR)
 *
 * @public
 */
export const dateTimeZoneStableId = (d: CalendarDate): string => d.zoneInfo.stableid;

/**
 * Timezone offset
 *
 * @public
 */
export const dateTimeZoneOffset = (d: CalendarDate): number => d.zoneInfo.offset;

/**
 * Is leap year.
 *
 * @public
 */
export const dateIsLeapYear = (d: CalendarDate): boolean => d.fields[DateField.IS_LEAP] === 1;

/**
 * Is daylight savings time.
 *
 * @public
 */
export const dateIsDaylightSavings = (d: CalendarDate): boolean => d.zoneInfo.dst === 1;

/**
 * Computes the field of visual difference between the two dates.
 * Note: This assumes the dates are of the same type and have the same
 * timezone offset.
 *
 * @public
 */
export const dateFieldOfVisualDifference = (
  d: CalendarDate,
  other: CalendarDate,
): DateTimePatternFieldType | undefined => {
  const a = d.fields;
  const b = other.fields;
  for (const [key, field] of differenceFields) {
    if (a[key] !== b[key]) {
      return field;
    }
  }
  return undefined;
};

/**
 * Compare two dates a and b, returning:
 *
 * ```
 *   a < b  ->  -1
 *   a = b  ->  0
 *   a > b  ->  1
 * ```
 *
 * @public
 */
export const dateCompare = (a: CalendarDate, b: CalendarDate): number => {
  const _a = dateUnixEpoch(a);
  const _b = dateUnixEpoch(b);
  return _a < _b ? -1 : _a > _b ? 1 : 0;
};

/**
 * Return all of the date and time field values.
 *
 * @public
 */
export const dateFields = (d: CalendarDate): CalendarDateFields => {
  const f = d.fields;
  return {
    year: f[DateField.EXTENDED_YEAR],
    month: f[DateField.MONTH],
    day: f[DateField.DAY_OF_MONTH],
    hour: f[DateField.HOUR_OF_DAY],
    minute: f[DateField.MINUTE],
    second: f[DateField.SECOND],
    millis: f[DateField.MILLIS],
    zoneId: d.zoneInfo.zoneid,
  };
};

/**
 * Return a JavaScript Date object with the same date and time.
 *
 * @public
 */
export const dateAsJSDate = (d: CalendarDate): Date => new Date(dateToLocalISOString(d));

/**
 * Return a string containing the date.
 *
 * @public
 */
export const dateToDateString = (d: CalendarDate): string => {
  const y = d.fields[DateField.EXTENDED_YEAR];
  const neg = y < 0;
  return (
    `${neg ? '-' : ''}${zeropad(Math.abs(y), 4)}` +
    `-${zeropad(d.fields[DateField.MONTH], 2)}-${zeropad(d.fields[DateField.DAY_OF_MONTH], 2)}`
  );
};

/**
 * Return a string containing the time, with optional timezone.
 *
 * @public
 */
export const dateToTimeString = (d: CalendarDate, options?: TimeStringOptions): string => {
  const f = d.fields;
  let s =
    `${zeropad(f[DateField.HOUR_OF_DAY], 2)}:${zeropad(f[DateField.MINUTE], 2)}` +
    `:${zeropad(f[DateField.SECOND], 2)}`;
  const ms = f[DateField.MILLIS];

  // Check if user disabled display of milliseconds when zero
  const showMilliseconds = !(options && options.optionalMilliseconds && ms === 0);
  if (showMilliseconds) {
    s += `.${zeropad(ms, 3)}`;
  }
  if (options) {
    if (options.includeZoneOffset) {
      s += `${formatZoneOffset(d)}`;
    }
    if (options.includeZoneId) {
      s += ` ${d.zoneInfo.zoneid}`;
    }
  }
  return s;
};

/**
 * Return a compact string containing just date and time, with optional timezone.
 *
 * @public
 */
export const dateToDateTimeString = (d: CalendarDate, options?: TimeStringOptions): string =>
  `${dateToDateString(d)} ${dateToTimeString(d, options)}`;

/**
 * String representation of the date and time, e.g. "Gregorian 2024-03-01 12:00:00.000 Etc/UTC".
 *
 * @public
 */
export const dateToString = (d: CalendarDate): string =>
  `${d.calendar.name} ${dateToDateString(d)} ${dateToTimeString(d, { includeZoneId: true })}`;

/**
 * Set one or more fields on this date explicitly, and return a new date.
 *
 * Note: when setting the 'year' field you must use the "extended year".
 * For example, the extended year 0 is 1 B.C in the Gregorian calendar.
 *
 * @public
 */
export const dateSet = (d: CalendarDate, fields: Partial<CalendarDateFields>): CalendarDate => {
  const [epoch, zoneId] = d.calendar.resolveFields(
    { ...dateFields(d), ...fields },
    d.zoneInfo.zoneid,
    d.zoneInfo.offset,
  );
  return newDate(d.calendar, epoch, zoneId, d.firstDay, d.minDays);
};

/**
 * Change the timezone for this date, returning a new date.
 *
 * @public
 */
export const dateWithZone = (d: CalendarDate, zoneId: string): CalendarDate =>
  newDate(d.calendar, dateUnixEpoch(d), zoneId, d.firstDay, d.minDays);

/**
 * Start of date, e.g. `dateStartOf(date, 'day')`
 *
 * @public
 */
export const dateStartOf = (d: CalendarDate, field: CalendarDateModFields): CalendarDate => {
  switch (field) {
    case 'year':
      return dateSet(d, {
        month: 0,
        day: 0,
        hour: 0,
        minute: 0,
        second: 0,
        millis: 0,
      });
    case 'month':
      return dateSet(d, { day: 0, hour: 0, minute: 0, second: 0, millis: 0 });
    case 'day':
      return dateSet(d, { hour: 0, minute: 0, second: 0, millis: 0 });
    case 'hour':
      return dateSet(d, { minute: 0, second: 0, millis: 0 });
    case 'minute':
      return dateSet(d, { second: 0, millis: 0 });
    case 'second':
      return dateSet(d, { millis: 0 });
  }
};

/**
 * End of date, e.g. `dateEndOf(date, 'day')`
 *
 * @public
 */
export const dateEndOf = (d: CalendarDate, field: CalendarDateModFields): CalendarDate => {
  switch (field) {
    case 'year':
      return dateSet(d, {
        month: 13,
        day: 32,
        hour: 23,
        minute: 59,
        second: 59,
        millis: 999,
      });
    case 'month':
      return dateSet(d, {
        day: 32,
        hour: 23,
        minute: 59,
        second: 59,
        millis: 999,
      });
    case 'day':
      return dateSet(d, { hour: 23, minute: 59, second: 59, millis: 999 });
    case 'hour':
      return dateSet(d, { minute: 59, second: 59, millis: 999 });
    case 'minute':
      return dateSet(d, { second: 59, millis: 999 });
    case 'second':
      return dateSet(d, { millis: 999 });
  }
};

const toISOString = (d: CalendarDate, utc: boolean): string => {
  const g = newDate(
    gregorianCalendar,
    dateUnixEpoch(d),
    utc ? 'Etc/UTC' : d.zoneInfo.zoneid,
    d.firstDay,
    d.minDays,
  );
  let z = 'Z';
  if (!utc) {
    const o = (d.zoneInfo.offset / CalendarConstants.ONE_MINUTE_MS) | 0;
    z = `${o < 0 ? '-' : '+'}${zeropad((o / 60) | 0, 2)}:${zeropad((o % 60) | 0, 2)}`;
  }
  const f = g.fields;
  const y = f[DateField.EXTENDED_YEAR];
  const neg = y < 0;
  return (
    `${neg ? '-' : ''}${zeropad(Math.abs(y), 4)}` +
    `-${zeropad(f[DateField.MONTH], 2)}-${zeropad(f[DateField.DAY_OF_MONTH], 2)}` +
    `T${zeropad(f[DateField.HOUR_OF_DAY], 2)}:${zeropad(f[DateField.MINUTE], 2)}:${zeropad(f[DateField.SECOND], 2)}` +
    `.${zeropad(f[DateField.MILLIS], 3)}${z}`
  );
};

/**
 * Compute the week of year and the year of the week of year using the given week rules.
 * Computed on demand; dates do not cache them.
 */
const weekOfYear = (d: CalendarDate, firstDay: number, minDays: number): [number, number] => {
  const f = d.fields;
  const dow = f[DateField.DAY_OF_WEEK];
  const doy = f[DateField.DAY_OF_YEAR];
  const eyear = f[DateField.EXTENDED_YEAR];

  let ywoy = eyear;
  const rdow = (dow + 7 - firstDay) % 7;
  const rdowJan1 = (dow - doy + 7001 - firstDay) % 7;
  let woy = floor((doy - 1 + rdowJan1) / 7);
  if (7 - rdowJan1 >= minDays) {
    woy++;
  }

  if (woy === 0) {
    const prevDay = doy + yearLength(d, eyear - 1);
    woy = weekNumber(firstDay, minDays, prevDay, prevDay, dow);
    ywoy--;
  } else {
    const lastDoy = yearLength(d, eyear);
    if (doy >= lastDoy - 5) {
      let lastRdow = (rdow + lastDoy - doy) % 7;
      if (lastRdow < 0) {
        lastRdow += 7;
      }
      if (6 - lastRdow >= minDays && doy + 7 - rdow > lastDoy) {
        woy = 1;
        ywoy++;
      }
    }
  }

  return [woy, ywoy];
};

const yearLength = (d: CalendarDate, y: number): number =>
  d.calendar.monthStart(y + 1, 0, false) - d.calendar.monthStart(y, 0, false);

const weekNumber = (
  firstDay: number,
  minDays: number,
  desiredDay: number,
  dayOfPeriod: number,
  dayOfWeek: number,
): number => {
  let psow = (dayOfWeek - firstDay - dayOfPeriod + 1) % 7;
  if (psow < 0) {
    psow += 7;
  }
  const weekNo = floor((desiredDay + psow - 1) / 7);
  return 7 - psow >= minDays ? weekNo + 1 : weekNo;
};

const formatZoneOffset = (d: CalendarDate): string => {
  const [_, negative, hours, minutes] = getTZC(d.zoneInfo.offset);
  let s = '';
  const zero = hours === 0 && minutes === 0;
  s += zero ? '+' : negative ? '-' : '+';
  s += zeropad(hours, 2);
  s += ':';
  s += zeropad(minutes, 2);
  return s;
};
