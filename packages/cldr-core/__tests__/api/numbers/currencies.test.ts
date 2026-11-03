import type { ContextType, CurrencyType } from '@phensley/cldr-types';
import type { Part } from '@phensley/decimal';

import {
  type CurrencyFormatOptions,
  type CurrencyFormatStyleType,
  formatCurrency,
  formatCurrencyToParts,
  formatDecimal,
  getCurrencyDisplayName,
  getCurrencyForRegion,
  getCurrencyFractions,
  getCurrencyPluralName,
  getCurrencySymbol,
} from '../../../src';
import { numbersApi } from '../../_helpers';

test('currency fractions', () => {
  expect(getCurrencyFractions('USD').digits).toEqual(2);
  expect(getCurrencyFractions('JPY').digits).toEqual(0);
});

test('currency regions', () => {
  expect(getCurrencyForRegion('')).toEqual('USD');
  expect(getCurrencyForRegion('ZZ')).toEqual('USD');
  expect(getCurrencyForRegion('US')).toEqual('USD');
  expect(getCurrencyForRegion('AC')).toEqual('SHP');
  expect(getCurrencyForRegion('AR')).toEqual('ARS');
  expect(getCurrencyForRegion('EE')).toEqual('EUR');
});

test('plural unit wrapper fallback', () => {
  const api = numbersApi('so');
  let actual: string;

  actual = formatCurrency(api, '1', 'GBP', { style: 'code' });
  expect(actual).toEqual('1.00 GBP');
});

test('currency nan and infinity', () => {
  const api = numbersApi('en');

  expect(() => formatCurrency(api, NaN, 'USD')).toThrowError();
  expect(() => formatCurrency(api, Infinity, 'USD')).toThrowError();
});

test('currency unknown style', () => {
  const opts: CurrencyFormatOptions = { style: 'UNKNOWN' as CurrencyFormatStyleType };
  const api = numbersApi('en');
  let actual: string;

  actual = formatCurrency(api, '12345.234', 'USD', opts);
  expect(actual).toEqual('');
});

test('minimum grouping digits', () => {
  const opts: CurrencyFormatOptions = { style: 'symbol', group: true };
  const api = numbersApi('es-ES');
  let s: string;

  s = formatCurrency(api, '1234.567', 'EUR', opts);
  expect(s).toEqual('1234,57 €');
});

test('zero currency', () => {
  const opts: CurrencyFormatOptions = { style: 'symbol', group: true };
  const api = numbersApi('en');
  let s: string;

  s = formatCurrency(api, '0', 'USD', opts);
  expect(s).toEqual('$0.00');

  s = formatCurrency(api, '0', 'JPY', opts);
  expect(s).toEqual('¥0');
});

test('currency', () => {
  const opts: CurrencyFormatOptions = { style: 'symbol', group: true };
  const api = numbersApi('en');
  let s: string;

  s = formatCurrency(api, '0', 'USD', opts);
  expect(s).toEqual('$0.00');

  s = formatCurrency(api, '-1', 'USD', opts);
  expect(s).toEqual('-$1.00');

  s = formatCurrency(api, '12345.234', 'USD', opts);
  expect(s).toEqual('$12,345.23');

  opts.maximumFractionDigits = 0;
  s = formatCurrency(api, '1.567', 'USD', opts);
  expect(s).toEqual('$2');
});

test('v38 currencies', () => {
  const opts: CurrencyFormatOptions = { style: 'symbol', symbolWidth: 'narrow', group: true };
  const api = numbersApi('en');
  let s: string;

  s = formatCurrency(api, '0', 'AZN', opts);
  expect(s).toEqual('₼0.00');
});

