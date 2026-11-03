import { CalendarConstants } from './constants';
import { dateFromFields, dateFromUnixEpoch, isCalendarDate } from './core';
import { DateField } from './fields';
import { unixEpochFromJD, wallTimeToMillis } from './math';
import type { CalendarDate, CalendarDateFields, CalendarSystem } from './types';
import { floorDiv } from './util';

/**
 * A date in the Persian calendar.
 *
 * @public
 */
export type PersianDate = CalendarDate;

/**
 * Construct a Persian date from the given fields.
 *
 * Note: as in 1.x, the 'zoneId' field is ignored and the date is constructed in UTC.
 *
 * @public
 */
export const persianDateFromFields = (
  fields: Partial<CalendarDateFields>,
  firstDay: number,
  minDays: number,
): PersianDate => dateFromFields(persianCalendar, fields, firstDay, minDays);

/**
 * Construct a Persian date from the given UNIX epoch.
 *
 * @public
 */
export const persianDateFromUnixEpoch = (
  epoch: number,
  zoneId: string,
  firstDay: number,
  minDays: number,
): PersianDate => dateFromUnixEpoch(persianCalendar, epoch, zoneId, firstDay, minDays);

/**
 * Returns true if the argument is a date in the Persian calendar.
 *
 * @public
 */
export const isPersianDate = (x: any): x is PersianDate =>
  isCalendarDate(x) && x.calendar.type === 'persian';

const floor = Math.floor;

const MONTH_COUNT = [
  [31, 31, 0], // Farvardin
  [31, 31, 31], // Ordibehesht
  [31, 31, 62], // Khordad
  [31, 31, 93], // Tir
  [31, 31, 124], // Mordad
  [31, 31, 155], // Shahrivar
  [30, 30, 186], // Mehr
  [30, 30, 216], // Aban
  [30, 30, 246], // Azar
  [30, 30, 276], // Dey
  [30, 30, 306], // Bahman
  [29, 30, 336], // Esfand
];

const computePersianFields = (f: number[]): void => {
  const jd = f[DateField.JULIAN_DAY];
  const days = jd - CalendarConstants.JD_PERSIAN_EPOCH;
  const year = 1 + floor((33 * days + 3) / 12053);

  const favardin1 = 365 * (year - 1) + floor((8 * year + 21) / 33);
  const doy = days - favardin1;
  const month = floor(doy < 216 ? doy / 31 : (doy - 6) / 30);
  const dom = doy - MONTH_COUNT[month][2] + 1;

  f[DateField.ERA] = 0;
  f[DateField.YEAR] = year;
  f[DateField.EXTENDED_YEAR] = year;
  f[DateField.MONTH] = month + 1;
  f[DateField.DAY_OF_MONTH] = dom;
  f[DateField.DAY_OF_YEAR] = doy + 1;
  f[DateField.IS_LEAP] = leapPersian(year) ? 1 : 0;
};

/**
 * Return true if the given year is a leap year in the Persian calendar; false otherwise;
 */
const leapPersian = (y: number): boolean => {
  const rem: [number] = [0];
  floorDiv(25 * y + 11, 33, rem);
  return rem[0] < 8;
};

const persianDaysInMonth = (y: number, m: number): number => MONTH_COUNT[m][leapPersian(y) ? 1 : 0];

const persianDaysInYear = (y: number): number => (leapPersian(y) ? 366 : 365);

const persianMonthStart = (eyear: number, month: number, _useMonth: boolean): number => {
  let jd =
    CalendarConstants.JD_PERSIAN_EPOCH - 1 + 365 * (eyear - 1) + floor((8 * eyear + 21) / 33);
  if (month !== 0) {
    const mc = MONTH_COUNT;
    const m = floor(month);
    const d = month - m;

    jd += mc[m][2];

    // TODO: we never reach the block below since all internal uses of monthStart
    // pass in an integer

    // Check if there is a fractional month part, and if so add the number
    // of the days in the next month multiplied by the fraction
    /* istanbul ignore if -- @preserve */
    if (d !== 0) {
      // number of days in Esfand determined by:
      // "number of days between two vernal equinoxes"
      const isLeap = leapPersian(eyear);

      // note: the 'month' parameter must always be <= # months in the calendar
      // year, so <= 12 in this case.
      jd += d * mc[m + 1][isLeap ? 1 : 0];
    }
  }
  return jd;
};

const persianYmdToJD = (y: number, m: number, d: number): number => {
  y |= 0;
  const leap = leapPersian(y);
  const mc = 12;
  m = m < 1 ? 1 : m > mc ? mc : m;
  const dc = MONTH_COUNT[m - 1][leap ? 1 : 0];
  d = d < 1 ? 1 : d > dc ? dc : d;

  const favardin1 = 365 * (y - 1) + floor((8 * y + 21) / 33);
  const mdays = MONTH_COUNT[m - 1][2];
  const days = favardin1 + d + mdays - 1;
  return days + CalendarConstants.JD_PERSIAN_EPOCH;
};

/**
 * Persian dates are set in the date's own time zone using its current offset; the
 * 'zoneId' field is ignored (1.x behaviour).
 */
const persianResolveFields = (
  f: Partial<CalendarDateFields>,
  zoneId: string,
  offset: number,
): [number, string] => {
  const jd = persianYmdToJD(f.year!, f.month!, f.day!);
  const ms = wallTimeToMillis(f) - offset;
  return [unixEpochFromJD(jd, ms), zoneId];
};

/**
 * Rules of the Persian calendar.
 *
 * type: persian
 *
 * @public
 */
export const persianCalendar: CalendarSystem = {
  type: 'persian',
  name: 'Persian',
  monthCount: 12,
  relatedYearOffset: 622,
  defaultFields: { year: 1, month: 1, day: 1 },
  daysInMonth: persianDaysInMonth,
  daysInYear: persianDaysInYear,
  monthStart: persianMonthStart,
  computeFields: computePersianFields,
  resolveFields: persianResolveFields,
};
