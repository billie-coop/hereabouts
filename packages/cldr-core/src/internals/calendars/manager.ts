import { DateTimePatternField, type DateTimePatternFieldType } from '@phensley/cldr-types';
import { decimal } from '@phensley/decimal';
import { pluralCardinal } from '@phensley/plurals';
import type { DateFormatOptions, DateIntervalFormatOptions } from '../../common/calendars';
import type { NumberParams } from '../../common/private';
import type { LocaleData } from '../../locale-data';
import type { DateTimeNode } from '../../parsing/date';
import {
  dateDayOfMonth,
  dateEra,
  dateFieldOfVisualDifference,
  dateHour,
  dateHourOfDay,
  dateIsAM,
  dateMinute,
  dateMonth,
  dateWeekOfMonth,
  dateWeekOfYear,
  dateYear,
} from '../../systems/calendars/calendar';
import type { CalendarDate } from '../../systems/calendars/types';
import { Field } from './fields';
import { flexDayPeriod, parseDatePattern, selectCalendar } from './internal';
import {
  type CalendarPatterns,
  calendarPatterns,
  patternsAdjust,
  patternsAvailablePattern,
  patternsDatePattern,
  patternsGetCachedRequest,
  patternsIntervalFallback,
  patternsMatchAvailable,
  patternsMatchInterval,
  patternsParseSkeleton,
  patternsSetCachedRequest,
  patternsTimePattern,
  patternsWrapperPattern,
} from './patterns';
import {
  type DateSkeleton,
  type SkeletonField,
  skeletonCompound,
  skeletonHas,
  skeletonMonthWidth,
  skeletonSplit,
} from './skeleton';
import type { DateFormatRequest, DateIntervalFormatRequest } from './types';

const maskedFOVDFields: Field[] = [
  Field.ERA,
  Field.YEAR,
  Field.MONTH,
  Field.DAY,
  Field.DAYPERIOD,
  Field.HOUR,
  Field.MINUTE,
  Field.SECOND,
];

const minutes = (d: CalendarDate): number => dateHourOfDay(d) * 60 + dateMinute(d);

// Per-locale cache of the patterns for each calendar.
const PATTERNS = /*#__PURE__*/ new WeakMap<LocaleData, { [calendar: string]: CalendarPatterns }>();

/**
 * Patterns for the calendar, built on first use for each locale data object. Calendars not
 * enabled in the schema config use the Gregorian patterns.
 *
 * @internal
 */
export const getCalendarPatterns = (data: LocaleData, calendar: string): CalendarPatterns => {
  let cache = PATTERNS.get(data);
  if (cache === undefined) {
    cache = {};
    PATTERNS.set(data, cache);
  }
  let p = cache[calendar];
  if (p === undefined) {
    p = buildPatterns(data, calendar);
    cache[calendar] = p;
  }
  return p;
};

const buildPatterns = (data: LocaleData, calendar: string): CalendarPatterns => {
  // calendars config array should always be non-empty
  const schema = data.schema;
  if ((data.config.calendars || []).indexOf(calendar) !== -1) {
    switch (calendar) {
      case 'buddhist':
        return calendarPatterns(data, schema.Buddhist, false);
      case 'japanese':
        return calendarPatterns(data, schema.Japanese, false);
      case 'persian':
        return calendarPatterns(data, schema.Persian, false);
    }
  }
  return calendarPatterns(data, schema.Gregorian, true);
};

