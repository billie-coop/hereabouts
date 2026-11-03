import { dateStartOf, dateToString, gregorianDateFromUnixEpoch } from '../../../../src/core';

const FEB_15_2025_123040_UTC = 1739622640000;

test('startOf date', () => {
  const d = gregorianDateFromUnixEpoch(FEB_15_2025_123040_UTC, 'America/New_York');

  expect(dateToString(d)).toEqual('Gregorian 2025-02-15 07:30:40.000 America/New_York');
  expect(dateToString(dateStartOf(d, 'year'))).toEqual(
    'Gregorian 2025-01-01 00:00:00.000 America/New_York',
  );
  expect(dateToString(dateStartOf(d, 'month'))).toEqual(
    'Gregorian 2025-02-01 00:00:00.000 America/New_York',
  );
  expect(dateToString(dateStartOf(d, 'day'))).toEqual(
    'Gregorian 2025-02-15 00:00:00.000 America/New_York',
  );
  expect(dateToString(dateStartOf(d, 'hour'))).toEqual(
    'Gregorian 2025-02-15 07:00:00.000 America/New_York',
  );
  expect(dateToString(dateStartOf(d, 'minute'))).toEqual(
    'Gregorian 2025-02-15 07:30:00.000 America/New_York',
  );
  expect(dateToString(dateStartOf(d, 'second'))).toEqual(
    'Gregorian 2025-02-15 07:30:40.000 America/New_York',
  );
});
