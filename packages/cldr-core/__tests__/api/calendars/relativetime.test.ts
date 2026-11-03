import type { ContextType } from '@phensley/cldr-types';

import { type CalendarDate, dateAdd, formatRelativeTime, toGregorianDate } from '../../../src';
import { calendarsApi } from '../../_helpers';

const UTC = 'UTC';

// Sun, March 11, 2018 7:00:25 AM UTC
const MARCH_11_2018_070025_UTC = 1520751625000;

test('format relative time', () => {
  const context: ContextType = 'begin-sentence';
  const api = calendarsApi('en');
  let s: string;
  let end: CalendarDate;

  const start = toGregorianDate(api, { date: MARCH_11_2018_070025_UTC, zoneId: UTC });

  s = formatRelativeTime(api, start, start);
  expect(s).toEqual('now');

  s = formatRelativeTime(api, start, start, { context });
  expect(s).toEqual('Now');

  end = dateAdd(start, { millis: 250 });

  s = formatRelativeTime(api, start, end);
  expect(s).toEqual('now');

  s = formatRelativeTime(api, start, end, { context });
  expect(s).toEqual('Now');

  end = dateAdd(start, { millis: 750 });
  s = formatRelativeTime(api, start, end, { context });
  expect(s).toEqual('In 1 second');

  end = dateAdd(start, { millis: 1250 });
  s = formatRelativeTime(api, start, end, { context });
  expect(s).toEqual('In 1 second');

  end = dateAdd(start, { second: 30 });
  s = formatRelativeTime(api, start, end);
  expect(s).toEqual('in 30 seconds');

  s = formatRelativeTime(api, start, end, { context });
  expect(s).toEqual('In 30 seconds');

  end = dateAdd(start, { minute: -32 });
  s = formatRelativeTime(api, start, end, { context });
  expect(s).toEqual('32 minutes ago');

  end = dateAdd(start, { day: -27 });
  s = formatRelativeTime(api, start, end, { context, field: 'week' });
  expect(s).toEqual('4 weeks ago');

  end = dateAdd(start, { day: -27 });
  s = formatRelativeTime(api, start, end, { context, field: 'week', maximumFractionDigits: 1 });
  expect(s).toEqual('3.9 weeks ago');

  end = dateAdd(start, { week: 1 });
  s = formatRelativeTime(api, start, end, { context, field: 'week' });
  expect(s).toEqual('Next week');

  end = dateAdd(start, { week: 2 });
  s = formatRelativeTime(api, start, end, { context, field: 'week' });
  expect(s).toEqual('In 2 weeks');

  s = formatRelativeTime(api, start, end, { context, field: 'week', dayOfWeek: true });
  expect(s).toEqual('In 2 Sundays');

  s = formatRelativeTime(api, start, end, { context, allowWeeks: true });
  expect(s).toEqual('In 2 weeks');

  s = formatRelativeTime(api, start, end, { context, allowWeeks: true, dayOfWeek: true });
  expect(s).toEqual('In 2 Sundays');

  end = dateAdd(start, { month: 6 });
  s = formatRelativeTime(api, start, end, { context, field: 'month' });
  expect(s).toEqual('In 6 months');

  end = dateAdd(start, { month: 6 });
  s = formatRelativeTime(api, start, end, { context, width: 'short' });
  expect(s).toEqual('In 6 mo.');

  end = dateAdd(start, { month: 6 });
  s = formatRelativeTime(api, start, end, { context, field: 'day' });
  expect(s).toEqual('In 184 days');

  end = dateAdd(start, { month: 3000 });
  s = formatRelativeTime(api, start, end, { context, field: 'month' });
  expect(s).toEqual('In 3,000 months');

  s = formatRelativeTime(api, start, end, { context, field: 'month', group: false });
  expect(s).toEqual('In 3000 months');

  end = dateAdd(start, { year: 1, month: 2 });
  s = formatRelativeTime(api, start, end, { context, round: 'floor' });
  expect(s).toEqual('Next year');

  end = dateAdd(start, { year: 1, month: 2 });
  s = formatRelativeTime(api, start, end, { context, width: 'short', round: 'floor' });
  expect(s).toEqual('Next yr.');

  end = dateAdd(start, { year: 1, month: 2 });
  s = formatRelativeTime(api, start, end, { context, width: 'narrow', round: 'floor' });
  expect(s).toEqual('Next yr.');
});

test('specific field', () => {
  const context: ContextType = 'begin-sentence';
  const api = calendarsApi('en');
  let s: string;
  let end: CalendarDate;

  const start = toGregorianDate(api, { date: MARCH_11_2018_070025_UTC, zoneId: UTC });

  end = dateAdd(start, { year: 1, month: 6 });
  s = formatRelativeTime(api, start, end, { context, field: 'year' });
  expect(s).toEqual('In 2 years');

  s = formatRelativeTime(api, start, end, { context, field: 'year', minimumFractionDigits: 1 });
  expect(s).toEqual('In 1.5 years');

  s = formatRelativeTime(api, start, end, { context, field: 'month' });
  expect(s).toEqual('In 18 months');

  end = dateAdd(start, { month: 6 });
  s = formatRelativeTime(api, start, end, { context, field: 'day' });
  expect(s).toEqual('In 184 days');

  end = dateAdd(start, { day: 90, hour: 12, minute: 30 });

  s = formatRelativeTime(api, start, end, { context, field: 'day' });
  expect(s).toEqual('In 91 days');

  s = formatRelativeTime(api, start, end, { context, field: 'day', maximumFractionDigits: 1 });
  expect(s).toEqual('In 90.5 days');
});

test('numeric only', () => {
  const context: ContextType = 'begin-sentence';
  const api = calendarsApi('en');
  let s: string;
  let end: CalendarDate;

  const start = toGregorianDate(api, { date: MARCH_11_2018_070025_UTC, zoneId: UTC });

  end = dateAdd(start, {});
  s = formatRelativeTime(api, start, end, { context });
  expect(s).toEqual('Now');

  s = formatRelativeTime(api, start, end, { context, field: 'day' });
  expect(s).toEqual('Today');

  s = formatRelativeTime(api, start, end, { context, numericOnly: true });
  expect(s).toEqual('In 0 seconds');

  s = formatRelativeTime(api, start, end, { context, numericOnly: true, field: 'hour' });
  expect(s).toEqual('In 0 hours');

  s = formatRelativeTime(api, start, end, { context, numericOnly: true, alwaysNow: true });
  expect(s).toEqual('Now');

  end = dateAdd(start, { year: 1 });
  s = formatRelativeTime(api, start, end, { context });
  expect(s).toEqual('Next year');

  s = formatRelativeTime(api, start, end, { context, numericOnly: true });
  expect(s).toEqual('In 1 year');
});
