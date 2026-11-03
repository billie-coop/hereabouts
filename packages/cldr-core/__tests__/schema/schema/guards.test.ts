import {
  digitsArrow,
  fieldArrow,
  isDigitsArrow,
  isFieldArrow,
  isScopeArrow,
  isVectorArrow,
  keyIndex,
  scopeArrow,
  vectorArrow,
} from '../../../src';

test('arrow guards', () => {
  const index = keyIndex(['a', 'b']);
  const field = fieldArrow(1);
  const scope = scopeArrow({ x: field });
  const digits = digitsArrow(1, index, [1, 2]);
  const vector = vectorArrow(1, [index, index]);

  expect([
    isFieldArrow(field),
    isScopeArrow(scope),
    isDigitsArrow(digits),
    isVectorArrow(vector),
  ]).toEqual([true, true, true, true]);

  // Each guard accepts only its own kind.
  for (const x of [field, scope, digits, vector]) {
    expect(
      [isFieldArrow(x), isScopeArrow(x), isDigitsArrow(x), isVectorArrow(x)].filter((b) => b)
        .length,
    ).toEqual(1);
  }

  // Objects that only carry the kind tag are not arrows.
  const bad: any[] = [undefined, null, 'field', {}];
  for (const x of bad) {
    expect(isFieldArrow(x) || isScopeArrow(x) || isDigitsArrow(x) || isVectorArrow(x)).toBe(false);
  }
  expect(isFieldArrow({ kind: 'field' })).toBe(false);
  expect(isFieldArrow({ kind: 'field', offset: '1' })).toBe(false);
  expect(isScopeArrow({ kind: 'scope' })).toBe(false);
  expect(isScopeArrow({ kind: 'scope', map: null })).toBe(false);
  expect(isDigitsArrow({ kind: 'digits', offset: 1 })).toBe(false);
  expect(isDigitsArrow({ ...digits, values: undefined })).toBe(false);
  expect(isVectorArrow({ kind: 'vector', offset: 1 })).toBe(false);
  expect(isVectorArrow({ ...vector, keysets: undefined })).toBe(false);

  // Nested key indices must have their fields.
  expect(isDigitsArrow({ kind: 'digits', offset: 0, index: {}, values: [1], size2: 2 })).toBe(
    false,
  );
  expect(
    isVectorArrow({ kind: 'vector', offset: 1, len: 1, last: 0, factors: [1], keysets: [{}] }),
  ).toBe(false);
  expect(isVectorArrow({ ...vector, keysets: [index, { ...index, keys: undefined }] })).toBe(false);
});
