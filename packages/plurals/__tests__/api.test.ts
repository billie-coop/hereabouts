import { decimal } from '@phensley/decimal';
import { getPluralRules, type PluralRules, pluralCardinal, pluralOperands } from '../src';

test('basic', () => {
  const lang = 'en';
  const rules: PluralRules = getPluralRules(lang);

  expect(pluralOperands(rules, decimal('123'))).toEqual({
    f: 0,
    i: 123,
    n: 123,
    t: 0,
    v: 0,
    w: 0,
    c: 0,
  });

  expect(pluralCardinal(rules, 0)).toEqual('other');
  expect(pluralCardinal(rules, '0')).toEqual('other');
  expect(pluralCardinal(rules, decimal(0))).toEqual('other');

  expect(pluralCardinal(rules, 1)).toEqual('one');
  expect(pluralCardinal(rules, '1')).toEqual('one');
  expect(pluralCardinal(rules, decimal(1))).toEqual('one');
});
