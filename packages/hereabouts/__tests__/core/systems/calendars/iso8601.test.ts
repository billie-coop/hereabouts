import {
  dateDayOfWeek,
  dateIsLeapYear,
  dateToString,
  dateWeekOfYear,
  dateWithZone,
  dateYearOfWeekOfYear,
  iso8601DateFromUnixEpoch,
} from '../../../../src/core';
import type { ISO8601Date } from '../../../../src/core/systems/calendars';

const make = (e: number, z: string) => iso8601DateFromUnixEpoch(e, z, -1, -1);

// Tue, Dec 28, 2004 13:03:04 UTC
const DEC_28_2004 = 1104238984000;

test('iso week', () => {
  const zoneId = 'America/New_York';
  let d: ISO8601Date;

  // Sat, Mar 11, 2000
  d = make(952761625000, zoneId);
  expect(dateDayOfWeek(d)).toEqual(7); // saturday
  expect(dateWeekOfYear(d)).toEqual(10);
  expect(dateYearOfWeekOfYear(d)).toEqual(2000);
  expect(dateIsLeapYear(d)).toEqual(true);

  // Tue, Dec 28, 2004
  d = make(1104238984000, zoneId);
  expect(dateToString(d)).toEqual('ISO8601 2004-12-28 08:03:04.000 America/New_York');
  expect(dateWeekOfYear(d)).toEqual(53);
  expect(dateYearOfWeekOfYear(d)).toEqual(2004);
  expect(dateIsLeapYear(d)).toEqual(true);

  // Sat, Jan 1, 2005
  d = make(1104580800000, zoneId);
  expect(dateWeekOfYear(d)).toEqual(53);
  expect(dateYearOfWeekOfYear(d)).toEqual(2004);
  expect(dateIsLeapYear(d)).toEqual(false);

  // Mon, Dec 31, 2007
  d = make(1199106184000, zoneId);
  expect(dateWeekOfYear(d)).toEqual(1);
  expect(dateYearOfWeekOfYear(d)).toEqual(2008);

  // Fri, Sep 26, 2008
  d = make(1222430400000, zoneId);
  expect(dateWeekOfYear(d)).toEqual(39);
  expect(dateYearOfWeekOfYear(d)).toEqual(2008);

  // Mon, Dec 29, 2008
  d = make(1230555784000, zoneId);
  expect(dateWeekOfYear(d)).toEqual(1);
  expect(dateYearOfWeekOfYear(d)).toEqual(2009);

  // Sun, Jan 1, 2017
  d = make(1483275784000, zoneId);
  expect(dateWeekOfYear(d)).toEqual(52);
  expect(dateYearOfWeekOfYear(d)).toEqual(2016);

  // Mon, Jan 2, 2017
  d = make(1483362184000, zoneId);
  expect(dateWeekOfYear(d)).toEqual(1);
  expect(dateYearOfWeekOfYear(d)).toEqual(2017);

  // Thu, Dec 28, 2017
  d = make(1514465667000, zoneId);
  expect(dateWeekOfYear(d)).toEqual(52);
  expect(dateYearOfWeekOfYear(d)).toEqual(2017);

  // Sun, Mar 11, 2018
  d = make(1520751625000, zoneId);
  expect(dateWeekOfYear(d)).toEqual(10);
  expect(dateYearOfWeekOfYear(d)).toEqual(2018);
});

test('with zone', () => {
  let d: ISO8601Date;

  d = make(DEC_28_2004, 'UTC');
  expect(dateToString(d)).toEqual('ISO8601 2004-12-28 13:03:04.000 Etc/UTC');

  d = dateWithZone(d, 'America/New_York');
  expect(dateToString(d)).toEqual('ISO8601 2004-12-28 08:03:04.000 America/New_York');

  d = dateWithZone(d, 'America/Los_Angeles');
  expect(dateToString(d)).toEqual('ISO8601 2004-12-28 05:03:04.000 America/Los_Angeles');
});
