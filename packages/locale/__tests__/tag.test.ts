import { languageTag, parseLanguageTag, tagExpanded } from '@phensley/language-tag';
import { fastTag, returnTag } from '../src/resolver';

test('fast tag merging', () => {
  const f = fastTag(languageTag(undefined, 'Latn', 'US'));

  const tag = parseLanguageTag('und-POSIX-u-ca-calendar');
  const r = returnTag(tag, f);
  expect(tagExpanded(r)).toEqual('und-Latn-US-posix-u-ca-calendar');
});