export const getDateFormatRequest = (
  data: LocaleData,
  date: CalendarDate,
  options: DateFormatOptions,
  params: NumberParams,
): DateFormatRequest => {
  const calendar = selectCalendar(data, options.ca);
  const patterns = getCalendarPatterns(data, calendar);

  let dateKey = supportedOption(options.datetime || options.date);
  const timeKey = supportedOption(options.datetime || options.time);
  const wrapKey = supportedOption(options.wrap);
  const skelKey = options.skeleton || '';

  if (!dateKey && !timeKey && !skelKey) {
    dateKey = 'long';
  }

  const atTime = options.atTime === false ? false : true;

  let wrapper = '';
  if (wrapKey) {
    wrapper = patternsWrapperPattern(patterns, wrapKey, atTime);
  } else if (dateKey && timeKey) {
    wrapper = patternsWrapperPattern(patterns, dateKey, atTime);
  }

  const req: DateFormatRequest = { wrapper, params };
  if (dateKey) {
    req.date = patternsDatePattern(patterns, dateKey);
  }
  if (timeKey) {
    req.time = patternsTimePattern(patterns, timeKey);
  }

  // We have both standard formats, we're done
  if (req.date && req.time) {
    return req;
  }

  // We have at least a date/time standard format.
  if (req.date || req.time) {
    // If no skeleton specified, we're done
    if (!skelKey) {
      return req;
    }
  }

  // Cache best-fit results per raw skeleton, plus flags for which
  // standard date/time formats and wrapper are also in play. Mixing
  // a standard format with a skeleton changes the result for the
  // same skeleton, so the flags are part of the key. The original
  // canonical skeleton key collapsed field widths (e.g. 'SS' to 'S'),
  // which changed the adjusted output, so the raw skeleton is used.
  //
  // The resolved pattern also depends on the date for plural-category-
  // dependent skeletons (e.g. 'yw'/'MMMMW' pick a per-plural-category
  // pattern -- see CalendarPatterns.getAvailablePattern) and on the
  // numbering system, since fractional-second adjustment embeds
  // params.symbols.decimal in the nodes. Both are included in the
  // cache key (claude-review.md bugs 1-2).
  let pluralKey = '';
  if (!req.date && /[wW]/.test(skelKey)) {
    const p = data.plurals;
    const wkM = pluralCardinal(p, decimal(dateWeekOfMonth(date)));
    const wkY = pluralCardinal(p, decimal(dateWeekOfYear(date)));
    pluralKey = `${wkM}\u0001${wkY}`;
  }
  const cacheKey = `${skelKey}\t${dateKey}\t${timeKey}\t${wrapKey}\t${pluralKey}\t${params.numberSystemName}`;
  let dateSkel: DateSkeleton | undefined;
  const entry = patternsGetCachedRequest(patterns, cacheKey);
  if (entry) {
    // Reuse the previously matched patterns
    req.date = entry.date;
    req.time = entry.time;
    dateSkel = entry.dateSkel;
  } else {
    // No cached entry, so parse the skeleton and perform a best-fit
    // match against all available formats.
    let query: DateSkeleton;

    // We have a standard date or time pattern along with a skeleton.
    // We split the skeleton into date/time parts, then use the one
    // that doesn't conflict with the specified standard format.
    if (req.date || req.time) {
      query = patternsParseSkeleton(patterns, skelKey);
      const time = skeletonSplit(query);
      if (req.date) {
        query = time;
      }
    } else {
      // No standard format specified, so just parse the skeleton
      query = patternsParseSkeleton(patterns, skelKey);
    }

    let timeQuery: DateSkeleton | undefined;
    let timeSkel: DateSkeleton | undefined;

    // Check if skeleton specifies date or time fields, or both.
    if (skeletonCompound(query)) {
      // Separate into a date and a time skeletons.
      timeQuery = skeletonSplit(query);
      dateSkel = patternsMatchAvailable(patterns, query);
      timeSkel = patternsMatchAvailable(patterns, timeQuery);
    } else if (query.isDate) {
      dateSkel = patternsMatchAvailable(patterns, query);
    } else {
      timeQuery = query;
      timeSkel = patternsMatchAvailable(patterns, query);
    }

    if (dateSkel) {
      req.date = managerAvailablePattern(patterns, date, query, dateSkel, params);
    }
    if (timeQuery && timeSkel) {
      req.time = managerAvailablePattern(patterns, date, timeQuery, timeSkel, params);
    }

    patternsSetCachedRequest(patterns, cacheKey, { date: req.date, time: req.time, dateSkel });
  }

  if (!wrapKey) {
    if (dateSkel && req.date && req.time) {
      // Select wrapper based on fields in date skeleton
      req.wrapper = selectWrapper(patterns, dateSkel, req.date, atTime);
    } else {
      // Select wrapper based on width of standard date format
      req.wrapper = patternsWrapperPattern(patterns, dateKey || 'short', atTime);
    }
  }

  return req;
};

