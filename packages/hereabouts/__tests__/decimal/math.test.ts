import { divide } from '../../src/decimal/math';

test('divide internal error', () => {
  // Ensure we cover the case where a length mismatch throws.
  expect(() => divide([], [0, 123])).toThrowError();
});
