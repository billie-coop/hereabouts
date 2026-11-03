import {
  formatCurrency,
  formatDecimal,
  formatDecimalToParts,
  formatQuantity,
  formatQuantityToParts,
  type LocaleData,
  type Part,
} from '../../../../src/core';
import { numbersApi, unitsApi } from '../../_helpers';

test('numbers defaulting', () => {
  let api: LocaleData;
  let s: string;
  let p: Part[];

  api = numbersApi('en-u-nu-fullwide');

  s = formatDecimal(api, '123.45', {});
  expect(s).toEqual('１２３.４５');

  s = formatDecimal(api, '123.45', { nu: 'fullwide' });
  expect(s).toEqual('１２３.４５');

  s = formatDecimal(api, '123.45', { nu: 'arab' });
  expect(s).toEqual('١٢٣.٤٥');

  s = formatDecimal(api, '123.45', { nu: 'mathmono' });
  expect(s).toEqual('𝟷𝟸𝟹.𝟺𝟻');

  s = formatDecimal(api, '123.45', { nu: 'mathsans' });
  expect(s).toEqual('𝟣𝟤𝟥.𝟦𝟧');

  s = formatDecimal(api, '123.45678', { style: 'percent', nu: 'mathsans' });
  expect(s).toEqual('𝟣𝟤,𝟥𝟦𝟨%');

  s = formatDecimal(api, '12345.678', { style: 'short', nu: 'mathsans' });
  expect(s).toEqual('𝟣𝟤K');

  s = formatCurrency(api, '123.45', 'USD', {});
  expect(s).toEqual('$１２３.４５');

  s = formatCurrency(api, '12345', 'USD', { style: 'code' });
  expect(s).toEqual('１２,３４５.００ USD');

  s = formatCurrency(api, '12345', 'USD', { style: 'name' });
  expect(s).toEqual('１２,３４５.００ US dollars');

  s = formatCurrency(api, '12345', 'USD', { style: 'short' });
  expect(s).toEqual('$１２K');

  s = formatCurrency(api, '-12345', 'USD', { style: 'accounting' });
  expect(s).toEqual('($１２,３４５.００)');

  s = formatDecimal(api, '123.45', { nu: 'arab', style: 'long' });
  expect(s).toEqual('١٢٣');

  s = formatDecimal(api, '123.45', { nu: 'arab', style: 'percent' });
  expect(s).toEqual('١٢,٣٤٥%');

  s = formatDecimal(api, '1234567', { nu: 'arab', style: 'long' });
  expect(s).toEqual('١.٢ million');

  s = formatDecimal(api, '1234567', { nu: 'arab', style: 'short' });
  expect(s).toEqual('١.٢M');

  s = formatDecimal(api, '1234567', { nu: 'arab', style: 'decimal', group: true });
  expect(s).toEqual('١,٢٣٤,٥٦٧');

  s = formatCurrency(api, '12345', 'USD', { style: 'code', nu: 'arab' });
  expect(s).toEqual('١٢,٣٤٥.٠٠ USD');

  s = formatCurrency(api, '12345', 'USD', { style: 'name', nu: 'arab' });
  expect(s).toEqual('١٢,٣٤٥.٠٠ US dollars');

  s = formatCurrency(api, '12345', 'USD', { style: 'short', nu: 'arab' });
  expect(s).toEqual('١٢,٣٤٥');

  s = formatCurrency(api, '12345', 'USD', { style: 'symbol', nu: 'arab' });
  expect(s).toEqual('$١٢,٣٤٥.٠٠');

  s = formatCurrency(api, '-12345', 'USD', { style: 'accounting', nu: 'arab' });
  expect(s).toEqual('($١٢,٣٤٥.٠٠)');

  api = numbersApi('en-u-nu-orya');

  s = formatDecimal(api, '123.45', {});
  expect(s).toEqual('୧୨୩.୪୫');

  p = formatDecimalToParts(api, '123.45', {});
  expect(p).toEqual([
    { type: 'integer', value: '୧୨୩' },
    { type: 'decimal', value: '.' },
    { type: 'fraction', value: '୪୫' },
  ]);
});

test('units defaulting', () => {
  let api: LocaleData;
  let s: string;
  let p: Part[];

  api = unitsApi('en-u-nu-fullwide');
  s = formatQuantity(api, { value: '17.6789', unit: 'meter' });
  expect(s).toEqual('１７.６７９ meters');

  p = formatQuantityToParts(api, { value: '17.6789', unit: 'meter' });
  expect(p).toEqual([
    { type: 'integer', value: '１７' },
    { type: 'decimal', value: '.' },
    { type: 'fraction', value: '６７９' },
    { type: 'literal', value: ' meters' },
  ]);
});
