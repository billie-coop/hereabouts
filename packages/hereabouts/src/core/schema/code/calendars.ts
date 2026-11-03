import type { KeyIndexMap } from '../../../types';
import { field, keyIndex, scope, vector } from '../instructions';
import {
  BuddhistEraIndex,
  DateTimePatternFieldValues,
  DayPeriodValues,
  EraWidthValues,
  FieldWidthValues,
  FormatWidthValues,
  GregorianEraIndex,
  GregorianMonthsIndex,
  JapaneseEraIndex,
  PersianEraIndex,
  QuarterValues,
  WeekdayValues,
} from '../schema/calendar';

const formats = (name: string, rename: string, month: string) =>
  scope(name, rename, [
    vector('weekdays', ['field-width', 'weekday']),
    vector('months', ['field-width', `${month}-month`]),
    vector('quarters', ['field-width', 'quarter']),
    vector('dayPeriods', ['field-width', 'day-period', 'day-period-alt-key']),
  ]);

const calendarScope = (name: string, scopeName: string) =>
  scope(scopeName, scopeName, [
    vector('eras', ['era-type', `${name}-era`, 'era-alt-key']),
    formats('format', 'format', name),
    formats('standAlone', 'standAlone', name),
    vector('availableFormats', [`${name}-available-format`]),
    vector('pluralFormats', ['plural-key', `${name}-plural-format`]),
    vector('intervalFormats', [`${name}-interval-format`, 'date-time-pattern-field']),
    vector('dateFormats', ['format-width']),
    vector('timeFormats', ['format-width']),
    vector('dateSkeletons', ['format-width']),
    vector('timeSkeletons', ['format-width']),
    vector('dateTimeFormats', ['format-width']),
    vector('dateTimeFormatsAt', ['format-width']),
    field('intervalFormatFallback'),
  ]);

export const DateTimePatternFieldIndex = /*#__PURE__*/ keyIndex(DateTimePatternFieldValues);
export const DayPeriodIndex = /*#__PURE__*/ keyIndex(DayPeriodValues);
export const EraTypeIndex = /*#__PURE__*/ keyIndex(EraWidthValues);
export const FieldWidthIndex = /*#__PURE__*/ keyIndex(FieldWidthValues);
export const FormatWidthIndex = /*#__PURE__*/ keyIndex(FormatWidthValues);
export const QuartersIndex = /*#__PURE__*/ keyIndex(QuarterValues);
export const WeekdaysIndex = /*#__PURE__*/ keyIndex(WeekdayValues);

export const CALENDAR_INDICES: KeyIndexMap = {
  'date-time-pattern-field': DateTimePatternFieldIndex,
  'day-period': DayPeriodIndex,
  'era-type': EraTypeIndex,
  'field-width': FieldWidthIndex,
  'format-width': FormatWidthIndex,
  quarter: QuartersIndex,
  weekday: WeekdaysIndex,
};

export const BUDDHIST = calendarScope('buddhist', 'Buddhist');

export const BUDDHIST_INDICES: KeyIndexMap = {
  'buddhist-era': BuddhistEraIndex,
  'buddhist-month': GregorianMonthsIndex,
};

export const GREGORIAN = calendarScope('gregorian', 'Gregorian');

export const GREGORIAN_INDICES: KeyIndexMap = {
  'gregorian-era': GregorianEraIndex,
  'gregorian-month': GregorianMonthsIndex,
};

export const JAPANESE = calendarScope('japanese', 'Japanese');

export const JAPANESE_INDICES: KeyIndexMap = {
  'japanese-era': JapaneseEraIndex,
  'japanese-month': GregorianMonthsIndex,
};

export const PERSIAN = calendarScope('persian', 'Persian');

export const PERSIAN_INDICES: KeyIndexMap = {
  'persian-era': PersianEraIndex,
  'persian-month': GregorianMonthsIndex,
};
