import {
  type CalendarDate,
  dateExtendedYear,
  dateFirstDayOfWeek,
  dateHour,
  dateMinDaysInFirstWeek,
  dateUnixEpoch,
  dateYear,
  toBuddhistDate,
  toGregorianDate,
  toISO8601Date,
  toJapaneseDate,
  toPersianDate,
} from '../../../../src/core';
import { DayOfWeek } from '../../../../src/core/systems/calendars/fields';
import { calendarsApi } from '../../_helpers';

// March 11, 2018 7:00:25 AM UTC
const MARCH_11_2018_070025_UTC = 1520751625000;

const NEW_YORK = 'America/New_York';

const EN = calendarsApi('en-US');
const DE = calendarsApi('de-DE');
const FA = calendarsApi('fa-AF');

test('buddhist dates', () => {
  const base = MARCH_11_2018_070025_UTC;
  let d: CalendarDate;

  d = toBuddhistDate(EN, { date: base, zoneId: NEW_YORK });
  expect(dateFirstDayOfWeek(d)).toEqual(DayOfWeek.SUNDAY);
  expect(dateMinDaysInFirstWeek(d)).toEqual(1);

  expect(dateYear(d)).toEqual(2561);

  d = toBuddhistDate(DE, { date: base, zoneId: NEW_YORK });
  expect(dateFirstDayOfWeek(d)).toEqual(DayOfWeek.MONDAY);
  expect(dateMinDaysInFirstWeek(d)).toEqual(4);

  d = toBuddhistDate(FA, { date: base, zoneId: NEW_YORK });
  expect(dateFirstDayOfWeek(d)).toEqual(DayOfWeek.SATURDAY);
  expect(dateMinDaysInFirstWeek(d)).toEqual(1);
});

test('gregorian dates', () => {
  const base = MARCH_11_2018_070025_UTC;
  let d: CalendarDate;

  d = toGregorianDate(EN, { date: base, zoneId: NEW_YORK });
  expect(dateFirstDayOfWeek(d)).toEqual(DayOfWeek.SUNDAY);
  expect(dateMinDaysInFirstWeek(d)).toEqual(1);

  expect(dateYear(d)).toEqual(2018);

  d = toGregorianDate(DE, { date: base, zoneId: NEW_YORK });
  expect(dateFirstDayOfWeek(d)).toEqual(DayOfWeek.MONDAY);
  expect(dateMinDaysInFirstWeek(d)).toEqual(4);

  d = toGregorianDate(FA, { date: base, zoneId: NEW_YORK });
  expect(dateFirstDayOfWeek(d)).toEqual(DayOfWeek.SATURDAY);
  expect(dateMinDaysInFirstWeek(d)).toEqual(1);
});

test('iso-8601 dates', () => {
  const base = MARCH_11_2018_070025_UTC;
  let d: CalendarDate;

  d = toISO8601Date(EN, { date: base, zoneId: NEW_YORK });
  expect(dateFirstDayOfWeek(d)).toEqual(DayOfWeek.MONDAY);
  expect(dateMinDaysInFirstWeek(d)).toEqual(4);

  expect(dateYear(d)).toEqual(2018);

  d = toISO8601Date(DE, { date: base, zoneId: NEW_YORK });
  expect(dateFirstDayOfWeek(d)).toEqual(DayOfWeek.MONDAY);
  expect(dateMinDaysInFirstWeek(d)).toEqual(4);

  d = toISO8601Date(FA, { date: base, zoneId: NEW_YORK });
  expect(dateFirstDayOfWeek(d)).toEqual(DayOfWeek.MONDAY);
  expect(dateMinDaysInFirstWeek(d)).toEqual(4);
});

test('japanese dates', () => {
  const base = MARCH_11_2018_070025_UTC;
  let d: CalendarDate;

  d = toJapaneseDate(EN, { date: base, zoneId: NEW_YORK });
  expect(dateFirstDayOfWeek(d)).toEqual(DayOfWeek.SUNDAY);
  expect(dateMinDaysInFirstWeek(d)).toEqual(1);

  expect(dateYear(d)).toEqual(30);

  d = toJapaneseDate(DE, { date: base, zoneId: NEW_YORK });
  expect(dateFirstDayOfWeek(d)).toEqual(DayOfWeek.MONDAY);
  expect(dateMinDaysInFirstWeek(d)).toEqual(4);

  d = toJapaneseDate(FA, { date: base, zoneId: NEW_YORK });
  expect(dateFirstDayOfWeek(d)).toEqual(DayOfWeek.SATURDAY);
  expect(dateMinDaysInFirstWeek(d)).toEqual(1);
});

test('persian dates', () => {
  const base = MARCH_11_2018_070025_UTC;
  let d: CalendarDate;

  d = toPersianDate(EN, { date: base, zoneId: NEW_YORK });
  expect(dateFirstDayOfWeek(d)).toEqual(DayOfWeek.SUNDAY);
  expect(dateMinDaysInFirstWeek(d)).toEqual(1);

  expect(dateYear(d)).toEqual(1396);

  d = toPersianDate(DE, { date: base, zoneId: NEW_YORK });
  expect(dateFirstDayOfWeek(d)).toEqual(DayOfWeek.MONDAY);
  expect(dateMinDaysInFirstWeek(d)).toEqual(4);

  d = toPersianDate(FA, { date: base, zoneId: NEW_YORK });
  expect(dateFirstDayOfWeek(d)).toEqual(DayOfWeek.SATURDAY);
  expect(dateMinDaysInFirstWeek(d)).toEqual(1);
});

test('conversions', () => {
  const base = MARCH_11_2018_070025_UTC;
  const orig = toGregorianDate(EN, { date: base, zoneId: NEW_YORK });
  let d: CalendarDate;

  d = toISO8601Date(EN, orig);
  expect(dateFirstDayOfWeek(d)).toEqual(DayOfWeek.MONDAY);
  expect(dateMinDaysInFirstWeek(d)).toEqual(4);

  expect(dateYear(d)).toEqual(2018);

  d = toJapaneseDate(EN, d);
  expect(dateFirstDayOfWeek(d)).toEqual(DayOfWeek.SUNDAY);
  expect(dateMinDaysInFirstWeek(d)).toEqual(1);

  expect(dateYear(d)).toEqual(30);
  expect(dateExtendedYear(d)).toEqual(2018);

  d = toPersianDate(EN, d);
  expect(dateFirstDayOfWeek(d)).toEqual(DayOfWeek.SUNDAY);
  expect(dateMinDaysInFirstWeek(d)).toEqual(1);

  expect(dateYear(d)).toEqual(1396);
  expect(dateExtendedYear(d)).toEqual(1396);

  d = toGregorianDate(EN, d);
  expect(dateFirstDayOfWeek(d)).toEqual(DayOfWeek.SUNDAY);
  expect(dateMinDaysInFirstWeek(d)).toEqual(1);

  expect(dateYear(d)).toEqual(2018);
  expect(dateExtendedYear(d)).toEqual(2018);

  expect(d).toEqual(orig);

  d = toGregorianDate(EN, { date: dateUnixEpoch(d) });
  expect(dateHour(d)).toEqual(7);
  expect(dateYear(d)).toEqual(2018);
  expect(dateExtendedYear(d)).toEqual(2018);
});
