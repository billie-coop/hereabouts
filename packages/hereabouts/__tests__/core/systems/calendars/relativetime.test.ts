import {
  dateAdd,
  dateRelativeTime,
  dateToDateTimeString,
  gregorianDateFromUnixEpoch,
} from '../../../../src/core';
import type { CalendarDate } from '../../../../src/core/systems';
import { MAR_11_2000, UTC } from './_referencedates';

const gregorian = (e: number, z: string) => gregorianDateFromUnixEpoch(e, z, 1, 1);

test('basic difference', () => {
  let r: [string, number];
  let end: CalendarDate;
  const start = gregorian(MAR_11_2000, UTC);
  expect(dateToDateTimeString(start)).toEqual('2000-03-11 08:00:25.000');

  end = dateAdd(start, { year: 1 }); // truncated to 1
  expect(dateToDateTimeString(end)).toEqual('2001-03-11 08:00:25.000');

  r = dateRelativeTime(start, end, 'year');
  expect(r).toEqual(['year', 1]);
  r = dateRelativeTime(start, end, 'month');
  expect(r).toEqual(['month', 12]);
  r = dateRelativeTime(start, end, 'day');
  expect(r).toEqual(['day', 365]);

  end = dateAdd(start, { month: 6 });

  r = dateRelativeTime(start, end, 'year');
  expect(r).toEqual(['year', 0]);
  r = dateRelativeTime(start, end, 'year', { rollupFractional: true });
  expect(r).toEqual(['year', 0.5]);
  r = dateRelativeTime(start, end, 'month');
  expect(r).toEqual(['month', 6]);
  r = dateRelativeTime(start, end, 'day');
  expect(r).toEqual(['day', 184]);

  // March 11 to September 11 is 184 days, which is 1/2 year.
  end = dateAdd(start, { day: 184 });

  r = dateRelativeTime(start, end, 'year', { rollupFractional: true });
  expect(r).toEqual(['year', 0.5]);
  r = dateRelativeTime(start, end, 'month');
  expect(r).toEqual(['month', 6]);
  r = dateRelativeTime(start, end, 'day');
  expect(r).toEqual(['day', 184]);

  // TODO: increase test coverage
});

test('sign', () => {
  let r: [string, number];
  let end: CalendarDate;
  const start = gregorian(MAR_11_2000, UTC);
  expect(dateToDateTimeString(start)).toEqual('2000-03-11 08:00:25.000');

  end = dateAdd(start, { day: -5 });
  r = dateRelativeTime(start, end);
  expect(r).toEqual(['day', -5]);
});
