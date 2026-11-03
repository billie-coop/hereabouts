import { bench, describe } from 'vitest';
import { getPluralRules, pluralCardinal, pluralOrdinal } from '../../src/plurals';

const N = 1024;
const INTS = Array.from({ length: N }, (_, i) => i * 7);
const STRINGS = Array.from({ length: N }, (_, i) => `${i}.${i % 100}`);

let i = 0;
const next = () => i++ & (N - 1);

describe('plurals', () => {
  for (const lang of ['en', 'fr', 'ru', 'ar']) {
    const rules = getPluralRules(lang);
    bench(`cardinal ${lang} integer`, () => {
      pluralCardinal(rules, INTS[next()]);
    });
    bench(`cardinal ${lang} decimal string`, () => {
      pluralCardinal(rules, STRINGS[next()]);
    });
  }
  const en = getPluralRules('en');
  bench('ordinal en', () => {
    pluralOrdinal(en, INTS[next()]);
  });
  bench('getPluralRules en-US', () => {
    getPluralRules('en', 'US');
  });
});
