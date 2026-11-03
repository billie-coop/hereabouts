import type { TimePeriodField } from '@phensley/cldr-core/lib';
import {
  type CalendarDate,
  dateAdd,
  dateDifference,
  dateDifferenceSigned,
  dateToDateTimeString,
  dateUntil,
  type GregorianDate,
  gregorianDateFromUnixEpoch,
  type TimePeriod,
} from '../../../src';
import { MAR_11_2000, NEW_YORK } from './_referencedates';

const gregorian = (e: number, z: string) => gregorianDateFromUnixEpoch(e, z, 1, 1);

const period = (t: Partial<TimePeriod>): TimePeriod =>
  Object.assign(
    { year: 0, month: 0, week: 0, day: 0, hour: 0, minute: 0, second: 0, millis: 0 },
    t,
  );

const cldrstr = (c: CalendarDate): string =>
  dateToDateTimeString(c, { includeZoneOffset: true, optionalMilliseconds: true });

test('negative time', () => {
  let end: GregorianDate;

  //  February 29, 2024 8:30:00 AM GMT-05:00
  const start = gregorian(1709213400000, NEW_YORK);
  expect(cldrstr(start)).toEqual('2024-02-29 08:30:00-05:00');

  end = dateAdd(start, { day: 2, hour: -7 });
  expect(cldrstr(end)).toEqual('2024-03-02 01:30:00-05:00');
  expect(dateDifference(start, end)).toEqual(period({ day: 1, hour: 17 }));
});

test('difference month vs day', () => {
  let end: GregorianDate;

  //  February 29, 2024 8:30:00 AM GMT-05:00
  const start = gregorian(1709213400000, NEW_YORK);
  expect(cldrstr(start)).toEqual('2024-02-29 08:30:00-05:00');

  end = dateAdd(start, { month: 11, day: -28 });
  expect(cldrstr(end)).toEqual('2025-01-01 08:30:00-05:00');
  expect(dateDifference(start, end)).toEqual(period({ year: 0, month: 10, day: 3 }));

  end = dateAdd(start, { year: 1, month: -1 });
  expect(cldrstr(end)).toEqual('2025-01-29 08:30:00-05:00');
  expect(dateDifference(start, end)).toEqual(period({ month: 11 }));

  end = dateAdd(start, { year: 1, day: -5 });
  expect(cldrstr(end)).toEqual('2025-02-23 08:30:00-05:00');
  expect(dateDifference(start, end)).toEqual(period({ month: 11, day: 25 }));
});

test('all flags', () => {
  let end: GregorianDate;
  const fields: TimePeriodField[] = [
    'year',
    'month',
    'week',
    'day',
    'hour',
    'minute',
    'second',
    'millis',
  ];

  //  February 29, 2024 8:30:00 AM GMT-05:00
  const start = gregorian(1709213400000, NEW_YORK);
  expect(cldrstr(start)).toEqual('2024-02-29 08:30:00-05:00');

  end = dateAdd(start, { year: 1, month: 1 });
  expect(cldrstr(end)).toEqual('2025-03-29 08:30:00-04:00');
  expect(dateDifference(start, end)).toEqual(period({ year: 1, month: 1 }));
  expect(dateDifference(start, end, { fields })).toEqual(period({ year: 1, month: 1 }));
});

test('weeks', () => {
  let end: GregorianDate;

  //  February 29, 2024 8:30:00 AM GMT-05:00
  const start = gregorian(1709213400000, NEW_YORK);
  expect(cldrstr(start)).toEqual('2024-02-29 08:30:00-05:00');

  end = dateAdd(start, { day: 15 });
  expect(dateDifference(start, end, { fields: ['week', 'day'] })).toEqual(
    period({ week: 2, day: 1 }),
  );

  end = dateAdd(start, { day: 15 });
  expect(dateDifference(start, end, { fields: ['day'], includeWeeks: true })).toEqual(
    period({ week: 0, day: 15 }),
  );
});

