import {
  formatDateWrapper,
  formatDateWrapperToParts,
  type LocaleData,
  type Part,
} from '../../../src';
import { calendarsApi } from '../../_helpers';

test('date wrapper string', () => {
  let api: LocaleData;

  let s: string;

  api = calendarsApi('en');

  s = formatDateWrapper(api, 'DATE', 'TIME');
  expect(s).toEqual('DATE, TIME');

  s = formatDateWrapper(api, 'DATE', 'TIME', { width: 'full' });
  expect(s).toEqual('DATE at TIME');

  s = formatDateWrapper(api, 'DATE', 'TIME', { width: 'full', atTime: true });
  expect(s).toEqual('DATE at TIME');

  s = formatDateWrapper(api, 'DATE', 'TIME', { width: 'full', atTime: false });
  expect(s).toEqual('DATE, TIME');

  s = formatDateWrapper(api, 'DATE', 'TIME', { ca: 'persian' });
  expect(s).toEqual('DATE, TIME');

  api = calendarsApi('es-HN');

  s = formatDateWrapper(api, 'DATE', 'TIME', { width: 'full' });
  expect(s).toEqual('DATE, TIME');

  api = calendarsApi('fr-LU');

  s = formatDateWrapper(api, 'DATE', 'TIME', { width: 'full' });
  expect(s).toEqual('DATE à TIME');

  api = calendarsApi('vi');

  s = formatDateWrapper(api, 'DATE', 'TIME', { width: 'short' });
  expect(s).toEqual('TIME DATE');

  s = formatDateWrapper(api, 'DATE', 'TIME', { width: 'full' });
  expect(s).toEqual('lúc TIME DATE');

  api = calendarsApi('fa');

  s = formatDateWrapper(api, 'DATE', 'TIME', { ca: 'persian' });
  expect(s).toEqual('DATE،\u200f TIME');

  s = formatDateWrapper(api, 'DATE', 'TIME', { ca: 'persian', width: 'full' });
  expect(s).toEqual('DATE، ساعت TIME');
});

test('date wrapper parts', () => {
  let api: LocaleData;

  let p: Part[];

  api = calendarsApi('en');

  p = formatDateWrapperToParts(
    api,
    [{ type: 'date', value: 'DATE' }],
    [{ type: 'time', value: 'TIME' }],
  );
  expect(p).toEqual([
    { type: 'date', value: 'DATE' },
    { type: 'literal', value: ', ' },
    { type: 'time', value: 'TIME' },
  ]);

  p = formatDateWrapperToParts(
    api,
    [{ type: 'date', value: 'DATE' }],
    [{ type: 'time', value: 'TIME' }],
    {
      width: 'full',
    },
  );
  expect(p).toEqual([
    { type: 'date', value: 'DATE' },
    { type: 'literal', value: ' at ' },
    { type: 'time', value: 'TIME' },
  ]);
});
