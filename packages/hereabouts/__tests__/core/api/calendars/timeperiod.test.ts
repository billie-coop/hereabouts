import { type Quantity, timePeriodToQuantity } from '../../../../src/core';

test('time period to quantity', () => {
  let q: Quantity[];

  q = timePeriodToQuantity({ year: 3, month: 5, day: 27.5 });
  expect(q).toEqual([
    { unit: 'year', value: 3 },
    { unit: 'month', value: 5 },
    { unit: 'day', value: 27.5 },
  ]);

  q = timePeriodToQuantity({ minute: 75, hour: 12.5, year: 4.2 });
  expect(q).toEqual([
    { unit: 'year', value: 4.2 },
    { unit: 'hour', value: 12.5 },
    { unit: 'minute', value: 75 },
  ]);

  q = timePeriodToQuantity({ millis: 125, month: 7 });
  expect(q).toEqual([
    { unit: 'month', value: 7 },
    { unit: 'millisecond', value: 125 },
  ]);
});
