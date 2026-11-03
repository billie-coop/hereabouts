import {
  type BuddhistDate,
  buddhistDateFromUnixEpoch,
  dateCompare,
  dateFields,
  dateSet,
  dateToISOString,
  dateToString,
  dateWithZone,
  type GregorianDate,
  gregorianDateFromFields,
  gregorianDateFromUnixEpoch,
  type PersianDate,
  persianDateFromUnixEpoch,
} from '../../../../src/core';
import { RNG } from '../../../utils/rng';

// Fri Apr 3 2020 18:08:52.123 UTC
const APR_03_2020 = 1585937332123;

// Thu Apr 3 3000 20:37:33 UTC
const APR_03_3000 = 32511703053000;

const ZONES = [
  'America/New_York',
  'Asia/Tokyo',
  'Africa/Casablanca',
  'Antarctica/McMurdo', // alias
];

const NEW_YORK = 'America/New_York';

test('leap', () => {
  // February 29, 2024 8:30:00 AM GMT-05:00
  let s = gregorianDateFromUnixEpoch(1709213400000, NEW_YORK);
  let q = dateSet(s, { year: 2025 });
  expect(dateToString(q)).toEqual('Gregorian 2025-02-28 08:30:00.000 America/New_York');

  // January 31, 2024 8:30:00 AM GMT-05:00
  s = gregorianDateFromUnixEpoch(1706707800000, NEW_YORK);
  q = dateSet(s, { month: 2 });
  expect(dateToString(q)).toEqual('Gregorian 2024-02-29 08:30:00.000 America/New_York');

  q = dateSet(s, { year: 2025, month: 2 });
  expect(dateToString(q)).toEqual('Gregorian 2025-02-28 08:30:00.000 America/New_York');
});

test('gregorian fields', () => {
  const d1 = gregorianDateFromUnixEpoch(APR_03_2020, 'America/New_York');
  expect(dateToString(d1)).toEqual('Gregorian 2020-04-03 14:08:52.123 America/New_York');
  expect(dateToISOString(d1)).toEqual('2020-04-03T18:08:52.123Z');
  expect(dateFields(d1)).toEqual({
    year: 2020,
    month: 4,
    day: 3,
    hour: 14,
    minute: 8,
    second: 52,
    millis: 123,
    zoneId: 'America/New_York',
  });

  // Round-trip from fields to obtain idential value
  const d2 = gregorianDateFromFields(dateFields(d1));
  expect(dateToString(d2)).toEqual('Gregorian 2020-04-03 14:08:52.123 America/New_York');
  expect(dateToISOString(d2)).toEqual('2020-04-03T18:08:52.123Z');
});

test('gregorian set field', () => {
  let d: GregorianDate;

  d = gregorianDateFromUnixEpoch(APR_03_2020, 'America/New_York');
  expect(dateToString(dateSet(d, { year: 1997, day: 20 }))).toEqual(
    'Gregorian 1997-04-20 14:08:52.123 America/New_York',
  );
  expect(dateToString(dateSet(d, { year: 1997, day: 20 }))).toEqual(
    'Gregorian 1997-04-20 14:08:52.123 America/New_York',
  );

  // Moving month backwards into DST
  expect(dateToString(dateSet(d, { month: 2 }))).toEqual(
    'Gregorian 2020-02-03 14:08:52.123 America/New_York',
  );
  expect(dateToString(dateSet(d, { month: 0 }))).toEqual(
    'Gregorian 2020-01-03 14:08:52.123 America/New_York',
  );

  // Clamp invalid month to 1 <= m <= 12
  expect(dateToString(dateSet(d, { month: -5 }))).toEqual(
    'Gregorian 2020-01-03 14:08:52.123 America/New_York',
  );
  expect(dateToString(dateSet(d, { month: 24 }))).toEqual(
    'Gregorian 2020-12-03 14:08:52.123 America/New_York',
  );

  // Clamp invalid day to 1 <= day <= (days in month)
  expect(dateToString(dateSet(d, { day: -60 }))).toEqual(
    'Gregorian 2020-04-01 14:08:52.123 America/New_York',
  );
  expect(dateToString(dateSet(d, { day: 60 }))).toEqual(
    'Gregorian 2020-04-30 14:08:52.123 America/New_York',
  );

  // Clamp hour, minute, second, millis to 0 <= n <= 60
  expect(dateToString(dateSet(d, { hour: 10 }))).toEqual(
    'Gregorian 2020-04-03 10:08:52.123 America/New_York',
  );
  expect(dateToString(dateSet(d, { hour: -10 }))).toEqual(
    'Gregorian 2020-04-03 00:08:52.123 America/New_York',
  );
  expect(dateToString(dateSet(d, { hour: 0 }))).toEqual(
    'Gregorian 2020-04-03 00:08:52.123 America/New_York',
  );

  // Gregorian cutover
  expect(dateToString(dateSet(d, { year: 1582, month: 10, day: 3 }))).toEqual(
    'Gregorian 1582-10-03 14:08:52.123 America/New_York',
  );
  expect(dateToString(dateSet(d, { year: 1582, month: 10, day: 16 }))).toEqual(
    'Gregorian 1582-10-16 14:08:52.123 America/New_York',
  );

  // Set zone concurrently
  expect(dateToString(dateSet(d, { zoneId: 'America/Los_Angeles' }))).toEqual(
    'Gregorian 2020-04-03 14:08:52.123 America/Los_Angeles',
  );

  // Set fields then change zone
  expect(dateToString(dateWithZone(dateSet(d, {}), 'America/Los_Angeles'))).toEqual(
    'Gregorian 2020-04-03 11:08:52.123 America/Los_Angeles',
  );

  // Set fields, then change zone
  expect(dateToString(dateWithZone(dateSet(d, { hour: 9 }), 'America/Los_Angeles'))).toEqual(
    'Gregorian 2020-04-03 06:08:52.123 America/Los_Angeles',
  );

  // Change zone, then set fields
  expect(dateToString(dateSet(dateWithZone(d, 'America/Los_Angeles'), { hour: 9 }))).toEqual(
    'Gregorian 2020-04-03 09:08:52.123 America/Los_Angeles',
  );

  // Set to invalid zone
  expect(dateToString(dateSet(d, { zoneId: 'ZZZ' }))).toEqual(
    'Gregorian 2020-04-03 14:08:52.123 Etc/UTC',
  );
});

