/**
 * Shared pieces for the core conformance generators (`core-*.ts`): locale data loaded through
 * the framework from the shipped packs and config, as the Zig suites load it.
 */
import * as fs from 'fs';
import { join } from 'path';
import { config } from '../../src/config';
import { createFramework, type LocaleData, loadLocale } from '../../src/core';

const PACKS = join(__dirname, '..', '..', 'packs');

/** The languages whose packs the Zig suites embed (`packs.languages` in zig/build.zig). */
export const PACK_LANGUAGES = [
  'en',
  'de',
  'fr',
  'es',
  'pt',
  'ar',
  'fa',
  'he',
  'hi',
  'bn',
  'ja',
  'zh',
  'ko',
  'th',
  'ru',
  'pl',
  'sr',
  'tr',
  'sw',
  'my',
];

const framework = createFramework(
  { loader: (language: string) => fs.readFileSync(join(PACKS, `${language}.json`), 'utf-8') },
  JSON.parse(JSON.stringify(config)),
);

/** Locale data for an id, cached by the framework. */
export const load = (id: string): LocaleData => loadLocale(framework, id);

/** Locales spread over the test packs: plain languages, regions, scripts and extensions. */
export const LOCALES = [
  'en',
  'en-GB',
  'en-IN',
  'en-CA',
  'en-AU',
  'en-ZA',
  'en-150',
  'en-001',
  'de',
  'de-CH',
  'de-AT',
  'de-LI',
  'fr',
  'fr-CA',
  'fr-CH',
  'fr-BE',
  'es',
  'es-MX',
  'es-419',
  'es-AR',
  'pt',
  'pt-PT',
  'pt-AO',
  'ar',
  'ar-EG',
  'ar-SA',
  'ar-MA',
  'ar-AE',
  'ar-DZ',
  'fa',
  'fa-AF',
  'he',
  'hi',
  'hi-Latn',
  'bn',
  'bn-IN',
  'ja',
  'zh',
  'zh-Hant',
  'zh-Hant-TW',
  'zh-Hant-HK',
  'zh-HK',
  'zh-SG',
  'ko',
  'th',
  'ru',
  'ru-UA',
  'pl',
  'sr',
  'sr-Latn',
  'sr-Latn-BA',
  'sr-Cyrl-ME',
  'tr',
  'sw',
  'sw-KE',
  'sw-CD',
  'my',
  'en-u-nu-arab',
  'ar-u-nu-latn',
  'hi-u-nu-deva',
  'zh-u-nu-hanidec',
  'fa-u-nu-latn',
  'bn-u-nu-latn',
  'my-u-nu-latn',
  'th-u-nu-thai',
  'de-u-nu-arabext',
  'en-u-nu-bogus',
  'ja-u-ca-japanese',
  'en-US-u-ca-buddhist-nu-thai',
  'en_US',
  'und',
  'de-Arab',
  'pt-ZZ',
];