test('currency accounting', () => {
  const opts: CurrencyFormatOptions = { style: 'accounting', group: true };
  let api = numbersApi('en');
  let s: string;

  s = formatCurrency(api, '-12345.6789', 'EUR', { group: false });
  expect(s).toEqual('-€12345.68');

  s = formatCurrency(api, '-12345.6789', 'EUR', opts);
  expect(s).toEqual('(€12,345.68)');

  s = formatCurrency(api, '-12345.6789', 'GBP', opts);
  expect(s).toEqual('(£12,345.68)');

  s = formatCurrency(api, '-12345.6789', 'JPY', opts);
  expect(s).toEqual('(¥12,346)');

  api = numbersApi('de');
  s = formatCurrency(api, '-12345.6789', 'EUR', opts);
  expect(s).toEqual('-12.345,68 €');

  s = formatCurrency(api, '-12345.6789', 'GBP', opts);
  expect(s).toEqual('-12.345,68 £');

  s = formatCurrency(api, '-12345.6789', 'JPY', opts);
  expect(s).toEqual('-12.346 ¥');

  api = numbersApi('es-419');
  s = formatCurrency(api, '-12345.6789', 'EUR', opts);
  expect(s).toEqual('-EUR 12,345.68');

  s = formatCurrency(api, '-12345.6789', 'GBP', opts);
  expect(s).toEqual('-GBP 12,345.68');

  s = formatCurrency(api, '-12345.6789', 'JPY', opts);
  expect(s).toEqual('-JPY 12,346');
});

test('currency name', () => {
  const opts: CurrencyFormatOptions = { style: 'name', group: true };
  let api = numbersApi('en');
  let s: string;

  s = formatCurrency(api, '-12345.6789', 'EUR', opts);
  expect(s).toEqual('-12,345.68 euros');

  s = formatCurrency(api, '-12345.6789', 'GBP', opts);
  expect(s).toEqual('-12,345.68 British pounds');

  s = formatCurrency(api, '-12345.6789', 'JPY', opts);
  expect(s).toEqual('-12,346 Japanese yen');

  api = numbersApi('de');
  s = formatCurrency(api, '-12345.6789', 'EUR', opts);
  expect(s).toEqual('-12.345,68 Euro');

  s = formatCurrency(api, '-12345.6789', 'GBP', opts);
  expect(s).toEqual('-12.345,68 Britische Pfund');

  s = formatCurrency(api, '-12345.6789', 'JPY', opts);
  expect(s).toEqual('-12.346 Japanische Yen');

  api = numbersApi('es-419');
  s = formatCurrency(api, '-12345.6789', 'EUR', opts);
  expect(s).toEqual('-12,345.68 euros');

  s = formatCurrency(api, '-12345.6789', 'GBP', opts);
  expect(s).toEqual('-12,345.68 libras esterlinas');

  s = formatCurrency(api, '-12345.6789', 'JPY', opts);
  expect(s).toEqual('-12,346 yenes japoneses');
});

test('currency short', () => {
  let opts: CurrencyFormatOptions = { style: 'short', group: true };
  let e = numbersApi('en');
  let s: string;

  s = formatCurrency(e, '-12345.6789', 'EUR', opts);
  expect(s).toEqual('-€12K');

  s = formatCurrency(e, '-12345.6789', 'GBP', opts);
  expect(s).toEqual('-£12K');

  s = formatCurrency(e, '-12345.6789', 'JPY', opts);
  expect(s).toEqual('-¥12K');

  s = formatCurrency(e, '0.9999', 'USD', opts);
  expect(s).toEqual('$1');

  s = formatCurrency(e, '123.4567', 'USD', opts);
  expect(s).toEqual('$123');

  s = formatCurrency(e, '999.9', 'USD', opts);
  expect(s).toEqual('$1K');

  s = formatCurrency(e, '999999.9', 'USD', opts);
  expect(s).toEqual('$1M');

  s = formatCurrency(e, '999900.00', 'USD', opts);
  expect(s).toEqual('$1M');

  s = formatCurrency(e, '999000.00', 'USD', opts);
  expect(s).toEqual('$999K');

  opts.maximumFractionDigits = 1;
  s = formatCurrency(e, '999900.00', 'USD', opts);
  expect(s).toEqual('$999.9K');

  opts.maximumFractionDigits = 0;
  s = formatCurrency(e, '999900.00', 'USD', opts);
  expect(s).toEqual('$1M');

  opts = { style: 'short', group: true };
  e = numbersApi('de');
  s = formatCurrency(e, '-12345.6789', 'EUR', opts);
  expect(s).toEqual('-12.346 €');

  s = formatCurrency(e, '-12345.6789', 'GBP', opts);
  expect(s).toEqual('-12.346 £');

  s = formatCurrency(e, '-12345.6789', 'JPY', opts);
  expect(s).toEqual('-12.346 ¥');

  e = numbersApi('es-419');
  s = formatCurrency(e, '-12345.6789', 'EUR', opts);
  expect(s).toEqual('-EUR 12 k');

  s = formatCurrency(e, '-12345.6789', 'GBP', opts);
  expect(s).toEqual('-GBP 12 k');

  s = formatCurrency(e, '-12345.6789', 'JPY', opts);
  expect(s).toEqual('-JPY 12 k');

  e = numbersApi('zh');
  s = formatCurrency(e, '999999.987', 'USD', opts);
  // TODO: support algorithmic numbering for chinese finance
  expect(s).toEqual('US$100万');
});

