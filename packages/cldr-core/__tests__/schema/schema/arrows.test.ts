import type { PluralType, PrimitiveBundle } from '@phensley/cldr-types';
import {
  digitsArrow,
  digitsGet,
  fieldArrow,
  fieldGet,
  keyIndex,
  PluralIndex,
  scopeArrow,
  scopeGet,
  vectorArrow,
  vectorExists,
  vectorGet,
  vectorMapping,
  vectorValid,
} from '../../../src';

type Foo = 'foo1' | 'foo2';
type Bar = 'bar1' | 'bar2' | 'bar3';

const FOO: Foo[] = ['foo1', 'foo2'];
const BAR: Bar[] = ['bar1', 'bar2', 'bar3'];

const PluralDigitValues = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

// Test bundles as plain string tables. A "dummy" bundle returns each offset as its own value
// (the header at offset 0 marks the vector as present); an "empty" bundle only has the header.
const SIZE = 1000;

const DummyBundle = (exists: boolean, header: boolean = true): PrimitiveBundle => ({
  id: 'und-ZZ',
  language: 'und',
  region: 'ZZ',
  strings: Array.from({ length: SIZE }, (_, offset) =>
    header && offset === 0 ? (exists ? 'E' : '') : exists ? offset.toString() : '',
  ),
  exceptions: [],
});

const EmptyBundle = (): PrimitiveBundle => ({
  id: 'und-ZZ',
  language: 'und',
  region: 'ZZ',
  strings: Array.from({ length: SIZE }, (_, offset) => (offset === 0 ? 'E' : '')),
  exceptions: [],
});

test('field arrow', () => {
  const bundle = DummyBundle(true);

  const a = fieldArrow(1);
  expect(fieldGet(a, bundle)).toEqual('1');

  const b = fieldArrow(123);
  expect(fieldGet(b, bundle)).toEqual('123');
});

test('digits arrow', () => {
  const bundle = DummyBundle(true, false);
  const a = digitsArrow(0, PluralIndex, PluralDigitValues);

  expect(digitsGet(a, bundle, 'other', -1)).toEqual(['', 0]);

  expect(digitsGet(a, bundle, 'other', 1)).toEqual(['0', 1]);
  expect(digitsGet(a, bundle, 'other', 2)).toEqual(['2', 3]);
  expect(digitsGet(a, bundle, 'other', 3)).toEqual(['4', 5]);

  expect(digitsGet(a, bundle, 'other', 15)).toEqual(['28', 29]);
  expect(digitsGet(a, bundle, 'other', 16)).toEqual(['28', 29]);
  expect(digitsGet(a, bundle, 'other', 17)).toEqual(['28', 29]);

  expect(digitsGet(a, bundle, 'zero', 10)).toEqual(['48', 49]);
  expect(digitsGet(a, bundle, 'zero', 11)).toEqual(['50', 51]);
  expect(digitsGet(a, bundle, 'zero', 12)).toEqual(['52', 53]);

  expect(digitsGet(a, bundle, 'zero', 15)).toEqual(['58', 59]);
  expect(digitsGet(a, bundle, 'zero', 16)).toEqual(['58', 59]);
  expect(digitsGet(a, bundle, 'zero', 17)).toEqual(['58', 59]);

  expect(digitsGet(a, bundle, 'foo' as PluralType, 10)).toEqual(['', 0]);
});

type FooScope = {
  [k in Foo]: any;
};

test('scope arrow', () => {
  const map: FooScope = { foo1: { bar: 1 }, foo2: { bar: 2 } };
  const a = scopeArrow(map);
  expect(scopeGet(a, 'foo1')).toEqual({ bar: 1 });
  expect(scopeGet(a, 'foo2')).toEqual({ bar: 2 });
  expect(scopeGet(a, 'bar' as any as Foo)).toBe(undefined);
});

test('1d arrow', () => {
  const bundle = DummyBundle(true);
  const index = keyIndex(FOO);
  const a = vectorArrow(0, [index]);

  expect(vectorGet(a, bundle, 'foo1')).toEqual('1');
  expect(vectorGet(a, bundle, 'foo2')).toEqual('2');
  expect(vectorGet(a, bundle, 'quux' as Foo)).toEqual('');
  expect(vectorMapping(a, bundle)).toEqual({
    foo1: '1',
    foo2: '2',
  });
});

test('1d arrow empty', () => {
  const bundle = EmptyBundle();
  const index = keyIndex(FOO);
  const a = vectorArrow(0, [index]);

  expect(vectorGet(a, bundle, 'foo1')).toEqual('');
  expect(vectorMapping(a, bundle)).toEqual({});
});

test('missing 1d arrow', () => {
  let bundle: PrimitiveBundle;
  const index = keyIndex(FOO);
  const a = vectorArrow(0, [index]);

  bundle = DummyBundle(false);

  expect(vectorExists(a, bundle)).toEqual(false);
  expect(vectorGet(a, bundle, 'foo1')).toEqual('');
  expect(vectorGet(a, bundle, 'foo2')).toEqual('');
  expect(vectorGet(a, bundle, 'quux' as Foo)).toEqual('');
  expect(vectorMapping(a, bundle)).toEqual({});

  bundle = EmptyBundle();
  expect(vectorExists(a, bundle)).toEqual(true);
  expect(vectorGet(a, bundle, 'foo1')).toEqual('');
  expect(vectorGet(a, bundle, 'foo2')).toEqual('');
  expect(vectorGet(a, bundle, 'quux' as Foo)).toEqual('');
  expect(vectorMapping(a, bundle)).toEqual({});
});