test('leap year', () => {
  let end: GregorianDate;

  //  February 29, 2024 8:30:00 AM GMT-05:00
  const start = gregorian(1709213400000, NEW_YORK);
  expect(cldrstr(start)).toEqual('2024-02-29 08:30:00-05:00');

  end = dateAdd(start, { year: 1 });
  expect(cldrstr(end)).toEqual('2025-02-28 08:30:00-05:00');
  expect(dateDifference(start, end)).toEqual(period({ month: 11, day: 30 }));

  end = dateAdd(start, { year: 1, month: 1 });
  expect(cldrstr(end)).toEqual('2025-03-29 08:30:00-04:00');
  expect(dateDifference(start, end)).toEqual(period({ year: 1, month: 1 }));

  end = dateAdd(start, { year: 1, month: 2, day: 3 });
  expect(cldrstr(end)).toEqual('2025-05-02 08:30:00-04:00');
  expect(dateDifference(start, end)).toEqual(period({ year: 1, month: 2, day: 3 }));

  end = dateAdd(start, { year: 1, month: 2, day: 17 });
  expect(cldrstr(end)).toEqual('2025-05-16 08:30:00-04:00');
  expect(dateDifference(start, end, { includeWeeks: true })).toEqual(
    period({ year: 1, month: 2, week: 2, day: 3 }),
  );
});

test('month backwards', () => {
  let end: GregorianDate;

  //  February 29, 2024 8:30:00 AM GMT-05:00
  const start = gregorian(1709213400000, NEW_YORK);
  expect(cldrstr(start)).toEqual('2024-02-29 08:30:00-05:00');

  end = dateAdd(start, { year: 1, month: -1 });
  expect(cldrstr(end)).toEqual('2025-01-29 08:30:00-05:00');
  expect(dateDifference(start, end)).toEqual(period({ month: 11 }));

  end = dateAdd(start, { year: 1, day: -5 });
  expect(cldrstr(end)).toEqual('2025-02-23 08:30:00-05:00');
  expect(dateDifference(start, end)).toEqual(period({ month: 11, day: 25 }));

  end = dateAdd(start, { year: 1, month: -1, day: -5 });
  expect(cldrstr(end)).toEqual('2025-01-24 08:30:00-05:00');
  expect(dateDifference(start, end)).toEqual(period({ month: 10, day: 26 }));

  end = dateAdd(start, { year: 1, month: -3 });
  expect(cldrstr(end)).toEqual('2024-11-29 08:30:00-05:00');
  expect(dateDifference(start, end)).toEqual(period({ month: 9 }));
});

test('basic difference', () => {
  let t: TimePeriod;
  let end: CalendarDate;
  const start = gregorian(MAR_11_2000, NEW_YORK);

  end = dateAdd(start, { day: 369 }); // Mar 15, 2001

  t = dateDifference(start, end);
  expect(t).toEqual(period({ year: 1, day: 4 }));

  end = dateAdd(start, { day: 419 }); // May 4, 2001

  t = dateDifference(start, end, { includeWeeks: true });
  expect(t).toEqual(period({ year: 1, month: 1, week: 3, day: 2 }));
  t = dateDifference(start, end);
  expect(t).toEqual(period({ year: 1, month: 1, week: 0, day: 23 }));

  end = dateAdd(start, { year: 3, month: 17 }); // Aug 11, 2004

  t = dateDifference(start, end);
  expect(t).toEqual(period({ year: 4, month: 5 }));

  end = dateAdd(start, { day: 45 }); // April 25, 2000

  t = dateDifference(start, end, { includeWeeks: true });
  expect(t).toEqual(period({ month: 1, week: 2 }));

  end = dateAdd(start, { hour: 48 }); // March 13, 2000

  t = dateDifference(start, end);
  expect(t).toEqual(period({ day: 2 }));

  end = dateAdd(start, { day: 8, hour: 12 }); // March 19, 2000

  t = dateDifference(start, end, { includeWeeks: true });
  expect(t).toEqual(period({ week: 1, day: 1, hour: 12 }));

  end = dateAdd(start, { hour: 24 * 10 }); // March 21, 2000

  t = dateDifference(start, end, { includeWeeks: true });
  expect(t).toEqual(period({ week: 1, day: 3 }));
});