test('currency fractions', () => {
  const opts: CurrencyFormatOptions = { style: 'symbol' };
  const api = numbersApi('en');
  let s: string;

  s = formatCurrency(api, '12345.019999', 'JPY', opts);
  expect(s).toEqual('¥12,345');

  opts.minimumFractionDigits = 2;
  s = formatCurrency(api, '12345.019999', 'JPY', opts);
  expect(s).toEqual('¥12,345.02');
});

test('currency spacing', () => {
  let api = numbersApi('en');
  let opts: CurrencyFormatOptions;
  let s: string;

  opts = { style: 'symbol', group: true };
  s = formatCurrency(api, '12345.234', 'BAD', opts);
  expect(s).toEqual('BAD\u00a012,345.23');

  s = formatCurrency(api, '12345.234', 'AUD', opts);
  expect(s).toEqual('A$12,345.23');

  opts.symbolWidth = 'narrow';
  s = formatCurrency(api, '12345.234', 'AUD', opts);
  expect(s).toEqual('$12,345.23');

  api = numbersApi('de');
  opts.symbolWidth = 'default';

  s = formatCurrency(api, '12345.234', 'BAD', opts);
  expect(s).toEqual('12.345,23\u00a0BAD');

  s = formatCurrency(api, '12345.234', 'USD', opts);
  expect(s).toEqual('12.345,23\u00a0$');

  api = numbersApi('km');
  s = formatCurrency(api, '12345.234', 'USD', opts);
  expect(s).toEqual('12,345.23$');

  opts = { style: 'symbol', symbolWidth: 'default', group: true, nu: 'native' };
  s = formatCurrency(api, '12345.234', 'USD', opts);
  expect(s).toEqual('១២.៣៤៥,២៣$');

  s = formatCurrency(api, '12345.234', 'BAD', opts);
  expect(s).toEqual('១២.៣៤៥,២៣\u00a0BAD');
});

