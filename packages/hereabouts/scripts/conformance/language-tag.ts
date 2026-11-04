/**
 * Builds the shared language tag cases in `conformance/language-tag.json`: parsing (case
 * folding, separators, extlangs, region aliases, variants, extensions, private use,
 * grandfathered tags, junk), construction, rendering and region alias substitution.
 *
 * Tags are recorded as plain objects (see `describeTag`): undefined subtags are null and the
 * extensions are `[key, subtags]` pairs sorted by key.
 */

import {
  type FastTag,
  type LanguageTag,
  LanguageTagField,
  languageTag,
  parseLanguageTag,
  substituteRegionAliases,
  tagCompact,
  tagExpanded,
  tagExtensionSubtags,
  tagHasLanguage,
  tagHasRegion,
  tagHasScript,
  tagLanguage,
  tagRegion,
  tagScript,
  tagVariant,
} from '../../src/language-tag';
import { territoryAliasRaw } from '../../src/language-tag/autogen.aliases';
import { grandfatheredRaw } from '../../src/language-tag/autogen.subtags';
import { type ConformanceCase, collector, type Random, random } from './_shared';

/** A tag as plain JSON, with its compact and expanded strings. */
export const describeTag = (t: LanguageTag) => ({
  language: t.language ?? null,
  script: t.script ?? null,
  region: t.region ?? null,
  variant: t.variant ?? null,
  extensions: Object.keys(t.extensions)
    .sort()
    .map((k) => [k, t.extensions[k]]),
  privateUse: t.privateUse,
  extlangs: t.extlangs,
  compact: tagCompact(t),
  expanded: tagExpanded(t),
});

/** Also the accessor results. */
const describeFull = (t: LanguageTag) => ({
  ...describeTag(t),
  get: [tagLanguage(t), tagScript(t), tagRegion(t), tagVariant(t)],
  has: [tagHasLanguage(t), tagHasScript(t), tagHasRegion(t)],
});

const TERRITORY_KEYS = territoryAliasRaw.split('|').map((e) => e.split(':')[0]);
const GRANDFATHERED_KEYS = grandfatheredRaw.split('|').map((e) => e.split(':')[0]);

