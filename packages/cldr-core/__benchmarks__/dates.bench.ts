import { bench, describe } from 'vitest';
import {
  type CalendarDate,
  dateAdd,
  dateDayOfMonth,
  dateDayOfWeekInMonth,
  dateDifference,
  dateHour,
  dateMinute,
  dateMonth,
  dateUntil,
  dateWeekOfMonth,
  dateWeekOfYear,
  dateWeekOfYearISO,
  dateYear,
  dateYearOfWeekOfYear,
  gregorianDateFromFields,
  gregorianDateFromUnixEpoch,
  persianDateFromUnixEpoch,
} from '../src';
import { counter, N } from './_locale';

const NY = 'America/New_York';
const EPOCHS = Array.from({ length: N }, (_, i) => 1.7e12 + i * 3.6e6 * 31);
const DATES: CalendarDate[] = EPOCHS.map((e) => gregorianDateFromUnixEpoch(e, NY, 1, 1));
const next = counter();
export let sink = 0;

describe('date creation', () => {
  bench('gregorian from epoch, UTC', () => {
    gregorianDateFromUnixEpoch(EPOCHS[next()], 'UTC', 1, 1);
  });
  bench('gregorian from epoch, New York', () => {
    gregorianDateFromUnixEpoch(EPOCHS[next()], NY, 1, 1);
  });
  bench('gregorian from epoch, ISO week rule', () => {
    gregorianDateFromUnixEpoch(EPOCHS[next()], 'Europe/Berlin', 2, 4);
  });
  bench('persian from epoch', () => {
    persianDateFromUnixEpoch(EPOCHS[next()], 'Asia/Tehran', 7, 1);
  });
  bench('gregorian from fields', () => {
    const k = next();
    gregorianDateFromFields({
      year: 2000 + (k & 31),
      month: 1 + (k % 12),
      day: 1 + (k % 28),
      zoneId: NY,
    });
  });
});

describe('date accessors', () => {
  bench('year+month+day+hour+minute', () => {
    const d = DATES[next()];
    sink = dateYear(d) + dateMonth(d) + dateDayOfMonth(d) + dateHour(d) + dateMinute(d);
  });
  bench('weekOfYear', () => {
    dateWeekOfYear(DATES[next()]);
  });
  bench('yearOfWeekOfYear', () => {
    dateYearOfWeekOfYear(DATES[next()]);
  });
  bench('weekOfYearISO', () => {
    dateWeekOfYearISO(DATES[next()]);
  });
  bench('weekOfMonth', () => {
    dateWeekOfMonth(DATES[next()]);
  });
  bench('dayOfWeekInMonth', () => {
    dateDayOfWeekInMonth(DATES[next()]);
  });
});

describe('date arithmetic', () => {
  bench('dateAdd day+hour', () => {
    dateAdd(DATES[next()], { day: 3, hour: 5 });
  });
  bench('dateAdd month', () => {
    dateAdd(DATES[next()], { month: 1 });
  });
  bench('dateAdd year+month+day', () => {
    dateAdd(DATES[next()], { year: 1, month: 2, day: 10 });
  });
  bench('dateUntil', () => {
    const k = next();
    dateUntil(DATES[k], DATES[(k * 7) & (N - 1)]);
  });
  bench('dateDifference', () => {
    const k = next();
    dateDifference(DATES[k], DATES[(k * 7) & (N - 1)]);
  });
});
