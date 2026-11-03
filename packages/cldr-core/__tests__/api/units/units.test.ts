import type { Part } from '@phensley/decimal';
import {
  availableUnits,
  fieldGet,
  formatQuantity,
  formatQuantitySequence,
  formatQuantitySequenceToParts,
  formatQuantityToParts,
  getUnitDisplayName,
  type Quantity,
  type UnitFormatOptions,
  vectorGet,
} from '../../../src';
import { languageBundle, unitsApi } from '../../_helpers';

test('available units', () => {
  const api = unitsApi('en');

  expect(availableUnits(api)).toContain('light-year');
  expect(availableUnits(api)).toContain('kilogram');
  expect(availableUnits(api)).toContain('terabyte');

  // Added in cldr v35
  expect(availableUnits(api)).toContain('solar-radius');
  expect(availableUnits(api)).toContain('permyriad');
  expect(availableUnits(api)).toContain('british-thermal-unit');
  expect(availableUnits(api)).toContain('newton-meter');
});

test('cldr v35 units', () => {
  const api = unitsApi('en');
  let s: string;

  const q: Quantity = { value: 10.7599, unit: 'permyriad' };
  s = formatQuantity(api, q, { length: 'long' });
  expect(s).toEqual('10.76 permyriad');

  s = formatQuantity(api, q, { length: 'narrow' });
  expect(s).toEqual('10.76‱');

  q.unit = 'british-thermal-unit';

  s = formatQuantity(api, q, { length: 'long' });
  expect(s).toEqual('10.76 British thermal units');

  s = formatQuantity(api, q, { length: 'narrow' });
  expect(s).toEqual('10.76Btu');
});

test('cldr v36 units', () => {
  const api = unitsApi('en');
  let s: string;

  // decade
  const q: Quantity = { value: 8.9, unit: 'decade' };
  s = formatQuantity(api, q, { length: 'long' });
  expect(s).toEqual('8.9 decades');

  q.value = 1;
  s = formatQuantity(api, q);
  expect(s).toEqual('1 decade');

  // dot-per-inch
  q.value = 8.9;
  q.unit = 'dot-per-inch';
  s = formatQuantity(api, q);
  expect(s).toEqual('8.9 dots per inch');
  s = formatQuantity(api, q, { length: 'short' });
  expect(s).toEqual('8.9 dpi');

  q.value = 1;
  s = formatQuantity(api, q);
  expect(s).toEqual('1 dot per inch');
  s = formatQuantity(api, q, { length: 'narrow' });
  expect(s).toEqual('1dpi');
});

test('generic temperature', () => {
  const api = unitsApi('en');
  let s: string;

  const q: Quantity = { value: 8.9, unit: 'temperature' };
  s = formatQuantity(api, q, { length: 'long' });
  expect(s).toEqual('8.9 degrees temperature');

  s = formatQuantity(api, q, { length: 'short' });
  expect(s).toEqual('8.9°');
});

test('pattern fallback to other', () => {
  const api = unitsApi('de');
  let s: string;

  const q: Quantity = { value: 1, unit: 'kilogram' };
  s = formatQuantity(api, q, { style: 'long', length: 'short' });
  expect(s).toEqual('1 kg');
});

test('display name', () => {
  const api = unitsApi('en');

  expect(getUnitDisplayName(api, 'g-force')).toEqual('g-force');
  expect(getUnitDisplayName(api, 'meter-per-second')).toEqual('meters per second');
});

test('per unit pattern schema', () => {
  const en = languageBundle('en');
  const units = en.schema.Units;

  let p = vectorGet(units.long.perUnitPattern, en, 'kilogram');
  expect(p).toEqual('{0} per kilogram');

  p = fieldGet(units.long.perPattern, en);
  expect(p).toEqual('{0} per {1}');

  p = fieldGet(units.long.timesPattern, en);
  expect(p).toEqual('{0}-{1}');
});

test('per unit', () => {
  const api = unitsApi('en');
  let s: string;

  s = formatQuantity(api, { value: '12345.6789', unit: 'kilogram', per: 'second' });
  expect(s).toEqual('12,345.679 kilograms per second');

  s = formatQuantity(api, { value: '17.9887', unit: 'terabit', per: 'minute' });
  expect(s).toEqual('17.989 terabits per minute');

  s = formatQuantity(
    api,
    { value: '17.9887', unit: 'terabit', per: 'minute' },
    { length: 'narrow' },
  );
  expect(s).toEqual('17.989Tb/min');

  s = formatQuantity(api, { value: '30.7899', unit: 'kilogram', per: 'lux' });
  expect(s).toEqual('30.79 kilograms per lux');
});

