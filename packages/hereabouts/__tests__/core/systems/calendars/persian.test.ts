import {
  dateDayOfMonth,
  dateDayOfWeek,
  dateEra,
  dateIsLeapYear,
  dateModifiedJulianDay,
  dateMonth,
  dateSubtract,
  dateToString,
  dateType,
  dateWeekOfYear,
  dateWithZone,
  dateYear,
  persianDateFromUnixEpoch,
} from '../../../../src/core';
import { DayOfWeek } from '../../../../src/core/systems/calendars/fields';
import type { PersianDate } from '../../../../src/core/systems/calendars/persian';
import { NEW_YORK } from './_referencedates';

const make = (e: number, z: string) => persianDateFromUnixEpoch(e, z, DayOfWeek.SUNDAY, 1);

// Wednesday, April 11, 2018 11:59:59.123 PM UTC
const APR_11_2018 = 1523491199123;

// Monday, January 24, 620 4:40:00 AM UTC
const JAN_24_620 = -42599935200000;

test('persian calendar', () => {
  let d: PersianDate;

  d = make(APR_11_2018, NEW_YORK);
  expect(dateToString(d)).toEqual('Persian 1397-01-22 19:59:59.123 America/New_York');
  expect(dateType(d)).toEqual('persian');
  expect(dateModifiedJulianDay(d)).toEqual(2458220);
  expect(dateEra(d)).toEqual(0);
  expect(dateYear(d)).toEqual(1397);
  expect(dateMonth(d)).toEqual(1); // Farvardin
  expect(dateDayOfMonth(d)).toEqual(22);
  expect(dateDayOfWeek(d)).toEqual(4);
  expect(dateWeekOfYear(d)).toEqual(4);

  d = make(JAN_24_620, 'UTC');
  expect(dateModifiedJulianDay(d)).toEqual(1947533);
  expect(dateEra(d)).toEqual(0);
  expect(dateYear(d)).toEqual(-2);
  expect(dateMonth(d)).toEqual(11); // Bahman
  expect(dateDayOfMonth(d)).toEqual(3);
  expect(dateDayOfWeek(d)).toEqual(2);
  expect(dateWeekOfYear(d)).toEqual(45);
});

test('persian leaps', () => {
  let d: PersianDate;

  // March 19, 2020
  d = make(1584633586000, 'UTC');
  expect(dateYear(d)).toEqual(1398);
  expect(dateMonth(d)).toEqual(12); // Esfand
  expect(dateDayOfMonth(d)).toEqual(29); // 29 in non-leap
  expect(dateIsLeapYear(d)).toEqual(false);

  // March 20, 2020
  d = make(1584719986000, 'UTC');
  expect(dateYear(d)).toEqual(1399);
  expect(dateMonth(d)).toEqual(1); // Favardin
  expect(dateDayOfMonth(d)).toEqual(1);
  expect(dateIsLeapYear(d)).toEqual(true);

  // March 20, 2021
  d = make(1616255986000, 'UTC');
  expect(dateMonth(d)).toEqual(12); // Esfand
  expect(dateDayOfMonth(d)).toEqual(30); // 30 in leap
  expect(dateIsLeapYear(d)).toEqual(true);
});

test('with zone', () => {
  let d: PersianDate;

  d = make(APR_11_2018, 'UTC');
  expect(dateToString(d)).toEqual('Persian 1397-01-22 23:59:59.123 Etc/UTC');

  d = dateWithZone(d, NEW_YORK);
  expect(dateToString(d)).toEqual('Persian 1397-01-22 19:59:59.123 America/New_York');

  d = dateWithZone(d, 'America/Los_Angeles');
  expect(dateToString(d)).toEqual('Persian 1397-01-22 16:59:59.123 America/Los_Angeles');
});

test('subtract', () => {
  let end: PersianDate;

  const start = make(APR_11_2018, 'UTC');
  expect(dateToString(start)).toEqual('Persian 1397-01-22 23:59:59.123 Etc/UTC');

  end = dateSubtract(start, { year: 1, month: 1, day: 1 });
  expect(dateToString(end)).toEqual('Persian 1395-12-21 23:59:59.123 Etc/UTC');

  end = dateSubtract(start, { year: -1, month: -1, day: -1 });
  expect(dateToString(end)).toEqual('Persian 1398-02-23 23:59:59.123 Etc/UTC');
});

test('days in month/year', () => {
  let d: PersianDate;

  d = make(APR_11_2018, 'UTC');

  // Calendar rules (protected methods in 1.x)
  expect(d.calendar.daysInMonth(2025, 0)).toEqual(31);
  expect(d.calendar.daysInMonth(2022, 0)).toEqual(31);

  // Persian leap years
  expect(d.calendar.daysInMonth(2025, 11)).toEqual(29);
  expect(d.calendar.daysInMonth(2022, 11)).toEqual(30);

  // Persian leap years
  expect(d.calendar.daysInYear(2022)).toEqual(366);
  expect(d.calendar.daysInYear(2025)).toEqual(365);
});
