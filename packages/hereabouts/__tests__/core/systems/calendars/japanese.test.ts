import {
  dateEra,
  dateExtendedYear,
  dateToString,
  dateType,
  dateWithZone,
  dateYear,
  japaneseDateFromUnixEpoch,
} from '../../../../src/core';
import { DayOfWeek } from '../../../../src/core/systems/calendars/fields';
import type { JapaneseDate } from '../../../../src/core/systems/calendars/japanese';

const make = (e: number, z: string) => japaneseDateFromUnixEpoch(e, z, DayOfWeek.SUNDAY, 1);

// Monday, June 1, 1925 12:34:56 PM UTC
const JUN_01_1925 = -1406978704000;

test('japanese calendar', () => {
  let d: JapaneseDate;
  let n: number;

  // Monday, January 24, 620 4:40:00 AM UTC
  n = -42599935200000;
  d = make(n, 'UTC');
  expect(dateToString(d)).toEqual('Japanese 0620-01-21 04:40:00.000 Etc/UTC');
  expect(dateType(d)).toEqual('japanese');
  expect(dateEra(d)).toEqual(0); // Taika 645-06-19
  expect(dateYear(d)).toEqual(-24);
  expect(dateExtendedYear(d)).toEqual(620);

  // Monday, June 1, 1925 12:34:56 PM UTC
  n = -1406978704000;
  d = make(n, 'UTC');
  expect(dateEra(d)).toEqual(233); // Taisho 1912-07-30
  expect(dateYear(d)).toEqual(14);
  expect(dateExtendedYear(d)).toEqual(1925);

  // Thursday, June 1, 1933 12:34:56 PM UTC
  n = -1154517904000;
  d = make(n, 'UTC');
  expect(dateEra(d)).toEqual(234); // Showa 1926-12-25
  expect(dateYear(d)).toEqual(8);
  expect(dateExtendedYear(d)).toEqual(1933);

  // Sunday, October 5, 1975 12:34:56 PM UTC
  n = 181744496000;
  d = make(n, 'UTC');
  expect(dateEra(d)).toEqual(234); // Showa 1926-12-25
  expect(dateYear(d)).toEqual(50);
  expect(dateExtendedYear(d)).toEqual(1975);

  // Monday, January 9, 1989 12:34:56 PM UTC
  n = 600352496000;
  d = make(n, 'UTC');
  expect(dateEra(d)).toEqual(235); // Heisei 1989-01-08
  expect(dateYear(d)).toEqual(1);
  expect(dateExtendedYear(d)).toEqual(1989);

  // Wednesday, April 11, 2018 11:59:59.123 PM UTC
  n = 1523491199123;

  d = make(n, 'UTC');
  expect(dateEra(d)).toEqual(235); // Heisei 1989-01-08
  expect(dateYear(d)).toEqual(30);
  expect(dateExtendedYear(d)).toEqual(2018);

  // Saturday, June 1, 2019 05:00:00.000 PM UTC
  n = 1559365200000;
  d = make(n, 'UTC');
  expect(dateEra(d)).toEqual(236);
  expect(dateYear(d)).toEqual(1);
  expect(dateExtendedYear(d)).toEqual(2019);
});

test('japanese era year', () => {
  let d: JapaneseDate;
  let n: number;

  // Monday, June 5, 2023 12:34:56 PM UTC
  n = 1685968496000;
  d = make(n, 'UTC');
  expect(dateEra(d)).toEqual(236);
  expect(dateYear(d)).toEqual(5);
  expect(dateExtendedYear(d)).toEqual(2023);
});

test('with zone', () => {
  let d: JapaneseDate;

  d = make(JUN_01_1925, 'UTC');
  expect(dateToString(d)).toEqual('Japanese 1925-06-01 12:34:56.000 Etc/UTC');

  d = dateWithZone(d, 'America/New_York');
  expect(dateToString(d)).toEqual('Japanese 1925-06-01 08:34:56.000 America/New_York');

  d = dateWithZone(d, 'America/Los_Angeles');
  expect(dateToString(d)).toEqual('Japanese 1925-06-01 04:34:56.000 America/Los_Angeles');
});

test('einin era boundary (regression: 1293-08-55 typo)', () => {
  // The era table lists Einin as starting 1293-08-05 (was 1293-08-55, an
  // impossible day). Pre-1582 dates internalize via the proleptic Julian
  // calendar (as in ICU), so the Einin boundary falls at Julian 1293-08-05 =
  // Gregorian 1293-08-12. Values verified against ICU4J (era 140/141).

  // 1293-08-04 → Shoo (started 1288-04-28), era-year 6
  let d = make(-21345379200000, 'UTC');
  expect(dateEra(d)).toEqual(140);
  expect(dateYear(d)).toEqual(6);
  expect(dateExtendedYear(d)).toEqual(1293);

  // 1293-08-11 → last day of Shoo
  d = make(-21344774400000, 'UTC');
  expect(dateEra(d)).toEqual(140);
  expect(dateYear(d)).toEqual(6);

  // 1293-08-12 → first day of Einin. With the 1293-08-55 typo (August has 31
  // days) every date in August 1293 resolved to Shoo instead.
  d = make(-21344688000000, 'UTC');
  expect(dateEra(d)).toEqual(141);
  expect(dateYear(d)).toEqual(1);
  expect(dateExtendedYear(d)).toEqual(1293);

  // 1294-01-09 → Einin era-year 2
  d = make(-21331728000000, 'UTC');
  expect(dateEra(d)).toEqual(141);
  expect(dateYear(d)).toEqual(2);
});
