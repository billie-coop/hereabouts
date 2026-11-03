import { dateAdd, formatDate, formatDateInterval, toGregorianDate } from '../../src';
import { calendarsApi } from '../_helpers';

// June 10, 2019 12:34:56 PM EDT (UTC-4) == 16:34:56 UTC
const JUNE_10_2019_123456_EDT = 1560184496000;

test('custom calendars', () => {
  const zoneId = 'America/New_York';
  const date = { date: new Date(JUNE_10_2019_123456_EDT), zoneId };
  const api = calendarsApi('en', { calendars: [] });
  let s: string;

  s = formatDate(api, date, { datetime: 'full' });
  expect(s).toEqual('Monday, June 10, 2019 at 12:34:56 PM Eastern Daylight Time');

  // We've omitted all non-gregorian calendars, so all date formatting
  // will use the given calendar's rules but fall back to gregorian
  // patterns, names, etc

  s = formatDate(api, date, { datetime: 'full', ca: 'buddhist' });
  expect(s).toEqual('Monday, June 10, 2019 at 12:34:56 PM Eastern Daylight Time');

  s = formatDate(api, date, { datetime: 'full', ca: 'persian' });
  expect(s).toEqual('Monday, June 10, 2019 at 12:34:56 PM Eastern Daylight Time');
});

test('skeleton pattern defaulting', () => {
  const zoneId = 'America/New_York';
  const date = { date: new Date(JUNE_10_2019_123456_EDT), zoneId };
  const api = calendarsApi('en', { calendars: [] });
  let s: string;

  // If all skeletons are ommitted, it will attempt to match the input
  // skeleton against one of the named formats, e.g. 'short', 'long', etc.

  s = formatDate(api, date, { date: 'short' });
  expect(s).toEqual('6/10/19');

  s = formatDate(api, date, { skeleton: 'yyMd' });
  expect(s).toEqual('6/10/19');

  s = formatDate(api, date, { skeleton: 'yMd' });
  expect(s).toEqual('6/10/2019');

  // This requests year and quarter, but we get the closest match
  s = formatDate(api, date, { skeleton: 'yQQQQ' });
  expect(s).toEqual('Jun 10, 2019');
});

test('skeleton pattern quarters', () => {
  const zoneId = 'America/New_York';
  const date = { date: new Date(JUNE_10_2019_123456_EDT), zoneId };
  const api = calendarsApi('en', {
    calendars: [],
    'gregorian-available-format': ['yQQQ', 'yQQQQ'],
  });

  let s: string;

  // Skeleton matcher can't narrow 'yQQQ' to 'yQ', so we get 'yQQQ' here
  s = formatDate(api, date, { skeleton: 'yQ' });
  expect(s).toEqual('Q2 2019');

  s = formatDate(api, date, { skeleton: 'yQQQQ' });
  expect(s).toEqual('2nd quarter 2019');
});

test('missing interval patterns', () => {
  const zoneId = 'America/New_York';
  const api = calendarsApi('en', {
    calendars: [],
  });
  let s: string;

  const start = toGregorianDate(api, { date: new Date(JUNE_10_2019_123456_EDT), zoneId });

  s = formatDateInterval(api, start, dateAdd(start, { day: 1 }));
  expect(s).toEqual('');
});
