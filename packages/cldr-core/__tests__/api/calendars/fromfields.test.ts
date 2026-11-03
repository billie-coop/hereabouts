import {
  type CalendarDate,
  dateToISOString,
  dateToString,
  newBuddhistDate,
  newGregorianDate,
  newISO8601Date,
  newJapaneseDate,
  newPersianDate,
} from '../../../src';
import { calendarsApi } from '../../_helpers';

test('gregorian defaults', () => {
  let d: CalendarDate;
  const api = calendarsApi('en');

  d = newGregorianDate(api, {});
  expect(dateToString(d)).toEqual('Gregorian 1970-01-01 00:00:00.000 Etc/UTC');

  d = newGregorianDate(api, { month: 5 });
  expect(dateToString(d)).toEqual('Gregorian 1970-05-01 00:00:00.000 Etc/UTC');

  d = newGregorianDate(api, { day: 15 });
  expect(dateToString(d)).toEqual('Gregorian 1970-01-15 00:00:00.000 Etc/UTC');

  d = newGregorianDate(api, { year: 2025, month: 2, day: 15, zoneId: 'America/New_York' });
  expect(dateToString(d)).toEqual('Gregorian 2025-02-15 00:00:00.000 America/New_York');
  expect(dateToISOString(d)).toEqual('2025-02-15T05:00:00.000Z');
});

test('gregorian bounds', () => {
  let d: CalendarDate;
  const api = calendarsApi('en');

  d = newGregorianDate(api, { year: -9999 });
  expect(dateToString(d)).toEqual('Gregorian -4712-01-01 00:00:00.000 Etc/UTC');

  d = newGregorianDate(api, { year: 9999 });
  expect(dateToString(d)).toEqual('Gregorian 8652-12-31 00:00:00.000 Etc/UTC');

  d = newGregorianDate(api, { year: 2020, month: -1 });
  expect(dateToString(d)).toEqual('Gregorian 2020-01-01 00:00:00.000 Etc/UTC');

  d = newGregorianDate(api, { year: 2020, month: 13 });
  expect(dateToString(d)).toEqual('Gregorian 2020-12-01 00:00:00.000 Etc/UTC');

  d = newGregorianDate(api, { year: 2020, month: 1, day: -1 });
  expect(dateToString(d)).toEqual('Gregorian 2020-01-01 00:00:00.000 Etc/UTC');

  d = newGregorianDate(api, { year: 2020, month: 1, day: 32 });
  expect(dateToString(d)).toEqual('Gregorian 2020-01-31 00:00:00.000 Etc/UTC');

  d = newGregorianDate(api, { year: 2020, hour: -1 });
  expect(dateToString(d)).toEqual('Gregorian 2020-01-01 00:00:00.000 Etc/UTC');

  d = newGregorianDate(api, { year: 2020, hour: 24 });
  expect(dateToString(d)).toEqual('Gregorian 2020-01-01 23:00:00.000 Etc/UTC');

  d = newGregorianDate(api, { year: 2020, minute: -1 });
  expect(dateToString(d)).toEqual('Gregorian 2020-01-01 00:00:00.000 Etc/UTC');

  d = newGregorianDate(api, { year: 2020, minute: 60 });
  expect(dateToString(d)).toEqual('Gregorian 2020-01-01 00:59:00.000 Etc/UTC');

  d = newGregorianDate(api, { year: 2020, second: -1 });
  expect(dateToString(d)).toEqual('Gregorian 2020-01-01 00:00:00.000 Etc/UTC');

  d = newGregorianDate(api, { year: 2020, second: 60 });
  expect(dateToString(d)).toEqual('Gregorian 2020-01-01 00:00:59.000 Etc/UTC');

  d = newGregorianDate(api, { year: 2020, millis: -1 });
  expect(dateToString(d)).toEqual('Gregorian 2020-01-01 00:00:00.000 Etc/UTC');

  d = newGregorianDate(api, { year: 2020, millis: 1000 });
  expect(dateToString(d)).toEqual('Gregorian 2020-01-01 00:00:00.999 Etc/UTC');
});

