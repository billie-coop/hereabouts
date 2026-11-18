/**
 * Builds the shared locale cases in `conformance/locale.json`: alias substitution, likely
 * subtags (every key of the likely subtags table, every language and territory alias),
 * locale ids and emoji flags.
 *
 * A tag argument is a string, or `{ tag: [...] }` with the arguments of `languageTag`. A tag
 * result is either the full plain object of `describeTag` or, for the bulk cases, the pair
 * `[compact, expanded]`.
 */
import {
  type LanguageTag,
  languageTag,
  parseLanguageTag,
  tagCompact,
  tagExpanded,
} from '../../src/language-tag';
import { territoryAliasRaw } from '../../src/language-tag/autogen.aliases';
import {
  addLikelySubtags,
  flagRegion,
  localeFlag,
  regionFlag,
  removeLikelySubtags,
  resolveLanguageTag,
  resolveLocaleId,
  subdivisionFlag,
  substituteAliases,
} from '../../src/locale';
import { languageAliasRaw } from '../../src/locale/autogen.aliases';
import { likelySubtags } from '../../src/locale/autogen.subtags';
import { fastTag, returnTag } from '../../src/locale/resolver';
import { type ConformanceCase, collector, type Random, random } from './_shared';
import { describeTag } from './language-tag';

type TagArg = string | { tag: unknown[] };

const toTag = (a: TagArg): string | LanguageTag =>
  typeof a === 'string' ? a : (languageTag as (...x: unknown[]) => LanguageTag)(...a.tag);

const short = (t: LanguageTag) => [tagCompact(t), tagExpanded(t)];

const RESOLVERS: [string, (t: string | LanguageTag) => LanguageTag][] = [
  ['resolveLanguageTag', resolveLanguageTag],
  ['substituteAliases', substituteAliases],
  ['addLikelySubtags', addLikelySubtags],
  ['removeLikelySubtags', removeLikelySubtags],
];

/** Inputs from the unit tests, plus aliases, undefined values and extensions. */
const FIXED: TagArg[] = [
  'iw',
  'afr',
  'tah',
  'en-120',
  'ru-172',
  'en-AAA',
  'en-eng-eng-AAA',
  'en-aaa',
  'he',
  'zh-Hanb',
  'en',
  'en-GB',
  'und-US',
  'xx',
  'be',
  'be-BY',
  'und-BY',
  'en-u-cu-usd',
  'fr-FR',
  'en-Latn-US',
  'zh-Hant-CN',
  'zh-Hans-CN',
  'zh-Hant-TW',
  'sr',
  'sr-Cyrl',
  'sr-Cyrl-RS',
  'sr-Cyrl-BA',
  'sr-Latn-BA',
  'sr-Latn-RS',
  'be-Cyrl-BY',
  'en-US-u-cu-usd',
  'eng-Latn-US',
  'cmn',
  'cmn-Hans',
  'cmn-Hant-TW',
  'cmn-TW',
  'aam',
  'sgn-US',
  'sgn-BR',
  'sgn-Latn-BR',
  'sgn',
  'und',
  'UND',
  'root',
  'und-Zzzz-ZZ',
  'und-zzzz-zz',
  'und-Hant',
  'und-Latn',
  'und-419',
  'und-001',
  'und-150',
  'und-Latn-419',
  'und-Arab',
  'und-Cyrl-RU',
  'und-ZZ',
  'en-ZZ',
  'en-zz',
  'en-Zzzz',
  'en-zzzz',
  'zh-yue',
  'zh-YUE',
  'zh-yue-HK',
  'zh-cmn-Hans-CN',
  'ar-aao',
  'en-usa',
  'en-zzz',
  'en-UK',
  'en-SU',
  'de-DD',
  'sh',
  'sh-BA',
  'no',
  'no-bok',
  'i-klingon',
  'zh-min-nan',
  'en-US-posix',
  'und-POSIX-u-ca-calendar',
  'en-x-foo',
  'x-foo',
  'en-US-u-nu-thai-ca-buddhist-u-co-search',
  'ja-JP-u-ca-japanese-x-bar',
  'tlh',
  'qaa',
  'zz',
  'abcdefgh',
  '',
  '!!',
  'en-Latn-XY',
  'fr-CA',
  { tag: ['en', null, null, null, null, null, ['yue']] },
  { tag: ['zh', null, null, null, null, null, ['YUE']] },
  { tag: ['zh', null, 'HK', null, null, null, ['cmn', 'yue']] },
  { tag: [null, null, null, null, null, null, ['iw']] },
  { tag: ['en', null, null, null, null, null, ['']] },
  { tag: ['UND'] },
  { tag: [null, 'ZZZZ', 'zz'] },
  { tag: [null, 'Latn', 'US'] },
  { tag: ['en', 'latn', 'us', 'POSIX', { u: ['ca-gregory'], t: ['ja'] }, 'x-foo'] },
  { tag: ['iw', null, 'ARG', null, { U: ['a'] }, 'q'] },
  { tag: ['', '', '', ''] },
];

