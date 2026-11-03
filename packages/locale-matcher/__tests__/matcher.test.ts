import {
  languageTag,
  parseLanguageTag,
  tagExpanded,
  tagExtensions,
  tagRegion,
} from '@phensley/language-tag';
import {
  createLocaleMatcher,
  type LanguageTag,
  type Locale,
  type LocaleMatch,
  type LocaleMatcher,
  matchLocale,
} from '../src';
import { parse, sortEntries } from '../src/matcher';
import { loadMatchCases } from './util';

test('basics', () => {
  const matcher = createLocaleMatcher('en, en_GB, zh, pt_AR, es-419');
  let m: LocaleMatch;

  m = matchLocale(matcher, 'en-AU');
  expect(m.distance).toEqual(3);
  expect(m.locale.id).toEqual('en_GB');

  // Unknown languages match default supported locale with max. distance
  m = matchLocale(matcher, ['xx', 'yy']);
  expect(m.distance).toEqual(100);
  expect(m.locale.id).toEqual('en');

  // Distance 100 indicates none of the desired locales match (since the
  // argument is empty) and default supported locale was returned
  m = matchLocale(matcher, []);
  expect(m.distance).toEqual(100);
  expect(m.locale.id).toEqual('en');
});

test('entry sort', () => {
  const entries = parse('en en-GB fr-FR');
  const en = entries[0];
  const enGB = entries[1];
  const frFR = entries[2];

  const f = sortEntries(en);

  // 'en' is default, should always be first
  expect(f(en, enGB)).toEqual(-1);
  expect(f(enGB, en)).toEqual(1);

  // 'en-GB' is a paradigm locale, should always be first
  expect(f(enGB, frFR)).toEqual(-1);
  expect(f(frFR, enGB)).toEqual(1);
});

test('threshold', () => {
  const matcher = createLocaleMatcher('en, en_GB, zh, pt_AR, es-419');
  let m: LocaleMatch;

  m = matchLocale(matcher, 'en-AU', 10);
  expect(m.distance).toEqual(3);
  expect(m.locale.id).toEqual('en_GB');

  // Distance 100 indicates match wasn't within threshold and default
  // supported locale was returned
  m = matchLocale(matcher, 'en-AU', 1);
  expect(m.distance).toEqual(100);
  expect(m.locale.id).toEqual('en');
});

test('no resolve', () => {
  let matcher = createLocaleMatcher('en en_GB', { resolve: false });
  let m: LocaleMatch;

  // Missing subtags cause matcher to fail
  m = matchLocale(matcher, 'en-AU');
  expect(m.distance).toEqual(100);
  expect(m.locale.id).toEqual('en');

  // Supported locales have all relevant subtags so matcher has enough
  // information for proper distance computation
  matcher = createLocaleMatcher('en-Latn-US en-Latn-GB', { resolve: false });
  m = matchLocale(matcher, 'en-AU');
  expect(m.distance).toEqual(3);
  expect(m.locale.id).toEqual('en-Latn-GB');

  // A Locale instance can be passed in to ensure the locale's id matches the
  // exact input tag form, assuming the language tags have all relevant
  const supported: Locale[] = [
    { id: 'en', tag: languageTag('en', 'Latn', 'US') },
    { id: 'en_GB', tag: languageTag('en', 'Latn', 'GB') },
  ];
  matcher = createLocaleMatcher(supported, { resolve: false });
  m = matchLocale(matcher, 'en-AU');
  expect(m.distance).toEqual(3);
  expect(m.locale.id).toEqual('en_GB');
});

test('bad args', () => {
  expect(() => createLocaleMatcher(undefined as unknown as string)).toThrowError('at least');
});

test('constructor args', () => {
  let matcher: LocaleMatcher;
  let m: LocaleMatch;

  matcher = createLocaleMatcher('en \t en_GB \n , zh');
  m = matchLocale(matcher, 'en-AU');
  expect(m.distance).toEqual(3);
  expect(m.locale.id).toEqual('en_GB');

  matcher = createLocaleMatcher([' en, pt_AR ', '\t en_GB']);
  m = matchLocale(matcher, 'en-AU');
  expect(m.distance).toEqual(3);
  expect(m.locale.id).toEqual('en_GB');

  m = matchLocale(matcher, 'pt');
  expect(m.distance).toEqual(4);

  // Parsing will correct the subtag separator
  matcher = createLocaleMatcher([parseLanguageTag('en_GB'), parseLanguageTag('pt_AR')]);
  m = matchLocale(matcher, 'en-AU');
  expect(m.distance).toEqual(3);
  expect(m.locale.id).toEqual('en-GB');

  // Only substitute aliases
  matcher = createLocaleMatcher([parseLanguageTag('eng-Latn-US'), parseLanguageTag('eng-Latn-GB')]);
  m = matchLocale(matcher, 'en-AU');
  expect(m.distance).toEqual(3);
  expect(m.locale.id).toEqual('eng-Latn-GB');

  // Invalid args
  matcher = createLocaleMatcher(['en', new Date() as unknown as LanguageTag]);
  m = matchLocale(matcher, 'de');
  expect(m.distance).toEqual(100);
  expect(m.locale.id).toEqual('en');

  // Aliases will be substituted automatically
  matcher = createLocaleMatcher([{ id: 'en', tag: parseLanguageTag('eng-Latn-US') }]);
  m = matchLocale(matcher, 'en');
  expect(tagExpanded(m.locale.tag)).toEqual('en-Latn-US');

  // Disable alias substitution
  matcher = createLocaleMatcher([{ id: 'en', tag: parseLanguageTag('eng-Latn-US') }], {
    resolve: false,
  });
  m = matchLocale(matcher, 'en');
  expect(tagExpanded(m.locale.tag)).toEqual('eng-Latn-US');
});

test('extensions', () => {
  const m = createLocaleMatcher('en, fr, fa, es');
  const r = matchLocale(m, 'en-AU-u-ca-persian');
  expect(r.distance).toEqual(5);
  const { id, tag } = r.locale;
  expect(id).toEqual('en');
  expect(tagRegion(tag)).toEqual('US');
  expect(tagExtensions(tag)).toEqual({ u: ['ca-persian'] });
});

loadMatchCases().forEach((c) => {
  test(c.testname, () => {
    const m = createLocaleMatcher(c.supported);
    const result = matchLocale(m, c.desired);
    expect(result.locale.id).toEqual(c.result);
  });
});

/**

TODO: these additional test cases come from ICU which implements additional
matching logic not described in the TR35 specification:
https://www.unicode.org/reports/tr35/tr35-63/tr35.html#EnhancedLanguageMatching
https://github.com/unicode-org/icu/blob/main/icu4j/main/classes/core/src/com/ibm/icu/util/LocaleMatcher.java

Uncomment when matching logic is modified so that these all pass.

loadMatchCasesNew().forEach((c) => {
  test(c.testname, () => {
    if (c.favor != 'normal' || c.threshold != '') {
      // TODO: we do not yet support the "favoring subtags" scheme in
      // locale matching, which adjusts the distance based on which subtag
      // we prefer. This is implemented informally in ICU but not formally
      // described in the CLDR specification. We skip these tests for now.

      // TODO: allow for overriding threshold
      return;
    }

    const m = new LocaleMatcher(c.supported);
    const result = m.match(c.desired);
    expect(result.locale.id).toEqual(c.result);
  });
});
*/
