import { parseLanguageTag, tagCompact, tagExpanded } from '@phensley/language-tag';
import { bindGeneral, resolveLocale } from '../../../src';
import { generalApi } from '../../_helpers';

// Exercises the convenience layer's bundle() / locale() accessors.
const api = (tag: string) => bindGeneral(generalApi(tag));

test('locales', () => {
  expect(api('en').bundle().id).toEqual('en-Latn-US');
  expect(api('en_US').bundle().id).toEqual('en-Latn-US');
  expect(api('zh_Hans').bundle().id).toEqual('zh-Hans-CN');

  expect(api('en').locale().id).toEqual('en');
  expect(api('en_US').locale().id).toEqual('en_US');
  expect(api('zh_Hans').locale().id).toEqual('zh_Hans');

  let locale = resolveLocale('und-Latn');
  expect(locale.id).toEqual('und-Latn');
  expect(tagCompact(locale.tag)).toEqual('en-Latn-US');

  const { tag } = locale;
  locale = resolveLocale(tag);
  expect(locale.id).toEqual('en-Latn-US');
  expect(tagCompact(locale.tag)).toEqual('en-Latn-US');
});

test('language tags', () => {
  expect(tagExpanded(parseLanguageTag('en'))).toEqual('en-Zzzz-ZZ');
});