test('signed difference 1', () => {
  let t: TimePeriod;
  let end: CalendarDate;
  const start = gregorian(MAR_11_2000, NEW_YORK);

  end = dateAdd(start, { day: 369 }); // Mar 15, 2001

  t = dateDifferenceSigned(end, start);
  expect(t).toEqual(period({ year: -1, day: -4 }));

  t = dateDifferenceSigned(start, end);
  expect(t).toEqual(period({ year: 1, day: 4 }));

  end = dateAdd(start, { day: 419 }); // May 4, 2001
  expect(cldrstr(end)).toEqual('2001-05-04 03:00:25-04:00');
  expect(dateDifferenceSigned(end, start, { includeWeeks: true })).toEqual(
    period({ year: -1, month: -1, week: -3, day: -3 }),
  );
  expect(dateDifferenceSigned(end, start, { includeWeeks: false })).toEqual(
    period({ year: -1, month: -1, week: 0, day: -24 }),
  );

  expect(dateDifferenceSigned(start, end, { includeWeeks: true })).toEqual(
    period({ year: 1, month: 1, week: 3, day: 2 }),
  );
  expect(dateDifferenceSigned(start, end, { includeWeeks: false })).toEqual(
    period({ year: 1, month: 1, week: 0, day: 23 }),
  );
});

test('basic difference 2', () => {
  let end: CalendarDate;
  const start = gregorian(MAR_11_2000, NEW_YORK);
  expect(cldrstr(start)).toEqual('2000-03-11 03:00:25-05:00');

  // Year 2000
  //          March                April                  May
  //  Su Mo Tu We Th Fr Sa  Su Mo Tu We Th Fr Sa  Su Mo Tu We Th Fr Sa
  //            1  2  3  4                     1      1  2  3  4  5  6
  //   5  6  7  8  9 10 11   2  3  4  5  6  7  8   7  8  9 10 11 12 13
  //  12 13 14 15 16 17 18   9 10 11 12 13 14 15  14 15 16 17 18 19 20
  //  19 20 21 22 23 24 25  16 17 18 19 20 21 22  21 22 23 24 25 26 27
  //  26 27 28 29 30 31     23 24 25 26 27 28 29  28 29 30 31
  //                        30

  end = dateAdd(start, { year: 1, month: 2, day: 3 });
  expect(cldrstr(end)).toEqual('2001-05-14 03:00:25-04:00');
  expect(dateUntil(start, end, { fields: ['month'] })).toEqual(period({ month: 14 }));
  expect(dateUntil(start, end, { fields: ['day'] })).toEqual(period({ day: 429 }));
  expect(dateUntil(start, end, { fields: ['year', 'day'] })).toEqual(period({ year: 1, day: 64 }));
});

test('diff all fields', () => {
  //  February 29, 2024 8:30:00 AM GMT-05:00
  const start = gregorian(1709213400000, NEW_YORK);
  expect(cldrstr(start)).toEqual('2024-02-29 08:30:00-05:00');
  let end = dateAdd(start, { year: 1, month: 2, day: 3 });
  expect(dateUntil(start, end, {})).toEqual(period({ year: 1, month: 2, day: 3 }));

  end = dateAdd(start, { year: 1, month: 2, day: 17 });
  expect(dateUntil(start, end, { includeWeeks: true })).toEqual(
    period({ year: 1, month: 2, week: 2, day: 3 }),
  );

  expect(dateUntil(start, end, { fields: ['year', 'month', 'day', 'week'] })).toEqual(
    period({ year: 1, month: 2, week: 2, day: 3 }),
  );
});

test('diff YMD', () => {
  //  February 29, 2024 8:30:00 AM GMT-05:00
  const start = gregorian(1709213400000, NEW_YORK);
  expect(cldrstr(start)).toEqual('2024-02-29 08:30:00-05:00');
  let end = dateAdd(start, { year: 1, month: 2, day: 3 });
  expect(dateUntil(start, end, { fields: ['year', 'month', 'day'] })).toEqual(
    period({ year: 1, month: 2, day: 3 }),
  );

  end = dateAdd(start, { year: 1, month: 2, day: 17 });
  expect(dateUntil(start, end, { fields: ['year', 'month', 'day'] })).toEqual(
    period({ year: 1, month: 2, day: 17 }),
  );

  expect(dateUntil(start, end, { fields: ['year', 'month', 'day', 'week'] })).toEqual(
    period({ year: 1, month: 2, week: 2, day: 3 }),
  );
});

