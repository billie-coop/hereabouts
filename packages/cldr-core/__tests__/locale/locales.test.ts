import { resolveLanguageTag } from '@phensley/locale';
import { availableLocales, type LanguageTag, type Locale } from '../../src';

test('available locales', () => {
  let locales = availableLocales();
  let tag: LanguageTag;

  for (const id of ['en', 'zh', 'ko', 'fr', 'ar', 'en-GB', 'de', 'es-419']) {
    tag = resolveLanguageTag(id);
    const locale: Locale = { id, tag };
    expect(locales).toContainEqual(locale);
  }

  // fetch again for coverage
  locales = availableLocales();
  tag = resolveLanguageTag('gu');
  expect(locales).toContainEqual({ id: 'gu', tag });
});
