import { decimal } from '@phensley/decimal';

import { getNumberParams } from '../../../src/api/private/numbers';
import { getNumberPattern } from '../../../src/internals/numbers/internal';
import { RE_DIGIT, RE_SYMBOL, stringRenderer } from '../../../src/internals/numbers/render';
import type { NumberPattern } from '../../../src/parsing/number';
import { languageBundle } from '../../_helpers';

test('number renderer', () => {
  const en = languageBundle('en');
  const renderer = stringRenderer(getNumberParams(en, 'latn'));
  const raw = '+#0.0#;-#0.0#';
  const pattern = getNumberPattern(raw, false);
  const s = renderer.render(decimal('12345.6789'), pattern, '', '', '.', 1, false);
  expect(s).toEqual('+12345.6789');
});

test('digits', () => {
  const is = (s: string) => RE_DIGIT.test(s);

  expect(is('5')).toEqual(true);
  expect(is('୨')).toEqual(true);
  expect(is('\u0b67')).toEqual(true);
  expect(is('\u1095')).toEqual(true);

  expect(is('$')).toEqual(false);
  expect(is('k')).toEqual(false);
});

test('secondary groupiing', () => {
  const en = languageBundle('en');
  const renderer = stringRenderer(getNumberParams(en, 'latn'));
  let s: string;
  let pattern: NumberPattern;

  pattern = getNumberPattern('#,##,##0', false);
  s = renderer.render(decimal('123456789'), pattern, '', '', '.', 1, true);
  expect(s).toEqual('12,34,56,789');
});

test('symbols', () => {
  const is = (s: string) => RE_SYMBOL.test(s);

  expect(is('$')).toEqual(true);
  expect(is('☀')).toEqual(true);
  expect(is('\u2660')).toEqual(true);
  expect(is('♯')).toEqual(true);
  expect(is('\u266f')).toEqual(true);

  expect(is('9')).toEqual(false);
  expect(is('k')).toEqual(false);
});
