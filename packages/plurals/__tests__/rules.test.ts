import { decimal } from '@phensley/decimal';
import { getPluralRules, type PluralRules, pluralCardinal, pluralOrdinal } from '../src';

test('missing rules', () => {
  const rules: PluralRules = getPluralRules('xyz');
  const n = decimal('12345.678');

  let cat = pluralCardinal(rules, n);
  expect(cat).toEqual('other');

  cat = pluralOrdinal(rules, n);
  expect(cat).toEqual('other');
});

test('constructor', () => {
  const rules: PluralRules = getPluralRules('en');

  let cat = pluralCardinal(rules, decimal('1'));
  expect(cat).toEqual('one');

  cat = pluralCardinal(rules, decimal('5'));
  expect(cat).toEqual('other');
});
