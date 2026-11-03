import { languageTag, parseLanguageTag, tagExpanded } from '../../src/language-tag';
import { fastTag, returnTag } from '../../src/locale/resolver';

test('fast tag merging', () => {
  const f = fastTag(languageTag(undefined, 'Latn', 'US'));

  const tag = parseLanguageTag('und-POSIX-u-ca-calendar');
  const r = returnTag(tag, f);
  expect(tagExpanded(r)).toEqual('und-Latn-US-posix-u-ca-calendar');
});