test('times unit', () => {
  const api = unitsApi('en');
  let s: string;

  s = formatQuantity(api, { value: '1', unit: 'newton', times: 'meter' });
  expect(s).toEqual('1 newton-meter');

  s = formatQuantity(api, { value: '123', unit: 'newton', times: 'meter' });
  expect(s).toEqual('123 newton-meters');

  s = formatQuantity(api, { value: '1', unit: 'foot', times: 'pound' });
  expect(s).toEqual('1 foot-pound');

  s = formatQuantity(api, { value: '123', unit: 'foot', times: 'pound' });
  expect(s).toEqual('123 foot-pounds');

  s = formatQuantity(api, { value: '1', unit: 'meter', times: 'kilogram' });
  expect(s).toEqual('1 meter-kilogram');

  s = formatQuantity(api, { value: '123', unit: 'meter', times: 'kilogram' });
  expect(s).toEqual('123 meter-kilograms');
});

test('v38 units', () => {
  const api = unitsApi('en');
  let q: Quantity;
  let opts: UnitFormatOptions;
  let s: string;

  q = { value: '23.7', unit: 'earth-radius' };
  s = formatQuantity(api, q);
  expect(s).toEqual('23.7 earth radius');

  opts = { length: 'short' };
  s = formatQuantity(api, q, opts);
  expect(s).toEqual('23.7 R⊕');

  q = { value: '1', unit: 'dessert-spoon' };
  s = formatQuantity(api, q);
  expect(s).toEqual('1 dessert spoon');

  q.value = '5';
  s = formatQuantity(api, q);
  expect(s).toEqual('5 dessert spoons');

  q.value = '12.5';
  s = formatQuantity(api, q);
  expect(s).toEqual('12.5 dessert spoons');

  opts = { length: 'short' };
  s = formatQuantity(api, q, opts);
  expect(s).toEqual('12.5 dsp');
});

test('v39 units', () => {
  const api = unitsApi('en');
  let q: Quantity;
  let opts: UnitFormatOptions;
  let s: string;

  q = { value: '1', unit: 'milligram-ofglucose-per-deciliter' };
  s = formatQuantity(api, q);
  expect(s).toEqual('1 milligram per deciliter');

  q.value = '12.5';
  s = formatQuantity(api, q);
  expect(s).toEqual('12.5 milligrams per deciliter');

  opts = { length: 'short' };
  s = formatQuantity(api, q, opts);
  expect(s).toEqual('12.5 mg/dL');
});

test('v42 units', () => {
  const api = unitsApi('en');

  let q: Quantity;
  let opts: UnitFormatOptions;
  let s: string;

  q = { value: '1', unit: 'tonne' };
  s = formatQuantity(api, q);
  expect(s).toEqual('1 metric ton');

  opts = { length: 'short' };
  s = formatQuantity(api, q, opts);
  expect(s).toEqual('1 t');

  q = { value: '12.5', unit: 'ton' };
  s = formatQuantity(api, q);
  expect(s).toEqual('12.5 tons');

  opts = { length: 'short' };
  s = formatQuantity(api, q, opts);
  expect(s).toEqual('12.5 tn');
});

test('significant', () => {
  const api = unitsApi('en');
  let s: string;

  s = formatQuantity(api, { value: '12345.6789', unit: 'mile' }, { maximumSignificantDigits: 3 });
  expect(s).toEqual('12,300 miles');
});

test('negative zero', () => {
  const api = unitsApi('en');
  let s: string;

  s = formatQuantity(api, { value: '-0', unit: 'mile' });
  expect(s).toEqual('0 miles');
});

test('number systems', () => {
  let api = unitsApi('ar');
  let s: string;

  s = formatQuantity(api, { value: '123', unit: 'meter' });
  expect(s).toEqual('١٢٣ مترًا');

  s = formatQuantity(api, { value: '123', unit: 'meter' }, { nu: 'latn' });
  expect(s).toEqual('123 مترًا');

  api = unitsApi('zh');

  s = formatQuantity(api, { value: '123', unit: 'meter' }, { nu: 'native' });
  expect(s).toEqual('一二三米');

  s = formatQuantity(api, { value: '12345', unit: 'kilometer' }, { group: true, nu: 'native' });
  expect(s).toEqual('一二,三四五公里');

  s = formatQuantity(api, { value: '123', unit: 'meter' });
  expect(s).toEqual('123米');

  s = formatQuantity(api, { value: '123', unit: 'meter' }, { nu: 'latn' });
  expect(s).toEqual('123米');

  s = formatQuantity(api, { value: '12345', unit: 'kilometer' }, { group: true, nu: 'latn' });
  expect(s).toEqual('12,345公里');
});

test('format string', () => {
  const api = unitsApi('en');
  let s: string;

  s = formatQuantity(api, { value: '123', unit: 'meter' });
  expect(s).toEqual('123 meters');

  s = formatQuantity(
    api,
    { value: '12345', unit: 'meter' },
    { style: 'long', minimumFractionDigits: 1 },
  );
  expect(s).toEqual('12.3 thousand meters');

  s = formatQuantity(api, { value: '1', unit: 'pound' }, { style: 'long' });
  expect(s).toEqual('1 pound');

  s = formatQuantity(
    api,
    { value: '1', unit: 'pound' },
    { style: 'long', minimumFractionDigits: 1 },
  );
  expect(s).toEqual('1.0 pounds');

  s = formatQuantity(
    api,
    { value: '12345000', unit: 'pound' },
    { length: 'short', style: 'short', minimumFractionDigits: 1 },
  );
  expect(s).toEqual('12.3M lb');
});

