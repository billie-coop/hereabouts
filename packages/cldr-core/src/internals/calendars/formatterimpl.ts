import type { ContextTransformFieldType, Vector2Arrow } from '@phensley/cldr-types';

import type { DateTimeField, DateTimeNode } from '../../parsing/date';
import type { Bundle } from '../../resource/bundle';
import { fieldGet, vectorGet } from '../../schema/schema/arrows';
import {
  dateDayOfMonth,
  dateDayOfWeek,
  dateDayOfWeekInMonth,
  dateDayOfYear,
  dateEra,
  dateExtendedYear,
  dateHour,
  dateHourOfDay,
  dateIsAM,
  dateIsDaylightSavings,
  dateMetaZoneId,
  dateMilliseconds,
  dateMillisecondsInDay,
  dateMinute,
  dateModifiedJulianDay,
  dateMonth,
  dateOrdinalDayOfWeek,
  dateRelatedYear,
  dateSecond,
  dateTimeZoneId,
  dateTimeZoneOffset,
  dateTimeZoneStableId,
  dateWeekOfMonth,
  dateWeekOfYear,
  dateYear,
  dateYearOfWeekOfYear,
} from '../../systems/calendars/calendar';
import type { CalendarDate } from '../../systems/calendars/types';
import { numberingFormatString } from '../../systems/numbering/decimal';
import type { AbstractValue } from '../../utils/render';
import { contextTransform, formatWrapper } from '../general/internal';
import type { CalendarContext, CalendarFormatter } from './formatter';
import { flexDayPeriod, getHourPattern } from './internal';
import { getTZC } from './zoneutil';

const min = Math.min;

const widthKey1 = (w: number): string => (w === 5 ? 'narrow' : w === 4 ? 'wide' : 'abbreviated');

/**
 * Format a number using the main numbering system, with the given minimum integers.
 */
const _num = <T extends CalendarDate>(ctx: CalendarContext<T>, n: number, minInt: number): string =>
  numberingFormatString(ctx.system, n, false, minInt);

const _year = <T extends CalendarDate>(
  ctx: CalendarContext<T>,
  year: number,
  width: number,
): string => _num(ctx, width === 2 ? year % 100 : year, width);