/** Inputs taken from the unit tests, plus edges of each subtag rule. */
const FIXED_PARSE = [
  // Case folding and separators
  'en',
  'EN',
  'En',
  'en-us',
  'en-US',
  'EN-us',
  'en_us',
  'en_US',
  'en-latn-us',
  'EN-LATN-US',
  'eN-lAtN-uS',
  'en-Latn-US',
  'FR_latn_fr',
  'zh-hant-tw',
  'zh_Hant_TW',
  'sr-cyrl',
  'SR-LATN-rs',
  'en_Latn-US',
  // Undefined values
  'und',
  'UND',
  'Und',
  'root',
  'ROOT',
  'Root',
  'und-zzzz-zz',
  'und-Zzzz-ZZ',
  'und-ZZZZ',
  'und-Zzzz',
  'und-ZZ',
  'en-zz',
  'en-ZZ',
  'en-Zz',
  'en-zzzz',
  'en-Zzzz',
  'root-US',
  'und-US',
  'und-Latn',
  'und-x-foo',
  'und-u-ca-gregory',
  // Grandfathered (mixed case keys never match: the input is lowercased first)
  'I-KLINGON',
  'i_klingon',
  'i-Klingon',
  'en-gb-oed',
  'EN-GB-OED',
  'en-GB-oed',
  'sgn-be-fr',
  'sgn-BE-FR',
  'sgn-ch-de',
  'zh-min',
  'ZH-MIN-NAN',
  'zh_min_nan',
  'cel-gaulish',
  'i-default',
  'i-enochian',
  'i-mingo',
  'art-lojban',
  'no-bok',
  'no-nyn',
  'zh-guoyu',
  'i-Klingon',
  'zh-haKKa',
  'i-klingon-x',
  'i-klingon-u-ca-gregory',
  'i',
  'i-foo',
  // Extlangs
  'zh-yue',
  'zh-YUE',
  'zh-yue-HK',
  'zh-yue-hant-hk',
  'zh-cmn-Hans-CN',
  'en-usa',
  'en-USA',
  'en-aaa',
  'en-AAA',
  'en-eng-eng-AAA',
  'en-zzz',
  'en-ZZZ',
  'en-qzz',
  'en-xzz',
  'ar-aao',
  'ar-aao-eg',
  'en-abc-def-us',
  'en-abc-def-ghi-jkl',
  'en-ext-lan',
  'en-abc-usa',
  'en-usa-gbr',
  'en-usa-US',
  'en-usa-Latn',
  'eng-usa',
  'abcd-usa',
  'arbv-arb',
  'en-arg',
  'en-bra-Latn',
  'en-yug',
  'en-yu',
  // Regions
  'en-001',
  'es-419',
  'en-120',
  'ru-172',
  'en-ARG',
  'de-DD',
  'en-UK',
  'en-999',
  'en-1234',
  'en-12',
  'en-1',
  'en-US-GB',
  // Variants
  'en-VARIANT1-VARIANT2-VARIANT3',
  'de-1996',
  'de-DE-1901',
  'sl-rozaj-biske',
  'sl-ROZAJ-BISKE-1994',
  'en-US-posix',
  'en-US-POSIX',
  'ca-ES-valencia',
  'en-1abc',
  'en-abcd',
  'en-12345678',
  'en-123456789',
  'en-a1234',
  'en-Latn-US-12ab-ab12c',
  'und-POSIX-u-ca-calendar',
  // Extensions
  'en-US-u-cu-usd',
  'fr-u-ca-islamic',
  'fr-u-ca-islamic-u_co_phonebk',
  'fr-u-ca-islamic-ca-gregory',
  'fr-u-xy-foobar',
  'fr-u',
  'fr-u-ca',
  'fr-u-xy',
  'en-U-CA-GREGORY',
  'en-u-CA-gregory',
  'en-u-ca-GREGORY',
  'en-U-ca-gregory-u-nu-latn',
  'en-a-bbb-u-ccc',
  'en-t-en-latn',
  'en-t-en-latn-m0-ungegn',
  'en-u-ca-gregory-t-ja',
  'en-t-ja-u-ca-gregory',
  'en-1-abc',
  'en-0-ab-9-cd',
  'en-u-x-foo',
  'en-u-ab-x-cd',
  'de-u-co-phonebk-ka-shifted',
  'en-GB-u-sd-gbsct',
  'en-u-ca-buddhist-sd-gbsct',
  'en-u-sd-gbsct-ca-buddhist',
  'en-US-u-nu-thai-u-foo-u-ca-gregory',
  'en-US-u-nu-thai-ca-buddhist-u-co-search',
  'en-u-bar-nu-hant-co-standard-ca-islamic-umalqura',
  'en-u-ca-gregory-u-ca-buddhist',
  'en-u-ca-gregory-u-ca-gregory',
  'en-u-ca_gregory',
  'en-z-ab',
  'en-y-ab-z-cd-a-ef',
  'en-u-tz-usnyc-va-posix-cu-eur-nu-arab-co-trad-ca-roc',
  'en-u-ca-a',
  'en-u-ca-abcdefghi',
  'en-u-ca-gregory-abcdefghi-nu-latn',
  'en-u-ca-gregory--nu-latn',
  'en-t-t-u-u',
  'en-u-t-foo',
  'en-u-nu-latn-x-foo-u-ca-gregory',
  'en-u-a1-b2-c3',
  'en-u-1a-ca-ab',
  'x-u-ca-gregory',
  // Private use
  'x-mytag',
  'X-MYTAG',
  'x-foo-x-bar-baz',
  'zh-x-foobar',
  'zh-x-foo-x-bar-baz',
  'x-',
  'x--x--',
  'x',
  'en-x',
  'en-X-Foo',
  'en-x-a',
  'x-a',
  'x-123456789',
  'en-x-a-123456789',
  'en-x-a-123456789-b',
  'x-x-x',
  'en-x-u-ca-gregory',
  'en_x_foo_bar',
  'en-Latn-US-variant-u-ca-gregory-x-private',
  // Junk
  '!+',
  '!+#%!',
  '',
  '-',
  '--',
  '_',
  'en-',
  '-en',
  'en--US',
  'en__US',
  'xxxxxxxxxxx',
  'abcdefgh',
  'abcdefghi',
  'a',
  '12',
  '123-US',
  'é',
  'en-é',
  'en-US-é',
  'ÉN',
  'en-Latn-US-ÿ',
  ' en',
  'en ',
  'enK',
  'en.US',
  'en@calendar=gregorian',
  'en-US-u',
  'en-US-x',
  'en-US-1',
];

