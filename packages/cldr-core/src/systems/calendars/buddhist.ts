import { CalendarConstants } from './constants';
import { dateFromFields, dateFromUnixEpoch, isCalendarDate } from './core';
import { DateField } from './fields';
import { gregorianDaysInYear, gregorianResolveFields } from './gregorian';
import { daysInMonth, initGregorianFields, monthStart } from './gregorianmath';
import type { CalendarDate, CalendarDateFields, CalendarSystem } from './types';

/**
 * A date in the Buddhist calendar.
 *
 * @public
 */
export type BuddhistDate = CalendarDate;

const computeBuddhistFields = (f: number[]): void => {
  initGregorianFields(f);
  f[DateField.ERA] = 0;
  f[DateField.YEAR] = f[DateField.EXTENDED_YEAR] - CalendarConstants.BUDDHIST_ERA_START;
};

/**
 * Rules of the Buddhist calendar.
 *
 * type: buddhist
 *
 * @public
 */
export const buddhistCalendar: CalendarSystem = {
  type: 'buddhist',
  name: 'Buddhist',
  monthCount: 12,
  relatedYearOffset: 0,
  defaultFields: { year: 1, month: 1, day: 1, hour: 0, minute: 0, second: 0, millis: 0 },
  daysInMonth,
  daysInYear: gregorianDaysInYear,
  monthStart,
  computeFields: computeBuddhistFields,
  resolveFields: gregorianResolveFields,
};

/**
 * Construct a Buddhist date from the given fields.
 *
 * @public
 */
export const buddhistDateFromFields = (
  fields: Partial<CalendarDateFields>,
  firstDay: number,
  minDays: number,
): BuddhistDate => dateFromFields(buddhistCalendar, fields, firstDay, minDays);

/**
 * Construct a Buddhist date from the given UNIX epoch.
 *
 * @public
 */
export const buddhistDateFromUnixEpoch = (
  epoch: number,
  zoneId: string,
  firstDay: number,
  minDays: number,
): BuddhistDate => dateFromUnixEpoch(buddhistCalendar, epoch, zoneId, firstDay, minDays);

/**
 * Returns true if the argument is a date in the Buddhist calendar.
 *
 * @public
 */
export const isBuddhistDate = (x: any): x is BuddhistDate =>
  isCalendarDate(x) && x.calendar.type === 'buddhist';
