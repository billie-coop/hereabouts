import { formatCurrency, formatDecimal } from '../../../../src/core';
import { numbersApi } from '../../_helpers';

test('trim zero fractions', () => {
  const api = numbersApi('en');
  let s: string;

  s = formatDecimal(api, '9.999', {});
  expect(s).toEqual('9.999');

  s = formatDecimal(api, '9.9999', {});
  expect(s).toEqual('10');

  s = formatDecimal(api, '9.9999', { trimZeroFractions: true });
  expect(s).toEqual('10');

  s = formatDecimal(api, '9.9999', { minimumFractionDigits: 2, trimZeroFractions: true });
  expect(s).toEqual('10.00');

  // US Dollar - 2 digits

  s = formatCurrency(api, 10, 'USD');
  expect(s).toEqual('$10.00');

  s = formatCurrency(api, '10.00', 'USD', { trimZeroFractions: true });
  expect(s).toEqual('$10');

  s = formatCurrency(api, '10.10', 'USD', { trimZeroFractions: true });
  expect(s).toEqual('$10.10');

  s = formatCurrency(api, '9.9999', 'USD', { trimZeroFractions: true });
  expect(s).toEqual('$10');

  s = formatCurrency(api, '9.9999', 'USD', { minimumFractionDigits: 2, trimZeroFractions: true });
  expect(s).toEqual('$10.00');

  // Bahraini Dinar - 3 digits
  s = formatCurrency(api, '9.999', 'BHD');
  expect(s).toEqual('BHD\u00a09.999');

  s = formatCurrency(api, '9.9999', 'BHD');
  expect(s).toEqual('BHD\u00a010.000');

  s = formatCurrency(api, '9.9999', 'BHD', { trimZeroFractions: true });
  expect(s).toEqual('BHD\u00a010');

  s = formatCurrency(api, '10.10000', 'BHD', { trimZeroFractions: true });
  expect(s).toEqual('BHD\u00a010.100');

  // Chilean Unit of Account - 4 digits
  s = formatCurrency(api, '9.999', 'CLF');
  expect(s).toEqual('CLF\u00a09.9990');

  s = formatCurrency(api, '9.9999', 'CLF');
  expect(s).toEqual('CLF\u00a09.9999');

  s = formatCurrency(api, '9.99999', 'CLF');
  expect(s).toEqual('CLF\u00a010.0000');

  s = formatCurrency(api, '9.99999', 'CLF', { trimZeroFractions: true });
  expect(s).toEqual('CLF\u00a010');

  s = formatCurrency(api, '10.1', 'CLF', { trimZeroFractions: true });
  expect(s).toEqual('CLF\u00a010.1000');
});
