import { tzFromWall } from '@phensley/timezone';
import { dateFromFields, dateFromUnixEpoch, isCalendarDate } from './core';
import {
  daysInMonth,
  initGregorianFields,
  leapGregorian,
  monthStart,
  ymdToJD,
} from './gregorianmath';
import { unixEpochFromJD, wallTimeToMillis } from './math';
import type { CalendarDate, CalendarDateFields, CalendarSystem } from './types';

/**
 * A date in the Gregorian calendar (or one of the calendars built on it).
 *
 * @public
 */
export type GregorianDate = CalendarDate;

/**
 * Days in a year of the Gregorian calendar (Julian calendar before the 1582 cutover).
 *
 * @internal
 */
export const gregorianDaysInYear = (y: number): number => (leapGregorian(y) ? 366 : 365);

/**
 * Resolve wall-clock fields to a UTC epoch in the requested time zone (falling back to the
 * date's own zone), using the Gregorian calendar. Shared by the Gregorian-based calendars.
 *
 * @internal
 */
export const gregorianResolveFields = (
  f: Partial<CalendarDateFields>,
  zoneId: string,
  _offset: number,
): [number, string] => {
  const jd = ymdToJD(f.year!, f.month!, f.day!, 12);
  const ms = wallTimeToMillis(f);
  const epoch = unixEpochFromJD(jd, ms);
  const zone = f.zoneId || zoneId;
  // Find UTC epoch for wall clock time in the requested timezone
  const r = tzFromWall(zone, epoch);
  return [r ? r[0] : epoch, zone];
};

/**
 * Rules of the Gregorian calendar.
 *
 * type: gregory
 *
 * @public
 */
export const gregorianCalendar: CalendarSystem = {
  type: 'gregory',
  name: 'Gregorian',
  monthCount: 12,
  relatedYearOffset: 0,
  defaultFields: { year: 1970, month: 1, day: 1, hour: 0, minute: 0, second: 0, millis: 0 },
  daysInMonth,
  daysInYear: gregorianDaysInYear,
  monthStart,
  computeFields: initGregorianFields,
  resolveFields: gregorianResolveFields,
};

/**
 * Construct a Gregorian date from the given fields.
 *
 * @public
 */
export const gregorianDateFromFields = (
  fields: Partial<CalendarDateFields>,
  firstDay: number = 1,
  minDays: number = 1,
): GregorianDate => dateFromFields(gregorianCalendar, fields, firstDay, minDays);

/**
 * Construct a Gregorian date from the given UNIX epoch.
 *
 * @public
 */
export const gregorianDateFromUnixEpoch = (
  epoch: number,
  zoneId: string,
  firstDay: number = 1,
  minDays: number = 1,
): GregorianDate => dateFromUnixEpoch(gregorianCalendar, epoch, zoneId, firstDay, minDays);

/**
 * Returns true if the argument is a date in the Gregorian calendar or one of the calendars
 * built on it (iso8601, buddhist, japanese), as 1.x `instanceof GregorianDate` did.
 *
 * @public
 */
export const isGregorianDate = (x: any): x is GregorianDate => {
  if (!isCalendarDate(x)) {
    return false;
  }
  const t = x.calendar.type;
  return t === 'gregory' || t === 'iso8601' || t === 'buddhist' || t === 'japanese';
};
