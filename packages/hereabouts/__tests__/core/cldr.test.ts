import {
  availableLocales,
  type CLDRFramework,
  type CurrencyFormatOptions,
  cldrFramework,
  cldrVersion,
  fieldGet,
  type NumberSystemInfo,
  parseLanguageTag,
  type Quantity,
  resolveLocale,
  type SchemaConfig,
  scopeGet,
  vectorMapping,
} from '../../src/core';
import { parseDatePattern } from '../../src/core/internals/calendars/internal';
import { tagCompact, tagExpanded } from '../../src/language-tag';
import { getCLDR } from './_helpers';

test('init framework', () => {
  const framework = getCLDR();
  let api = framework.get('en');
  expect(framework.info()).toEqual('packs loaded: 1');

  expect(() => framework.get('xx')).toThrowError();

  expect(api.General.bundle().id).toEqual('en-Latn-US');
  expect(api.General.locale().id).toEqual('en');
  expect(tagExpanded(api.General.resolveLocale('zh').tag)).toEqual('zh-Hans-CN');

  expect(api.General.characterOrder()).toEqual('ltr');
  expect(api.General.lineOrder()).toEqual('ttb');

  expect(api.Calendars.months({ width: 'wide' })[3]).toEqual('March');

  let s: string;

  const ux = { date: 1109934428000, zoneId: 'America/New_York' };
  s = api.Calendars.formatDate(ux, { datetime: 'full' });
  s = api.Calendars.formatDate(ux, { datetime: 'full' });
  expect(s).toEqual('Friday, March 4, 2005 at 6:07:08 AM Eastern Standard Time');

  const currOpts: CurrencyFormatOptions = { style: 'short' };
  s = api.Numbers.formatCurrency('345678', 'USD', currOpts);
  s = api.Numbers.formatCurrency('345678', 'USD', currOpts);
  expect(s).toEqual('$346K');

  const qty: Quantity = { value: '17.69', unit: 'pound' };
  const unitOpts = { maximumFractionDigits: 1 };
  s = api.Units.formatQuantity(qty, unitOpts);
  s = api.Units.formatQuantity(qty, unitOpts);
  expect(s).toEqual('17.7 pounds');

  framework.get('es');
  expect(framework.info()).toEqual('packs loaded: 2');
  framework.get('es');
  expect(framework.info()).toEqual('packs loaded: 2');

  // Bundle with invalid region
  api = framework.get('ar-Arab-XX');
  expect(api.General.bundle().language).toEqual('ar');
  expect(api.General.bundle().languageRegion).toEqual('ar-EG');
  expect(api.General.bundle().languageScript).toEqual('ar-Arab');

  // Bundle with invalid script
  api = framework.get('ar-Cyrl-SA');
  expect(api.General.bundle().language).toEqual('ar');
  expect(api.General.bundle().languageRegion).toEqual('ar-EG');
  expect(api.General.bundle().languageScript).toEqual('ar-Arab');

  // Load with a locale object
  const l = resolveLocale('gu');
  api = framework.get(l);
  expect(api.General.bundle().language).toEqual('gu');
});

test('parsing language tags', () => {
  let r = parseLanguageTag('und-Zzzz-BR');
  expect(tagCompact(r)).toEqual('und-BR');

  r = parseLanguageTag('und');
  expect(tagCompact(r)).toEqual('und');

  let l = resolveLocale('und-Zzzz-BR');
  expect(tagCompact(l.tag)).toEqual('pt-Latn-BR');

  l = resolveLocale('und');
  expect(tagCompact(l.tag)).toEqual('en-Latn-US');
});

test('enumerating locales', () => {
  const locales = availableLocales();
  expect(locales).toContainEqual(resolveLocale('en'));
});

