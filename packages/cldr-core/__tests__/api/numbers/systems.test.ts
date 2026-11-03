import { formatDecimal, type NumberSystemType } from '../../../src';
import { numbersApi } from '../../_helpers';

test('numbering systems', () => {
  let api = numbersApi('th');
  let s: string;

  s = formatDecimal(api, '12345.678', { nu: 'thai', group: true, maximumFractionDigits: 1 });
  expect(s).toEqual('๑๒,๓๔๕.๗');
  s = formatDecimal(api, '12345.678', { group: true, maximumFractionDigits: 1 });
  expect(s).toEqual('12,345.7');

  api = numbersApi('zh');
  s = formatDecimal(api, '12345.678', { group: true, maximumFractionDigits: 1, nu: 'native' });
  expect(s).toEqual('一二,三四五.七');
  s = formatDecimal(api, '12345.678', { group: true, maximumFractionDigits: 1 });
  expect(s).toEqual('12,345.7');

  api = numbersApi('ar');
  s = formatDecimal(api, '12345.678', { group: true, maximumFractionDigits: 1 });
  expect(s).toEqual('١٢٬٣٤٥٫٧');
  s = formatDecimal(api, '12345.678', { nu: 'native', group: true, maximumFractionDigits: 1 });
  expect(s).toEqual('١٢٬٣٤٥٫٧');
  s = formatDecimal(api, '12345.678', { nu: 'latn', group: true, maximumFractionDigits: 1 });
  expect(s).toEqual('12,345.7');

  // Invalid number system names will use the default system.
  s = formatDecimal(api, '12345.678', { nu: 'xxx' as NumberSystemType });
  expect(s).toEqual('١٢٬٣٤٥٫٦٧٨');
});
