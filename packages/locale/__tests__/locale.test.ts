import {
  languageTag,
  tagCompact,
  tagExpanded,
  tagExtensions,
  tagLanguage,
  tagPrivateUse,
  tagRegion,
  tagScript,
  tagToString,
  tagVariant,
} from '@phensley/language-tag';
import { resolveLocaleId } from '../src';

test('basics', () => {
  const tag = languageTag('en', undefined, 'US');

  expect(tagLanguage(tag)).toEqual('en');
  expect(tagScript(tag)).toEqual('Zzzz');
  expect(tagRegion(tag)).toEqual('US');
  expect(tagVariant(tag)).toEqual('');
  expect(tagExtensions(tag)).toEqual({});
  expect(tagPrivateUse(tag)).toEqual('');

  expect(tagCompact(tag)).toEqual('en-US');
  expect(tagExpanded(tag)).toEqual('en-Zzzz-US');
});

test('canonicalization', () => {
  // NOTE: we may add deeper validation later, but for now
  // only basic subtag canonicalization is done.
  const tag = languageTag('en', 'US');
  expect(tagScript(tag)).toEqual('Us');
});

test('defaults', () => {
  let tag = languageTag();
  expect(tagCompact(tag)).toEqual('und');
  expect(tagCompact(tag)).toEqual(tagToString(tag));
  expect(tagLanguage(tag)).toEqual('und');
  expect(tagScript(tag)).toEqual('Zzzz');
  expect(tagRegion(tag)).toEqual('ZZ');

  tag = languageTag('und', 'Zzzz', 'ZZ');
  expect(tagCompact(tag)).toEqual('und');
  expect(tagCompact(tag)).toEqual(tagToString(tag));
  expect(tagLanguage(tag)).toEqual('und');
  expect(tagScript(tag)).toEqual('Zzzz');
  expect(tagRegion(tag)).toEqual('ZZ');

  tag = languageTag('root', undefined, 'US');
  expect(tagCompact(tag)).toEqual('und-US');
  expect(tagCompact(tag)).toEqual(tagToString(tag));
  expect(tagLanguage(tag)).toEqual('und');
  expect(tagScript(tag)).toEqual('Zzzz');
  expect(tagRegion(tag)).toEqual('US');
});

test('parse locale', () => {
  expect(resolveLocaleId('en')).toEqual({
    id: 'en',
    tag: languageTag('en', 'Latn', 'US'),
  });
  expect(resolveLocaleId('en-Latn-XY')).toEqual({
    id: 'en-Latn-XY',
    tag: languageTag('en', 'Latn', 'XY'),
  });
  expect(resolveLocaleId('fr-CA')).toEqual({
    id: 'fr-CA',
    tag: languageTag('fr', 'Latn', 'CA'),
  });
  expect(resolveLocaleId('iw')).toEqual({
    id: 'iw',
    tag: languageTag('he', 'Hebr', 'IL'),
  });
  expect(resolveLocaleId('und')).toEqual({
    id: 'und',
    tag: languageTag('und', 'Zzzz', 'ZZ'),
  });
});

test('parse extensions', () => {
  expect(resolveLocaleId('en-US-u-nu-thai')).toEqual({
    id: 'en-US-u-nu-thai',
    tag: languageTag('en', 'Latn', 'US', '', { u: ['nu-thai'] }),
  });

  expect(resolveLocaleId('en-US-u-nu-thai-ca-gregory')).toEqual({
    id: 'en-US-u-nu-thai-ca-gregory',
    tag: languageTag('en', 'Latn', 'US', '', { u: ['ca-gregory', 'nu-thai'] }),
  });

  expect(resolveLocaleId('en-US-u-nu-thai-u-foo-u-ca-gregory')).toEqual({
    id: 'en-US-u-nu-thai-u-foo-u-ca-gregory',
    tag: languageTag('en', 'Latn', 'US', '', { u: ['ca-gregory', 'foo', 'nu-thai'] }),
  });
});

test('parse and render', () => {
  let { id, tag } = resolveLocaleId('en-US-u-nu-thai-ca-buddhist-u-co-search');
  expect(id).toEqual('en-US-u-nu-thai-ca-buddhist-u-co-search');
  expect(tagExtensions(tag)).toEqual({ u: ['ca-buddhist', 'co-search', 'nu-thai'] });
  expect(tagExpanded(tag)).toEqual('en-Latn-US-u-ca-buddhist-co-search-nu-thai');

  ({ id, tag } = resolveLocaleId('en-u-bar-nu-hant-co-standard-ca-islamic-umalqura'));
  expect(id).toEqual('en-u-bar-nu-hant-co-standard-ca-islamic-umalqura');
  expect(tagExtensions(tag)).toEqual({
    u: ['bar', 'ca-islamic-umalqura', 'co-standard', 'nu-hant'],
  });
  expect(tagExpanded(tag)).toEqual('en-Latn-US-u-bar-ca-islamic-umalqura-co-standard-nu-hant');
});
