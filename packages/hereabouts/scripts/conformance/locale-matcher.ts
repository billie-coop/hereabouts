/**
 * Builds the shared locale matcher cases in `conformance/locale-matcher.json`: distances,
 * region partitions, entry parsing and sorting, and matching. Includes every case in the data
 * files under `__tests__/locale-matcher/data`, with the results the TypeScript gives (some of
 * the ICU cases in `locale-match-cases-new.txt` expect other results; see matcher.test.ts).
 *
 * A list of locales is a string, or an array of strings, `{ tag: [...] }` (the arguments of
 * `languageTag`) and `{ locale: [id, [...]] }`. Result tags are `[compact, expanded]`.
 */
import {
  loadDistanceCases,
  loadDistanceCasesNew,
  loadMatchCases,
  loadMatchCasesNew,
} from '../../__tests__/locale-matcher/util';
import {
  type LanguageTag,
  languageTag,
  parseLanguageTag,
  tagCompact,
  tagExpanded,
} from '../../src/language-tag';
import type { Locale } from '../../src/locale';
import { resolveLanguageTag } from '../../src/locale';
import { createLocaleMatcher, matchLocale } from '../../src/locale-matcher';
import { getDistance } from '../../src/locale-matcher/distance';
import { parse } from '../../src/locale-matcher/matcher';
import { getRegionPartition } from '../../src/locale-matcher/partition';
import { type ConformanceCase, collector, type Random, random } from './_shared';

type Item = string | { tag: unknown[] } | { locale: [string, unknown[]] };
type Locales = string | Item[];

const makeTag = (args: unknown[]): LanguageTag =>
  (languageTag as (...x: unknown[]) => LanguageTag)(...args);

const toLocales = (l: Locales): string | (string | LanguageTag | Locale)[] =>
  typeof l === 'string'
    ? l
    : l.map((x) => {
        if (typeof x === 'string') {
          return x;
        }
        if ('tag' in x) {
          return makeTag(x.tag);
        }
        return { id: x.locale[0], tag: makeTag(x.locale[1]) };
      });

const short = (t: LanguageTag) => [tagCompact(t), tagExpanded(t)];

const POOL = [
  'en',
  'en-US',
  'en-GB',
  'en-AU',
  'en-IN',
  'en-CA',
  'en-001',
  'en-150',
  'es',
  'es-ES',
  'es-419',
  'es-MX',
  'es-AR',
  'pt',
  'pt-BR',
  'pt-PT',
  'pt-AO',
  'fr',
  'fr-CA',
  'fr-CH',
  'de',
  'de-AT',
  'de-CH',
  'gsw',
  'zh',
  'zh-TW',
  'zh-Hant',
  'zh-Hans-HK',
  'zh-HK',
  'yue',
  'ja',
  'ko',
  'ru',
  'uk',
  'be',
  'sr',
  'sr-Latn',
  'sr-ME',
  'hr',
  'bs',
  'no',
  'nb',
  'nn',
  'da',
  'sv',
  'fi',
  'ar',
  'ar-EG',
  'fa',
  'he',
  'iw',
  'hi',
  'bn',
  'ta',
  'af',
  'eu',
  'ca',
  'gl',
  'und',
  'und-Latn',
  'und-Hant',
  'xx',
  'tlh',
  'en-u-ca-buddhist',
  'en-x-foo',
  'eng-Latn-GB',
  'en_GB',
];

const randomList = (r: Random, n: number): string =>
  Array.from({ length: n }, () => r.pick(POOL)).join(r.pick([', ', ' ', ',', ' ,\t']));