test('gregorian from fields', () => {
  let d: CalendarDate;
  const api = calendarsApi('en');

  d = newGregorianDate(api, { year: 1801, month: 5, day: 17, zoneId: 'America/New_York' });
  expect(dateToString(d)).toEqual('Gregorian 1801-05-17 00:00:00.000 America/New_York');

  d = newGregorianDate(api, { year: 1999, month: 5, day: 17 });
  expect(dateToString(d)).toEqual('Gregorian 1999-05-17 00:00:00.000 Etc/UTC');

  d = newGregorianDate(api, { year: 1582, month: 10, day: 19 });
  expect(dateToString(d)).toEqual('Gregorian 1582-10-19 00:00:00.000 Etc/UTC');

  d = newGregorianDate(api, { year: 1581, month: 10, day: 19 });
  expect(dateToString(d)).toEqual('Gregorian 1581-10-19 00:00:00.000 Etc/UTC');

  d = newGregorianDate(api, { year: 1066, month: 10, day: 19 });
  expect(dateToString(d)).toEqual('Gregorian 1066-10-19 00:00:00.000 Etc/UTC');

  d = newGregorianDate(api, { year: 66, month: 10, day: 19 });
  expect(dateToString(d)).toEqual('Gregorian 0066-10-19 00:00:00.000 Etc/UTC');

  d = newGregorianDate(api, { year: 1, month: 10, day: 19 });
  expect(dateToString(d)).toEqual('Gregorian 0001-10-19 00:00:00.000 Etc/UTC');

  d = newGregorianDate(api, { year: 0, month: 10, day: 19 });
  expect(dateToString(d)).toEqual('Gregorian 0000-10-19 00:00:00.000 Etc/UTC');

  d = newGregorianDate(api, { year: -1, month: 10, day: 19 });
  expect(dateToString(d)).toEqual('Gregorian -0001-10-19 00:00:00.000 Etc/UTC');

  d = newGregorianDate(api, { year: -100, month: 10, day: 19 });
  expect(dateToString(d)).toEqual('Gregorian -0100-10-19 00:00:00.000 Etc/UTC');
});

test('gregorian from fields dst', () => {
  let d: CalendarDate;
  const api = calendarsApi('en');

  // Sun Mar 8 2020 spring forward 1 hour

  d = newGregorianDate(api, {
    year: 2020,
    month: 3,
    day: 8,
    hour: 1,
    minute: 59,
    zoneId: 'America/New_York',
  });
  expect(dateToString(d)).toEqual('Gregorian 2020-03-08 01:59:00.000 America/New_York');

  d = newGregorianDate(api, { year: 2020, month: 3, day: 8, hour: 2, zoneId: 'America/New_York' });
  expect(dateToString(d)).toEqual('Gregorian 2020-03-08 03:00:00.000 America/New_York');

  d = newGregorianDate(api, {
    year: 2020,
    month: 3,
    day: 8,
    hour: 2,
    minute: 30,
    zoneId: 'America/New_York',
  });
  expect(dateToString(d)).toEqual('Gregorian 2020-03-08 03:30:00.000 America/New_York');

  d = newGregorianDate(api, {
    year: 2020,
    month: 3,
    day: 8,
    hour: 2,
    minute: 59,
    zoneId: 'America/New_York',
  });
  expect(dateToString(d)).toEqual('Gregorian 2020-03-08 03:59:00.000 America/New_York');

  d = newGregorianDate(api, { year: 2020, month: 3, day: 8, hour: 3, zoneId: 'America/New_York' });
  expect(dateToString(d)).toEqual('Gregorian 2020-03-08 03:00:00.000 America/New_York');

  d = newGregorianDate(api, {
    year: 2020,
    month: 3,
    day: 8,
    hour: 3,
    minute: 1,
    zoneId: 'America/New_York',
  });
  expect(dateToString(d)).toEqual('Gregorian 2020-03-08 03:01:00.000 America/New_York');

  // Sun Nov 1 2020 fall back 1 hour

  d = newGregorianDate(api, {
    year: 2020,
    month: 11,
    day: 1,
    hour: 1,
    minute: 59,
    zoneId: 'America/New_York',
  });
  expect(dateToString(d)).toEqual('Gregorian 2020-11-01 01:59:00.000 America/New_York');

  d = newGregorianDate(api, { year: 2020, month: 11, day: 1, hour: 2, zoneId: 'America/New_York' });
  expect(dateToString(d)).toEqual('Gregorian 2020-11-01 02:00:00.000 America/New_York');

  d = newGregorianDate(api, {
    year: 2020,
    month: 11,
    day: 1,
    hour: 2,
    minute: 59,
    zoneId: 'America/New_York',
  });
  expect(dateToString(d)).toEqual('Gregorian 2020-11-01 02:59:00.000 America/New_York');

  d = newGregorianDate(api, { year: 2020, month: 11, day: 1, hour: 3, zoneId: 'America/New_York' });
  expect(dateToString(d)).toEqual('Gregorian 2020-11-01 03:00:00.000 America/New_York');

  d = newGregorianDate(api, {
    year: 2020,
    month: 11,
    day: 1,
    hour: 3,
    minute: 1,
    zoneId: 'America/New_York',
  });
  expect(dateToString(d)).toEqual('Gregorian 2020-11-01 03:01:00.000 America/New_York');
});