const LANGS = ['en', 'EN', 'zh', 'sr', 'und', 'root', 'iw', 'eng', 'cmn', 'abcd', 'x', 'i', 'qaa'];
const EXTLANGS = ['yue', 'usa', 'aaa', 'zzz', 'abc', 'USA', 'arg', 'gbr'];
const SCRIPTS = ['latn', 'Latn', 'LATN', 'Hant', 'cyrl', 'zzzz', 'Zzzz'];
const REGIONS = ['us', 'US', 'gb', '419', '001', 'zz', 'ZZ', 'arg', 'ARG', 'uk', 'su', '172'];
const VARIANTS = ['posix', 'POSIX', '1996', 'valencia', 'rozaj', '1abc', 'abcdefgh'];
const EXT_PREFIXES = ['u', 'U', 't', 'a', '1', 'z', 'x'];
const EXT_SUBTAGS = ['ca', 'gregory', 'nu', 'latn', 'co', 'phonebk', 'cu', 'usd', 'tz', 'va', 'sd'];
const EXT_MORE = ['gbsct', 'xy', 'CA', 'abcdefghi', 'a', 'tz', 'buddhist', 'islamic', 'm0'];
const PRIVATE = ['foo', 'bar', 'x', 'a', '123456789', 'XYZ'];
const JUNK = ['', '!', 'é', 'abcdefghij', '_', '0'];

const randomCase = (r: Random, s: string): string => {
  const x = r.next();
  if (x < 0.6) {
    return s;
  }
  if (x < 0.75) {
    return s.toUpperCase();
  }
  if (x < 0.85) {
    return s.toLowerCase();
  }
  return s
    .split('')
    .map((c) => (r.next() < 0.5 ? c.toUpperCase() : c.toLowerCase()))
    .join('');
};

/** A random tag built from plausible subtags, sometimes with junk or odd separators. */
const randomTag = (r: Random): string => {
  const parts: string[] = [];
  const maybe = (p: number, f: () => void) => {
    if (r.next() < p) {
      f();
    }
  };
  maybe(0.9, () => parts.push(r.pick(LANGS)));
  maybe(0.15, () => {
    const n = r.int(1, 3);
    for (let i = 0; i < n; i++) {
      parts.push(r.pick(EXTLANGS));
    }
  });
  maybe(0.4, () => parts.push(r.pick(SCRIPTS)));
  maybe(0.6, () => parts.push(r.next() < 0.2 ? r.pick(TERRITORY_KEYS) : r.pick(REGIONS)));
  maybe(0.2, () => {
    const n = r.int(1, 2);
    for (let i = 0; i < n; i++) {
      parts.push(r.pick(VARIANTS));
    }
  });
  maybe(0.35, () => {
    const n = r.int(1, 3);
    for (let i = 0; i < n; i++) {
      parts.push(r.pick(EXT_PREFIXES));
      const m = r.int(0, 5);
      for (let j = 0; j < m; j++) {
        parts.push(r.next() < 0.8 ? r.pick(EXT_SUBTAGS) : r.pick(EXT_MORE));
      }
    }
  });
  maybe(0.2, () => {
    parts.push(r.next() < 0.8 ? 'x' : 'X');
    const n = r.int(0, 3);
    for (let i = 0; i < n; i++) {
      parts.push(r.pick(PRIVATE));
    }
  });
  maybe(0.1, () => parts.splice(r.int(0, parts.length), 0, r.pick(JUNK)));
  let s = '';
  parts.forEach((p, i) => {
    if (i > 0) {
      s += r.next() < 0.15 ? '_' : '-';
    }
    s += randomCase(r, p);
  });
  return s;
};

const opt = <T>(r: Random, xs: readonly T[], p = 0.7): T | null =>
  r.next() < p ? r.pick(xs) : null;