/**
 * Formats datetime intervals.
 *
 * NOTE: The ICU implementation of CLDR datetime range formatting
 * contains inconsistent behavior (see code at end of comment below).
 *
 * The skeleton data for interval formatting consists of a series of
 * separate date and time patterns. No interval skeletons / formats
 * contain both date and time fields.
 *
 * For example, the data might contain the following:
 *
 *  ['y', 'yM', 'yMd', 'h', 'hm', 'H', 'Hm']
 *
 * However a caller can pass input skeleton containing a mix of date and
 * time fields. We split this skeleton into separate date and time
 * skeletons, and perform formatting by considering the possibilities below.
 *
 * Variables:
 *
 *   start         = start datetime
 *   end           = end datetime
 *   skeleton      = input skeleton
 *   fovd          = fieldOfVisualDifference(start, end)
 *   date_differs  = fovd in ('era', 'year', 'month', 'day')
 *   time_differs  = fovd in ('dayperiod', 'hour', 'minute')
 *   equal         = fovd in ('second', undefined)
 *
 * Formatting Rules:
 *
 * 1. Skeleton requests both date and time fields
 *
 *   a. IF time_differs, format date followed by time range
 *      e.g. "date, time0 - time 1"
 *
 *   b. ELSE IF date_differs, format generic fallback
 *      e.g. "date0, time0 - date1, time1"
 *
 *   c. ELSE format the date + time standalone
 *      e.g. "date0, time0"
 *
 * 2: Skeleton only requests date fields
 *
 *   a. IF date_differs, format date range
 *      e.g. "date0 - date1"
 *
 *   b. ELSE format date standalone
 *
 * 3: Skeleton only requests time fields
 *
 *   a. IF time_differs, format time range
 *      e.g. "time0 - time1"
 *
 *   b. ELSE format time standalone
 *
 * ========================================================
 *
 * Example of inconsistency of ICU range formatting.
 * The output was produced using Node 23.7.0 and ICU 74.
 * ICU4J version 75 produces the same output.
 *
 *     const OPTS = [
 *       { day: 'numeric' },
 *       { day: 'numeric', minute: '2-digit' }
 *     ];
 *     const start = new Date(Date.UTC(2007, 0, 1, 10, 12, 0));
 *     const end = new Date(Date.UTC(2008, 0, 2, 11, 13, 0));
 *     for (let i = 0; i < OPTS.length; i++) {
 *       const opts = OPTS[i];
 *       const fmt = new Intl.DateTimeFormat('en', opts);
 *       console.log(fmt.formatRange(start, end));
 *     }
 *
 * This code formats two dates two different ways:
 *
 *   2007-Jan-01 10:12
 *   2008-Jan-02 11:13
 *
 * 1. Display the day: { day: 'numeric' }
 *
 *  ICU auto-expands the selected pattern to include the year
 *  and month:
 *
 *    "1/1/2007 – 1/2/2008"
 *
 *  This adds context needed to understand the two
 *  dates are separated by 367 days.
 *
 * 2. Display day and minute: { day: 'numeric', minute: '2-digit' }
 *
 *  No pattern expansion occurs, we get only what we
 *  requested. The output is highly ambiguous since it's
 *  missing year, month, and hour fields:
 *
 *    "1, 12 – 2, 13"
 *
 * Additional context is added in one case but not in the other.
 *
 * IMO it makes more sense to leave the input skeleton as untouched
 * as possible, leaving it up to the caller to decide which
 * fields to request.
 */
