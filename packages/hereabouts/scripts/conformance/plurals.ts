/**
 * Builds the shared plural rule cases in `conformance/plurals.json`: every sample in
 * `__tests__/plurals/samples.txt`, the rule tables of every language, operands, and random
 * numbers for cardinals, ordinals and ranges. Decimal arguments are strings.
 */
import * as fs from 'fs';
import { join } from 'path';
import { decimal, decimalShiftleft, decimalToString } from '../../src/decimal';
import {
  getPluralRules,
  numberOperands,
  numberOperandsToString,
  pluralCardinal,
  pluralOperands,
  pluralOrdinal,
  pluralRange,
} from '../../src/plurals';
import { pluralRanges } from '../../src/plurals/autogen.ranges';
import { cardinalRules, ordinalRules } from '../../src/plurals/autogen.rules';
import { digitCount } from '../../src/plurals/operands';
import { type ConformanceCase, collector, type Random, random } from './_shared';

const SAMPLES = join(__dirname, '..', '..', '__tests__', 'plurals', 'samples.txt');

/** Language ids with rules, plus some without. */
const LANGUAGES = Array.from(
  new Set([
    ...Object.keys(cardinalRules),
    ...Object.keys(ordinalRules),
    ...Object.keys(pluralRanges),
  ]),
).sort();
const UNKNOWN = ['xyz', 'root', 'und', '', 'EN', 'en-US', 'zz'];

/** Split 'pt-PT' as the samples test does. */
const split = (id: string): [string, string | null] => {
  const [language, region] = id.split('-');
  return [language, region === undefined ? null : region];
};

/** Values from the operand and rule unit tests. */
const OPERANDS: [string, number][] = [
  ['1000000.0', 0],
  ['1', 0],
  ['1.0', 0],
  ['1.00', 0],
  ['1.3', 0],
  ['1.30', 0],
  ['1.03', 0],
  ['1.230', 0],
  ['1200000', 0],
  ['1.2e6', 6],
  ['123e6', 6],
  ['123e5', 5],
  ['1200.50', 0],
  ['1.20050e3', 3],
  ['nan', 0],
  ['infinity', 0],
  ['-infinity', 0],
  ['0', 0],
  ['0.00', 0],
  ['0e3', 0],
  ['-0.0', 0],
  ['1', -5],
  ['1e-3', 0],
  ['1e2', 2],
  ['123.12', 2],
  ['-123.400', 2],
  ['-1234567890.12300', 0],
  ['0.1234567890123456789', 0],
  ['1234567890123456789.12345000', 0],
  ['1234567e5', 0],
  ['9999999e10', 0],
  ['-5.23000', 0],
  ['-510.00120', 0],
  ['10230.122', 0],
  ['10000000000000', 0],
  ['20000000000000', 0],
  ['2123000000000', 0],
  ['20123000000000', 0],
  ['20012300000000', 0],
  ['20001230000000', 0],
  ['20000123000000', 0],
  ['20000012300000', 0],
  ['20000000000001', 0],
  ['20000001230000000', 0],
  ['111222333444555666777888999', 0],
  ['0.111222333444555666777888999', 0],
  ['-99999999999999999999.99999999999999999999', 0],
  ['0.00000000000000100000000000000', 0],
  ['12345.678', 0],
  ['1e30', 3],
];

const randomDecimal = (r: Random): string => {
  const x = r.next();
  if (x < 0.4) {
    return String(r.int(0, 200));
  }
  if (x < 0.55) {
    return `${r.int(0, 30)}.${'0'.repeat(r.int(0, 3))}${r.int(0, 999)}`;
  }
  if (x < 0.65) {
    return `${r.int(0, 9)}.${'0'.repeat(r.int(1, 4))}`;
  }
  if (x < 0.75) {
    return `${r.int(1, 99)}e${r.int(0, 8)}`;
  }
  if (x < 0.85) {
    return `${r.pick(['', '-'])}${r.int(0, 999999999)}${r.int(0, 9999999)}.${r.int(0, 99999999)}`;
  }
  if (x < 0.9) {
    return r.pick(['NaN', 'Infinity', '-Infinity', '0e-5', '-0']);
  }
  return String(r.int(0, 2000000)) + '0'.repeat(r.int(0, 20));
};

