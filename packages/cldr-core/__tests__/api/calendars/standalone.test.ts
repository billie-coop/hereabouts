import {
  dayPeriods,
  type EraWidthType,
  eras,
  type FieldWidthType,
  months,
  quarters,
  weekdays,
} from '../../../src';
import { calendarsApi } from '../../_helpers';

test('era', () => {
  const en = calendarsApi('en');
  let e = eras(en);

  expect(e[0]).toEqual({ none: 'Before Christ', sensitive: 'Before Common Era' });
  expect(e[1]).toEqual({ none: 'Anno Domini', sensitive: 'Common Era' });

  e = eras(en, { width: 'abbr' });
  expect(e[0]).toEqual({ none: 'BC', sensitive: 'BCE' });
  expect(e[1]).toEqual({ none: 'AD', sensitive: 'CE' });

  e = eras(en, { width: 'narrow' });
  expect(e[0]).toEqual({ none: 'B', sensitive: 'BCE' });
  expect(e[1]).toEqual({ none: 'A', sensitive: 'CE' });

  e = eras(en, { width: 'names' });
  expect(e[0]).toEqual({ none: 'Before Christ', sensitive: 'Before Common Era' });
  expect(e[1]).toEqual({ none: 'Anno Domini', sensitive: 'Common Era' });

  e = eras(en, { width: 'invalid' as EraWidthType });
  expect(e[0]).toEqual(undefined);
  expect(e[1]).toEqual(undefined);

  const es = calendarsApi('es');
  e = eras(es);
  expect(e[0]).toEqual({ none: 'antes de Cristo', sensitive: 'antes de la era común' });

  e = eras(es, { context: 'begin-sentence' });
  expect(e[0]).toEqual({ none: 'Antes de Cristo', sensitive: 'Antes de la era común' });
});

test('month', () => {
  const en = calendarsApi('en');
  let m = months(en);

  m = months(en, { width: 'narrow' });
  expect(m[1]).toEqual('J');
  expect(m[10]).toEqual('O');

  // short same as narrow for months
  m = months(en, { width: 'short' });
  expect(m[1]).toEqual('J');
  expect(m[10]).toEqual('O');

  m = months(en, { width: 'abbreviated' });
  expect(m[1]).toEqual('Jan');
  expect(m[10]).toEqual('Oct');

  m = months(en, { width: 'wide' });
  expect(m[1]).toEqual('January');
  expect(m[10]).toEqual('October');

  m = months(en, { width: 'invalid' as FieldWidthType });
  expect(m[1]).toEqual(undefined);
  expect(m[10]).toEqual(undefined);

  m = months(en, { ca: 'persian' });
  expect(m[2]).toEqual('Ordibehesht');
});

test('weekdays', () => {
  const en = calendarsApi('en');
  let w = weekdays(en);
  expect(w[2]).toEqual('Monday');

  // fetch twice to exercise caching
  w = weekdays(en, { width: 'short' });
  expect(w[6]).toEqual('Fr');

  w = weekdays(en, { width: 'narrow' });
  expect(w[6]).toEqual('F');

  w = weekdays(en, { width: 'wide' });
  expect(w[6]).toEqual('Friday');

  w = weekdays(en, { ca: 'persian' });
  expect(w[2]).toEqual('Monday');

  const es = calendarsApi('es');

  w = weekdays(es);
  expect(w[6]).toEqual('viernes');

  w = weekdays(es, { context: 'middle-of-text' });
  expect(w[6]).toEqual('viernes');

  w = weekdays(es, { context: 'standalone' });
  expect(w[6]).toEqual('Viernes');

  w = weekdays(es, { context: 'ui-list-or-menu' });
  expect(w[6]).toEqual('Viernes');

  w = weekdays(es, { context: 'begin-sentence' });
  expect(w[6]).toEqual('Viernes');
});

test('day periods', () => {
  let api = calendarsApi('en');

  let d = dayPeriods(api);
  expect(d.am).toEqual({ none: 'AM', casing: 'am' });
  expect(d.noon).toEqual({ none: 'noon' });

  d = dayPeriods(api, { ca: 'persian' });
  expect(d.noon).toEqual({ none: 'noon' });

  api = calendarsApi('es');

  d = dayPeriods(api);
  expect(d.noon).toEqual({ none: 'mediodía' });

  d = dayPeriods(api, { context: 'begin-sentence' });
  expect(d.noon).toEqual({ none: 'Mediodía' });

  d = dayPeriods(api, { context: 'ui-list-or-menu' });
  expect(d.noon).toEqual({ none: 'mediodía' });
});

test('quarter', () => {
  let api = calendarsApi('en');

  let q = quarters(api);
  expect(q[2]).toEqual('2nd quarter');

  q = quarters(api, { ca: 'persian' });
  expect(q[2]).toEqual('2nd quarter');

  api = calendarsApi('es');

  q = quarters(api);
  expect(q[2]).toEqual('2.º trimestre');

  q = quarters(api, { context: 'standalone' });
  expect(q[2]).toEqual('2.º trimestre');
});
