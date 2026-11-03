import { CalendarConstants } from './constants';
import { dateFromFields, dateFromUnixEpoch, isCalendarDate } from './core';
import { DayOfWeek } from './fields';
import { gregorianDaysInYear, gregorianResolveFields } from './gregorian';
import { daysInMonth, initGregorianFields, monthStart } from './gregorianmath';
import type { CalendarDate, CalendarDateFields, CalendarSystem } from './types';

/**
 * A date in the ISO-8601 calendar.
 *
 * @public
 */
export type ISO8601Date = CalendarDate;

/**
 * Rules of the Gregorian calendar with ISO-8601 first day of week and minimum days in week.
 * The locale's week settings are ignored.
 *
 * type: iso8601
 *
 * @public
 */
export const iso8601Calendar: CalendarSystem = {
  type: 'iso8601',
  name: 'ISO8601',
  monthCount: 12,
  relatedYearOffset: 0,
  // ISO-8601 dates use hard-coded firstDay and minDays
  weekRule: [DayOfWeek.MONDAY, CalendarConstants.ISO8601_MIN_DAYS],
  // 1.x ISO8601Date.fromFields applies no defaults
  defaultFields: {},
  daysInMonth,
  daysInYear: gregorianDaysInYear,
  monthStart,
  computeFields: initGregorianFields,
  resolveFields: gregorianResolveFields,
};

/**
 * Construct an ISO-8601 date from the given fields. The week arguments are ignored.
 *
 * @public
 */
export const iso8601DateFromFields = (
  fields: Partial<CalendarDateFields>,
  _firstDay: number,
  _minDays: number,
): ISO8601Date => dateFromFields(iso8601Calendar, fields);

/**
 * Construct an ISO-8601 date from the given UNIX epoch. The week arguments are ignored.
 *
 * @public
 */
export const iso8601DateFromUnixEpoch = (
  epoch: number,
  zoneId: string,
  _firstDay: number,
  _minDays: number,
): ISO8601Date => dateFromUnixEpoch(iso8601Calendar, epoch, zoneId);

/**
 * Returns true if the argument is a date in the ISO-8601 calendar.
 *
 * @public
 */
export const isISO8601Date = (x: any): x is ISO8601Date =>
  isCalendarDate(x) && x.calendar.type === 'iso8601';
