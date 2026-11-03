/**
 * Benchmarks of the built CommonJS output (`dist/cjs/`), as a Node server that `require`s the
 * package runs it. The other bench suites run the TypeScript sources through Vite as ES
 * modules, so they don't see costs specific to TypeScript's CommonJS output (e.g. names
 * re-exported through `export *` barrels are read through getter functions).
 *
 * Requires `yarn build` first. The module is loaded with Node's own `require`, so Vite
 * does not transform it.
 */
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { join } from 'path';
import { bench, describe } from 'vitest';

import type * as CLDR from '../../src';

const LIB = join(__dirname, '..', '..', 'dist', 'cjs', 'index.js');
const c: typeof CLDR = createRequire(__filename)(LIB);

const loader = (id: string): string =>
  readFileSync(join(__dirname, '..', '..', 'packs', `${id}.json`), 'utf-8');
const EN = c.loadLocale(c.createFramework({ loader }), 'en');

const N = 1024;
const NY = 'America/New_York';
const EPOCHS = Array.from({ length: N }, (_, i) => 1.7e12 + i * 3.6e6 * 31);
const DATES = EPOCHS.map((e) => c.gregorianDateFromUnixEpoch(e, NY, 1, 1));
const STRINGS = Array.from({ length: N }, (_, i) => `${i * 137}.25`);
const AMOUNTS = Array.from({ length: N }, (_, i) => i * 3.1);
let i = 0;
const next = () => i++ & (N - 1);

describe('CommonJS dist/cjs/', () => {
  bench('decimalAdd', () => {
    const k = next();
    c.decimalAdd(STRINGS[k], AMOUNTS[k]);
  });
  bench('formatDecimal', () => {
    c.formatDecimal(EN, STRINGS[next()], { maximumFractionDigits: 1 });
  });
  bench('formatDecimal short', () => {
    c.formatDecimal(EN, AMOUNTS[next()] * 1000, { style: 'short' });
  });
  bench('formatCurrency EUR', () => {
    c.formatCurrency(EN, AMOUNTS[next()], 'EUR');
  });
  bench('date from epoch', () => {
    c.gregorianDateFromUnixEpoch(EPOCHS[next()], NY, 1, 1);
  });
  bench('dateAdd day+hour', () => {
    c.dateAdd(DATES[next()], { day: 3, hour: 5 });
  });
  bench('formatDate prebuilt, date short', () => {
    c.formatDate(EN, DATES[next()], { date: 'short' });
  });
  bench('formatDate prebuilt, datetime long', () => {
    c.formatDate(EN, DATES[next()], { datetime: 'long' });
  });
  bench('formatDate {date,zoneId}, datetime long', () => {
    c.formatDate(EN, { date: EPOCHS[next()], zoneId: NY }, { datetime: 'long' });
  });
  bench('formatQuantity', () => {
    c.formatQuantity(EN, { value: STRINGS[next()], unit: 'kilometer' }, { length: 'long' });
  });
});
