import type {
  ContextTransformFieldType,
  ContextType,
  DateFieldType,
  DateTimePatternFieldType,
  MetaZoneType,
  RelativeTimeFieldType,
} from '@phensley/cldr-types';

import type { DecimalArg, Part } from '@phensley/decimal';
import {
  tzFromUTC,
  tzFromWall,
  tzResolveId,
  tzZoneIds,
  tzZoneMeta,
  type ZoneInfo,
} from '@phensley/timezone';
import type {
  CalendarFieldsOptions,
  DateFieldFormatOptions,
  DateFormatAltOptions,
  DateFormatOptions,
  DateIntervalFormatOptions,
  DateRawFormatOptions,
  DateWrapperFormatOptions,
  EraFieldOptions,
  MetazoneNames,
  RelativeTimeFieldFormatOptions,
  RelativeTimeFormatOptions,
  TimeData,
  TimeZoneInfo,
  ZonedDateTime,
} from '../common/calendars';
import type { NumberParams } from '../common/private';
import type { Quantity } from '../common/units';
import type { CalendarContext } from '../internals/calendars/formatter';
import {
  parseDatePattern,
  renderDateInterval,
  renderDateTime,
  selectCalendar,
  weekFirstDay,
  weekMinDays,
} from '../internals/calendars/internal';
import {
  getCalendarPatterns,
  getDateFormatRequest,
  getDateIntervalFormatRequest,
} from '../internals/calendars/manager';
import {
  type CalendarPatterns,
  patternsDayPeriods,
  patternsEras,
  patternsMonths,
  patternsQuarters,
  patternsTimeData,
  patternsWeekdays,
  patternsWrapperPattern,
} from '../internals/calendars/patterns';
import { renderRelativeTimeField } from '../internals/datefields/internal';
import { contextTransform, parseWrapper } from '../internals/general/internal';
import type { LocaleData } from '../locale-data';
import { vectorGet, vectorMapping } from '../schema/schema/arrows';
import { TimeZoneTypeIndex } from '../schema/schema/timezones';
import {
  type BuddhistDate,
  buddhistDateFromFields,
  buddhistDateFromUnixEpoch,
} from '../systems/calendars/buddhist';
import {
  type CalendarFromUnixEpoch,
  dateDayOfWeek,
  dateFieldOfVisualDifference,
  dateTimeZoneId,
  dateType,
  dateUnixEpoch,
} from '../systems/calendars/calendar';
import { isCalendarDate } from '../systems/calendars/core';
import { dateRelativeTime } from '../systems/calendars/difference';
import {
  type GregorianDate,
  gregorianDateFromFields,
  gregorianDateFromUnixEpoch,
} from '../systems/calendars/gregorian';
import { TIME_PERIOD_FIELDS, type TimePeriod } from '../systems/calendars/interval';
import {
  type ISO8601Date,
  iso8601DateFromFields,
  iso8601DateFromUnixEpoch,
} from '../systems/calendars/iso8601';
import {
  type JapaneseDate,
  japaneseDateFromFields,
  japaneseDateFromUnixEpoch,
} from '../systems/calendars/japanese';
import {
  type PersianDate,
  persianDateFromFields,
  persianDateFromUnixEpoch,
} from '../systems/calendars/persian';
import {
  currentMetazone,
  getStableTimeZoneId,
  substituteZoneAlias,
} from '../systems/calendars/timezone';
import type { CalendarDate, CalendarDateFields, CalendarType } from '../systems/calendars/types';
import { type AbstractValue, partsValue, stringValue } from '../utils/render';
import { getContextTransformInfo } from './private/api';
import { getNumberParams } from './private/numbers';

