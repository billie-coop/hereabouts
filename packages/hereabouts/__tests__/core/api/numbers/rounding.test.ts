import { formatDecimal } from '../../../../src/core';
import { numbersApi } from '../../_helpers';

test('compact rounding up to next divisor', () => {
  const api = numbersApi('en');
  let s: string;

  s = formatDecimal(api, 999900, { style: 'short' });
  expect(s).toEqual('1M');

  s = formatDecimal(api, 999900, { style: 'short', minimumFractionDigits: 1 });
  expect(s).toEqual('999.9K');

  s = formatDecimal(api, 999900, { style: 'short', minimumFractionDigits: 2 });
  expect(s).toEqual('999.90K');
});
