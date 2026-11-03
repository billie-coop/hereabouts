import { bench, describe } from 'vitest';
import {
  type Decimal,
  decimal,
  decimalAdd,
  decimalCompare,
  decimalDivide,
  decimalMultiply,
  decimalSetScale,
  decimalSubtract,
  decimalToParts,
  decimalToString,
} from '../../src/decimal';

// Inputs vary per call so results can't be cached or constant-folded.
const N = 1024;
const STRINGS = Array.from({ length: N }, (_, i) => `${i * 7919}.${(i * 31) % 1000}`);
const LONG = Array.from(
  { length: N },
  (_, i) => `${i}1234567890123456789012345.123456789${i % 10}`,
);
const NUMBERS = Array.from({ length: N }, (_, i) => i * 3.25 + 0.01);
const A: Decimal[] = STRINGS.map((s) => decimal(s));
const B: Decimal[] = NUMBERS.map((n) => decimal(n));

let i = 0;
const next = () => i++ & (N - 1);

describe('decimal parse', () => {
  bench('decimal(string)', () => {
    decimal(STRINGS[next()]);
  });
  bench('decimal(number)', () => {
    decimal(NUMBERS[next()]);
  });
  bench('decimal(long string)', () => {
    decimal(LONG[next()]);
  });
});

describe('decimal arithmetic', () => {
  bench('add', () => {
    const k = next();
    decimalAdd(A[k], B[k]);
  });
  bench('subtract', () => {
    const k = next();
    decimalSubtract(A[k], B[k]);
  });
  bench('multiply', () => {
    const k = next();
    decimalMultiply(A[k], B[k]);
  });
  bench('divide (default context)', () => {
    const k = next();
    decimalDivide(A[k], B[k]);
  });
  bench('divide scale 2 half-even', () => {
    const k = next();
    decimalDivide(A[k], B[k], { scale: 2, round: 'half-even' });
  });
  bench('setScale 2', () => {
    decimalSetScale(A[next()], 2);
  });
  bench('compare', () => {
    const k = next();
    decimalCompare(A[k], B[k]);
  });
});

describe('decimal format', () => {
  bench('toString', () => {
    decimalToString(A[next()]);
  });
  bench('toParts', () => {
    decimalToParts(A[next()]);
  });
});