test('diff Y', () => {
  //  February 29, 2024 8:30:00 AM GMT-05:00
  const start = gregorian(1709213400000, NEW_YORK);
  expect(cldrstr(start)).toEqual('2024-02-29 08:30:00-05:00');
  const end = dateAdd(start, { year: 1, month: 2, day: 3 });
  expect(dateUntil(start, end, { fields: ['year'] })).toEqual(period({ year: 1 }));
});

test('diff M', () => {
  //  February 29, 2024 8:30:00 AM GMT-05:00
  const start = gregorian(1709213400000, NEW_YORK);
  expect(cldrstr(start)).toEqual('2024-02-29 08:30:00-05:00');
  const end = dateAdd(start, { year: 1, month: 2, day: 3 });
  expect(dateUntil(start, end, { fields: ['month'] })).toEqual(period({ month: 14 }));
});

test('diff YM', () => {
  //  February 29, 2024 8:30:00 AM GMT-05:00
  const start = gregorian(1709213400000, NEW_YORK);
  expect(cldrstr(start)).toEqual('2024-02-29 08:30:00-05:00');
  const end = dateAdd(start, { year: 1, month: 2, day: 3 });
  expect(cldrstr(end)).toEqual('2025-05-02 08:30:00-04:00');
  expect(dateUntil(start, end, { fields: ['year', 'month'] })).toEqual(
    period({ year: 1, month: 2 }),
  );
});

test('diff D', () => {
  //  February 29, 2024 8:30:00 AM GMT-05:00
  const start = gregorian(1709213400000, NEW_YORK);
  expect(cldrstr(start)).toEqual('2024-02-29 08:30:00-05:00');
  const end = dateAdd(start, { year: 1, month: 2, day: 3 });
  expect(cldrstr(end)).toEqual('2025-05-02 08:30:00-04:00');
  expect(dateUntil(start, end, { fields: ['day'] })).toEqual(period({ day: 428 }));
});

test('diff YD', () => {
  let end: GregorianDate;

  //  February 29, 2024 8:30:00 AM GMT-05:00
  const start = gregorian(1709213400000, NEW_YORK);
  expect(cldrstr(start)).toEqual('2024-02-29 08:30:00-05:00');
  end = dateAdd(start, { year: 1 });
  expect(cldrstr(end)).toEqual('2025-02-28 08:30:00-05:00');
  expect(dateUntil(start, end, { fields: ['year', 'day'] })).toEqual(period({ day: 365 }));

  end = dateAdd(start, { year: 1, month: 2 });
  expect(cldrstr(end)).toEqual('2025-04-29 08:30:00-04:00');
  expect(dateUntil(start, end, { fields: ['year', 'day'] })).toEqual(period({ year: 1, day: 60 }));
});

test('diff MD', () => {
  //  February 29, 2024 8:30:00 AM GMT-05:00
  const start = gregorian(1709213400000, NEW_YORK);
  expect(cldrstr(start)).toEqual('2024-02-29 08:30:00-05:00');
  const end = dateAdd(start, { year: 1, month: 2, day: 3 });
  expect(cldrstr(end)).toEqual('2025-05-02 08:30:00-04:00');
  expect(dateUntil(start, end, { fields: ['month', 'day'] })).toEqual(
    period({ month: 14, day: 3 }),
  );
});

test('diff DH', () => {
  let end: GregorianDate;

  //  February 29, 2024 8:30:00 AM GMT-05:00
  const start = gregorian(1709213400000, NEW_YORK);
  expect(cldrstr(start)).toEqual('2024-02-29 08:30:00-05:00');

  end = dateAdd(start, { year: 1, month: 2, day: 3, hour: 15 });
  expect(cldrstr(end)).toEqual('2025-05-02 23:30:00-04:00');
  expect(dateUntil(start, end, { fields: ['day', 'hour'] })).toEqual(
    period({ month: 0, day: 428, hour: 15 }),
  );

  end = dateAdd(start, { year: 1, month: 2, day: 3 });
  expect(cldrstr(end)).toEqual('2025-05-02 08:30:00-04:00');
  expect(dateUntil(start, end, { fields: ['day', 'hour'] })).toEqual(
    period({ month: 0, day: 428 }),
  );
});
