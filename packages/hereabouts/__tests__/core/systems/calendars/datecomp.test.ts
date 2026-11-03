import {
  type CalendarDate,
  dateAdd,
  dateCompare,
  gregorianDateFromUnixEpoch,
} from '../../../../src/core';
import { MAR_11_2000, NEW_YORK } from './_referencedates';

const gregorian = (e: number, z: string) => gregorianDateFromUnixEpoch(e, z, 1, 1);

test('comparison', () => {
  let end: CalendarDate;
  const start = gregorian(MAR_11_2000, NEW_YORK);

  end = dateAdd(start, { year: 1 });
  expect(dateCompare(start, end)).toEqual(-1);

  end = dateAdd(start, { millis: 1 });
  expect(dateCompare(start, end)).toEqual(-1);

  end = dateAdd(start, {});
  expect(dateCompare(start, end)).toEqual(0);

  end = dateAdd(start, { year: 0, millis: 0 });
  expect(dateCompare(start, end)).toEqual(0);

  end = dateAdd(start, { millis: -1 });
  expect(dateCompare(start, end)).toEqual(1);

  end = dateAdd(start, { year: -1 });
  expect(dateCompare(start, end)).toEqual(1);
});
