import * as core from '../../src';
import { getHourPattern, parseDatePattern } from '../../src/internals/calendars/internal';
import { parseWrapper } from '../../src/internals/general/internal';
import { getNumberPattern } from '../../src/internals/numbers/internal';

// Parsed patterns are cached and shared by every locale and framework, so the functions that
// return them are internal and the results are readonly in the types.

test('cached parsers are not exported', () => {
  const names = [
    'parseDatePattern',
    'getHourPattern',
    'getNumberPattern',
    'parseWrapper',
    'getNumberParams',
    'getContextTransformInfo',
  ];
  for (const name of names) {
    expect(name in core).toBe(false);
  }
});

test('parsed patterns are readonly', () => {
  const date = parseDatePattern('yyyy-MM-dd');
  const hour = getHourPattern('+HH:mm;-HH:mm', true);
  const num = getNumberPattern('#,##0.00', false);
  const wrapper = parseWrapper('{1} at {0}');

  // The checks are the @ts-expect-error lines (the lint step type-checks the tests); they are
  // never executed.
  const mutate = () => {
    // @ts-expect-error -- readonly
    date.splice(0, date.length);
    const field = date[0];
    if (typeof field !== 'string') {
      // @ts-expect-error -- readonly
      field[1] = 2;
    }
    // @ts-expect-error -- readonly
    hour.push('x');
    // @ts-expect-error -- readonly
    num.minInt = 5;
    // @ts-expect-error -- readonly
    num.nodes.push('x');
    // @ts-expect-error -- readonly
    wrapper[0] = 'x';
  };
  expect(typeof mutate).toBe('function');

  expect(date).toEqual([['y', 4], '-', ['M', 2], '-', ['d', 2]]);
  expect(parseDatePattern('yyyy-MM-dd')).toBe(date);
});
