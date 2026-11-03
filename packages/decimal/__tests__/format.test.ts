import {
  decimal,
  decimalFormat,
  decimalToString,
  partsDecimalFormatter,
  stringDecimalFormatter,
} from '../src';

const parse = (s: string) => decimal(s);

test('format', () => {
  expect(decimalToString(parse('-12.79'))).toEqual('-12.79');
});

test('string', () => {
  const f = stringDecimalFormatter();
  const digits = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
  const n = decimal('123456789');
  decimalFormat(n, f, '.', ',', 1, 1, 3, 3, true, digits);
  expect(f.render()).toEqual('bcd,efg,hij');
});

test('trailing zeros with group', () => {
  const f = stringDecimalFormatter();
  const n = decimal('1.2e31');
  decimalFormat(n, f, '.', ',', 1, 1, 3, 3, true);
  expect(f.render()).toEqual('12,000,000,000,000,000,000,000,000,000,000');
});

test('parts formatter edge case', () => {
  const f = partsDecimalFormatter('.', ',');
  expect(f.render()).toEqual([]);
  f.add('123');
  expect(f.render()).toEqual([{ type: 'integer', value: '123' }]);
});