export const calendarFormat = <R>(
  f: CalendarFormatter,
  val: AbstractValue<R>,
  ctx: CalendarContext<CalendarDate>,
  nodes: readonly DateTimeNode[],
  first: boolean = true,
): void => {
  const len = nodes.length;
  for (let i = 0; i < len; i++) {
    const n = nodes[i];
    if (typeof n === 'string') {
      val.add('literal', n);
      continue;
    }

    const w = n[1];
    let field: ContextTransformFieldType | undefined;
    let type = '';
    let value = '';

    // Date field symbol table
    // https://www.unicode.org/reports/tr35/tr35-dates.html#Date_Field_Symbol_Table

    switch (n[0]) {
      // ERA
      case 'G': {
        type = 'era';
        const era = `${dateEra(ctx.date)}`;
        const width = w === 5 ? 'narrow' : w === 4 ? 'names' : 'abbr';
        value = vectorGet(f.cal.eras, ctx.bundle, width, era, [ctx.alt.era!, 'none']);
        if (w !== 5) {
          field = w === 4 ? 'era-name' : 'era-abbr';
        }
        break;
      }

      // YEAR
      case 'y':
        type = 'year';
        value = _year(ctx, dateYear(ctx.date), w);
        break;

      // YEAR IN WEEK OF YEAR
      case 'Y':
        type = 'year';
        value = _year(ctx, dateYearOfWeekOfYear(ctx.date), w);
        break;

      // EXTENDED YEAR
      case 'u':
        type = 'year';
        value = _num(ctx, dateExtendedYear(ctx.date), w);
        break;

      // CYCLIC YEAR
      case 'U':
        type = 'cyclic-year';
        // TODO: support chinese cyclical years
        value = '';
        break;

      // RELATED YEAR
      case 'r':
        type = 'related-year';
        // Note: this is always rendered using 'latn' digits
        value = numberingFormatString(ctx.latnSystem, dateRelatedYear(ctx.date), false, w);
        break;

      // QUARTER
      case 'Q':
      case 'q':
        type = 'quarter';
        value = quarter(f, ctx, n);
        break;

      // MONTH FORMAT
      case 'M':
        type = 'month';
        value = month(f, ctx, n);
        switch (w) {
          case 3:
          case 4:
            field = 'month-format-except-narrow';
            break;
        }
        break;

      // MONTH STANDALONE
      case 'L':
        type = 'month';
        value = month(f, ctx, n);
        switch (w) {
          case 3:
          case 4:
            field = 'month-standalone-except-narrow';
            break;
        }
        break;

      // 'l' - deprecated

      // WEEK OF WEEK YEAR
      case 'w':
        type = 'week';
        value = _num(ctx, dateWeekOfYear(ctx.date), min(w, 2));
        break;

      // WEEK OF MONTH
      case 'W':
        type = 'week';
        value = _num(ctx, dateWeekOfMonth(ctx.date), 1);
        break;

      // DAY OF MONTH
      case 'd':
        type = 'day';
        value = _num(ctx, dateDayOfMonth(ctx.date), min(w, 2));
        break;

      // DAY OF YEAR
      case 'D':
        type = 'day';
        value = _num(ctx, dateDayOfYear(ctx.date), min(w, 3));
        break;

      // DAY OF WEEK IN MONTH
      case 'F':
        type = 'day';
        value = _num(ctx, dateDayOfWeekInMonth(ctx.date), 1);
        break;

      // MODIFIED JULIAN DAY
      case 'g':
        type = 'mjulian-day';
        value = _num(ctx, dateModifiedJulianDay(ctx.date), w);
        break;

      // WEEKDAY FORMAT
      case 'E':
        type = 'weekday';
        value = _weekday(ctx.bundle, f.cal.format.weekdays, ctx.date, w);
        if (w !== 5) {
          field = 'day-format-except-narrow';
        }
        break;

      // WEEKDAY LOCAL
      case 'e':
        type = 'weekday';
        value = _weekdayLocal(f, ctx, n, false);
        break;

      // WEEKDAY LOCAL STANDALONE
      case 'c':
        type = 'weekday';
        value = _weekdayLocal(f, ctx, n, true);
        if (w !== 5) {
          field = 'day-standalone-except-narrow';
        }
        break;

      // DAY PERIOD AM/PM
      case 'a': {
        const ampm = dateHourOfDay(ctx.date) < 12 ? 'am' : 'pm';
        const width = widthKey1(w);
        type = 'dayperiod';
        value = vectorGet(f.cal.format.dayPeriods, ctx.bundle, width, ampm, [
          ctx.alt.dayPeriod!,
          'none',
        ]);
        break;
      }

      // DAY PERIOD EXTENDED
      case 'b':
        type = 'dayperiod';
        value = dayPeriodExt(f, ctx, n);
        break;

      // DAY PERIOD FLEXIBLE
      case 'B':
        type = 'dayperiod';
        value = dayPeriodFlex(f, ctx, n);
        break;

      // HOUR 1-12 and 0-23
      case 'h':
      case 'H':
        type = 'hour';
        value = hour(ctx, n);
        break;

      // HOUR 0-11 and 1-24
      case 'K':
      case 'k':
        type = 'hour';
        value = hourAlt(ctx, n);
        break;

      // 'j', 'J', 'C' - input skeleton symbols, not present in formats

      // MINUTE
      case 'm':
        type = 'minute';
        value = _num(ctx, dateMinute(ctx.date), min(w, 2));
        break;

      // SECOND
      case 's':
        type = 'second';
        value = _num(ctx, dateSecond(ctx.date), min(w, 2));
        break;

      // FRACTIONAL SECOND
      case 'S':
        type = 'fracsec';
        value = fractionalSecond(ctx, n);
        break;

      // MILLISECONDS IN DAY
      case 'A':
        type = 'millis-in-day';
        value = _num(ctx, dateMillisecondsInDay(ctx.date), w);
        break;

      // TIMEZONE SPECIFIC NON-LOCATION
      case 'z':
        type = 'timezone';
        value = timezone_z(f, ctx, n);
        break;

      // TIMEZONE ISO-8601 EXTENDED
      case 'Z':
        type = 'timezone';
        value = timezone_Z(f, ctx, n);
        break;

      // TIMEZONE LOCALIZED
      case 'O':
        type = 'timezone';
        value = timezone_O(f, ctx, n);
        break;

      // TIMEZONE GENERIC NON-LOCATION
      case 'v':
        type = 'timezone';
        value = timezone_v(f, ctx, n);
        break;

      // TIMEZONE ID, EXEMPLAR CITY, GENERIC LOCATION
      case 'V':
        type = 'timezone';
        value = timezone_V(f, ctx, n);
        break;

      // TIMEZONE ISO-8601 BASIC, EXTENDED
      case 'X':
      case 'x':
        type = 'timezone';
        value = timezone_x(ctx, n);
        break;

      default:
        continue;
    }

    if (first && i === 0 && ctx.context && field) {
      value = contextTransform(value, ctx.transform, ctx.context, field);
    }
    val.add(type, value);
  }
};