test('iso-8601 from fields', () => {
  let d: CalendarDate;
  const api = calendarsApi('en');

  d = newISO8601Date(api, { year: 1964, month: 10, day: 19 });
  expect(dateToString(d)).toEqual('ISO8601 1964-10-19 00:00:00.000 Etc/UTC');

  d = newISO8601Date(api, { year: 2021, month: 7, day: 29, hour: 10 });
  expect(dateToString(d)).toEqual('ISO8601 2021-07-29 10:00:00.000 Etc/UTC');
});

test('japanese from fields', () => {
  let d: CalendarDate;
  const api = calendarsApi('en');

  d = newJapaneseDate(api, { year: 1964, month: 10, day: 19 });
  expect(dateToString(d)).toEqual('Japanese 1964-10-19 00:00:00.000 Etc/UTC');

  d = newJapaneseDate(api, { year: 2021, month: 7, day: 29, hour: 10 });
  expect(dateToString(d)).toEqual('Japanese 2021-07-29 10:00:00.000 Etc/UTC');
});

test('buddhist from fields', () => {
  let d: CalendarDate;
  const api = calendarsApi('en');

  d = newBuddhistDate(api, { year: 2561, day: 12 });
  expect(dateToString(d)).toEqual('Buddhist 2561-01-12 00:00:00.000 Etc/UTC');

  d = newBuddhistDate(api, { year: 1399, month: 3 });
  expect(dateToString(d)).toEqual('Buddhist 1399-03-01 00:00:00.000 Etc/UTC');

  d = newBuddhistDate(api, { year: 1398, month: 5, zoneId: 'America/New_York' });
  expect(dateToString(d)).toEqual('Buddhist 1398-05-01 00:00:00.000 America/New_York');

  d = newBuddhistDate(api, { year: 1398, hour: 12, minute: 31, zoneId: 'America/New_York' });
  expect(dateToString(d)).toEqual('Buddhist 1398-01-01 12:31:00.000 America/New_York');

  d = newBuddhistDate(api, { year: 1, month: 2 });
  expect(dateToString(d)).toEqual('Buddhist 0001-02-01 00:00:00.000 Etc/UTC');
});

test('persian defaults', () => {
  let d: CalendarDate;
  const api = calendarsApi('en');

  d = newPersianDate(api, {});
  expect(dateToString(d)).toEqual('Persian 0001-01-01 00:00:00.000 Etc/UTC');

  d = newPersianDate(api, { month: 5 });
  expect(dateToString(d)).toEqual('Persian 0001-05-01 00:00:00.000 Etc/UTC');

  d = newPersianDate(api, { day: 15 });
  expect(dateToString(d)).toEqual('Persian 0001-01-15 00:00:00.000 Etc/UTC');
});

test('persian bounds', () => {
  const api = calendarsApi('en');
  let d: CalendarDate;

  d = newPersianDate(api, { year: -9999 });
  expect(dateToString(d)).toEqual('Persian -5334-09-03 00:00:00.000 Etc/UTC');

  d = newPersianDate(api, { year: 9999 });
  expect(dateToString(d)).toEqual('Persian 8031-10-11 00:00:00.000 Etc/UTC');
});

test('persian from fields', () => {
  let d: CalendarDate;
  const api = calendarsApi('en');

  d = newPersianDate(api, { year: -1, month: 10, day: 19 });
  expect(dateToString(d)).toEqual('Persian -0001-10-19 00:00:00.000 Etc/UTC');

  d = newPersianDate(api, { year: 1399, month: 10, day: 19, hour: 10 });
  expect(dateToString(d)).toEqual('Persian 1399-10-19 10:00:00.000 Etc/UTC');
});
