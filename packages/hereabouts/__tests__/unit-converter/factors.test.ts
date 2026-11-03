import {
  decimal,
  decimalToString,
  rational,
  rationalCompare,
  rationalMultiply,
  rationalToString,
} from '../../src/decimal';
import type { UnitType } from '../../src/types';
import {
  ANGLE,
  AREA,
  convertUnits,
  createUnitConverter,
  DURATION,
  type FactorDef,
  type UnitConversion,
  unitConverterAdd,
  unitFactors,
  unitFactorsGet,
} from '../../src/unit-converter';

test('factors', () => {
  const factors: FactorDef[] = [['g-force', '9.80665', 'meter-per-square-second']];
  const map = unitFactors(factors);
  let c: UnitConversion;

  const f = (e: UnitConversion) => e.factors.map((x) => rationalToString(x));

  c = unitFactorsGet(map, 'g-force', 'meter-per-square-second')!;
  expect(f(c)).toEqual(['9.80665 / 1']);

  c = unitFactorsGet(map, 'meter-per-square-second', 'g-force')!;
  expect(f(c)).toEqual(['1 / 9.80665']);
});

test('angle', () => {
  const map = unitFactors(ANGLE);
  let c: UnitConversion;

  const f = (e: UnitConversion) => e.factors.map((x) => rationalToString(x));

  c = unitFactorsGet(map, 'arc-second', 'arc-minute')!;
  expect(f(c)).toEqual(['1 / 60']);

  c = unitFactorsGet(map, 'arc-minute', 'arc-second')!;
  expect(f(c)).toEqual(['60 / 1']);

  c = unitFactorsGet(map, 'arc-second', 'degree')!;
  expect(f(c)).toEqual(['1 / 60', '1 / 60']);

  c = unitFactorsGet(map, 'degree', 'arc-second')!;
  expect(f(c)).toEqual(['60 / 1', '60 / 1']);
});

test('area', () => {
  const map = unitFactors(AREA);
  let c: UnitConversion;

  const f = (e: UnitConversion) => e.factors.map((x) => rationalToString(x));

  c = unitFactorsGet(map, 'acre', 'square-foot')!;
  expect(f(c)).toEqual(['43560 / 1']);

  c = unitFactorsGet(map, 'acre', 'square-inch')!;
  expect(f(c)).toEqual(['43560 / 1', '144 / 1']);

  c = unitFactorsGet(map, 'square-inch', 'acre')!;
  expect(f(c)).toEqual(['1 / 144', '1 / 43560']);

  // Caching coverage
  c = unitFactorsGet(map, 'acre', 'square-foot')!;
  expect(f(c)).toEqual(['43560 / 1']);

  c = unitFactorsGet(map, 'acre', 'square-foot')!;
  expect(f(c)).toEqual(['43560 / 1']);
});

test('rational factors', () => {
  let c: UnitConversion;
  const map = unitFactors([['foo' as UnitType, rational('2 / 1'), 'bar' as UnitType]]);

  c = unitFactorsGet(map, 'foo', 'bar')!;
  expect(c.path).toEqual(['foo', 'bar']);
  expect(c.factors.length).toEqual(1);
  expect(rationalToString(c.factors[0])).toEqual('2 / 1');
});

test('duration century is 100 years (CLDR 48.2.0 convertUnits: century = 100 year)', () => {
  const map = unitFactors(DURATION);
  const c = unitFactorsGet(map, 'century', 'year')!;
  const fac = c.factors.reduce((p, x) => rationalMultiply(p, x), rational(1));
  expect(rationalCompare(fac, '100 / 1')).toEqual(0);

  let conv = createUnitConverter();
  conv = unitConverterAdd(conv, 'duration', unitFactors(DURATION));
  expect(decimalToString(convertUnits(conv, 'duration', decimal(1), 'century', 'second')!)).toEqual(
    '3155695200',
  );
  expect(decimalToString(convertUnits(conv, 'duration', decimal(1), 'century', 'year')!)).toEqual(
    '100',
  );
  expect(decimalToString(convertUnits(conv, 'duration', decimal(1), 'year', 'second')!)).toEqual(
    '31556952',
  );
});