const _formatQuarterOrMonth = (
  ctx: CalendarContext<CalendarDate>,
  format: Vector2Arrow<string, string>,
  value: number,
  width: number,
): string => {
  return width >= 3
    ? vectorGet(format, ctx.bundle, widthKey1(width), String(value))
    : _num(ctx, value, width);
};

const quarter = (
  f: CalendarFormatter,
  ctx: CalendarContext<CalendarDate>,
  node: DateTimeField,
): string => {
  const [field, width] = node;
  const format = field === 'Q' ? f.cal.format : f.cal.standAlone;
  const quarters = format.quarters;
  const quarter = (((dateMonth(ctx.date) - 1) / 3) | 0) + 1;
  return _formatQuarterOrMonth(ctx, quarters, quarter, width);
};

const month = (
  f: CalendarFormatter,
  ctx: CalendarContext<CalendarDate>,
  node: DateTimeField,
): string => {
  const format = node[0] === 'M' ? f.cal.format : f.cal.standAlone;
  return _formatQuarterOrMonth(ctx, format.months, dateMonth(ctx.date), node[1]);
};

const _weekday = (
  bundle: Bundle,
  format: Vector2Arrow<string, string>,
  date: CalendarDate,
  width: number,
): string => {
  const key2 = String(dateDayOfWeek(date));
  let key1 = 'abbreviated';
  switch (width) {
    case 6:
      key1 = 'short';
      break;
    case 5:
      key1 = 'narrow';
      break;
    case 4:
      key1 = 'wide';
      break;
  }
  return vectorGet(format, bundle, key1, key2);
};

const _weekdayLocal = (
  f: CalendarFormatter,
  ctx: CalendarContext<CalendarDate>,
  node: DateTimeField,
  standAlone: boolean,
): string => {
  const { bundle, date } = ctx;
  let width = node[1];
  if (width > 2) {
    const format = standAlone ? f.cal.standAlone : f.cal.format;
    return _weekday(bundle, format.weekdays, date, width);
  }
  const ord = dateOrdinalDayOfWeek(date);
  if (standAlone) {
    width = 1;
  }
  return numberingFormatString(ctx.system, ord, false, width);
};

const dayPeriodExt = (
  f: CalendarFormatter,
  ctx: CalendarContext<CalendarDate>,
  node: DateTimeField,
): string => {
  const { bundle, date } = ctx;
  const key1 = widthKey1(node[1]);
  const key2 = dateIsAM(date) ? 'am' : 'pm';
  let key2ext = key2;
  if (dateMinute(date) === 0) {
    const hour = dateHourOfDay(date);
    key2ext = hour === 0 ? 'midnight' : hour === 12 ? 'noon' : key2;
  }
  const format = f.cal.format.dayPeriods;
  // Try extended and if it doesn't exist fall back to am/pm
  return vectorGet(format, bundle, key1, [key2ext, key2], [ctx.alt.dayPeriod!, 'none']);
};

