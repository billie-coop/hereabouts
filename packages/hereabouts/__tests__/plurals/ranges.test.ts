import { getPluralRules, pluralRange } from '../../src/plurals';

test('english ranges', () => {
  const rules = getPluralRules('en');
  let cat = pluralRange(rules, 1, 5);
  expect(cat).toEqual('other');

  cat = pluralRange(rules, 0, 1);
  expect(cat).toEqual('other');

  cat = pluralRange(rules, 3, 17);
  expect(cat).toEqual('other');
});

test('irish ranges', () => {
  const rules = getPluralRules('ga');

  // other -> one = one
  let cat = pluralRange(rules, 0, 1);
  expect(cat).toEqual('one');

  // one -> few = few
  cat = pluralRange(rules, 1, 3);
  expect(cat).toEqual('few');

  // few -> many = many
  cat = pluralRange(rules, 3, 8);
  expect(cat).toEqual('many');

  // two -> many = many
  cat = pluralRange(rules, 2, 7);
  expect(cat).toEqual('many');

  // other -> one = one
  cat = pluralRange(rules, 12, 1);
  expect(cat).toEqual('one');

  // many -> few = other
  cat = pluralRange(rules, 10, 4);
  expect(cat).toEqual('other');
});

test('coverage', () => {
  const rules = getPluralRules('ga');
  for (let i = 0; i < 100; i++) {
    for (let j = 0; j < 100; j++) {
      const cat = pluralRange(rules, i, j);
      expect(cat).toBeDefined();
    }
  }
});
