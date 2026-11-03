import { type Decimal, decimal, decimalToString, rationalToString } from '@phensley/decimal';
import {
  ACCELERATION,
  ANGLE,
  convertUnits,
  createUnitConverter,
  LENGTH,
  type UnitConversion,
  unitConverterAdd,
  unitConverterCategories,
  unitConverterFactors,
  unitConverterGet,
  unitConverterHas,
  unitFactors,
} from '../src';

test('converter', () => {
  let c = createUnitConverter();
  let f: UnitConversion | undefined;
  let v: Decimal | undefined;

  const angle = unitFactors(ANGLE);
  c = unitConverterAdd(c, 'angle', angle);

  expect(unitConverterHas(c, 'angle')).toBe(true);
  expect(unitConverterHas(c, 'acceleration')).toBe(false);

  expect(() => unitConverterAdd(c, 'angle', angle)).toThrowError();

  c = unitConverterAdd(c, 'acceleration', unitFactors(ACCELERATION));
  expect(unitConverterHas(c, 'acceleration')).toBe(true);

  expect(unitConverterFactors(c, 'angle')).toBe(angle);

  c = unitConverterAdd(c, 'length', unitFactors(LENGTH));
  expect(unitConverterCategories(c)).toEqual(['acceleration', 'angle', 'length']);

  f = unitConverterGet(c, 'angle', 'revolution', 'arc-minute')!;
  // Direct edge from the CLDR star table (1 revolution = 21600 arc-minutes)
  expect(f.path).toEqual(['revolution', 'arc-minute']);
  expect(f.factors.map((x) => rationalToString(x))).toEqual(['21600 / 1']);

  f = unitConverterGet(c, 'angle', 'unknown', 'arc-minute');
  expect(f).toBe(undefined);

  f = unitConverterGet(c, 'unknown', 'arc-second', 'arc-minute');
  expect(f).toBe(undefined);

  v = convertUnits(c, 'angle', decimal(3), 'revolution', 'arc-minute')!;
  expect(decimalToString(v)).toEqual('64800');

  v = convertUnits(c, 'angle', decimal(3), 'revolution', 'unknown');
  expect(v).toBe(undefined);
});

test('constructor', () => {
  let c = createUnitConverter();
  c = unitConverterAdd(c, 'angle', unitFactors(ANGLE));
  c = unitConverterAdd(c, 'angle-2', unitFactors(ANGLE));
  expect(unitConverterHas(c, 'angle')).toEqual(true);
  expect(unitConverterGet(c, 'angle', 'degree', 'arc-minute')!.path).toEqual([
    'degree',
    'arc-minute',
  ]);
  expect(unitConverterGet(c, 'angle-2', 'degree', 'arc-minute')!.path).toEqual([
    'degree',
    'arc-minute',
  ]);
});

test('immutable add and initial categories', () => {
  const empty = createUnitConverter();
  const angle = unitFactors(ANGLE);
  const c = unitConverterAdd(empty, 'angle', angle);
  // the original converter is unchanged
  expect(unitConverterCategories(empty)).toEqual([]);
  expect(unitConverterHas(empty, 'angle')).toBe(false);
  expect(unitConverterCategories(c)).toEqual(['angle']);

  const d = createUnitConverter({ length: unitFactors(LENGTH), angle });
  expect(unitConverterCategories(d)).toEqual(['angle', 'length']);
  expect(unitConverterFactors(d, 'angle')).toBe(angle);
});
