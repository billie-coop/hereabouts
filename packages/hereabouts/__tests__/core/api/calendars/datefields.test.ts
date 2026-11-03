import { dateField, formatRelativeTimeField } from '../../../../src/core';
import { decimal } from '../../../../src/decimal';
import type { DateFieldWidthType, RelativeTimeFieldType } from '../../../../src/types';
import { calendarsApi } from '../../_helpers';

test('display name', () => {
  let api = calendarsApi('en');
  let s: string;

  s = dateField(api, 'era');
  expect(s).toEqual('era');

  s = dateField(api, 'era', { context: 'middle-of-text' });
  expect(s).toEqual('era');

  s = dateField(api, 'era', { context: 'standalone' });
  expect(s).toEqual('Era');

  s = dateField(api, 'era', { context: 'begin-sentence' });
  expect(s).toEqual('Era');

  s = dateField(api, 'year');
  expect(s).toEqual('year');

  s = dateField(api, 'year', { context: 'middle-of-text' });
  expect(s).toEqual('year');

  s = dateField(api, 'year', { context: 'standalone' });
  expect(s).toEqual('Year');

  // Spanish

  api = calendarsApi('es');

  s = dateField(api, 'era');
  expect(s).toEqual('era');

  s = dateField(api, 'era', { context: 'middle-of-text' });
  expect(s).toEqual('era');

  s = dateField(api, 'era', { context: 'standalone' });
  expect(s).toEqual('era');

  s = dateField(api, 'era', { context: 'begin-sentence' });
  expect(s).toEqual('Era');

  s = dateField(api, 'year');
  expect(s).toEqual('año');

  s = dateField(api, 'year', { context: 'middle-of-text' });
  expect(s).toEqual('año');

  s = dateField(api, 'year', { context: 'standalone' });
  expect(s).toEqual('año');

  s = dateField(api, 'year', { context: 'begin-sentence' });
  expect(s).toEqual('Año');
});

test('relative time', () => {
  const api = calendarsApi('en');
  let s: string;

  s = formatRelativeTimeField(api, 1, 'hour');
  expect(s).toEqual('in 1 hour');

  s = formatRelativeTimeField(api, 2, 'hour');
  expect(s).toEqual('in 2 hours');

  s = formatRelativeTimeField(api, 0, 'day');
  expect(s).toEqual('today');

  s = formatRelativeTimeField(api, '0', 'day');
  expect(s).toEqual('today');

  s = formatRelativeTimeField(api, 1, 'day');
  expect(s).toEqual('tomorrow');

  s = formatRelativeTimeField(api, -1, 'day');
  expect(s).toEqual('yesterday');

  s = formatRelativeTimeField(api, '5', 'day');
  expect(s).toEqual('in 5 days');

  s = formatRelativeTimeField(api, '-6.3', 'day');
  expect(s).toEqual('6 days ago');

  s = formatRelativeTimeField(api, '-6.3', 'day', { maximumFractionDigits: 1 });
  expect(s).toEqual('6.3 days ago');

  s = formatRelativeTimeField(api, 1, 'sun');
  expect(s).toEqual('next Sunday');

  s = formatRelativeTimeField(api, 4, 'sun');
  expect(s).toEqual('in 4 Sundays');

  s = formatRelativeTimeField(api, -1, 'month');
  expect(s).toEqual('last month');

  s = formatRelativeTimeField(api, -6, 'month');
  expect(s).toEqual('6 months ago');

  s = formatRelativeTimeField(api, '-6.6', 'year');
  expect(s).toEqual('7 years ago');

  s = formatRelativeTimeField(api, '-6.6', 'year', { maximumFractionDigits: 1 });
  expect(s).toEqual('6.6 years ago');

  s = formatRelativeTimeField(api, 1, 'year');
  expect(s).toEqual('next year');
});

