import {
  type CalendarDate,
  dateDayOfMonth,
  dateHour,
  dateHourOfDay,
  dateMilliseconds,
  dateMinute,
  dateMonth,
  dateSecond,
  dateTimeZoneOffset,
  dateToString,
  dateUnixEpoch,
  dateWithZone,
  dateYear,
  type GregorianDate,
  toGregorianDate,
} from '../../../../src/core';
import { calendarsApi } from '../../_helpers';

const NEW_YORK = 'America/New_York';
const LOS_ANGELES = 'America/Los_Angeles';
const ROME = 'Europe/Rome';

// NOTE: We have two problems using Date for dates way in the past:
//
// 1. The tzdb defines early timezone offsets in LMT (local mean time)
//    and many of these offsets include a seconds component. The JavaScript
//    spec defines getTimezoneOffset() as returning minutes, so we lose
//    this precision.
// 2. Node v8 did not use the LMT offsets in seconds but Node v10 does.
//    This means that we have a problem trying to run tests on Node v10 that
//    depend on the seconds component of the time zone offset.  Consequently
//    we can't accurately construct a UTC timestamp from a Date object for
//    very old dates whose LMT offset has a seconds component.

test('zoned date time gregorian epoch', () => {
  const api = calendarsApi('en');
  let d: GregorianDate;
  let date: Date;

  // 1514828096789 UTC == Jan 1, 2018 12:34:56.789 EST (UTC-5)
  date = new Date(1514828096789);
  d = toGregorianDate(api, { date, zoneId: NEW_YORK });
  expect(dateToString(d)).toEqual('Gregorian 2018-01-01 12:34:56.789 America/New_York');
  expect(dateUnixEpoch(d)).toEqual(1514828096789);
  expect(dateYear(d)).toEqual(2018);
  expect(dateMonth(d)).toEqual(1);
  expect(dateDayOfMonth(d)).toEqual(1);
  expect(dateHour(d)).toEqual(0);
  expect(dateHourOfDay(d)).toEqual(12);
  expect(dateMinute(d)).toEqual(34);
  expect(dateSecond(d)).toEqual(56);
  expect(dateMilliseconds(d)).toEqual(789);

  d = toGregorianDate(api, { date, zoneId: LOS_ANGELES });
  expect(dateToString(d)).toEqual('Gregorian 2018-01-01 09:34:56.789 America/Los_Angeles');
  expect(dateUnixEpoch(d)).toEqual(1514828096789);
  expect(dateYear(d)).toEqual(2018);
  expect(dateMonth(d)).toEqual(1);
  expect(dateDayOfMonth(d)).toEqual(1);
  expect(dateHour(d)).toEqual(9);
  expect(dateHourOfDay(d)).toEqual(9);
  expect(dateMinute(d)).toEqual(34);
  expect(dateSecond(d)).toEqual(56);
  expect(dateMilliseconds(d)).toEqual(789);

  // -12219333903211 UTC
  // Gregorian cutover Thurs Oct 4, 1582 - Fri Oct 15, 1582
  // date = new Date(1582, 9, 14, 12, 34, 56, 789);

  // NOTE: can't use new Date here, see note at top.
  let utc = -12219333903211;
  d = toGregorianDate(api, { date: utc, zoneId: ROME });

  // Rome's LMT offset is 0:49:56
  expect(dateTimeZoneOffset(d)).toEqual(2996000);

  // Skip checking seconds for Node > v8
  expect(dateToString(d)).toEqual('Gregorian 1582-10-04 13:24:52.789 Europe/Rome');
  expect(dateUnixEpoch(d)).toEqual(-12219333903211);
  expect(dateYear(d)).toEqual(1582);
  expect(dateMonth(d)).toEqual(10);
  expect(dateHour(d)).toEqual(1);
  expect(dateHourOfDay(d)).toEqual(13);
  expect(dateMinute(d)).toEqual(24);
  expect(dateSecond(d)).toEqual(52);
  expect(dateMilliseconds(d)).toEqual(789);

  // -12219247503211 UTC
  // date = new Date(1582, 9, 15, 12, 34, 56, 789);

  // NOTE: can't use new Date here, see note at top.
  utc = -12219247503211;
  d = toGregorianDate(api, { date: utc, zoneId: ROME });

  // Rome's LMT offset is 0:49:56
  expect(dateTimeZoneOffset(d)).toEqual(2996000);

  // Skip checking seconds for Node > v8
  expect(dateToString(d)).toEqual('Gregorian 1582-10-15 13:24:52.789 Europe/Rome');
  expect(dateUnixEpoch(d)).toEqual(-12219247503211);
  expect(dateYear(d)).toEqual(1582);
  expect(dateMonth(d)).toEqual(10);
  expect(dateDayOfMonth(d)).toEqual(15);
  expect(dateHour(d)).toEqual(1);
  expect(dateHourOfDay(d)).toEqual(13);
  expect(dateMinute(d)).toEqual(24);
  expect(dateSecond(d)).toEqual(52);
  expect(dateMilliseconds(d)).toEqual(789);
});

test('bare date', () => {
  const api = calendarsApi('en');
  let d: CalendarDate;

  // Defaults to UTC. 1519148040000 == Feb 20, 2018 12:34 EST (UTC-5)
  d = toGregorianDate(api, new Date(1519148040000));
  expect(dateUnixEpoch(d)).toEqual(1519148040000);
  expect(dateYear(d)).toEqual(2018);
  expect(dateMonth(d)).toEqual(2);
  expect(dateDayOfMonth(d)).toEqual(20);
  expect(dateHour(d)).toEqual(5);
  expect(dateHourOfDay(d)).toEqual(17);
  expect(dateMinute(d)).toEqual(34);
  expect(dateSecond(d)).toEqual(0);

  d = dateWithZone(d, NEW_YORK);
  expect(dateHour(d)).toEqual(0);
  expect(dateHourOfDay(d)).toEqual(12);
});

test('noop conversions', () => {
  const api = calendarsApi('en');
  let d: CalendarDate;
  let r: CalendarDate;

  // Feb 1, 2018 midnight UTC
  d = toGregorianDate(api, new Date(1517443200000));
  r = toGregorianDate(api, d);
  expect(d).toEqual(r);
});
