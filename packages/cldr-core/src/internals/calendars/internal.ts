import type { CalendarSchema } from '@phensley/cldr-types';
import { type Cache, cacheGet, createCache } from '@phensley/cldr-utils';
import type { LocaleData } from '../../locale-data';
import {
  type DateTimeNode,
  intervalPatternBoundary,
  parseDatePattern as parseDatePatternRaw,
} from '../../parsing/date';
import type { CalendarDate, CalendarType } from '../../systems/calendars/types';
import type { AbstractValue } from '../../utils/render';
import { PATTERN_CACHE_SIZE, parseWrapper } from '../general/internal';
import { calendarIds, calendarPrefData } from './autogen.calprefs';
import {
  weekFirstDay as weekFirstDayData,
  weekMinDays as weekMinDaysData,
} from './autogen.weekdata';
import type { CalendarContext, CalendarFormatter } from './formatter';
import { calendarFormat } from './formatterimpl';

export { flexDayPeriod } from './rules';

let patternCache: Cache<readonly DateTimeNode[]> | undefined;
let hourPatternCache: Cache<[readonly DateTimeNode[], readonly DateTimeNode[]]> | undefined;

/**
 * Parse a date pattern (cached).
 *
 * @internal
 */
export const parseDatePattern = (raw: string): readonly DateTimeNode[] =>
  cacheGet(
    patternCache || (patternCache = createCache(parseDatePatternRaw, PATTERN_CACHE_SIZE)),
    raw,
  );

const parseHourPattern = (raw: string): [readonly DateTimeNode[], readonly DateTimeNode[]] => {
  const parts = raw.split(';');
  return [parseDatePattern(parts[0]), parseDatePattern(parts[1])];
};

/**
 * Positive or negative part of an hour pattern like '+HH:mm;-HH:mm' (cached).
 *
 * @internal
 */
export const getHourPattern = (raw: string, negative: boolean): readonly DateTimeNode[] => {
  const patterns = cacheGet(
    hourPatternCache || (hourPatternCache = createCache(parseHourPattern, PATTERN_CACHE_SIZE)),
    raw,
  );
  return patterns[negative ? 1 : 0];
};

/**
 * First day of the week for a region (1 = Sunday).
 *
 * @internal
 */
export const weekFirstDay = (region: string): number =>
  weekFirstDayData[region] || weekFirstDayData['001'];

/**
 * Minimum days in the first week of the year for a region.
 *
 * @internal
 */
export const weekMinDays = (region: string): number =>
  weekMinDaysData[region] || weekMinDaysData['001'];

/**
 * Schema parts used to format dates in the given calendar. Calendars not enabled in the schema
 * config use the Gregorian fields.
 *
 * @internal
 */
export const getCalendarFormatter = (
  data: LocaleData,
  calendar: CalendarType,
): CalendarFormatter => {
  const schema = data.schema;
  let s: CalendarSchema | undefined;
  if (calendarAvailable(data, calendar)) {
    switch (calendar) {
      case 'buddhist':
        s = schema.Buddhist;
        break;
      case 'japanese':
        s = schema.Japanese;
        break;
      case 'persian':
        s = schema.Persian;
        break;
    }
  }
  if (s === undefined) {
    s = schema.Gregorian;
  }
  return { cal: s, tz: schema.TimeZones };
};

/**
 * Format a date and/or time pattern, joining them with the wrapper pattern when both are given.
 *
 * @internal
 */
export const renderDateTime = <R>(
  calendar: CalendarType,
  ctx: CalendarContext<CalendarDate>,
  value: AbstractValue<R>,
  first: boolean,
  date?: readonly DateTimeNode[],
  time?: readonly DateTimeNode[],
  wrapper?: string,
): R => {
  const formatter = getCalendarFormatter(ctx.bundle, calendar);
  let _date: R | undefined;
  let _time: R | undefined;
  if (date) {
    calendarFormat(formatter, value, ctx, date, first);
    _date = value.render();
  }
  if (time) {
    calendarFormat(formatter, value, ctx, time, !!date && first);
    _time = value.render();
  }
  if (_date && _time && wrapper) {
    const pattern = parseWrapper(wrapper);
    value.wrap(pattern, [_time, _date]);
    return value.render();
  }
  return _date ? _date : _time ? _time : value.empty();
};

/**
 * Format an interval pattern: the part before the boundary with the start date, the rest
 * with the end date.
 *
 * @internal
 */
export const renderDateInterval = <R>(
  calendar: CalendarType,
  ctx: CalendarContext<CalendarDate>,
  value: AbstractValue<R>,
  first: boolean,
  end: CalendarDate,
  pattern: readonly DateTimeNode[],
): R => {
  const idx = intervalPatternBoundary(pattern);
  const s = renderDateTime(calendar, ctx, value, first, pattern.slice(0, idx));
  ctx.date = end;
  const e = renderDateTime(calendar, ctx, value, false, pattern.slice(idx));
  return value.join(s, e);
};

/**
 * Choose the calendar to use: the requested one, the locale's 'u-ca' extension, or the region's
 * preferred calendar, limited to calendars enabled in the schema config.
 *
 * @internal
 */
export const selectCalendar = (data: LocaleData, ca?: CalendarType): CalendarType => {
  let calendar = supportedCalendar(data, ca) || supportedCalendar(data, data.calendarSystem);
  if (!calendar) {
    const prefs = calendarPrefData[data.region] || [];
    for (const id of prefs) {
      // The calendar preference data current as of CLDR 48) will always choose
      // a calendar that is supported, so the else will never fire.
      calendar = supportedCalendar(data, calendarIds[id]);
      /* istanbul ignore else -- @preserve */
      if (calendar) {
        return calendar;
      }
    }
    // Fallback to World supported calendars, which will select Gregorian
    const index = calendarPrefData['001'][0];
    return calendarIds[index] as CalendarType;
  }
  return calendar;
};

const calendarAvailable = (data: LocaleData, c: string): boolean =>
  (data.config.calendars || []).indexOf(c) !== -1;

/**
 * Translates a string into a supported calendar type, or undefined if none match.
 */
const supportedCalendar = (data: LocaleData, c: string | undefined): CalendarType | undefined => {
  // NOTE: cldr constrains identifiers to have segments that are 8 characters in length,
  // so "gregorian" is invalid. instead, "gregory" is used. "islamic-umalqura" is valid since
  // each segment is <= 8 characters. check for "gregorian" here.
  if (c === 'gregorian') {
    c = 'gregory';
  }

  if (c && calendarAvailable(data, c)) {
    switch (c) {
      case 'buddhist':
      case 'iso8601':
      case 'japanese':
      case 'persian':
      case 'gregory':
        return c;
    }
  }
  return undefined;
};
