import {
  type DisplayNameOptions,
  getLanguageDisplayName,
  getRegionDisplayName,
  getScriptDisplayName,
  type LanguageTag,
  parseLanguageTag,
  vectorGet,
} from '../../../../src/core';
import type { AltType } from '../../../../src/types';
import { generalApi, languageBundle } from '../../_helpers';

test('languages', () => {
  let tag: LanguageTag;

  let api = generalApi('en');
  expect(getLanguageDisplayName(api, 'en')).toEqual('English');
  expect(getLanguageDisplayName(api, 'en-US')).toEqual('American English');
  expect(getLanguageDisplayName(api, 'es-419')).toEqual('Latin American Spanish');
  expect(getLanguageDisplayName(api, 'de')).toEqual('German');
  expect(getLanguageDisplayName(api, 'fr')).toEqual('French');
  expect(getLanguageDisplayName(api, 'ko')).toEqual('Korean');
  expect(getLanguageDisplayName(api, 'de-CH')).toEqual('Swiss High German');
  expect(getLanguageDisplayName(api, 'en-GB')).toEqual('British English');
  expect(getLanguageDisplayName(api, 'en-GB', { type: 'short' })).toEqual('UK English');
  expect(getLanguageDisplayName(api, 'zh-Hans')).toEqual('Simplified Chinese');
  expect(getLanguageDisplayName(api, 'zh-Hans', { type: 'long' })).toEqual(
    'Simplified Mandarin Chinese',
  );
  expect(getLanguageDisplayName(api, 'zh-Hant')).toEqual('Traditional Chinese');
  expect(getLanguageDisplayName(api, 'zh-Hant', { type: 'long' })).toEqual(
    'Traditional Mandarin Chinese',
  );
  expect(getLanguageDisplayName(api, 'yue')).toEqual('Cantonese');
  expect(getLanguageDisplayName(api, 'yue', { type: 'menu' })).toEqual('Chinese, Cantonese');
  expect(getLanguageDisplayName(api, 'zh', { type: 'menu' })).toEqual('Chinese, Mandarin');

  // unknown subtags
  expect(getLanguageDisplayName(api, 'en-Zzzz-ZZ')).toEqual('English');
  expect(getLanguageDisplayName(api, 'und-Zzzz-ZZ')).toEqual('Unknown language');

  // tags
  tag = parseLanguageTag('und');
  expect(getLanguageDisplayName(api, tag)).toEqual('Unknown language');
  tag = parseLanguageTag('en');
  expect(getLanguageDisplayName(api, tag)).toEqual('English');
  tag = parseLanguageTag('en-US');
  expect(getLanguageDisplayName(api, tag)).toEqual('American English');
  tag = parseLanguageTag('zh-Zzzz');
  expect(getLanguageDisplayName(api, tag)).toEqual('Chinese');
  tag = parseLanguageTag('zh-Hans');
  expect(getLanguageDisplayName(api, tag)).toEqual('Simplified Chinese');
  tag = parseLanguageTag('zh-Zzzz-CN');
  expect(getLanguageDisplayName(api, tag)).toEqual('Simplified Chinese');
  tag = parseLanguageTag('zh-Zzzz-TW');
  expect(getLanguageDisplayName(api, tag)).toEqual('Traditional Chinese');

  api = generalApi('es');
  expect(getLanguageDisplayName(api, 'en')).toEqual('Inglés');
  expect(getLanguageDisplayName(api, 'es-419')).toEqual('Español latinoamericano');
  expect(getLanguageDisplayName(api, 'de')).toEqual('Alemán');
  expect(getLanguageDisplayName(api, 'fr')).toEqual('Francés');
  expect(getLanguageDisplayName(api, 'ko')).toEqual('Coreano');

  const opts: DisplayNameOptions = { context: 'middle-of-text' };
  expect(getLanguageDisplayName(api, 'en', opts)).toEqual('inglés');
  expect(getLanguageDisplayName(api, 'de', opts)).toEqual('alemán');
  expect(getLanguageDisplayName(api, 'fr', opts)).toEqual('francés');
  expect(getLanguageDisplayName(api, 'ko', opts)).toEqual('coreano');

  api = generalApi('de');
  expect(getLanguageDisplayName(api, 'en')).toEqual('Englisch');
  expect(getLanguageDisplayName(api, 'de')).toEqual('Deutsch');
  expect(getLanguageDisplayName(api, 'fr')).toEqual('Französisch');
  expect(getLanguageDisplayName(api, 'ko')).toEqual('Koreanisch');

  api = generalApi('ko');
  expect(getLanguageDisplayName(api, 'en')).toEqual('영어');
  expect(getLanguageDisplayName(api, 'de')).toEqual('독일어');
  expect(getLanguageDisplayName(api, 'fr')).toEqual('프랑스어');
  expect(getLanguageDisplayName(api, 'ko')).toEqual('한국어');
});

