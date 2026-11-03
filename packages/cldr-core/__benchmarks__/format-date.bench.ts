import { bench, describe } from 'vitest';
import {
  type CalendarDate,
  formatDate,
  formatDateInterval,
  formatDateToParts,
  formatRelativeTimeField,
  gregorianDateFromUnixEpoch,
  type ZonedDateTime,
} from '../src';
import { counter, locale, N } from './_locale';

const EN = locale('en');
const DE = locale('de');

const NY = 'America/New_York';
const HOUR = 3.6e6;
const EPOCHS = Array.from({ length: N }, (_, i) => 1.7e12 + i * HOUR * 31);
const DATES: CalendarDate[] = EPOCHS.map((e) => gregorianDateFromUnixEpoch(e, NY, 1, 1));
const ZONED: ZonedDateTime[] = EPOCHS.map((date) => ({ date, zoneId: NY }));
const next = counter();

describe('formatDate prebuilt date', () => {
  for (const width of ['short', 'medium', 'long', 'full'] as const) {
    bench(`date ${width}`, () => {
      formatDate(EN, DATES[next()], { date: width });
    });
  }
  bench('time short', () => {
    formatDate(EN, DATES[next()], { time: 'short' });
  });
  bench('datetime long', () => {
    formatDate(EN, DATES[next()], { datetime: 'long' });
  });
  for (const skeleton of ['yMMMd', 'yMMMEdhm', 'Ehm', 'yQQQ', 'YwE']) {
    bench(`skeleton ${skeleton}`, () => {
      formatDate(EN, DATES[next()], { skeleton });
    });
  }
  bench('de datetime long', () => {
    formatDate(DE, DATES[next()], { datetime: 'long' });
  });
  bench('datetime long toParts', () => {
    formatDateToParts(EN, DATES[next()], { datetime: 'long' });
  });
});

describe('formatDate { date, zoneId }', () => {
  bench('date short', () => {
    formatDate(EN, ZONED[next()], { date: 'short' });
  });
  bench('datetime long', () => {
    formatDate(EN, ZONED[next()], { datetime: 'long' });
  });
  bench('skeleton yMMMEdhm', () => {
    formatDate(EN, ZONED[next()], { skeleton: 'yMMMEdhm' });
  });
});

describe('formatDateInterval', () => {
  bench('same day, hours apart', () => {
    const k = next();
    formatDateInterval(
      EN,
      DATES[k],
      { date: EPOCHS[k] + 3 * HOUR, zoneId: NY },
      { skeleton: 'yMMMdhm' },
    );
  });
  bench('days apart, default', () => {
    const k = next();
    formatDateInterval(EN, DATES[k], DATES[(k + 3) & (N - 1)]);
  });
  bench('months apart, skeleton yMMMd', () => {
    const k = next();
    formatDateInterval(EN, DATES[k], DATES[(k + 40) & (N - 1)], { skeleton: 'yMMMd' });
  });
});

describe('formatRelativeTimeField', () => {
  bench('en day', () => {
    formatRelativeTimeField(EN, (next() % 20) - 10, 'day');
  });
});
