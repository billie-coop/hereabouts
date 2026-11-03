import { bench, describe } from 'vitest';
import { formatCurrency, formatCurrencyToParts, formatDecimal, formatDecimalToParts } from '../src';
import { counter, locale, N } from './_locale';

const EN = locale('en');
const DE = locale('de');

const STRINGS = Array.from({ length: N }, (_, i) => `${i * 137}.25`);
const NUMBERS = Array.from({ length: N }, (_, i) => i * 1371.5);
const AMOUNTS = Array.from({ length: N }, (_, i) => i * 3.1);
const next = counter();

describe('formatDecimal', () => {
  bench('en default (string input)', () => {
    formatDecimal(EN, STRINGS[next()]);
  });
  bench('en maximumFractionDigits 1', () => {
    formatDecimal(EN, STRINGS[next()], { maximumFractionDigits: 1 });
  });
  bench('en number input', () => {
    formatDecimal(EN, NUMBERS[next()]);
  });
  bench('en style short', () => {
    formatDecimal(EN, NUMBERS[next()], { style: 'short' });
  });
  bench('en style long', () => {
    formatDecimal(EN, NUMBERS[next()], { style: 'long' });
  });
  bench('en style percent', () => {
    formatDecimal(EN, STRINGS[next()], { style: 'percent' });
  });
  bench('de default', () => {
    formatDecimal(DE, STRINGS[next()]);
  });
  bench('en toParts', () => {
    formatDecimalToParts(EN, STRINGS[next()]);
  });
});

describe('formatCurrency', () => {
  bench('en EUR', () => {
    formatCurrency(EN, AMOUNTS[next()], 'EUR');
  });
  bench('en USD accounting', () => {
    formatCurrency(EN, -AMOUNTS[next()], 'USD', { style: 'accounting' });
  });
  bench('en USD code', () => {
    formatCurrency(EN, AMOUNTS[next()], 'USD', { style: 'code' });
  });
  bench('en USD name', () => {
    formatCurrency(EN, AMOUNTS[next()], 'USD', { style: 'name' });
  });
  bench('en USD short (compact)', () => {
    formatCurrency(EN, NUMBERS[next()], 'USD', { style: 'short' });
  });
  bench('de EUR', () => {
    formatCurrency(DE, AMOUNTS[next()], 'EUR');
  });
  bench('en EUR toParts', () => {
    formatCurrencyToParts(EN, AMOUNTS[next()], 'EUR');
  });
});