test('currency parts', () => {
  const api = numbersApi('en');
  let p: Part[];

  p = formatCurrencyToParts(api, '12345.234', 'USD');
  expect(p).toEqual([
    { type: 'currency', value: '$' },
    { type: 'integer', value: '12' },
    { type: 'group', value: ',' },
    { type: 'integer', value: '345' },
    { type: 'decimal', value: '.' },
    { type: 'fraction', value: '23' },
  ]);

  const opts: CurrencyFormatOptions = { style: 'accounting', group: true };
  p = formatCurrencyToParts(api, '12345.234', 'USD', opts);
  expect(p).toEqual([
    { type: 'currency', value: '$' },
    { type: 'integer', value: '12' },
    { type: 'group', value: ',' },
    { type: 'integer', value: '345' },
    { type: 'decimal', value: '.' },
    { type: 'fraction', value: '23' },
  ]);

  opts.style = 'code';
  p = formatCurrencyToParts(api, '1002123.0166', 'AUD', opts);
  expect(p).toEqual([
    { type: 'integer', value: '1' },
    { type: 'group', value: ',' },
    { type: 'integer', value: '002' },
    { type: 'group', value: ',' },
    { type: 'integer', value: '123' },
    { type: 'decimal', value: '.' },
    { type: 'fraction', value: '02' },
    { type: 'literal', value: ' ' },
    { type: 'unit', value: 'AUD' },
  ]);

  opts.style = 'short';
  p = formatCurrencyToParts(api, '123456789.123', 'EUR', opts);
  expect(p).toEqual([
    { type: 'currency', value: '€' },
    { type: 'integer', value: '123' },
    { type: 'literal', value: 'M' },
  ]);
});

test('currency parts spacing', () => {
  let api = numbersApi('en');
  let s: Part[];

  s = formatCurrencyToParts(api, '12345.234', 'BAD', { group: true });
  expect(s).toEqual([
    { type: 'currency', value: 'BAD' },
    { type: 'spacer', value: '\u00a0' },
    { type: 'integer', value: '12' },
    { type: 'group', value: ',' },
    { type: 'integer', value: '345' },
    { type: 'decimal', value: '.' },
    { type: 'fraction', value: '23' },
  ]);

  api = numbersApi('km');
  s = formatCurrencyToParts(api, '12345.234', 'BAD', { group: true, nu: 'native' });
  expect(s).toEqual([
    { type: 'integer', value: '១២' },
    { type: 'group', value: '.' },
    { type: 'integer', value: '៣៤៥' },
    { type: 'decimal', value: ',' },
    { type: 'fraction', value: '២៣' },
    { type: 'spacer', value: '\u00a0' },
    { type: 'currency', value: 'BAD' },
  ]);

  s = formatCurrencyToParts(api, '12345.234', 'BAD', { group: true });
  expect(s).toEqual([
    { type: 'integer', value: '12' },
    { type: 'group', value: ',' },
    { type: 'integer', value: '345' },
    { type: 'decimal', value: '.' },
    { type: 'fraction', value: '23' },
    { type: 'spacer', value: '\u00a0' },
    { type: 'currency', value: 'BAD' },
  ]);
});

// TODO: should unknown currency throw error or return empty
// test('currency parts unknown', () => {
//   const opts: CurrencyFormatOptions = { style: 'symbol', group: true };
//   let engine = new NumbersApiImpl(INTERNAL, EN);
//   let actual: Part[];

//   actual = engine.formatCurrencyParts('12345.234', 'XXQ' as CurrencyType, opts);
//   expect(actual).toEqual([]);
// });

test('currency symbols', () => {
  const api = numbersApi('en');

  let s = getCurrencySymbol(api, 'USD');
  expect(s).toEqual('$');

  s = getCurrencySymbol(api, 'USD', 'narrow');
  expect(s).toEqual('$');

  s = getCurrencySymbol(api, 'AUD');
  expect(s).toEqual('A$');

  s = getCurrencySymbol(api, 'AUD', 'narrow');
  expect(s).toEqual('$');

  s = getCurrencySymbol(api, 'BAD');
  expect(s).toEqual('BAD');

  s = getCurrencySymbol(api, 'BAD', 'narrow');
  expect(s).toEqual('BAD');

  s = getCurrencySymbol(api, 'UNKNOWN' as CurrencyType);
  expect(s).toEqual('');
});

