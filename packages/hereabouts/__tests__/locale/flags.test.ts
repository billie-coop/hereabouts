import { parseLanguageTag } from '../../src/language-tag';
import { flagRegion, localeFlag, regionFlag, subdivisionFlag } from '../../src/locale';

const indicators = (code: string): string =>
  String.fromCodePoint(0x1f1e6 + code.charCodeAt(0) - 65, 0x1f1e6 + code.charCodeAt(1) - 65);

test('region flags', () => {
  expect(regionFlag('SC')).toEqual('🇸🇨');
  expect(regionFlag('fr')).toEqual('🇫🇷');
  expect(regionFlag('US')).toEqual(indicators('US'));
  // Flags that aren't countries.
  expect(regionFlag('EU')).toEqual('🇪🇺');
  expect(regionFlag('UN')).toEqual('🇺🇳');
  expect(regionFlag('XK')).toEqual('🇽🇰');
  // Sark, added in Emoji 16.
  expect(regionFlag('CQ')).toEqual('🇨🇶');
  for (const none of ['419', '001', 'ZZ', 'QO', 'EZ', 'UK', 'A', 'USA', '', '🇫🇷']) {
    expect(regionFlag(none)).toBeUndefined();
  }
});

test('every A-Z pair', () => {
  let count = 0;
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b);
      const flag = regionFlag(code);
      if (flag) {
        count++;
        expect(flag).toEqual(indicators(code));
        expect(flagRegion(flag)).toEqual(code);
      }
    }
  }
  expect(count).toEqual(259);
});

test('subdivision flags', () => {
  expect(subdivisionFlag('gbsct')).toEqual('🏴󠁧󠁢󠁳󠁣󠁴󠁿');
  expect(subdivisionFlag('GBENG')).toEqual('🏴󠁧󠁢󠁥󠁮󠁧󠁿');
  expect(subdivisionFlag('gbwls')).toEqual('🏴󠁧󠁢󠁷󠁬󠁳󠁿');
  expect(subdivisionFlag('usca')).toBeUndefined();
  expect(subdivisionFlag('')).toBeUndefined();
});

test('locale flags', () => {
  expect(localeFlag('en-SC')).toEqual('🇸🇨');
  expect(localeFlag('zh-Hant-TW')).toEqual('🇹🇼');
  // The likely region.
  expect(localeFlag('en')).toEqual('🇺🇸');
  expect(localeFlag('ja')).toEqual('🇯🇵');
  expect(localeFlag('zh-Hant')).toEqual('🇹🇼');
  expect(localeFlag('ca')).toEqual('🇪🇸');
  // Old codes are replaced.
  expect(localeFlag('en-UK')).toEqual('🇬🇧');
  // Subdivisions.
  expect(localeFlag('en-GB-u-sd-gbsct')).toEqual('🏴󠁧󠁢󠁳󠁣󠁴󠁿');
  expect(localeFlag('cy-GB-u-sd-gbwls-ca-gregory')).toEqual('🏴󠁧󠁢󠁷󠁬󠁳󠁿');
  expect(localeFlag('en-US-u-sd-usca')).toEqual('🇺🇸');
  // Tags work too.
  expect(localeFlag(parseLanguageTag('de-AT'))).toEqual('🇦🇹');
  // No flag.
  expect(localeFlag('es-419')).toBeUndefined();
  expect(localeFlag('ar-001')).toBeUndefined();
  expect(localeFlag('eo')).toBeUndefined();
});

test('flag to region', () => {
  expect(flagRegion('🇨🇦')).toEqual('CA');
  // Not RGI, or not a flag.
  expect(flagRegion(indicators('ZZ'))).toBeUndefined();
  expect(flagRegion('🇨🇦 ')).toBeUndefined();
  expect(flagRegion('CA')).toBeUndefined();
  expect(flagRegion('🏴󠁧󠁢󠁳󠁣󠁴󠁿')).toBeUndefined();
});