export const getDateIntervalFormatRequest = (
  data: LocaleData,
  calendar: string,
  start: CalendarDate,
  end: CalendarDate,
  options: DateIntervalFormatOptions,
  params: NumberParams,
): DateIntervalFormatRequest => {
  const patterns = getCalendarPatterns(data, calendar);
  const wrapper = patternsIntervalFallback(patterns);
  const req: DateIntervalFormatRequest = { params, wrapper };

  // Determine whether the largest field of visual difference (fovd)
  // is a date or time field, or neither.  Note that interval patterns
  // in the CLDR data do not include seconds, so we consider dates
  // that only differ in seconds to be equivalent.
  const fovd = dateFieldOfVisualDifference(start, end) || 's';
  const dateDiffers = 'GyMd'.indexOf(fovd) !== -1;
  const timeDiffers = 'BahHm'.indexOf(fovd) !== -1;

  // If main skeleton input is not used, select either date or
  // time based on whether the date or time differ.
  let skeleton = options.skeleton;
  if (!skeleton) {
    if (dateDiffers && options.date) {
      skeleton = options.date;
    } else {
      skeleton = options.time;
    }
  }

  // If no skeleton is defined, choose a simple default
  let defaulted = false;
  if (!skeleton) {
    skeleton = dateDiffers ? 'yMMMd' : 'jm';
    defaulted = true;
  }

  // At this point the skeleton contains at least one field.

  // Parse the input skeleton.
  let query = patternsParseSkeleton(patterns, skeleton);

  // If we are not using a default pattern, check a few cases and
  // augment the skeleton accordingly.
  if (!defaulted) {
    // In non-strict mode, if the query requested time fields only
    // and the date fields differ, insert some context.
    if (!options.strict && dateDiffers && !query.isDate) {
      skeleton = `yMMMd` + skeleton;
      query = patternsParseSkeleton(patterns, skeleton);
    }

    // Interval skeletons for bare seconds 's' and minutes 'm' do not
    // exist in the CLDR data. We fill in the gap to ensure we at least
    // match on the correct hour field for the current locale.
    const largest = largestSkeletonField(query);
    if ('sm'.indexOf(largest) !== -1) {
      skeleton = (largest === 's' ? 'jm' : 'j') + skeleton;
      query = patternsParseSkeleton(patterns, skeleton);
    }
  }

  // BEGIN formatting rules.

  // RULE 1. Skeleton contains both date and time fields
  if (skeletonCompound(query)) {
    if (timeDiffers) {
      // RULE 1a. IF time_differs, format date followed by time range
      const timeQuery = skeletonSplit(query);
      req.date = matchAvailablePattern(patterns, start, query, params);
      query = timeQuery;
      // ... (1a) intentional fall through to format date + time range
    } else if (dateDiffers) {
      // RULE 1b. ELSE IF date_differs, format generic fallback
      req.skeleton = skeleton;
      return req;
    } else {
      // RULE 1c. ELSE format the date + time standalone
      const timeQuery = skeletonSplit(query);
      req.date = matchAvailablePattern(patterns, start, query, params);
      req.time = matchAvailablePattern(patterns, start, timeQuery, params);
      return req;
    }
  }

  // RULE 2: skeleton only contains date fields
  // RULE 2b ELSE format date standalone (!dateDiffers)
  if (!dateDiffers && !query.isTime) {
    req.date = matchAvailablePattern(patterns, start, query, params);
    return req;
  }

  // Something differs in date or time fields
  if (fovd !== 's') {
    // RULE 2a IF dateDiffers, format date range
    // RULE 3a IF timeDiffers, format time range
    const match = patternsMatchInterval(patterns, query);
    if (match && match.data) {
      // Compute masked field of visual difference using the found skeleton.
      const fovd = maskedFOVD(data, start, end, match.skeleton);

      // Use fovd to select final pattern. Since it was masked by the matched
      // skeleton, the fovd should completely cover the set of patterns in the data.
      const pattern = match.data.patterns[fovd];

      const parsedPattern = parseDatePattern(pattern || '');
      /* istanbul ignore else -- @preserve */
      if (parsedPattern.length) {
        req.range = patternsAdjust(parsedPattern, query, match.skeleton, params.symbols.decimal);
      }
    }
  } else {
    // RULE 3b ELSE format time standalone
    req.date = matchAvailablePattern(patterns, start, query, params);
  }

  return req;
};

export const largestSkeletonField = (skeleton: DateSkeleton): DateTimePatternFieldType => {
  for (const field of maskedFOVDFields) {
    const info = skeleton.info[field];
    if (info) {
      return info.field as DateTimePatternFieldType;
    }
  }
  return DateTimePatternField.SECOND;
};

