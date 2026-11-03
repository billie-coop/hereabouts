import { decimal, decimalProperties, decimalToString } from '../../src/decimal';

test('decimal(d) returns the same immutable value', () => {
  const original = decimal(123);
  expect(decimal(original)).toBe(original);
});

test('decimalProperties returns a copy of the coefficient', () => {
  const original = decimal(123);
  const copy = decimal(original);
  const props = decimalProperties(copy);
  expect(props).toEqual([[123], 1, 0, 0]);
  expect(props[0]).not.toBe(original.data);

  // Writing to the returned array (only possible by bypassing its readonly type) must not
  // change the shared value.
  (props[0] as number[])[0] = 456;
  expect(decimalToString(original)).toEqual('123');
  expect(decimalToString(copy)).toEqual('123');

  const mutate = () => {
    // @ts-expect-error -- readonly
    decimalProperties(original)[0][0] = 1;
  };
  expect(typeof mutate).toBe('function');
});
