import { tagCompact } from '@phensley/language-tag';
import { type Bundle, bundleGet, parseLanguageTag, stringBundle } from '../../src';
import { languageBundle } from '../_helpers';

test('bundle loading', () => {
  let b: Bundle;

  b = languageBundle('en-u-nu-hant-ca-buddhist');
  expect(b.id).toEqual('en-Latn-US-u-ca-buddhist-nu-hant');
  expect(tagCompact(b.tag)).toEqual('en-Latn-US-u-ca-buddhist-nu-hant');
  expect(b.language).toEqual('en');
  expect(b.region).toEqual('US');
  expect(b.languageScript).toEqual('en-Latn');
  expect(b.languageRegion).toEqual('en-US');
  expect(b.calendarSystem).toEqual('buddhist');
  expect(b.numberSystem).toEqual('hant');
});

test('bundle unicode extension defaulting', () => {
  let b: Bundle;

  b = languageBundle('en-u-co-foo');
  expect(b.numberSystem).toEqual('default');
  expect(b.calendarSystem).toEqual('');
});

test('bundle index', () => {
  const tag = parseLanguageTag('en-XX');
  const b = stringBundle('en-XX', tag, ['A', 'B'], [], {}, {});
  expect(bundleGet(b, 0)).toEqual('A');
  expect(bundleGet(b, 1)).toEqual('B');
  expect(bundleGet(b, 2)).toEqual('');
});

test('bundle exceptions', () => {
  const tag = parseLanguageTag('en-XX');
  const b = stringBundle('en-XX', tag, ['A', 'B'], ['C'], { 1: 0 }, {});
  expect(bundleGet(b, 0)).toEqual('A');
  expect(bundleGet(b, 1)).toEqual('C');
  expect(bundleGet(b, 2)).toEqual('');
});

test('bundle exception missing', () => {
  const tag = parseLanguageTag('en-XX');
  const b = stringBundle('en-XX', tag, ['A', 'B'], ['C'], { 0: 0, 1: 5 }, {});
  expect(bundleGet(b, 0)).toEqual('C');
  expect(bundleGet(b, 1)).toEqual('');
  expect(bundleGet(b, 2)).toEqual('');
});

test('bundle spellout', () => {
  let b: Bundle;

  b = languageBundle('en-u-nu-hant-ca-buddhist');
  expect(b.spellout).toBeDefined();
});
