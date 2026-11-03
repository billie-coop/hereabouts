import { dateEndOf, dateToString, gregorianDateFromUnixEpoch } from '../../../../src/core';

const FEB_15_2025_123040_UTC = 1739622640000;

test('endOf date', () => {
  const d = gregorianDateFromUnixEpoch(FEB_15_2025_123040_UTC, 'America/New_York');

  expect(dateToString(d)).toEqual('Gregorian 2025-02-15 07:30:40.000 America/New_York');
  expect(dateToString(dateEndOf(d, 'year'))).toEqual(
    'Gregorian 2025-12-31 23:59:59.999 America/New_York',
  );
  expect(dateToString(dateEndOf(d, 'month'))).toEqual(
    'Gregorian 2025-02-28 23:59:59.999 America/New_York',
  );
  expect(dateToString(dateEndOf(d, 'day'))).toEqual(
    'Gregorian 2025-02-15 23:59:59.999 America/New_York',
  );
  expect(dateToString(dateEndOf(d, 'hour'))).toEqual(
    'Gregorian 2025-02-15 07:59:59.999 America/New_York',
  );
  expect(dateToString(dateEndOf(d, 'minute'))).toEqual(
    'Gregorian 2025-02-15 07:30:59.999 America/New_York',
  );
  expect(dateToString(dateEndOf(d, 'second'))).toEqual(
    'Gregorian 2025-02-15 07:30:40.999 America/New_York',
  );
});