const DOW_FIELDS: RelativeTimeFieldType[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// Exemplar city names, per locale data, read on first use.
const EXEMPLAR_CITIES = /*#__PURE__*/ new WeakMap<LocaleData, { [x: string]: string }>();

/**
 * First day of the week for this locale, e.g. 1=SUN, 2=MON, etc.
 *
 * @public
 */
export const firstDayOfWeek = (data: LocaleData): number => {
  return weekFirstDay(data.region);
};

/**
 * Minimum number of days to count as a new week in a month or year in this locale.
 *
 * @public
 */
export const minDaysInFirstWeek = (data: LocaleData): number => {
  return weekMinDays(data.region);
};

/**
 * Date field's string representation for this locale.
 *
 * @public
 */
export const dateField = (
  data: LocaleData,
  type: DateFieldType,
  opt?: DateFieldFormatOptions,
): string => {
  opt = opt || {};
  const field = vectorGet(data.schema.DateFields.displayName, data, type, opt.width || 'wide');
  return _transformField(data, field, 'calendar-field', opt.context);
};

/**
 * Mapping of all day periods for this locale.
 *
 * @public
 */
export const dayPeriods = (data: LocaleData, opt?: CalendarFieldsOptions): any => {
  opt = opt || {};
  const fields = patternsDayPeriods(_getPatterns(data, opt.ca))[opt.width || 'wide'];
  return _transformFields(data, fields, undefined, opt.context);
};

/**
 * Mapping of all eras for this locale.
 *
 * @public
 */
export const eras = (data: LocaleData, opt?: EraFieldOptions): any => {
  opt = opt || {};
  const w = opt.width || 'names';
  const fields = patternsEras(_getPatterns(data, opt.ca))[w];
  const tx = w === 'abbr' ? 'era-abbr' : w === 'names' ? 'era-name' : undefined;
  return _transformFields(data, fields, tx, opt.context);
};

/**
 * Mapping of all months for this locale.
 *
 * @public
 */
export const months = (data: LocaleData, opt?: CalendarFieldsOptions): any => {
  opt = opt || {};
  const w = opt.width === 'short' ? 'narrow' : opt.width || 'wide';
  const fields = patternsMonths(_getPatterns(data, opt.ca))[w];
  const tx = w !== 'narrow' ? 'month-standalone-except-narrow' : undefined;
  return _transformFields(data, fields, tx, opt.context);
};

/**
 * Mapping of all quarters for this locale.
 *
 * @public
 */
export const quarters = (data: LocaleData, opt?: CalendarFieldsOptions): any => {
  opt = opt || {};
  const fields = patternsQuarters(_getPatterns(data, opt.ca))[opt.width || 'wide'];
  return _transformFields(data, fields, undefined, opt.context);
};

/**
 * Mapping of all weekdays for this locale.
 *
 * @public
 */
export const weekdays = (data: LocaleData, opt?: CalendarFieldsOptions): any => {
  opt = opt || {};
  const w = opt.width || 'wide';
  const fields = patternsWeekdays(_getPatterns(data, opt.ca))[w];
  const tx = w !== 'narrow' ? 'day-standalone-except-narrow' : undefined;
  return _transformFields(data, fields, tx, opt.context);
};

/**
 * Alias for nowGregorian()
 *
 * @public
 */
export const now = (data: LocaleData, zoneId?: string): GregorianDate => {
  return nowGregorian(data, zoneId);
};

/**
 * Convert the given date to the Buddhist calendar.
 *
 * @public
 */
export const toBuddhistDate = (
  data: LocaleData,
  date: CalendarDate | ZonedDateTime | Date,
): BuddhistDate => {
  return convertDate(data, buddhistDateFromUnixEpoch, date);
};

/**
 * Construct a new date in the Buddhist calendar with the given fields.
 *
 * @public
 */
export const newBuddhistDate = (
  data: LocaleData,
  fields: Partial<CalendarDateFields>,
): BuddhistDate => {
  return buddhistDateFromFields(fields, weekFirstDay(data.region), weekMinDays(data.region));
};

/**
 * Construct a new date in the Buddhist calendar representing the current date and time.
 *
 * @public
 */
export const nowBuddhist = (data: LocaleData, zoneId?: string): BuddhistDate => {
  return buddhistDateFromUnixEpoch(
    Date.now(),
    zoneId || '',
    weekFirstDay(data.region),
    weekMinDays(data.region),
  );
};

/**
 * Convert the given date to the Gregorian calendar.
 *
 * @public
 */
export const toGregorianDate = (
  data: LocaleData,
  date: CalendarDate | ZonedDateTime | Date,
): GregorianDate => {
  return convertDate(data, gregorianDateFromUnixEpoch, date);
};

/**
 * Construct a new date in the Gregorian calendar with the given fields.
 *
 * @public
 */
export const newGregorianDate = (
  data: LocaleData,
  fields: Partial<CalendarDateFields>,
): GregorianDate => {
  return gregorianDateFromFields(fields, weekFirstDay(data.region), weekMinDays(data.region));
};

/**
 * Construct a new date in the Gregorian calendar representing the current date and time.
 *
 * @public
 */
export const nowGregorian = (data: LocaleData, zoneId?: string): GregorianDate => {
  return gregorianDateFromUnixEpoch(
    Date.now(),
    zoneId || '',
    weekFirstDay(data.region),
    weekMinDays(data.region),
  );
};

/**
 * Convert the given date to the ISO-8601 calendar.
 *
 * @public
 */
export const toISO8601Date = (
  data: LocaleData,
  date: CalendarDate | ZonedDateTime | Date,
): ISO8601Date => {
  return convertDate(data, iso8601DateFromUnixEpoch, date);
};

/**
 * Construct a new date in the ISO-8601 calendar with the given fields.
 *
 * @public
 */
export const newISO8601Date = (
  data: LocaleData,
  fields: Partial<CalendarDateFields>,
): ISO8601Date => {
  return iso8601DateFromFields(fields, weekFirstDay(data.region), weekMinDays(data.region));
};

/**
 * Construct a new date in the ISO8601 calendar representing the current date and time.
 *
 * @public
 */
export const nowISO8601 = (data: LocaleData, zoneId?: string): ISO8601Date => {
  return iso8601DateFromUnixEpoch(
    Date.now(),
    zoneId || '',
    weekFirstDay(data.region),
    weekMinDays(data.region),
  );
};

/**
 * Convert the given date to the Japanese calendar.
 *
 * @public
 */
export const toJapaneseDate = (
  data: LocaleData,
  date: CalendarDate | ZonedDateTime | Date,
): JapaneseDate => {
  return convertDate(data, japaneseDateFromUnixEpoch, date);
};

/**
 * Construct a new date in the Japanese calendar with the given fields.
 *
 * @public
 */
export const newJapaneseDate = (
  data: LocaleData,
  fields: Partial<CalendarDateFields>,
): JapaneseDate => {
  return japaneseDateFromFields(fields, weekFirstDay(data.region), weekMinDays(data.region));
};

/**
 * Construct a new date in the Japanese calendar representing the current date and time.
 *
 * @public
 */
export const nowJapanese = (data: LocaleData, zoneId?: string): JapaneseDate => {
  return japaneseDateFromUnixEpoch(
    Date.now(),
    zoneId || '',
    weekFirstDay(data.region),
    weekMinDays(data.region),
  );
};

/**
 * Convert the given date to the Persian calendar.
 *
 * @public
 */
export const toPersianDate = (
  data: LocaleData,
  date: CalendarDate | ZonedDateTime | Date,
): PersianDate => {
  return convertDate(data, persianDateFromUnixEpoch, date);
};

/**
 * Construct a new date in the Persian calendar with the given fields.
 *
 * @public
 */
export const newPersianDate = (
  data: LocaleData,
  fields: Partial<CalendarDateFields>,
): PersianDate => {
  return persianDateFromFields(fields, weekFirstDay(data.region), weekMinDays(data.region));
};

/**
 * Construct a new date in the Persian calendar representing the current date and time.
 *
 * @public
 */
export const nowPersian = (data: LocaleData, zoneId?: string): PersianDate => {
  return persianDateFromUnixEpoch(
    Date.now(),
    zoneId || '',
    weekFirstDay(data.region),
    weekMinDays(data.region),
  );
};

/**
 * Find the field of visual difference between two dates. For example, the
 * dates "2019-03-31" and "2019-04-01" differ visually in the month field,
 * even though the dates are only 1 day apart.
 *
 * This can be used by applications to select an appropriate skeleton for date
 * interval formatting, e.g. to format "March 31 - April 01, 2019"
 *
 * @public
 */
export const fieldOfVisualDifference = (
  data: LocaleData,
  a: CalendarDate | ZonedDateTime | Date,
  b: CalendarDate | ZonedDateTime | Date,
): DateTimePatternFieldType | undefined => {
  // Date is interpreted as UTC
  if (a instanceof Date) {
    a = { date: a } as ZonedDateTime;
  }
  if (b instanceof Date) {
    b = { date: b } as ZonedDateTime;
  }

  // Determine calendar type to use for comparison, falling back to the default for the
  // current locale.
  const type: CalendarType = isCalendarDate(a)
    ? dateType(a)
    : isCalendarDate(b)
      ? dateType(b)
      : selectCalendar(data);

  // Convert a and b to CalendarDate having the correct type, ensuring their types and timezones match.
  if (!isCalendarDate(a) || type !== dateType(a)) {
    a = convertDateTo(data, type, a);
  }
  if (!isCalendarDate(b) || type !== dateType(b) || dateTimeZoneId(a) !== dateTimeZoneId(b)) {
    b = convertDateTo(data, type, b, dateTimeZoneId(a));
  }
  return dateFieldOfVisualDifference(a, b);
};

/**
 * Format a calendar date to string using the given options.
 *
 * @public
 */
export const formatDate = (
  data: LocaleData,
  date: CalendarDate | ZonedDateTime | Date,
  options?: DateFormatOptions,
): string => {
  return _formatDate(data, stringValue(), date, options);
};

/**
 * Format a calendar date to a parts array using the given options.
 *
 * @public
 */
export const formatDateToParts = (
  data: LocaleData,
  date: CalendarDate | ZonedDateTime | Date,
  options?: DateFormatOptions,
): Part[] => {
  return _formatDate(data, partsValue(), date, options);
};

/**
 * Formats a date-time interval for the given skeleton to string.
 *
 * @public
 */
export const formatDateInterval = (
  data: LocaleData,
  start: CalendarDate | ZonedDateTime | Date,
  end: CalendarDate | ZonedDateTime | Date,
  options?: DateIntervalFormatOptions,
): string => {
  return _formatInterval(data, stringValue(), start, end, options);
};

/**
 * Formats a date-time interval for the given skeleton to an array of parts.
 *
 * @public
 */
export const formatDateIntervalToParts = (
  data: LocaleData,
  start: CalendarDate | ZonedDateTime | Date,
  end: CalendarDate | ZonedDateTime | Date,
  options?: DateIntervalFormatOptions,
): Part[] => {
  return _formatInterval(data, partsValue(), start, end, options);
};

// TODO: need to sort out the options
// formatRelativeTime(start: CalendarDate | ZonedDateTime, end: CalendarDate | ZonedDateTime,
//     options?: RelativeTimeFormatOptions): string {
//   options = options || DEFAULT_RELTIME_OPTIONS;
//   const params = getNumberParams(data, options.nu);
//   const calendar = this.internals.calendars.selectCalendar(data);
//   start = convertDateTo(data, calendar, start);
//   end = convertDateTo(data, calendar, end, start.timeZoneId());
//   return this.internals.dateFields.formatRelativeTime(
//     data, start, end, options, params);
// }

/**
 * Formats a relative time field to string.
 *
 * @public
 */
export const formatRelativeTimeField = (
  data: LocaleData,
  value: DecimalArg,
  field: RelativeTimeFieldType,
  options?: RelativeTimeFieldFormatOptions,
): string => {
  options = options || { width: 'wide' };
  const transform = getContextTransformInfo(data);
  const params = getNumberParams(data, options.nu);
  return renderRelativeTimeField(data, value, field, options, params, transform);
};

/**
 * Formats the relative time from a start to end date.
 *
 * @public
 */
export const formatRelativeTime = (
  data: LocaleData,
  start: CalendarDate | ZonedDateTime | Date,
  end: CalendarDate | ZonedDateTime | Date,
  options?: RelativeTimeFormatOptions,
): string => {
  options = options || { width: 'wide', maximumFractionDigits: 0, group: true };

  const calendar = selectCalendar(data, options.ca);
  const _start = convertDateTo(data, calendar, start);
  const _end = convertDateTo(data, calendar, end);

  let [field, amount] = dateRelativeTime(_start, _end, options.field, {
    rollupFractional: true,
    includeWeeks: options.allowWeeks,
  });
  if (field === 'millis') {
    amount /= 1000.0;
    field = 'second';
  }

  // See if we can use day of week formatting
  let _field = field as RelativeTimeFieldType;
  if (options.dayOfWeek && field === 'week' && dateDayOfWeek(_start) === dateDayOfWeek(_end)) {
    const dow = dateDayOfWeek(_end) - 1;
    _field = DOW_FIELDS[dow];
  }

  return formatRelativeTimeField(data, amount, _field, options);
};

/**
 * Format a raw date pattern. Note: This should not be used, but is available for debugging or
 * extreme cases where an application must implement a custom format.
 *
 * @public
 */
export const formatDateRaw = (
  data: LocaleData,
  date: CalendarDate | ZonedDateTime | Date,
  options?: DateRawFormatOptions,
): string => {
  return _formatDateRaw(data, stringValue(), date, options || {});
};

/**
 * Formats a date-time value to an array of parts using a raw date-time pattern.
 *
 * Warning: You should not use this for general formatting.
 *
 * @public
 */
export const formatDateRawToParts = (
  data: LocaleData,
  date: CalendarDate | ZonedDateTime | Date,
  options?: DateRawFormatOptions,
): Part[] => {
  return _formatDateRaw(data, partsValue(), date, options || {});
};

/**
 * Formats a date and time string together using a wrapper format of the given width. This can be
 * used when you need to format a date and time string separately and join them together.
 *
 * @public
 */
export const formatDateWrapper = (
  data: LocaleData,
  date: string,
  time: string,
  options?: DateWrapperFormatOptions,
): string => {
  return _formatDateWrapper(data, stringValue(), date, time, options || {});
};

/**
 * Formats  date and time `Part[]` together using a wrapper format of the given width. This can be
 * used when you need to format a date and time string separately and join them together.
 *
 * @public
 */
export const formatDateWrapperToParts = (
  data: LocaleData,
  date: Part[],
  time: Part[],
  options?: DateWrapperFormatOptions,
): Part[] => {
  return _formatDateWrapper(data, partsValue(), date, time, options || {});
};

/**
 * Return information about the locale's preferred and allowed time cycles.
 *
 * @public
 */
export const timeData = (data: LocaleData): TimeData => {
  const patterns = _getPatterns(data, 'gregory');
  const [allowed, preferred] = patternsTimeData(patterns);
  return {
    preferred,
    allowed: allowed.split(' '),
  };
};

/**
 * Return an array containing the official TZDB timezone identifiers.
 *
 * @public
 */
export const timeZoneIds = (): string[] => tzZoneIds();

/**
 * Resolve a timezone id / alias to the official TZDB identifier.
 *
 * @public
 */
export const resolveTimeZoneId = (zoneid: string): string | undefined =>
  tzResolveId(substituteZoneAlias(zoneid));

/**
 * Return additional information for a timezone id, including the
 * localized exemplar city, e.g. `{ id: "America/New_York", city: { name: "New York" } }`
 *
 * @public
 */
export const timeZoneInfo = (data: LocaleData, zoneid: string): TimeZoneInfo => {
  const tz = data.schema.TimeZones;
  let exemplarCities = EXEMPLAR_CITIES.get(data);
  if (!exemplarCities) {
    exemplarCities = vectorMapping(tz.exemplarCity, data);
    EXEMPLAR_CITIES.set(data, exemplarCities);
  }
  const id = resolveTimeZoneId(zoneid) || 'Factory';
  const stableid = getStableTimeZoneId(id);
  const city = exemplarCities[stableid] || exemplarCities['Etc/Unknown'];
  const metazone = (currentMetazone(id) || '') as MetaZoneType;
  const names: MetazoneNames = {
    long: { generic: '', standard: '', daylight: '' },
    short: { generic: '', standard: '', daylight: '' },
  };
  for (const key of TimeZoneTypeIndex.keys) {
    names.long[key] = vectorGet(tz.metaZones.long, data, key, metazone);
    names.short[key] = vectorGet(tz.metaZones.short, data, key, metazone);
  }
  const { countries, latitude, longitude, stdoffset } = tzZoneMeta(id)!; // Factory fallback will return a record
  return {
    id,
    city: {
      name: city,
    },
    countries,
    latitude,
    longitude,
    stdoffset,
    metazone,
    names,
  };
};

/**
 * Lookup the time zone info for the given UTC timestamp (in milliseconds).
 * Info includes the abbreviation, offset, daylight savings flag. Returns undefined if the
 * zoneid doesn't exist.
 *
 * @public
 */
export const timeZoneFromUTC = (utc: number, zoneid: string): ZoneInfo | undefined =>
  tzFromUTC(zoneid, utc);

/**
 * Lookup the time zone info for the given local "wall clock" timestamp (in milliseconds).
 * It also returns the corresponding UTC timestamp. Info includes the abbreviation, offset,
 * daylight savings flag. Returns undefined if the zoneid doesn't exist.
 *
 * @public
 */
export const timeZoneFromWall = (wall: number, zoneid: string): [number, ZoneInfo] | undefined =>
  tzFromWall(zoneid, wall);

/**
 * Convert a time period into a quantiy sequence, for unit formatting, e.g. "1 year, 2 months".
 *
 * @public
 */
export const timePeriodToQuantity = (period: Partial<TimePeriod>): Quantity[] => {
  const q: Quantity[] = [];
  for (const f of TIME_PERIOD_FIELDS) {
    const v = period[f];
    if (v) {
      const unit = f === 'millis' ? 'millisecond' : f;
      q.push({ unit, value: v });
    }
  }
  return q;
};

const _getPatterns = (data: LocaleData, type?: CalendarType): CalendarPatterns => {
  const calendar = selectCalendar(data, type);
  return getCalendarPatterns(data, calendar);
};

/**
 * Copy fields, applying an optional context transform to the values.
 */
const _transformFields = (
  data: LocaleData,
  fields: any,
  type?: ContextTransformFieldType,
  context?: ContextType,
): any => {
  const res: any = {};
  if (fields) {
    for (const key of Object.keys(fields)) {
      const val = fields[key];
      res[key] =
        typeof val === 'string'
          ? _transformField(data, val, type, context)
          : _transformFields(data, val, type, context);
    }
  }
  return res;
};

const _transformField = (
  data: LocaleData,
  field: string,
  type?: ContextTransformFieldType,
  context?: ContextType,
): string => {
  const info = getContextTransformInfo(data);
  return context ? contextTransform(field, info, context, type) : field;
};

const _formatDate = <R>(
  data: LocaleData,
  value: AbstractValue<R>,
  date: CalendarDate | ZonedDateTime | Date,
  options?: DateFormatOptions,
): R => {
  options = options || { date: 'full' };
  const calendar = selectCalendar(data, options.ca);
  const params = getNumberParams(data, options.nu, 'default');

  date = convertDateTo(data, calendar, date);
  const req = getDateFormatRequest(data, date, options, params);
  const ctx = _context(data, date, params, options.context, options.alt);
  return renderDateTime(calendar, ctx, value, true, req.date, req.time, req.wrapper);
};

const _formatInterval = <R>(
  data: LocaleData,
  value: AbstractValue<R>,
  start: CalendarDate | ZonedDateTime | Date,
  end: CalendarDate | ZonedDateTime | Date,
  options?: DateIntervalFormatOptions,
): R => {
  // options = options || { skeleton: 'yMd' };
  options = options || {};
  const calendar = selectCalendar(data, options.ca);
  start = convertDateTo(data, calendar, start);
  end = convertDateTo(data, calendar, end);

  // const fieldDiff = fieldOfVisualDifference(data, start, end);
  const wrap = options.wrap || 'medium';
  const params = getNumberParams(data, options.nu, 'default');
  const req = getDateIntervalFormatRequest(data, calendar, start, end, options, params);

  const ctx = _context(data, start, params, options.context, options.alt);
  if (req.skeleton) {
    const { ca, nu } = options;
    const r = getDateFormatRequest(
      data,
      start,
      { ca, nu, skeleton: req.skeleton, wrap: options.wrap, atTime: options.atTime },
      params,
    );
    const _start = renderDateTime(calendar, ctx, value, true, r.date, r.time, r.wrapper);
    ctx.date = end;
    const _end = renderDateTime(calendar, ctx, value, false, r.date, r.time, r.wrapper);
    const wrapper = parseWrapper(req.wrapper);
    value.wrap(wrapper, [_start, _end]);
    return value.render();
  }

  const patterns = getCalendarPatterns(data, calendar);
  const atTime = options.atTime === false ? false : true;

  let _date: R | undefined;
  if (req.date) {
    _date = renderDateTime(calendar, ctx, value, true, req.date);
  }

  if (req.time) {
    const _time = renderDateTime(calendar, ctx, value, true, req.time);
    const wrapper = parseWrapper(patternsWrapperPattern(patterns, wrap, atTime));
    value.wrap(wrapper, [_time, _date!]);
    return value.render();
  }

  if (req.range) {
    const ctx = _context(data, start, params, options.context, options.alt);
    const _range = renderDateInterval(calendar, ctx, value, !_date, end, req.range);
    if (!_date) {
      return _range;
    }
    // Note: This case is covered in ICU but not mentioned in the CLDR docs. Use the MEDIUM
    // dateTimeFormat to join a common date with a time range.
    // Ticket referencing the discrepancy:
    // https://www.unicode.org/cldr/trac/ticket/11158
    // Docs don't mention this edge case:
    // https://www.unicode.org/reports/tr35/tr35-dates.html#intervalFormats
    const wrapper = parseWrapper(patternsWrapperPattern(patterns, wrap, atTime));
    value.wrap(wrapper, [_range, _date]);
    return value.render();
  }
  // Here, the request should always be:
  //   { date }
  //   { date, range }
  //   { range }
  // Unless the schema config contains no relevant patterns.
  return _date || value.empty();
};

const _context = <T extends CalendarDate>(
  data: LocaleData,
  date: T,
  params: NumberParams,
  context?: ContextType,
  alt: DateFormatAltOptions = {},
): CalendarContext<T> => {
  return {
    alt,
    date,
    bundle: data,
    system: params.system,
    latnSystem: params.latnSystem,
    context,
    transform: getContextTransformInfo(data),
  };
};

const _formatDateRaw = <R>(
  data: LocaleData,
  value: AbstractValue<R>,
  date: CalendarDate | ZonedDateTime | Date,
  options: DateRawFormatOptions,
): R => {
  if (!options.pattern) {
    return value.empty();
  }
  const pattern = parseDatePattern(options.pattern);
  const calendar = selectCalendar(data, options.ca);
  const params = getNumberParams(data, options.nu, 'default');
  const ctx = _context(
    data,
    convertDateTo(data, calendar, date),
    params,
    options.context,
    options.alt,
  );
  return renderDateTime(calendar, ctx, value, true, pattern);
};

const _formatDateWrapper = <R>(
  data: LocaleData,
  value: AbstractValue<R>,
  date: R,
  time: R,
  options: DateWrapperFormatOptions,
): R => {
  const calendar = selectCalendar(data, options.ca);
  const patterns = getCalendarPatterns(data, calendar);
  const atTime = options.atTime === false ? false : true;
  const wrapper = parseWrapper(patternsWrapperPattern(patterns, options.width || 'medium', atTime));
  value.wrap(wrapper, [time, date]);
  return value.render();
};

const convertDate = <T>(
  data: LocaleData,
  cons: CalendarFromUnixEpoch<T>,
  date: CalendarDate | ZonedDateTime | Date,
): T => {
  if (date instanceof Date) {
    date = { date, zoneId: 'UTC' } as ZonedDateTime;
  }
  return isCalendarDate(date)
    ? convertEpoch(data, cons, dateUnixEpoch(date), dateTimeZoneId(date))
    : convertEpoch(data, cons, getEpochUTC(date.date), date.zoneId || 'UTC');
};

const convertEpoch = <T>(
  data: LocaleData,
  cons: CalendarFromUnixEpoch<T>,
  epoch: number,
  zoneId: string,
): T => {
  return cons(epoch, zoneId, weekFirstDay(data.region), weekMinDays(data.region));
};

const convertDateTo = (
  data: LocaleData,
  target: CalendarType,
  date: CalendarDate | ZonedDateTime | Date,
  zoneId?: string,
): CalendarDate => {
  if (
    isCalendarDate(date) &&
    target === dateType(date) &&
    (!zoneId || zoneId === dateTimeZoneId(date))
  ) {
    return date;
  } else if (date instanceof Date) {
    date = { date, zoneId } as ZonedDateTime;
  }

  switch (target) {
    case 'buddhist':
      return toBuddhistDate(data, date);
    case 'japanese':
      return toJapaneseDate(data, date);
    case 'persian':
      return toPersianDate(data, date);
  }
  // All others convert to 'gregory'
  return toGregorianDate(data, date);
};

const getEpochUTC = (date: Date | number): number => {
  const n = +date;
  return isFinite(n) ? n : 0;
};
