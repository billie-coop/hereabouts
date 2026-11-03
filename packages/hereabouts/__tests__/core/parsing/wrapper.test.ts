import { parseWrapperPattern } from '../../../src/core/parsing/wrapper';

const parse = parseWrapperPattern;

test('basics', () => {
  expect(parse("{1} 'at' {0}")).toEqual([1, ' at ', 0]);
});