const dayPeriodFlex = (
  f: CalendarFormatter,
  ctx: CalendarContext<CalendarDate>,
  node: DateTimeField,
): string => {
  const { bundle, date } = ctx;
  const minutes = dateHourOfDay(date) * 60 + dateMinute(date);
  const key2 = flexDayPeriod(bundle, minutes);
  let res = '';
  if (key2) {
    const width = widthKey1(node[1]);
    // TODO: more compact fallbacks for alternatives
    res = vectorGet(f.cal.format.dayPeriods, bundle, width, key2, [ctx.alt.dayPeriod!, 'none']);
  }
  return res ? res : dayPeriodExt(f, ctx, node);
};

const hour = (ctx: CalendarContext<CalendarDate>, node: DateTimeField): string => {
  const { date } = ctx;
  const twelve = node[0] === 'h';
  let hour = twelve ? dateHour(date) : dateHourOfDay(date);
  if (twelve && hour === 0) {
    hour = 12;
  }
  return _num(ctx, hour, min(node[1], 2));
};

const hourAlt = (ctx: CalendarContext<CalendarDate>, node: DateTimeField): string => {
  const { date } = ctx;
  const twelve = node[0] === 'K';
  let hour = twelve ? dateHour(date) : dateHourOfDay(date);
  if (!twelve && hour === 0) {
    hour = 24;
  }
  return _num(ctx, hour, min(node[1], 2));
};

const fractionalSecond = (ctx: CalendarContext<CalendarDate>, node: DateTimeField): string => {
  let w = node[1];
  let m = dateMilliseconds(ctx.date);
  const d = w > 3 ? w - 3 : 0;
  w -= d;
  if (d > 0) {
    m *= 10 ** d;
  }
  // Milliseconds always have precision of 3, so handle the cases compactly.
  const n = w === 3 ? m : (w === 2 ? m / 10 : m / 100) | 0;
  return _num(ctx, n, node[1]);
};

/**
 * Timezone: short/long specific non-location format.
 * https://www.unicode.org/reports/tr35/tr35-dates.html#dfst-zone
 */
const timezone_z = (
  f: CalendarFormatter,
  ctx: CalendarContext<CalendarDate>,
  node: DateTimeField,
): string => {
  if (node[1] > 4) {
    return '';
  }
  const key2 = dateMetaZoneId(ctx.date);
  if (key2) {
    const { long, short } = f.tz.metaZones;
    const format = node[1] === 4 ? long : short;
    const name = vectorGet(
      format,
      ctx.bundle,
      dateIsDaylightSavings(ctx.date) ? 'daylight' : 'standard',
      key2,
    );
    if (name) {
      return name;
    }
  }
  return timezone_O(f, ctx, node);
};

/**
 * Timezone: ISO8601 basic/extended format, long localized GMT format.
 * https://www.unicode.org/reports/tr35/tr35-dates.html#dfst-zone
 */
const timezone_Z = (
  f: CalendarFormatter,
  ctx: CalendarContext<CalendarDate>,
  node: DateTimeField,
): string => {
  const width = node[1];
  if (width === 4) {
    return timezone_O(f, ctx, ['O', width]);
  }

  const [, negative, hours, minutes] = getTZC(dateTimeZoneOffset(ctx.date));
  let fmt = '';
  if (width <= 5) {
    // TODO: use number params
    fmt += negative ? '-' : '+';
    fmt += _num(ctx, hours, 2);
    if (width === 5) {
      fmt += ':';
    }
    fmt += _num(ctx, minutes, 2);
  }
  return fmt;
};

/**
 * Timezone: short/long localized GMT format.
 */
const timezone_O = (
  f: CalendarFormatter,
  ctx: CalendarContext<CalendarDate>,
  node: DateTimeField,
): string => {
  return node[1] === 1 || node[1] === 4 ? _wrapGMT(f, ctx, node[1] === 1) : '';
};

/**
 * Timezone: short/long generic non-location format.
 */
