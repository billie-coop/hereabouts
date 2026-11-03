import { decimal, decimalToString } from '@phensley/decimal';
import { adjustDecimal, type Decimal, type DecimalAdjustOptions } from '../../../src';
import { numbersApi } from '../../_helpers';

const API = numbersApi('en');

const adjust = (s: string, opts?: DecimalAdjustOptions): string =>
  decimalToString(adjustDecimal(API, s, opts));

const parse = (n: number | string): Decimal => decimal(n);

test('parse decimal', () => {
  let d: Decimal;

  d = parse('1.0');
  expect(decimalToString(d)).toEqual('1.0');

  // biome-ignore lint/suspicious/noApproximativeNumericConstant: a literal with these digits
  d = parse(3.14159);
  expect(decimalToString(d)).toEqual('3.14159');
});

test('adjust fractions', () => {
  let s: string;

  s = adjust('1.0');
  expect(s).toEqual('1');

  s = adjust('1.0', { minimumFractionDigits: 1 });
  expect(s).toEqual('1.0');

  s = adjust('1.0', { maximumFractionDigits: 1 });
  expect(s).toEqual('1');

  s = adjust('1.1', { maximumFractionDigits: 1 });
  expect(s).toEqual('1.1');

  s = adjust('1.1', { maximumFractionDigits: 0 });
  expect(s).toEqual('1');

  s = adjust('1.5', { maximumFractionDigits: 0 });
  expect(s).toEqual('2');

  s = adjust('1.5', { maximumFractionDigits: 0, round: 'down' });
  expect(s).toEqual('1');
});

test('adjust significant', () => {
  let s: string;

  s = adjust('1.00', { minimumSignificantDigits: 1 });
  expect(s).toEqual('1');

  s = adjust('1.00', { minimumSignificantDigits: 2 });
  expect(s).toEqual('1.0');

  s = adjust('1.00', { minimumSignificantDigits: 3 });
  expect(s).toEqual('1.00');

  s = adjust('1.00', { minimumSignificantDigits: 4 });
  expect(s).toEqual('1.000');

  // minimum overrides maximum
  s = adjust('1.00', { minimumSignificantDigits: 4, maximumSignificantDigits: 1 });
  expect(s).toEqual('1.000');

  s = adjust('1.00', { minimumSignificantDigits: 4, maximumSignificantDigits: 5 });
  expect(s).toEqual('1.000');

  s = adjust('1.00006', { minimumSignificantDigits: 4, maximumSignificantDigits: 5 });
  expect(s).toEqual('1.0001');
});

test('adjust significant', () => {
  let s: string;

  s = adjust('1.05');
  expect(s).toEqual('1');

  s = adjust('1.05', { maximumSignificantDigits: 2 });
  expect(s).toEqual('1.0');

  s = adjust('1.06', { maximumSignificantDigits: 2 });
  expect(s).toEqual('1.1');

  s = adjust('1.05', { maximumSignificantDigits: 2, round: 'ceiling' });
  expect(s).toEqual('1.1');

  s = adjust('1.05', { maximumSignificantDigits: 2, round: 'down' });
  expect(s).toEqual('1.0');

  s = adjust('1.05', { maximumSignificantDigits: 3 });
  expect(s).toEqual('1.05');

  s = adjust('1.05', { maximumSignificantDigits: 4 });
  expect(s).toEqual('1.050');
});