export const maskedFOVD = (
  data: LocaleData,
  start: CalendarDate,
  end: CalendarDate,
  skeleton: DateSkeleton,
): DateTimePatternFieldType => {
  let smallest: SkeletonField | undefined;
  for (const field of maskedFOVDFields) {
    const info = skeleton.info[field];
    if (!info) {
      continue;
    }

    smallest = info;
    switch (field) {
      case Field.ERA:
        if (dateEra(start) !== dateEra(end)) {
          return DateTimePatternField.ERA;
        }
        break;

      case Field.YEAR:
        if (dateYear(start) !== dateYear(end)) {
          return DateTimePatternField.YEAR;
        }
        break;

      case Field.MONTH:
        if (dateMonth(start) !== dateMonth(end)) {
          return DateTimePatternField.MONTH;
        }
        break;

      case Field.DAY:
        if (dateDayOfMonth(start) !== dateDayOfMonth(end)) {
          return DateTimePatternField.DAY;
        }
        break;

      case Field.DAYPERIOD:
        switch (info.field) {
          case 'a': // dayperiod
          case 'b': // dayperiod extended (resolve to 'a' for now)
            if (dateIsAM(start) !== dateIsAM(end)) {
              return DateTimePatternField.DAYPERIOD;
            }
            break;
          case 'B': // dayperiod flex
            if (dayperiodFlex(data, start) !== dayperiodFlex(data, end)) {
              return DateTimePatternField.DAYPERIOD_FLEX;
            }
            break;
        }
        break;

      case Field.HOUR:
        switch (info.field) {
          case 'h': // hour 1-12
          case 'K': // hour 0-11
            if (dateHour(start) !== dateHour(end)) {
              return DateTimePatternField.HOUR12;
            }
            break;

          case 'H': // hour 0-23
          case 'k': // hour 1-24
            if (dateHourOfDay(start) !== dateHourOfDay(end)) {
              return DateTimePatternField.HOUR24;
            }
            break;
        }
        break;

      case Field.MINUTE:
      case Field.SECOND:
        if (dateMinute(start) !== dateMinute(end)) {
          return DateTimePatternField.MINUTE;
        }
        break;
    }
  }

  // If we exhaust all fields of the skeleton, the two dates are equivalent
  // with respect to the fields masked by the skeleton. We return the smallest
  // field by default.

  return smallest ? (smallest.field as DateTimePatternFieldType) : DateTimePatternField.MINUTE;
};

const dayperiodFlex = (data: LocaleData, date: CalendarDate): string => {
  return flexDayPeriod(data, minutes(date)) || '';
};

const matchAvailablePattern = (
  patterns: CalendarPatterns,
  date: CalendarDate,
  query: DateSkeleton,
  params: NumberParams,
): readonly DateTimeNode[] | undefined => {
  const match = patternsMatchAvailable(patterns, query);
  return managerAvailablePattern(patterns, date, query, match, params);
};

const managerAvailablePattern = (
  patterns: CalendarPatterns,
  date: CalendarDate,
  query: DateSkeleton,
  match: DateSkeleton,
  params: NumberParams,
): readonly DateTimeNode[] | undefined => {
  const pattern = patternsAvailablePattern(patterns, date, match);
  /* istanbul ignore else -- @preserve */
  if (pattern.length) {
    return patternsAdjust(pattern, query, match, params.symbols.decimal);
  }
  // Base standard calendar formats are (currently) always defined.
  /* istanbul ignore next -- @preserve */
  return undefined;
};

/**
 * Select appropriate wrapper based on fields in the date skeleton.
 */
const selectWrapper = (
  patterns: CalendarPatterns,
  dateSkel: DateSkeleton,
  _date: readonly DateTimeNode[],
  atTime: boolean,
): string => {
  let wrapKey = 'short';
  const monthWidth = skeletonMonthWidth(dateSkel);
  const hasWeekday = skeletonHas(dateSkel, Field.WEEKDAY);
  if (monthWidth === 4) {
    wrapKey = hasWeekday ? 'full' : 'long';
  } else if (monthWidth === 3) {
    wrapKey = 'medium';
  }
  return patternsWrapperPattern(patterns, wrapKey, atTime);
};

const supportedOption = (key?: string): string => {
  switch (key) {
    case 'full':
    case 'long':
    case 'medium':
    case 'short':
      return key;
    default:
      return '';
  }
};