const timezone_v = (
  f: CalendarFormatter,
  ctx: CalendarContext<CalendarDate>,
  node: DateTimeField,
): string => {
  const width = node[1];
  if (width !== 1 && width !== 4) {
    return '';
  }
  let name = '';
  const key = dateMetaZoneId(ctx.date);
  const { long, short } = f.tz.metaZones;
  const format = width === 1 ? short : long;
  name = vectorGet(format, ctx.bundle, 'generic', key);
  return name ? name : timezone_O(f, ctx, ['O', width]);
};

/**
 * Timezone: short/long zone ID, exemplar city, generic location format.
 * https://www.unicode.org/reports/tr35/tr35-dates.html#dfst-zone
 */
const timezone_V = (
  f: CalendarFormatter,
  ctx: CalendarContext<CalendarDate>,
  node: DateTimeField,
): string => {
  const { bundle } = ctx;
  const stableId = dateTimeZoneStableId(ctx.date);
  const exemplarCity = f.tz.exemplarCity;
  let city = '';
  switch (node[1]) {
    case 4: {
      city = vectorGet(exemplarCity, bundle, stableId);
      if (!city) {
        return timezone_O(f, ctx, ['O', 4]);
      }
      const pattern = fieldGet(f.tz.regionFormat, bundle);
      return formatWrapper(pattern, [city]);
    }

    case 3:
      // Exemplar city for the timezone.
      city = vectorGet(exemplarCity, bundle, stableId);
      return city ? city : vectorGet(exemplarCity, bundle, 'Etc/Unknown');

    case 2: {
      const zoneId = dateTimeZoneId(ctx.date);
      return zoneId;
    }

    case 1:
      return 'unk';
  }
  return '';
};

/**
 * Timezone: ISO8601 basic format
 * https://www.unicode.org/reports/tr35/tr35-dates.html#dfst-zone
 */
const timezone_x = (ctx: CalendarContext<CalendarDate>, node: DateTimeField): string => {
  const [field, width] = node;
  const [offset, negative, hours, minutes] = getTZC(dateTimeZoneOffset(ctx.date));
  let fmt = '';
  if (width >= 1 && width <= 5) {
    // TR35: the UTC indicator 'Z' is used only when the offset is zero and the
    // specifier is X* (uppercase) — for every width 1..5. Lowercase 'x' renders
    // '+00', '+0000', '+00:00', ... instead (never 'Z').
    if (field === 'X' && offset === 0) {
      return 'Z';
    }
    fmt += negative ? '-' : '+';
    fmt += _num(ctx, hours, 2);
    if (width === 3 || width === 5) {
      fmt += ':';
    }
    if (width !== 1 || minutes > 0) {
      fmt += _num(ctx, minutes, 2);
    }
  }
  return fmt;
};

const _wrapGMT = (
  f: CalendarFormatter,
  ctx: CalendarContext<CalendarDate>,
  short: boolean,
): string => {
  const { bundle, date } = ctx;
  const _offset = dateTimeZoneOffset(date);
  if (_offset === 0) {
    return fieldGet(f.tz.gmtZeroFormat, bundle);
  }
  const [, negative, hours, minutes] = getTZC(_offset);

  const emitMins = !short || minutes > 0;
  const hourPattern = _hourPattern(f, bundle, negative);
  let fmt = '';
  for (const n of hourPattern) {
    if (typeof n === 'string') {
      const sep = n === '.' || n === ':';
      if (!sep || emitMins) {
        fmt += n;
      }
    } else {
      const [field, width] = n;
      if (field === 'H') {
        fmt += width === 1 ? _num(ctx, hours, 1) : _num(ctx, hours, short ? 1 : width);
      } else if (field === 'm' && emitMins) {
        fmt += _num(ctx, minutes, width);
      }
    }
  }

  const wrap = fieldGet(f.tz.gmtFormat, bundle);
  return formatWrapper(wrap, [fmt]);
};

const _hourPattern = (
  f: CalendarFormatter,
  bundle: Bundle,
  negative: boolean,
): readonly DateTimeNode[] => {
  const raw = fieldGet(f.tz.hourFormat, bundle);
  return getHourPattern(raw, negative);
};