/** Arguments for languageTag: subtags (null is undefined), extensions, private use, extlangs. */
const randomFields = (r: Random): unknown[] => {
  let extensions: { [k: string]: string[] } | null = null;
  if (r.next() < 0.5) {
    extensions = {};
    const n = r.int(0, 3);
    for (let i = 0; i < n; i++) {
      const subs: string[] = [];
      const m = r.int(0, 3);
      for (let j = 0; j < m; j++) {
        subs.push(r.pick(['ca-gregory', 'nu-latn', 'foo', 'en-latn', 'b', '']));
      }
      extensions[r.pick(['u', 't', 'U', 'a', '1', '9', 'x', 'ab'])] = subs;
    }
  }
  return [
    opt(r, ['en', 'EN', 'und', 'UND', 'root', '', 'abcdefgh', 'x-y']),
    opt(r, ['latn', 'LATN', 'Latn', 'zzzz', 'Zzzz', 'ZZZZ', '', 'us', 'l']),
    opt(r, ['us', 'US', 'zz', 'ZZ', 'Zz', '', '419', 'gbr']),
    opt(r, ['VARIANT', 'posix', '', 'Valencia']),
    extensions,
    opt(r, ['x-private', 'q', '', 'X-A-b'], 0.4),
    opt(r, [['yue'], ['YUE', 'abc'], []], 0.3),
  ];
};

const callLanguageTag = (args: unknown[]): LanguageTag =>
  (languageTag as (...a: unknown[]) => LanguageTag)(...args);

const fastJson = (f: FastTag) => f.map((v) => (typeof v === 'number' ? null : v));

export const cases = (): ConformanceCase[] => {
  const { cases, add } = collector();
  const parse = (s: string) => add('parseLanguageTag', [s], () => describeTag(parseLanguageTag(s)));

  for (const s of FIXED_PARSE) {
    parse(s);
  }
  for (const k of GRANDFATHERED_KEYS) {
    parse(k);
    parse(k.toUpperCase().replace(/-/g, '_'));
  }
  // Every territory alias as a region, and the 3-letter ones as extlangs.
  for (const k of TERRITORY_KEYS) {
    parse(`und-${k}`);
    if (/^[A-Z]{3}$/.test(k)) {
      parse(`en-${k.toLowerCase()}`);
    }
  }
  const r = random(0x1a6);
  for (let i = 0; i < 2500; i++) {
    parse(randomTag(r));
  }

  // Construction.
  const FIXED_FIELDS: unknown[][] = [
    [],
    ['root'],
    ['', '', '', ''],
    ['', '', '', 'VARIANT'],
    ['en', '', '', '', {}],
    ['en', '', '', '', { u: ['nu-latn'] }],
    ['en', '', '', '', { u: ['nu-latn', 'ca-gregory'] }],
    ['en', '', '', '', null, 'q'],
    ['en', 'Latn', 'US', 'VARIANT', { u: ['nu-latn', 'ca-gregory'] }, 'x-private'],
    ['en', null, 'US'],
    ['en', 'US'],
    ['und', 'Zzzz', 'ZZ'],
    ['root', null, 'US'],
    ['UND', 'zzzz', 'zz'],
    [null, 'latn', 'us', 'PoSiX', { u: ['ca-gregory'] }],
    ['en', null, null, null, { u: [], t: ['en'] }],
    ['en', null, null, null, { z: ['b'], a: ['c'], '1': ['d'], U: ['e'] }],
    ['en', null, null, null, null, '', ['yue']],
  ];
  for (const args of FIXED_FIELDS) {
    add('languageTag', args, () => describeFull(callLanguageTag(args)));
  }
  for (let i = 0; i < 300; i++) {
    const args = randomFields(r);
    add('languageTag', args, () => describeFull(callLanguageTag(args)));
  }

  // Accessors on parsed tags.
  for (const s of ['en-latn-us', 'und', 'x-foo', 'en-u-ca-gregory-t-ja-x-a', 'zh-yue-HK', 'root']) {
    add('describeFull', [s], () => describeFull(parseLanguageTag(s)));
    for (const key of ['u', 't', 'x', 'U', 'ca']) {
      add('tagExtensionSubtags', [s, key], () => tagExtensionSubtags(parseLanguageTag(s), key));
    }
  }

  // Region alias substitution on fast tags (null is undefined).
  const U: FastTag = [LanguageTagField.LANGUAGE, LanguageTagField.SCRIPT, LanguageTagField.REGION];
  const regions = [...TERRITORY_KEYS, 'US', 'ZZ', 'zz', 'ar', 'XYZ'];
  for (const region of [null, ...regions]) {
    const f: FastTag = ['en', LanguageTagField.SCRIPT, region ?? LanguageTagField.REGION];
    const args = [fastJson(f)];
    add('substituteRegionAliases', args, () => {
      substituteRegionAliases(f);
      return fastJson(f);
    });
  }
  add('substituteRegionAliases', [fastJson(U)], () => {
    const f = U.slice(0);
    substituteRegionAliases(f);
    return fastJson(f);
  });
  return cases;
};