test('currency display names', () => {
  let api = numbersApi('en');
  let s: string;

  s = getCurrencyDisplayName(api, 'USD');
  expect(s).toEqual('US Dollar');

  s = getCurrencyDisplayName(api, 'USD', {});
  expect(s).toEqual('US Dollar');

  api = numbersApi('en-GB');
  s = getCurrencyDisplayName(api, 'USD');
  expect(s).toEqual('US Dollar');

  api = numbersApi('es');
  s = getCurrencyDisplayName(api, 'USD');
  expect(s).toEqual('Dólar estadounidense');

  s = getCurrencyDisplayName(api, 'USD', { context: 'middle-of-text' });
  expect(s).toEqual('dólar estadounidense');

  api = numbersApi('fr');
  s = getCurrencyDisplayName(api, 'USD');
  expect(s).toEqual('Dollar des États-Unis');

  s = getCurrencyDisplayName(api, 'USD', { context: 'middle-of-text' });
  expect(s).toEqual('dollar des États-Unis');

  s = getCurrencyDisplayName(api, 'USD', { context: 'invalid' as ContextType });
  expect(s).toEqual('dollar des États-Unis');
});

test('currency plural names', () => {
  let api = numbersApi('en');
  let s: string;

  s = getCurrencyPluralName(api, '0', 'USD');
  expect(s).toEqual('US dollars');

  s = getCurrencyPluralName(api, '1', 'USD');
  expect(s).toEqual('US dollar');

  s = getCurrencyPluralName(api, '1.1', 'USD');
  expect(s).toEqual('US dollars');

  s = getCurrencyPluralName(api, '2', 'USD');
  expect(s).toEqual('US dollars');

  api = numbersApi('es');
  s = getCurrencyPluralName(api, '1', 'USD');
  expect(s).toEqual('Dólar estadounidense');

  s = getCurrencyPluralName(api, '2', 'USD');
  expect(s).toEqual('Dólares estadounidenses');

  s = getCurrencyPluralName(api, '2', 'USD', { context: 'middle-of-text' });
  expect(s).toEqual('dólares estadounidenses');

  api = numbersApi('fr');
  s = getCurrencyPluralName(api, '0', 'USD');
  expect(s).toEqual('Dollar des États-Unis');

  s = getCurrencyPluralName(api, '1', 'USD');
  expect(s).toEqual('Dollar des États-Unis');

  s = getCurrencyPluralName(api, '2', 'USD');
  expect(s).toEqual('Dollars des États-Unis');

  s = getCurrencyPluralName(api, '2', 'USD', { context: 'middle-of-text' });
  expect(s).toEqual('dollars des États-Unis');
});

test('currency special decimal', () => {
  let api = numbersApi('pt-PT');

  // Special decimal for the PTE currency in pt-PT
  let s = formatCurrency(api, 1, 'PTE');
  expect(s).toEqual('1$00\xa0\u200b');

  const p = formatCurrencyToParts(api, 1, 'PTE');
  expect(p).toEqual([
    { type: 'integer', value: '1' },
    { type: 'decimal', value: '$' },
    { type: 'fraction', value: '00' },
    { type: 'literal', value: '\xa0' },
    { type: 'currency', value: '\u200b' },
  ]);

  s = formatCurrency(api, 100.5, 'PTE');
  expect(s).toEqual('100$50\xa0\u200b');

  s = formatCurrency(api, 10689.5, 'PTE', { group: true });
  expect(s).toEqual('10\xa0689$50\xa0\u200b');

  api = numbersApi('pt-CV');
  s = formatCurrency(api, 100.5, 'CVE');
  expect(s).toEqual('100$50\xa0\u200b');

  // fr-CH different decimal for currency values
  api = numbersApi('fr-CH');
  s = formatDecimal(api, 100.5);
  expect(s).toEqual('100,5');

  s = formatCurrency(api, 100.5, 'CHF');
  expect(s).toEqual('100.50\xa0CHF');
});

test('currency non-latn', () => {
  const api = numbersApi('km');
  let s: string;

  s = formatCurrency(api, '123456789', 'USD', { style: 'name' });
  expect(s).toEqual('123,456,789.00 ដុល្លារ​អាមេរិក');

  s = formatCurrency(api, '123456789', 'USD', { style: 'code', nu: 'deva' });
  expect(s).toEqual('१२३,४५६,७८९.०० USD');
});
