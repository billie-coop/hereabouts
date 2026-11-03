import { getPluralRules, pluralCardinal } from '../../src/plurals';

// getPluralRules returns the shared generated rule tables, so every level is readonly in the
// types. The checks are the @ts-expect-error lines (the lint step type-checks the tests); the
// mutations are never executed.
test('rule records are readonly', () => {
  const rules = getPluralRules('en');
  const mutate = () => {
    // @ts-expect-error -- readonly
    rules.cardinals[0][0] = 5;
    // @ts-expect-error -- readonly
    rules.cardinals[0][1].length = 0;
    // @ts-expect-error -- readonly
    rules.cardinals[0][1][0][0] = 3;
    // @ts-expect-error -- readonly
    rules.ordinals.push([1, []]);
    // @ts-expect-error -- readonly
    rules.cardinals = [];
  };
  expect(typeof mutate).toBe('function');

  // Reading the rules is still fine.
  const rule = rules.cardinals[0];
  expect(rule[0]).toEqual(1);
  expect(rule[1].length).toBeGreaterThan(0);
  expect(pluralCardinal(getPluralRules('en'), 1)).toEqual('one');
});
