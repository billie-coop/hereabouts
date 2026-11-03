import {
  getLanguageDisplayName,
  getRegionDisplayName,
  getScriptDisplayName,
} from '../../../src/core';
import { buildConfig, generalApi } from '../_helpers';

test('custom language display names', () => {
  const cfg = buildConfig({ 'language-id': ['en'] });
  const api = generalApi('en', cfg);
  let s: string;

  s = getLanguageDisplayName(api, 'en');
  expect(s).toEqual('English');

  s = getLanguageDisplayName(api, 'fr');
  expect(s).toEqual('');
});

test('custom script display names', () => {
  const cfg = buildConfig({ 'script-id': ['Latn'] });
  const api = generalApi('en', cfg);
  let s: string;

  s = getScriptDisplayName(api, 'Latn');
  expect(s).toEqual('Latin');

  s = getLanguageDisplayName(api, 'Arab');
  expect(s).toEqual('');
});

test('custom region display names', () => {
  const cfg = buildConfig({ 'region-id': ['001', 'US'] });
  const api = generalApi('en', cfg);
  let s: string;

  s = getRegionDisplayName(api, '001');
  expect(s).toEqual('world');

  s = getRegionDisplayName(api, 'US');
  expect(s).toEqual('United States');

  s = getRegionDisplayName(api, 'FR');
  expect(s).toEqual('');
});
