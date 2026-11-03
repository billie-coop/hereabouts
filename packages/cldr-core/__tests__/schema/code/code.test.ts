import { buildOrigin, type Origin, originGetIndex, originGetValues } from '../../../src';

test('code builder', () => {
  let o: Origin;

  o = buildOrigin({
    calendars: ['buddhist', 'japanese', 'persian'],
  });

  for (const cal of ['gregorian', 'buddhist', 'japanese', 'persian']) {
    const key = `${cal}-month`;
    expect(originGetIndex(o, key).size).toBeGreaterThan(0);
    expect(originGetValues(o, key).length).toBeGreaterThan(0);
  }

  expect(originGetIndex(o, 'missing-index').size).toEqual(0);
  expect(originGetValues(o, 'missing-index').length).toEqual(0);
});

test('schema', () => {
  let o: Origin;

  o = buildOrigin({
    'number-system-name': ['latn'],
  });

  expect(originGetIndex(o, 'number-system-name').size).toEqual(1);
  expect(originGetValues(o, 'number-system-name')).toEqual(['latn']);
});