test('2d arrow', () => {
  const bundle = DummyBundle(true, true);
  const i1 = keyIndex(FOO);
  const i2 = keyIndex(BAR);
  const a = vectorArrow(0, [i1, i2]);

  expect(vectorExists(a, bundle)).toEqual(true);
  expect(vectorGet(a, bundle, 'foo1', 'bar1')).toEqual('1');
  expect(vectorGet(a, bundle, 'foo1', 'bar2')).toEqual('2');
  expect(vectorGet(a, bundle, 'foo1', 'bar3')).toEqual('3');
  expect(vectorGet(a, bundle, 'foo2', 'bar1')).toEqual('4');
  expect(vectorGet(a, bundle, 'foo2', 'bar2')).toEqual('5');
  expect(vectorGet(a, bundle, 'foo2', 'bar3')).toEqual('6');
  expect(vectorGet(a, bundle, 'foo2', 'quux' as Bar)).toEqual('');
  expect(vectorGet(a, bundle, 'quux' as Foo, 'bar1')).toEqual('');
  expect(vectorGet(a, bundle, 'quux' as Foo, 'quux' as Bar)).toEqual('');
  expect(vectorMapping(a, bundle)).toEqual({
    foo1: { bar1: '1', bar2: '2', bar3: '3' },
    foo2: { bar1: '4', bar2: '5', bar3: '6' },
  });

  // invalid keys
  expect(vectorGet(a, bundle, 'xxxxx', 'yyyyy')).toEqual('');
  expect(vectorGet(a, bundle, 'xxxxx', 'yyyyy')).toEqual('');

  // invalid mixed with valid
  expect(vectorGet(a, bundle, ['xxxxx', 'foo2'], ['yyyyy', 'bar3'])).toEqual('6');
  expect(vectorGet(a, bundle, ['foo2', 'xxxxx'], ['bar3', 'yyyyy'])).toEqual('6');

  // invalid multiple
  expect(vectorGet(a, bundle, ['xxxxx', 'yyyyy'], ['xxxxx', 'yyyyy'])).toEqual('');
  expect(vectorGet(a, bundle, ['xxxxx', 'yyyyy'], ['xxxxx', 'yyyyy'])).toEqual('');

  // number of arguments don't match vector's dimension throws error
  expect(() => vectorGet(a, bundle, 'xxxxx')).toThrowError();
  expect(() => vectorGet(a, bundle, 'xxxxx')).toThrowError();
  expect(() => vectorGet(a, bundle, 'foo1', 'bar1', 'xxxxx')).toThrowError();
  expect(() => vectorGet(a, bundle, 'foo1', 'bar1', 'xxxxx')).toThrowError();
});

test('missing 2d arrow', () => {
  const i1 = keyIndex(FOO);
  const i2 = keyIndex(BAR);
  const a = vectorArrow(0, [i1, i2]);
  let bundle: PrimitiveBundle;

  bundle = DummyBundle(false);
  expect(vectorGet(a, bundle, 'foo1', 'bar1')).toEqual('');
  expect(vectorGet(a, bundle, 'foo1', 'bar2')).toEqual('');
  expect(vectorGet(a, bundle, 'foo1', 'bar3')).toEqual('');
  expect(vectorGet(a, bundle, 'foo2', 'bar1')).toEqual('');
  expect(vectorGet(a, bundle, 'foo2', 'bar2')).toEqual('');
  expect(vectorGet(a, bundle, 'foo2', 'bar3')).toEqual('');
  expect(vectorGet(a, bundle, 'foo2', 'quux' as Bar)).toEqual('');
  expect(vectorGet(a, bundle, 'quux' as Foo, 'bar1')).toEqual('');
  expect(vectorGet(a, bundle, 'quux' as Foo, 'quux' as Bar)).toEqual('');
  expect(vectorMapping(a, bundle)).toEqual({});

  bundle = EmptyBundle();
  expect(vectorExists(a, bundle)).toEqual(true);
  expect(vectorGet(a, bundle, 'foo1', 'bar1')).toEqual('');
  expect(vectorMapping(a, bundle)).toEqual({
    foo1: {},
    foo2: {},
  });
});

test('valid 2d arrow', () => {
  const i1 = keyIndex(FOO);
  const i2 = keyIndex(BAR);
  const a = vectorArrow(0, [i1, i2]);
  expect(vectorValid(a, 'foo1', 'bar1')).toEqual(true);
  expect(vectorValid(a, 'quux' as Foo, 'bar1')).toEqual(false);
  expect(vectorValid(a, 'foo1', 'quux' as Bar)).toEqual(false);
  expect(vectorValid(a, 'quux' as Foo, 'quux' as Bar)).toEqual(false);

  // Fallbacks
  expect(vectorValid(a, ['quux', 'foo1'], ['quux', 'bar1'])).toEqual(true);
  expect(vectorValid(a, ['quux', 'quux'], ['bar1'])).toEqual(false);
  expect(vectorValid(a, ['foo1'], ['quux', 'quux'])).toEqual(false);
  expect(vectorValid(a, ['quux', 'quux'], ['quux', 'quux'])).toEqual(false);
});
