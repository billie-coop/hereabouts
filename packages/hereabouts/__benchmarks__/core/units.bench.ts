import { bench, describe } from 'vitest';
import { formatQuantity, formatQuantitySequence, type Quantity } from '../../src/core';
import { counter, locale, N } from './_locale';

const EN = locale('en');
const DE = locale('de');

const KM: Quantity[] = Array.from({ length: N }, (_, i) => ({
  value: `${i}.5`,
  unit: 'kilometer',
}));
const FEET_INCHES: Quantity[][] = Array.from({ length: N }, (_, i) => [
  { value: i % 7, unit: 'foot' },
  { value: i % 12, unit: 'inch' },
]);
const next = counter();

describe('formatQuantity', () => {
  bench('en kilometer long', () => {
    formatQuantity(EN, KM[next()], { length: 'long' });
  });
  bench('en kilometer short', () => {
    formatQuantity(EN, KM[next()], { length: 'short' });
  });
  bench('en kilometer narrow', () => {
    formatQuantity(EN, KM[next()], { length: 'narrow' });
  });
  bench('de kilometer long', () => {
    formatQuantity(DE, KM[next()], { length: 'long' });
  });
  bench('en sequence foot+inch', () => {
    formatQuantitySequence(EN, FEET_INCHES[next()]);
  });
});