test('scripts', () => {
  let tag: LanguageTag;

  let api = generalApi('en');
  expect(getScriptDisplayName(api, 'Latn')).toEqual('Latin');
  expect(getScriptDisplayName(api, 'Cyrl')).toEqual('Cyrillic');
  expect(getScriptDisplayName(api, 'Hant')).toEqual('Traditional');
  expect(getScriptDisplayName(api, 'Arab')).toEqual('Arabic');
  expect(getScriptDisplayName(api, 'Arab', { type: 'variant' })).toEqual('Perso-Arabic');
  expect(getScriptDisplayName(api, 'Cans', { type: 'short' })).toEqual('UCAS');
  expect(getScriptDisplayName(api, 'Zzzz')).toEqual('Unknown Script');

  // tags
  tag = parseLanguageTag('en-Zzzz');
  expect(getScriptDisplayName(api, tag)).toEqual('Latin');
  tag = parseLanguageTag('und-Zzzz');
  expect(getScriptDisplayName(api, tag)).toEqual('Unknown Script');
  tag = parseLanguageTag('en');
  expect(getScriptDisplayName(api, tag)).toEqual('Latin');
  tag = parseLanguageTag('zh-CN');
  expect(getScriptDisplayName(api, tag)).toEqual('Simplified');
  tag = parseLanguageTag('zh-TW');
  expect(getScriptDisplayName(api, tag)).toEqual('Traditional');

  api = generalApi('es');
  expect(getScriptDisplayName(api, 'Latn')).toEqual('Latino');
  expect(getScriptDisplayName(api, 'Cyrl')).toEqual('Cirílico');
  expect(getScriptDisplayName(api, 'Hant')).toEqual('Tradicional');
  expect(getScriptDisplayName(api, 'Arab')).toEqual('Árabe');
  expect(getScriptDisplayName(api, 'Zzzz')).toEqual('Alfabeto desconocido');

  const opts: DisplayNameOptions = { context: 'middle-of-text' };
  expect(getScriptDisplayName(api, 'Latn', opts)).toEqual('latino');
  expect(getScriptDisplayName(api, 'Cyrl', opts)).toEqual('cirílico');
  expect(getScriptDisplayName(api, 'Hant', opts)).toEqual('tradicional');
  expect(getScriptDisplayName(api, 'Arab', opts)).toEqual('árabe');
  expect(getScriptDisplayName(api, 'Zzzz', opts)).toEqual('alfabeto desconocido');
});

test('regions', () => {
  let tag: LanguageTag;

  let api = generalApi('en');
  expect(getRegionDisplayName(api, 'US')).toEqual('United States');
  expect(getRegionDisplayName(api, 'US', { type: 'short' })).toEqual('US');
  expect(getRegionDisplayName(api, 'US', { type: 'INVALID' as AltType })).toEqual('United States');

  expect(getRegionDisplayName(api, 'ZZ')).toEqual('Unknown Region');

  expect(getRegionDisplayName(api, 'DE', { type: 'variant' })).toEqual('Germany');
  expect(getRegionDisplayName(api, 'DE', { type: 'narrow' })).toEqual('Germany');

  // tags
  tag = parseLanguageTag('und-US');
  expect(getRegionDisplayName(api, tag)).toEqual('United States');
  tag = parseLanguageTag('und-ZZ');
  expect(getRegionDisplayName(api, tag)).toEqual('Unknown Region');
  tag = parseLanguageTag('en-ZZ');
  expect(getRegionDisplayName(api, tag)).toEqual('United States');

  api = generalApi('es');
  expect(getRegionDisplayName(api, 'US')).toEqual('Estados Unidos');
  expect(getRegionDisplayName(api, 'US', { type: 'short' })).toEqual('EE. UU.');
  expect(getRegionDisplayName(api, 'ZZ')).toEqual('Región desconocida');

  // Confirmation of the CLDR 44 name change for Ivory Coast
  api = generalApi('sv');
  expect(getRegionDisplayName(api, 'CI', { type: 'long' })).toEqual('Elfenbenskusten');
});

test('internals', () => {
  const en = languageBundle('en');
  const es = languageBundle('es');

  const { schema } = en;
  let s: string;
  s = vectorGet(schema.Names.regions.displayName, en, 'none', '001');
  expect(s).toEqual('world');

  s = vectorGet(schema.Names.scripts.displayName, en, 'none', 'Arab');
  expect(s).toEqual('Arabic');

  s = vectorGet(schema.Names.regions.displayName, es, 'none', '001');
  expect(s).toEqual('Mundo');

  s = vectorGet(schema.Names.scripts.displayName, es, 'none', 'Arab');
  expect(s).toEqual('árabe');
});