export const cases = (): ConformanceCase[] => {
  const { cases, add } = collector();

  const distance = (
    desired: string,
    supported: string,
    threshold: number | null,
    resolve: boolean,
  ) =>
    add('getDistance', [desired, supported, threshold, resolve], () => {
      const tag = resolve ? resolveLanguageTag : parseLanguageTag;
      return getDistance(tag(desired), tag(supported), threshold ?? undefined);
    });
  const match = (
    supported: Locales,
    resolve: boolean | null,
    desired: string | string[],
    threshold: number | null,
  ) =>
    add('matchLocale', [supported, resolve, desired, threshold], () => {
      const m = createLocaleMatcher(
        toLocales(supported),
        resolve === null ? undefined : { resolve },
      );
      const result = matchLocale(m, desired, threshold ?? undefined);
      return { id: result.locale.id, tag: short(result.locale.tag), distance: result.distance };
    });
  const create = (supported: Locales, resolve: boolean | null) =>
    add('createLocaleMatcher', [supported, resolve], () => {
      const m = createLocaleMatcher(
        toLocales(supported),
        resolve === null ? undefined : { resolve },
      );
      return {
        supported: m.supported.map((e) => [e.id, ...short(e.tag)]),
        default: m.defaultEntry.id,
      };
    });

  // The data files.
  for (const c of [...loadDistanceCases(), ...loadDistanceCasesNew()]) {
    distance(c.desired, c.supported, null, true);
    distance(c.supported, c.desired, null, true);
  }
  for (const c of loadMatchCases()) {
    match(c.supported, null, c.desired, null);
  }
  for (const c of loadMatchCasesNew()) {
    match(c.supported, null, c.desired, c.threshold === '' ? null : Number(c.threshold));
  }

  // Distances: thresholds, unresolved tags, wildcards and region partitions.
  for (const [d, s] of [
    ['en-AU', 'en-GB'],
    ['en-GB', 'en-US'],
    ['es-MX', 'es-419'],
    ['sr-Latn', 'sr-Cyrl'],
    ['no', 'nb'],
    ['xx', 'yy'],
    ['xx', 'xx'],
    ['xx-Latn', 'xx-Cyrl'],
    ['und', 'und'],
    ['en', 'und'],
    ['en-ZZ', 'en-US'],
    ['en-001', 'en-150'],
    ['en-419', 'en-US'],
    ['en-QO', 'en-EU'],
    ['en-XX', 'en-YY'],
    ['zh-Hant', 'zh-Hans'],
  ]) {
    for (const threshold of [null, 0, 1, 4, 5, 50, 51, 100, 200, -1]) {
      distance(d, s, threshold, true);
    }
    distance(d, s, null, false);
  }

  // Region partitions.
  for (const region of [
    'US',
    'ZZ',
    'GB',
    'EU',
    'UN',
    '001',
    '419',
    '142',
    'QO',
    'EZ',
    'XX',
    'us',
    '',
  ]) {
    add('getRegionPartition', [region], () => getRegionPartition(region));
  }

  // Entries, including the Locale and LanguageTag forms.
  const lists: Locales[] = [
    'en en-GB fr-FR',
    'en, en_GB, zh, pt_AR, es-419',
    'en \t en_GB \n , zh',
    ' en',
    'en ',
    '',
    ',',
    'en　fr de﻿ja ko',
    'und und-x-foo und-u-ca-gregory x-bar',
    'eng-Latn-US eng-Latn-GB iw-Hebr-IL',
    'fr, pt-PT, en-GB, es-419, pt-BR, en, es-ES, de, en-US, pt-BR',
    'en-GB, en-US, en-Latn-US',
    'de, en-Latn-US, en-US, en',
    [' en, pt_AR ', '\t en_GB'],
    [],
    [{ tag: ['en', null, 'GB'] }, { tag: ['pt', null, 'AR'] }],
    [{ tag: ['eng', 'Latn', 'US'] }, { tag: ['eng', 'Latn', 'GB'] }],
    [{ tag: [] }, { tag: [null, null, null, 'posix', { u: ['ca-gregory'] }, 'x-a'] }],
    [{ tag: ['en', null, null, null, null, null, ['yue']] }],
    [{ locale: ['en', ['eng', 'Latn', 'US']] }, 'fr'],
    [{ locale: ['en', ['en', 'Latn', 'US']] }, { locale: ['en_GB', ['en', 'Latn', 'GB']] }],
    [{ locale: ['x', []] }, 'en-GB'],
  ];
  for (const l of lists) {
    for (const resolve of [null, false]) {
      create(l, resolve);
    }
    add('parse', [l], () => parse(toLocales(l)).map((e) => [e.id, e.compact, ...short(e.tag)]));
  }

  // Matching.
  const desireds: (string | string[])[] = [
    'en-AU',
    'en',
    'pt',
    'de',
    'es-MX',
    'zh-TW',
    'sr-ME',
    ['xx', 'yy'],
    [],
    '',
    ['', 'en-GB'],
    'en-AU-u-ca-persian',
    'en-AU-u-ca-persian-x-foo',
    ['fr-CA', 'en-AU-x-bar'],
    'und',
    'x-foo',
    'iw',
    'he-IL, en',
    ['de-CH', 'gsw'],
  ];
  for (const l of lists) {
    if (Array.isArray(l) && l.length === 0) {
      continue;
    }
    for (const d of desireds) {
      match(l, null, d, null);
    }
    match(l, false, 'en-AU', null);
    match(l, null, 'en-AU', 1);
    match(l, null, 'en-AU', 10);
  }

  // Random lists and desired locales.
  const r = random(0x3a7c4);
  for (let i = 0; i < 1200; i++) {
    const supported = randomList(r, r.int(1, 6));
    const desired = r.next() < 0.7 ? r.pick(POOL) : [r.pick(POOL), r.pick(POOL)];
    const threshold = r.next() < 0.7 ? null : r.pick([0, 3, 5, 10, 30, 50, 80, 100, 150]);
    match(supported, r.next() < 0.85 ? null : false, desired, threshold);
  }
  for (let i = 0; i < 1500; i++) {
    distance(
      r.pick(POOL),
      r.pick(POOL),
      r.next() < 0.8 ? null : r.pick([10, 50, 100, 200]),
      r.next() < 0.9,
    );
  }
  return cases;
};