const SCRIPTS = ['Latn', 'Cyrl', 'Arab', 'Hant', 'Hans', 'Deva', 'Zzzz', 'Jpan', 'Ethi', 'Grek'];
const REGIONS = ['US', 'GB', 'CN', 'TW', 'RU', 'IN', '419', '001', 'ZZ', 'BA', 'RS', 'UK', 'SU'];

/** A random tag mixing languages, scripts and regions found in the tables. */
const randomTag = (r: Random, langs: string[], regions: string[]): string => {
  const parts = [r.next() < 0.9 ? r.pick(langs) : 'und'];
  if (r.next() < 0.4) {
    parts.push(r.pick(SCRIPTS));
  }
  if (r.next() < 0.5) {
    parts.push(r.next() < 0.5 ? r.pick(REGIONS) : r.pick(regions));
  }
  if (r.next() < 0.1) {
    parts.push('u', r.pick(['ca', 'nu', 'sd']), r.pick(['gregory', 'latn', 'gbsct']));
  }
  return parts.join('-');
};

export const cases = (): ConformanceCase[] => {
  const { cases, add } = collector();

  for (const a of FIXED) {
    for (const [name, f] of RESOLVERS) {
      add(name, [a], () => describeTag(f(toTag(a))));
    }
    if (typeof a === 'string') {
      add('resolveLocaleId', [a], () => {
        const l = resolveLocaleId(a);
        return { id: l.id, tag: describeTag(l.tag) };
      });
    }
    add('localeFlag', [a], () => localeFlag(toTag(a)));
  }

  // Every key of the likely subtags table.
  const likelyKeys: string[] = [];
  for (const l of Object.keys(likelySubtags)) {
    if (l === '_') {
      continue;
    }
    for (const s of Object.keys(likelySubtags[l])) {
      for (const g of Object.keys(likelySubtags[l][s])) {
        const lang = l === '0' ? 'und' : l;
        likelyKeys.push([lang, s === '1' ? '' : s, g === '2' ? '' : g].filter((x) => x).join('-'));
      }
    }
  }
  for (const k of likelyKeys) {
    add('resolveLanguageTag', [k], () => short(resolveLanguageTag(k)));
    add('removeLikelySubtags', [k], () => short(removeLikelySubtags(k)));
    add('localeFlag', [k], () => localeFlag(k));
  }

  // Every language alias, alone and with a region, and every territory alias.
  const aliasKeys = languageAliasRaw.split('|').map((e) => e.split(':')[0].replace('--', '-'));
  for (const k of aliasKeys) {
    add('resolveLanguageTag', [k], () => short(resolveLanguageTag(k)));
    add('substituteAliases', [`${k}-BR`], () => short(substituteAliases(`${k}-BR`)));
  }
  const territoryKeys = territoryAliasRaw.split('|').map((e) => e.split(':')[0]);
  for (const k of territoryKeys) {
    add('resolveLanguageTag', [`und-${k}`], () => short(resolveLanguageTag(`und-${k}`)));
    add('substituteAliases', [`en-${k}`], () => short(substituteAliases(`en-${k}`)));
  }

  // Random mixes.
  const langs = Object.keys(likelySubtags).filter((l) => l !== '_' && l !== '0');
  const r = random(0x10ca1e);
  for (let i = 0; i < 700; i++) {
    const t = randomTag(r, langs, territoryKeys);
    const [name, f] = r.pick(RESOLVERS);
    add(name, [t], () => short(f(t)));
    if (i % 4 === 0) {
      add('resolveLocaleId', [t], () => {
        const l = resolveLocaleId(t);
        return { id: l.id, tag: short(l.tag) };
      });
    }
  }

  // Locale flags.
  for (const s of [
    'en-SC',
    'zh-Hant-TW',
    'en',
    'ja',
    'zh-Hant',
    'ca',
    'en-UK',
    'en-GB-u-sd-gbsct',
    'cy-GB-u-sd-gbwls-ca-gregory',
    'en-u-ca-gregory-sd-gbsct',
    'en-US-u-sd-usca',
    'en-u-sd-gbeng',
    'en-u-sd-gbsct-foo',
    'en-U-sd-gbsct',
    'en-u-SD-gbsct',
    'en-u-sd-GBSCT',
    'de-AT',
    'es-419',
    'ar-001',
    'eo',
    'und',
    'x-foo',
    'en-EU',
    'en-QO',
    'en-AQ',
  ]) {
    add('localeFlag', [s], () => localeFlag(s));
  }

  // Region flags: every A-Z pair, lowercase and mixed, and characters that uppercase to ASCII.
  const flags: string[] = [];
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b);
      add('regionFlag', [code], () => regionFlag(code) ?? null);
      flags.push(String.fromCodePoint(0x1f1e6 + a - 65, 0x1f1e6 + b - 65));
    }
  }
  for (const s of [
    'fr',
    'Fr',
    'us',
    'gb',
    'uk',
    '419',
    '001',
    'ZZ',
    'QO',
    'EZ',
    'A',
    'USA',
    '',
    '🇫🇷',
    'ß',
    'ı' + 't',
    'ſe',
    'ıſ',
    'ﬀ',
    'ﬁ',
    'ﬂ',
    'ﬃ',
    'ﬅ',
    'ﬆ',
    'ﬁ' + 'x',
    'ŉ',
    'K' + 'e',
    'é' + 's',
    'a ',
    ' a',
    '  ',
    'D ',
  ]) {
    add('regionFlag', [s], () => regionFlag(s) ?? null);
  }

  // Flags back to regions.
  for (const f of flags) {
    add('flagRegion', [f], () => flagRegion(f) ?? null);
  }
  for (const s of ['🇨🇦 ', 'CA', '🏴󠁧󠁢󠁳󠁣󠁴󠁿', '', '🇨', '🇨🇦🇨🇦', 'abcd', 'x🇨🇦']) {
    add('flagRegion', [s], () => flagRegion(s) ?? null);
  }

  // Subdivision flags, including the substring quirk ('gbeng gbsct' matches).
  for (const s of [
    'gbsct',
    'GBENG',
    'gbwls',
    'GbWlS',
    'usca',
    '',
    'gb',
    'eng',
    'gbsc',
    'gbsctx',
    ' gbsct',
    'gbsct ',
    'gbeng gbsct',
    'gbsct gbwls',
    'gbeng gbsct gbwls',
    'GBENG GBSCT',
    'gbeng  gbsct',
    'gbeng gbwls',
    'gKsct',
    'gbsсt',
  ]) {
    add('subdivisionFlag', [s], () => subdivisionFlag(s) ?? null);
  }

  // Visible for testing: merging a fast tag into a tag.
  add('returnTag', ['und-POSIX-u-ca-calendar', { tag: [null, 'Latn', 'US'] }], () =>
    describeTag(
      returnTag(
        parseLanguageTag('und-POSIX-u-ca-calendar'),
        fastTag(languageTag(undefined, 'Latn', 'US')),
      ),
    ),
  );
  add('returnTag', ['zh-yue-x-a', { tag: ['zh', null, null, null, null, null, ['yue']] }], () =>
    describeTag(
      returnTag(
        parseLanguageTag('zh-yue-x-a'),
        fastTag(languageTag('zh', undefined, undefined, undefined, {}, '', ['yue'])),
      ),
    ),
  );
  return cases;
};