test('unit lengths', () => {
  const api = unitsApi('en');
  let s: string;

  const q: Quantity = { value: '1', unit: 'meter' };

  s = formatQuantity(api, q);
  expect(s).toEqual('1 meter');

  s = formatQuantity(api, q, { length: 'long' });
  expect(s).toEqual('1 meter');

  s = formatQuantity(api, q, { length: 'short' });
  expect(s).toEqual('1 m');

  s = formatQuantity(api, q, { length: 'narrow' });
  expect(s).toEqual('1m');
});

test('no unit', () => {
  const api = unitsApi('en');
  let s: string;
  let q: Quantity;

  q = { value: '1' };
  s = formatQuantity(api, q, { length: 'long', minimumFractionDigits: 2 });
  expect(s).toEqual('1.00');
});

test('format parts', () => {
  const api = unitsApi('en');
  let p: Part[];

  p = formatQuantityToParts(api, { value: '123', unit: 'meter' });
  expect(p).toEqual([
    { type: 'integer', value: '123' },
    { type: 'literal', value: ' meters' },
  ]);

  p = formatQuantityToParts(api, { value: '123', unit: 'meter', per: 'hour' });
  expect(p).toEqual([
    { type: 'integer', value: '123' },
    { type: 'literal', value: ' meters' },
    { type: 'literal', value: ' per hour' },
  ]);

  p = formatQuantityToParts(
    api,
    { value: '123', unit: 'meter', per: 'hour' },
    { length: 'narrow' },
  );
  expect(p).toEqual([
    { type: 'integer', value: '123' },
    { type: 'literal', value: 'm' },
    { type: 'literal', value: '/h' },
  ]);

  p = formatQuantityToParts(
    api,
    { value: '12345000', unit: 'pound' },
    { length: 'short', style: 'short', minimumFractionDigits: 1 },
  );
  expect(p).toEqual([
    { type: 'integer', value: '12' },
    { type: 'decimal', value: '.' },
    { type: 'fraction', value: '3' },
    { type: 'literal', value: 'M' },
    { type: 'literal', value: ' lb' },
  ]);
});

test('format sequence string', () => {
  const api = unitsApi('en');
  let s: string;
  let u: Quantity[];

  u = [
    { value: '123', unit: 'meter' },
    { value: '17.2', unit: 'centimeter' },
  ];
  s = formatQuantitySequence(api, u);
  expect(s).toEqual('123 meters, 17.2 centimeters');

  s = formatQuantitySequence(api, u, { length: 'short' });
  expect(s).toEqual('123 m, 17.2 cm');

  s = formatQuantitySequence(api, u, { length: 'narrow' });
  expect(s).toEqual('123m 17.2cm');

  u = [
    { value: '312', unit: 'degree' },
    { value: '1', unit: 'arc-minute' },
    { value: '17', unit: 'arc-second' },
  ];

  s = formatQuantitySequence(api, u);
  expect(s).toEqual('312 degrees, 1 arcminute, 17 arcseconds');

  s = formatQuantitySequence(api, u, { length: 'short' });
  expect(s).toEqual('312 deg, 1 arcmin, 17 arcsecs');

  s = formatQuantitySequence(api, u, { length: 'narrow' });
  expect(s).toEqual('312° 1′ 17″');

  u = [
    { value: '312', unit: 'foot' },
    { value: '59', unit: 'inch' },
  ];
  s = formatQuantitySequence(api, u);
  expect(s).toEqual('312 feet, 59 inches');

  s = formatQuantitySequence(api, u, { length: 'short' });
  expect(s).toEqual('312 ft, 59 in');

  s = formatQuantitySequence(api, u, { length: 'narrow' });
  expect(s).toEqual('312′ 59″');
});

test('format sequence parts', () => {
  const api = unitsApi('en');
  let p: Part[];
  let u: Quantity[];

  u = [
    { value: '123', unit: 'meter' },
    { value: '17.2', unit: 'centimeter' },
  ];
  p = formatQuantitySequenceToParts(api, u);
  expect(p).toEqual([
    { type: 'integer', value: '123' },
    { type: 'literal', value: ' meters' },
    { type: 'literal', value: ', ' },
    { type: 'integer', value: '17' },
    { type: 'decimal', value: '.' },
    { type: 'fraction', value: '2' },
    { type: 'literal', value: ' centimeters' },
  ]);

  u = [
    { value: '312', unit: 'foot' },
    { value: '59', unit: 'inch' },
  ];
  p = formatQuantitySequenceToParts(api, u, { length: 'narrow' });
  expect(p).toEqual([
    { type: 'integer', value: '312' },
    { type: 'literal', value: '′' },
    { type: 'literal', value: ' ' },
    { type: 'integer', value: '59' },
    { type: 'literal', value: '″' },
  ]);
});