export const cases = (): ConformanceCase[] => {
  const { cases: out, add } = collector();

  // The rule tables, through getPluralRules.
  for (const id of [...LANGUAGES, ...UNKNOWN, 'pt-PT', 'kok-Latn']) {
    const [language, region] = split(id);
    add('getPluralRules', [language, region], () => getPluralRules(language, region ?? undefined));
  }
  add('getPluralRules', ['pt', 'BR'], () => getPluralRules('pt', 'BR'));
  add('getPluralRules', ['pt', ''], () => getPluralRules('pt', ''));

  // Every sample in samples.txt. The 'c' syntax (1.1c6) is a compact exponent: shift the
  // number left by it and pass it on.
  for (const line of fs.readFileSync(SAMPLES, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed[0] === '#') {
      continue;
    }
    const [typ, id, _category, samples] = trimmed.split(/\s+/);
    const [language, region] = split(id);
    const rules = getPluralRules(language, region ?? undefined);
    for (const sample of samples.split(',')) {
      const parts = sample.split('c');
      if (typ === 'cardinals') {
        const c = parts.length === 1 ? 0 : parseInt(parts[1], 10);
        const n = decimalToString(decimalShiftleft(decimal(parts[0]), c));
        add('pluralCardinal', [language, region, n, c], () => pluralCardinal(rules, n, c));
      } else {
        add('pluralOrdinal', [language, region, sample], () => pluralOrdinal(rules, sample));
      }
    }
  }

  // Operands
  for (const [n, c] of OPERANDS) {
    add('numberOperands', [n, c], () => ({ ...numberOperands(decimal(n), c) }));
    add('numberOperandsToString', [n, c], () =>
      numberOperandsToString(numberOperands(decimal(n), c)),
    );
    add('pluralOperands', ['en', n], () => ({
      ...pluralOperands(getPluralRules('en'), decimal(n)),
    }));
  }
  for (const w of [
    0, 9, 10, 99, 100, 999, 1000, 9999, 10000, 99999, 100000, 999999, 1000000, 9999999, 10000000,
    99999999,
  ]) {
    add('digitCount', [w], () => digitCount(w));
  }

  // Fixed cases from the unit tests.
  const fixed: [string, string, number][] = [
    ['en', '0', 0],
    ['en', '1', 0],
    ['en', '1.0', 0],
    ['fr', '1.7', 0],
    ['fr', '1000000', 0],
    ['fr', '100000', 5],
    ['fr', '1000000', 6],
    ['fr', '30000001', 6],
    ['lt', '0.1', 0],
    ['lt', '20.1', 0],
    ['lt', '21.0', 0],
    ['xyz', '12345.678', 0],
    ['en', 'NaN', 0],
    ['ar', '-3', 0],
  ];
  for (const [language, n, c] of fixed) {
    add('pluralCardinal', [language, null, n, c], () =>
      pluralCardinal(getPluralRules(language), n, c),
    );
  }
  add('pluralOrdinal', ['xyz', null, '12345.678'], () =>
    pluralOrdinal(getPluralRules('xyz'), '12345.678'),
  );
  for (const [s, e] of [
    [1, 5],
    [0, 1],
    [3, 17],
    [1, 3],
    [3, 8],
    [2, 7],
    [12, 1],
    [10, 4],
  ]) {
    for (const language of ['en', 'ga', 'xyz']) {
      add('pluralRange', [language, null, String(s), String(e)], () =>
        pluralRange(getPluralRules(language), s, e),
      );
    }
  }

  // Random numbers in every language.
  const r = random(0x91a7);
  const ids = [...LANGUAGES, 'pt-PT', 'xyz'];
  for (let i = 0; i < 4000; i++) {
    const [language, region] = split(r.pick(ids));
    const rules = getPluralRules(language, region ?? undefined);
    const n = randomDecimal(r);
    const x = r.next();
    if (x < 0.45) {
      const c = r.next() < 0.8 ? 0 : r.int(-1, 9);
      add('pluralCardinal', [language, region, n, c], () => pluralCardinal(rules, n, c));
    } else if (x < 0.7) {
      add('pluralOrdinal', [language, region, n], () => pluralOrdinal(rules, n));
    } else if (x < 0.9) {
      const e = randomDecimal(r);
      add('pluralRange', [language, region, n, e], () => pluralRange(rules, n, e));
    } else {
      const c = r.int(0, 3);
      add('numberOperands', [n, c], () => ({ ...numberOperands(decimal(n), c) }));
    }
  }

  return out;
};
