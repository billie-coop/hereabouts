import {
  type LanguageTag,
  languageTag,
  tagCompact,
  tagExpanded,
  tagExtensionSubtags,
  tagExtensions,
  tagHasLanguage,
  tagHasRegion,
  tagHasScript,
  tagLanguage,
  tagPrivateUse,
  tagRegion,
  tagScript,
  tagToString,
  tagVariant,
} from '../../src/language-tag';

test('basics', () => {
  let tag: LanguageTag;

  tag = languageTag();
  expect(tagCompact(tag)).toEqual('und');
  expect(tagExpanded(tag)).toEqual('und-Zzzz-ZZ');

  tag = languageTag('root');
  expect(tagCompact(tag)).toEqual('und');
  expect(tagToString(tag)).toEqual('und');

  tag = languageTag('', '', '', '');
  expect(tagCompact(tag)).toEqual('und');

  tag = languageTag('', '', '', 'VARIANT');
  expect(tagCompact(tag)).toEqual('und-variant');
  expect(tagToString(tag)).toEqual('und-variant');
  expect(tagExpanded(tag)).toEqual('und-Zzzz-ZZ-variant');
  // 2nd call to ensure cached value is returned
  expect(tagExpanded(tag)).toEqual('und-Zzzz-ZZ-variant');

  tag = languageTag('en', '', '', '', {});
  expect(tagCompact(tag)).toEqual('en');

  tag = languageTag('en', '', '', '', { u: ['nu-latn'] });
  expect(tagCompact(tag)).toEqual('en-u-nu-latn');

  tag = languageTag('en', '', '', '', { u: ['nu-latn', 'ca-gregory'] });
  expect(tagCompact(tag)).toEqual('en-u-nu-latn-ca-gregory');

  const unkarray = undefined as unknown as string[];
  tag = languageTag('en', '', '', '', { u: unkarray });
  expect(tagCompact(tag)).toEqual('en');

  // NOTE: constructing language tags directly allows creation
  // of malformed tags. validation and normalization is done in
  // the language tag parser, not the constructor.
  tag = languageTag('en', '', '', '', undefined, 'q');
  expect(tagCompact(tag)).toEqual('en-q');
});

test('properties', () => {
  let tag: LanguageTag;

  tag = languageTag();
  expect(tagLanguage(tag)).toEqual('und');
  expect(tagHasLanguage(tag)).toEqual(false);

  expect(tagScript(tag)).toEqual('Zzzz');
  expect(tagHasScript(tag)).toEqual(false);

  expect(tagRegion(tag)).toEqual('ZZ');
  expect(tagHasRegion(tag)).toEqual(false);

  expect(tagVariant(tag)).toEqual('');
  expect(tagExtensions(tag)).toEqual({});
  expect(tagExtensionSubtags(tag, 'u')).toEqual([]);
  expect(tagPrivateUse(tag)).toEqual('');

  tag = languageTag('en', 'Latn', 'US', 'VARIANT', { u: ['nu-latn', 'ca-gregory'] }, 'x-private');
  expect(tagExpanded(tag)).toEqual('en-Latn-US-variant-u-nu-latn-ca-gregory-x-private');
  expect(tagLanguage(tag)).toEqual('en');
  expect(tagScript(tag)).toEqual('Latn');
  expect(tagRegion(tag)).toEqual('US');
  expect(tagVariant(tag)).toEqual('variant');
  expect(tagExtensionSubtags(tag, 'u')).toEqual(['nu-latn', 'ca-gregory']);
  expect(tagPrivateUse(tag)).toEqual('x-private');
});
