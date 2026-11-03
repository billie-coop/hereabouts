import { emptyFields } from './fields';
import { initBaseFromUnixEpoch, unixEpochFromJD } from './math';
import { zoneInfoFromUTC } from './timezone';
import type { CalendarDate, CalendarDateFields, CalendarSystem } from './types';

/**
 * Construct a date in the given calendar from a UTC epoch and time zone. Every date is
 * created here so all dates share one object shape.
 */
export const newDate = (
  calendar: CalendarSystem,
  epoch: number,
  zoneId: string,
  firstDay: number,
  minDays: number,
): CalendarDate => {
  const fields = emptyFields();
  const zoneInfo = initBaseFromUnixEpoch(fields, epoch, zoneId);
  calendar.computeFields(fields);
  const rule = calendar.weekRule;
  return {
    calendar,
    fields,
    zoneInfo,
    firstDay: rule ? rule[0] : firstDay,
    minDays: rule ? rule[1] : minDays,
  };
};

/**
 * Construct a date from a Julian day and milliseconds in the day (UTC).
 */
export const newDateFromJD = (
  calendar: CalendarSystem,
  jd: number,
  msDay: number,
  zoneId: string,
  firstDay: number,
  minDays: number,
): CalendarDate => newDate(calendar, unixEpochFromJD(jd, msDay), zoneId, firstDay, minDays);

const isCalendarSystem = (c: any): c is CalendarSystem =>
  c !== null &&
  typeof c === 'object' &&
  typeof c.type === 'string' &&
  typeof c.name === 'string' &&
  typeof c.monthCount === 'number' &&
  typeof c.relatedYearOffset === 'number' &&
  typeof c.defaultFields === 'object' &&
  c.defaultFields !== null &&
  typeof c.daysInMonth === 'function' &&
  typeof c.daysInYear === 'function' &&
  typeof c.monthStart === 'function' &&
  typeof c.computeFields === 'function' &&
  typeof c.resolveFields === 'function';

/**
 * Returns true if the argument is a calendar date.
 *
 * @public
 */
export const isCalendarDate = (x: any): x is CalendarDate => {
  if (x === null || typeof x !== 'object') {
    return false;
  }
  const { calendar: c, zoneInfo: z, fields: f } = x;
  if (!Array.isArray(f)) {
    return false;
  }
  for (let i = 0; i < f.length; i++) {
    if (typeof f[i] !== 'number') {
      return false;
    }
  }
  return (
    typeof x.firstDay === 'number' &&
    typeof x.minDays === 'number' &&
    z !== null &&
    typeof z === 'object' &&
    typeof z.zoneid === 'string' &&
    typeof z.stableid === 'string' &&
    typeof z.abbr === 'string' &&
    typeof z.metazoneid === 'string' &&
    typeof z.dst === 'number' &&
    typeof z.offset === 'number' &&
    isCalendarSystem(c)
  );
};

/**
 * Construct a date in the given calendar from a UNIX epoch (milliseconds, UTC) and time zone.
 *
 * @public
 */
export const dateFromUnixEpoch = (
  calendar: CalendarSystem,
  epoch: number,
  zoneId: string,
  firstDay: number = 1,
  minDays: number = 1,
): CalendarDate => newDate(calendar, epoch, zoneId, firstDay, minDays);

/**
 * Construct a date in the given calendar from the given fields. Fields left out take the
 * calendar's defaults; the time zone defaults to UTC.
 *
 * Note: the 'year' field is the "extended year".
 *
 * @public
 */
export const dateFromFields = (
  calendar: CalendarSystem,
  fields: Partial<CalendarDateFields>,
  firstDay: number = 1,
  minDays: number = 1,
): CalendarDate => {
  const [epoch, zoneId] = calendar.resolveFields(
    { ...calendar.defaultFields, ...fields },
    zoneInfoFromUTC('UTC', 0).zoneid,
    0,
  );
  return newDate(calendar, epoch, zoneId, firstDay, minDays);
};