test('buddhist fields', () => {
  const d = buddhistDateFromUnixEpoch(APR_03_2020, 'America/New_York', 1, 1);

  // The toString method formats the extended year
  expect(dateToString(d)).toEqual('Buddhist 2020-04-03 14:08:52.123 America/New_York');
  expect(dateFields(d)).toEqual({
    year: 2020,
    month: 4,
    day: 3,
    hour: 14,
    minute: 8,
    second: 52,
    millis: 123,
    zoneId: 'America/New_York',
  });
});

test('buddhist set field', () => {
  let d: BuddhistDate;

  d = buddhistDateFromUnixEpoch(APR_03_2020, 'America/New_York', 1, 1);
  expect(dateToString(dateSet(d, { year: 1997, day: 20 }))).toEqual(
    'Buddhist 1997-04-20 14:08:52.123 America/New_York',
  );
});

test('persian fields', () => {
  const d = persianDateFromUnixEpoch(APR_03_2020, 'America/New_York', 1, 1);
  expect(dateToString(d)).toEqual('Persian 1399-01-15 14:08:52.123 America/New_York');
  expect(dateFields(d)).toEqual({
    year: 1399,
    month: 1,
    day: 15,
    hour: 14,
    minute: 8,
    second: 52,
    millis: 123,
    zoneId: 'America/New_York',
  });
});

test('persian set field', () => {
  let d: PersianDate;

  d = persianDateFromUnixEpoch(APR_03_2020, 'America/New_York', 1, 1);
  expect(dateToString(dateSet(d, { year: 1997, day: 20 }))).toEqual(
    'Persian 1997-01-20 13:08:52.123 America/New_York',
  );

  // Clamp invalid month to 1 <= m <= 12
  expect(dateToString(dateSet(d, { month: -5 }))).toEqual(
    'Persian 1399-01-15 14:08:52.123 America/New_York',
  );
  expect(dateToString(dateSet(d, { month: 24 }))).toEqual(
    'Persian 1399-12-15 13:08:52.123 America/New_York',
  );

  // Clamp invalid day to 1 <= day <= (days in month)
  expect(dateToString(dateSet(d, { day: -60 }))).toEqual(
    'Persian 1399-01-01 14:08:52.123 America/New_York',
  );
  expect(dateToString(dateSet(d, { day: 60 }))).toEqual(
    'Persian 1399-01-31 14:08:52.123 America/New_York',
  );

  // Time calculation is shared with Gregorian so this is sufficient
  expect(dateToString(dateSet(d, { hour: 5 }))).toEqual(
    'Persian 1399-01-15 05:08:52.123 America/New_York',
  );

  // Just change zone
  expect(dateToString(dateWithZone(dateSet(d, {}), 'America/Los_Angeles'))).toEqual(
    'Persian 1399-01-15 11:08:52.123 America/Los_Angeles',
  );

  // Set fields, then change zone
  expect(dateToString(dateWithZone(dateSet(d, { hour: 9 }), 'America/Los_Angeles'))).toEqual(
    'Persian 1399-01-15 06:08:52.123 America/Los_Angeles',
  );

  // Change zone, then set fields
  expect(dateToString(dateSet(dateWithZone(d, 'America/Los_Angeles'), { hour: 9 }))).toEqual(
    'Persian 1399-01-15 09:08:52.123 America/Los_Angeles',
  );
});

test('gregorian random', () => {
  // Randomized epochs to ensure setting all fields round-trips
  const rng = new RNG('1309');
  for (let i = 0; i < 10000; i++) {
    for (const sgn of [1, -1]) {
      const n = Math.floor(sgn * rng.rand() * APR_03_3000);
      for (const z of ZONES) {
        const d = gregorianDateFromUnixEpoch(n, z, 1, 1);
        const r = dateSet(d, dateFields(d));
        expect(dateCompare(d, r)).toEqual(0);
      }
    }
  }
});

test('persian random', () => {
  // Randomized epochs to ensure setting all fields round-trips
  const rng = new RNG('1309');
  for (let i = 0; i < 10000; i++) {
    for (const sgn of [1, -1]) {
      const n = Math.floor(sgn * rng.rand() * APR_03_3000);
      for (const z of ZONES) {
        const d = persianDateFromUnixEpoch(n, z, 1, 1);
        const r = dateSet(d, dateFields(d));
        expect(dateCompare(d, r)).toEqual(0);
      }
    }
  }
});
