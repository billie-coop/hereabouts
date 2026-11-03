import {
  dateAdd,
  dateSubtract,
  dateWeekOfMonth,
  dateWeekOfYear,
  dateWeekOfYearISO,
  dateYearOfWeekOfYear,
  dateYearOfWeekOfYearISO,
  gregorianDateFromUnixEpoch,
} from '../../../src';
import type { GregorianDate } from '../../../src/systems/calendars';
import { DayOfWeek } from '../../../src/systems/calendars/fields';
import { NEW_YORK } from './_referencedates';

const make = (e: number, z: string) => gregorianDateFromUnixEpoch(e, z, DayOfWeek.SUNDAY, 1);

test('weeks coverage', () => {
  let d: GregorianDate;
  let n: number;

  //  December 2020
  //  Su Mo Tu We Th Fr Sa
  //         1  2  3  4  5
  //   6  7  8  9 10 11 12
  //  13 14 15 16 17 18 19
  //  20 21 22 23 24 25 26
  //  27 28 29 30 31

  // Thursday, December 31, 2020 12:30:00 PM UTC
  n = 1609417800000;

  // Dec 31
  d = make(n, NEW_YORK);
  expect(dateWeekOfMonth(d)).toEqual(5);
  expect(dateWeekOfYear(d)).toEqual(1);
  expect(dateYearOfWeekOfYear(d)).toEqual(2021);
  expect(dateWeekOfYearISO(d)).toEqual(53);
  expect(dateYearOfWeekOfYearISO(d)).toEqual(2020);

  // Dec 30
  d = dateSubtract(d, { day: 1 });
  expect(dateWeekOfMonth(d)).toEqual(5);
  expect(dateWeekOfYear(d)).toEqual(1);
  expect(dateYearOfWeekOfYear(d)).toEqual(2021);
  expect(dateWeekOfYearISO(d)).toEqual(53);
  expect(dateYearOfWeekOfYearISO(d)).toEqual(2020);

  // Dec 29
  d = dateSubtract(d, { day: 1 });
  expect(dateWeekOfMonth(d)).toEqual(5);
  expect(dateWeekOfYear(d)).toEqual(1);
  expect(dateYearOfWeekOfYear(d)).toEqual(2021);
  expect(dateWeekOfYearISO(d)).toEqual(53);
  expect(dateYearOfWeekOfYearISO(d)).toEqual(2020);

  // Dec 28
  d = dateSubtract(d, { day: 1 });
  expect(dateWeekOfMonth(d)).toEqual(5);
  expect(dateWeekOfYear(d)).toEqual(1);
  expect(dateYearOfWeekOfYear(d)).toEqual(2021);
  expect(dateWeekOfYearISO(d)).toEqual(53);
  expect(dateYearOfWeekOfYearISO(d)).toEqual(2020);

  // Dec 27
  d = dateSubtract(d, { day: 1 });
  expect(dateWeekOfMonth(d)).toEqual(5);
  expect(dateWeekOfYear(d)).toEqual(1);
  expect(dateYearOfWeekOfYear(d)).toEqual(2021);
  expect(dateWeekOfYearISO(d)).toEqual(52);
  expect(dateYearOfWeekOfYearISO(d)).toEqual(2020);

  // Dec 26
  d = dateSubtract(d, { day: 1 });
  expect(dateWeekOfMonth(d)).toEqual(4);
  expect(dateWeekOfYear(d)).toEqual(52);
  expect(dateYearOfWeekOfYear(d)).toEqual(2020);
  expect(dateWeekOfYearISO(d)).toEqual(52);
  expect(dateYearOfWeekOfYearISO(d)).toEqual(2020);

  // Dec 25
  d = dateSubtract(d, { day: 1 });
  expect(dateWeekOfMonth(d)).toEqual(4);
  expect(dateWeekOfYear(d)).toEqual(52);
  expect(dateYearOfWeekOfYear(d)).toEqual(2020);
  expect(dateWeekOfYearISO(d)).toEqual(52);
  expect(dateYearOfWeekOfYearISO(d)).toEqual(2020);

  //  January 2021
  //  Su Mo Tu We Th Fr Sa
  //                  1  2
  //   3  4  5  6  7  8  9
  //  10 11 12 13 14 15 16
  //  17 18 19 20 21 22 23
  //  24 25 26 27 28 29 30
  //  31

  // Jan 1
  d = dateAdd(make(n, NEW_YORK), { day: 1 });
  expect(dateWeekOfMonth(d)).toEqual(1);
  expect(dateWeekOfYear(d)).toEqual(1);
  expect(dateYearOfWeekOfYear(d)).toEqual(2021);
  expect(dateWeekOfYearISO(d)).toEqual(53);
  expect(dateYearOfWeekOfYearISO(d)).toEqual(2020);

  // Jan 2
  d = dateAdd(d, { day: 1 });
  expect(dateWeekOfMonth(d)).toEqual(1);
  expect(dateWeekOfYear(d)).toEqual(1);
  expect(dateYearOfWeekOfYear(d)).toEqual(2021);
  expect(dateWeekOfYearISO(d)).toEqual(53);
  expect(dateYearOfWeekOfYearISO(d)).toEqual(2020);

  // Jan 3
  d = dateAdd(d, { day: 1 });
  expect(dateWeekOfMonth(d)).toEqual(2);
  expect(dateWeekOfYear(d)).toEqual(2);
  expect(dateYearOfWeekOfYear(d)).toEqual(2021);
  expect(dateWeekOfYearISO(d)).toEqual(53);
  expect(dateYearOfWeekOfYearISO(d)).toEqual(2020);

  // Jan 4
  d = dateAdd(d, { day: 1 });
  expect(dateWeekOfMonth(d)).toEqual(2);
  expect(dateWeekOfYear(d)).toEqual(2);
  expect(dateYearOfWeekOfYear(d)).toEqual(2021);
  expect(dateWeekOfYearISO(d)).toEqual(1);
  expect(dateYearOfWeekOfYearISO(d)).toEqual(2021);
});
