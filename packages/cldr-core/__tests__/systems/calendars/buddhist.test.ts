import {
  type BuddhistDate,
  buddhistDateFromUnixEpoch,
  dateDayOfMonth,
  dateEra,
  dateModifiedJulianDay,
  dateMonth,
  dateToString,
  dateType,
  dateWithZone,
  dateYear,
} from '../../../src';
import { DayOfWeek } from '../../../src/systems/calendars/fields';
import { LOS_ANGELES, NEW_YORK, UTC } from './_referencedates';

const make = (e: number, z: string) => buddhistDateFromUnixEpoch(e, z, DayOfWeek.SUNDAY, 1);

// Wednesday, April 11, 2018 11:59:59.123 PM UTC
const APR_11_2018 = 1523491199123;

// Year of Buddha's birth
const BUDDHA = -79293887631000;

test('buddhist calendar', () => {
  let d: BuddhistDate;

  d = make(APR_11_2018, NEW_YORK);
  expect(dateToString(d)).toEqual('Buddhist 2018-04-11 19:59:59.123 America/New_York');
  expect(dateType(d)).toEqual('buddhist');
  expect(dateModifiedJulianDay(d)).toEqual(2458220);
  expect(dateEra(d)).toEqual(0);
  expect(dateYear(d)).toEqual(2561);
  expect(dateMonth(d)).toEqual(4); // April
  expect(dateDayOfMonth(d)).toEqual(11);

  d = make(BUDDHA, NEW_YORK);
  expect(dateType(d)).toEqual('buddhist');
  expect(dateModifiedJulianDay(d)).toEqual(1522834);
  expect(dateEra(d)).toEqual(0);
  expect(dateYear(d)).toEqual(0);
  expect(dateMonth(d)).toEqual(4); // April
  expect(dateDayOfMonth(d)).toEqual(17);
});

test('with zone', () => {
  let d: BuddhistDate;

  d = make(APR_11_2018, UTC);
  expect(dateToString(d)).toEqual('Buddhist 2018-04-11 23:59:59.123 Etc/UTC');

  d = dateWithZone(d, LOS_ANGELES);
  expect(dateToString(d)).toEqual('Buddhist 2018-04-11 16:59:59.123 America/Los_Angeles');

  d = dateWithZone(d, NEW_YORK);
  expect(dateToString(d)).toEqual('Buddhist 2018-04-11 19:59:59.123 America/New_York');
});