test('accessing schema', () => {
  const framework = getCLDR();
  let api = framework.get('en');
  let bundle = api.General.bundle();

  let system = scopeGet(api.Schema.Numbers.numberSystem, 'latn') as NumberSystemInfo;
  let symbols = vectorMapping(system.symbols, bundle);
  expect(symbols.group).toEqual(',');
  expect(symbols.decimal).toEqual('.');

  let pattern = fieldGet(system.decimalFormats.standard, bundle);
  expect(pattern).toEqual('#,##0.###');

  api = framework.get('de');
  bundle = api.General.bundle();

  system = scopeGet(api.Schema.Numbers.numberSystem, 'latn') as NumberSystemInfo;
  symbols = vectorMapping(system.symbols, bundle);
  expect(symbols.group).toEqual('.');
  expect(symbols.decimal).toEqual(',');

  pattern = fieldGet(system.currencyFormats.standard, bundle);
  expect(pattern).toEqual('#,##0.00\u00a0\u00a4');
});

test('accessing internals', () => {
  const framework = getCLDR();
  framework.get('en');

  const p = parseDatePattern('yyyy/MM/dd h:m:s');
  expect(p).toEqual([
    ['y', 4],
    '/',
    ['M', 2],
    '/',
    ['d', 2],
    ' ',
    ['h', 1],
    ':',
    ['m', 1],
    ':',
    ['s', 1],
  ]);
});

test('resolving locales', () => {
  let r = parseLanguageTag('und-Zzzz-US');
  let { id, tag } = resolveLocale(r);
  expect(id).toEqual('und-US');
  expect(tagCompact(tag)).toEqual('en-Latn-US');

  r = parseLanguageTag('es');
  ({ id, tag } = resolveLocale(r));
  expect(id).toEqual('es');
  expect(tagCompact(tag)).toEqual('es-Latn-ES');
});

test('async loader', async () => {
  const framework = getCLDR();
  const en = framework.get('en');
  const es = framework.get('es');

  const path = ['data', 'id'];

  await expect(framework.getAsync('en')).resolves.toEqual(en);
  await expect(framework.getAsync('es')).resolves.toEqual(es);

  await expect(framework.getAsync('xx')).rejects.toContain('no such file');

  await expect(framework.getAsync('de')).resolves.toHaveProperty(path, 'de-Latn-DE');
  await expect(framework.getAsync('zh-TW')).resolves.toHaveProperty(path, 'zh-Hant-TW');

  await expect(framework.getAsync('de')).resolves.toHaveProperty(path, 'de-Latn-DE');
  await expect(framework.getAsync('zh-TW')).resolves.toHaveProperty(path, 'zh-Hant-TW');

  const l = resolveLocale('gu');
  await expect(framework.getAsync(l)).resolves.toHaveProperty(path, 'gu-Gujr-IN');
});

test('async await loader', async () => {
  const framework = getCLDR();
  const path = ['data', 'id'];

  const de = await framework.getAsync('de');
  expect(de).toHaveProperty(path, 'de-Latn-DE');

  const zh = await framework.getAsync('zh-TW');
  expect(zh).toHaveProperty(path, 'zh-Hant-TW');
});

test('loader errors', () => {
  const framework = cldrFramework({ config: {} });
  expect(() => framework.get('en')).toThrowError('loader is not defined');
  expect(() => framework.getAsync('en')).toThrowError('loader is not defined');
});

test('undefined locale', () => {
  const framework = getCLDR();
  const undef = undefined as unknown as string;
  expect(() => framework.get(undef)).toThrowError('argument is undefined');
  expect(() => framework.getAsync(undef)).toThrowError('argument is undefined');
});

test('version', () => {
  const version = cldrVersion().split(/\./g);
  expect(version.length).toBeGreaterThanOrEqual(3);
});

test('framework config', () => {
  let framework: CLDRFramework;
  const config: SchemaConfig = {
    'number-system-name': ['latn', 'beng'],
  };

  // 1.x set a global default config; the default is now passed to cldrFramework().
  framework = cldrFramework({}, config);
  expect(framework.config()).toEqual(config);

  framework = cldrFramework({});
  expect(framework.config()).toEqual({ calendars: ['gregory'] });

  framework = cldrFramework({ config });
  expect(framework.config()).toEqual({ ...config, calendars: ['gregory'] });
});