test('relative time 2', () => {
  // German for -2 and +2 days
  let api = calendarsApi('de');
  let s: string;

  s = formatRelativeTimeField(api, '-3', 'day');
  expect(s).toEqual('vor 3 Tagen');

  s = formatRelativeTimeField(api, '-2', 'day');
  expect(s).toEqual('vorgestern');

  s = formatRelativeTimeField(api, '-1', 'day');
  expect(s).toEqual('gestern');

  s = formatRelativeTimeField(api, '0', 'day');
  expect(s).toEqual('heute');

  s = formatRelativeTimeField(api, '1', 'day');
  expect(s).toEqual('morgen');

  s = formatRelativeTimeField(api, '2', 'day');
  expect(s).toEqual('übermorgen');

  s = formatRelativeTimeField(api, '3', 'day');
  expect(s).toEqual('in 3 Tagen');

  // English
  api = calendarsApi('en-CC');
  s = formatRelativeTimeField(api, '-3', 'day');
  expect(s).toEqual('3 days ago');

  s = formatRelativeTimeField(api, '-2', 'day');
  expect(s).toEqual('2 days ago');

  s = formatRelativeTimeField(api, '-1', 'day');
  expect(s).toEqual('yesterday');

  s = formatRelativeTimeField(api, '0', 'day');
  expect(s).toEqual('today');

  s = formatRelativeTimeField(api, '1', 'day');
  expect(s).toEqual('tomorrow');

  s = formatRelativeTimeField(api, '2', 'day');
  expect(s).toEqual('in 2 days');

  s = formatRelativeTimeField(api, '3', 'day');
  expect(s).toEqual('in 3 days');
});

test('relative time options', () => {
  const api = calendarsApi('en');
  let s: string;

  s = formatRelativeTimeField(api, decimal('-3.2'), 'week');
  expect(s).toEqual('3 weeks ago');

  s = formatRelativeTimeField(api, decimal('-1.2'), 'week');
  expect(s).toEqual('last week');

  s = formatRelativeTimeField(api, decimal('-1.2'), 'week', { maximumFractionDigits: 1 });
  expect(s).toEqual('1.2 weeks ago');

  s = formatRelativeTimeField(api, 1, 'week', {});
  expect(s).toEqual('next week');

  s = formatRelativeTimeField(api, 1, 'week', { width: 'short' });
  expect(s).toEqual('next wk.');

  s = formatRelativeTimeField(api, -3, 'week', { width: 'narrow' });
  expect(s).toEqual('3w ago');

  s = formatRelativeTimeField(api, 2, 'month', { width: 'narrow' });
  expect(s).toEqual('in 2mo');

  s = formatRelativeTimeField(api, -70, 'sun', { width: 'short' });
  expect(s).toEqual('70 Sun. ago');

  s = formatRelativeTimeField(api, -70, 'sun', { width: 'narrow' });
  expect(s).toEqual('70 Su ago');

  s = formatRelativeTimeField(api, -70, 'sun', { width: 'wide' });
  expect(s).toEqual('70 Sundays ago');

  // Invalid field
  s = formatRelativeTimeField(api, 5, 'weekXX' as RelativeTimeFieldType);
  expect(s).toEqual('');

  // Invalid width defaults to wide
  s = formatRelativeTimeField(api, 5, 'week', { width: 'wideXX' as DateFieldWidthType });
  expect(s).toEqual('in 5 weeks');

  // Invalid number
  expect(() => formatRelativeTimeField(api, 'xyz', 'week')).toThrowError();
});

test('relative time locales', () => {
  let api = calendarsApi('es');
  let s: string;

  s = formatRelativeTimeField(api, 1, 'day');
  expect(s).toEqual('mañana');

  s = formatRelativeTimeField(api, -1, 'week');
  expect(s).toEqual('la semana pasada');

  api = calendarsApi('de');
  s = formatRelativeTimeField(api, 1, 'day');
  expect(s).toEqual('morgen');

  s = formatRelativeTimeField(api, -1, 'week');
  expect(s).toEqual('letzte Woche');
});

test('numbering', () => {
  const api = calendarsApi('en');
  let s: string;

  s = formatRelativeTimeField(api, 3, 'week', { width: 'short', nu: 'arab' });
  expect(s).toEqual('in ٣ wk.');
});

test('numeric only', () => {
  const api = calendarsApi('en');
  let s: string;

  s = formatRelativeTimeField(api, 0, 'day', { numericOnly: true });
  expect(s).toEqual('in 0 days');

  s = formatRelativeTimeField(api, 0, 'day', { numericOnly: true, alwaysNow: true });
  expect(s).toEqual('today');

  s = formatRelativeTimeField(api, 1, 'day', { numericOnly: true });
  expect(s).toEqual('in 1 day');

  s = formatRelativeTimeField(api, 1, 'day', { numericOnly: true, alwaysNow: true });
  expect(s).toEqual('in 1 day');

  s = formatRelativeTimeField(api, -1, 'day');
  expect(s).toEqual('yesterday');

  s = formatRelativeTimeField(api, -1, 'day', { numericOnly: true });
  expect(s).toEqual('1 day ago');

  s = formatRelativeTimeField(api, -1, 'day', { numericOnly: true, alwaysNow: true });
  expect(s).toEqual('1 day ago');
});
