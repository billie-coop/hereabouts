import type { UnitType } from '../../src/types';
import { unitFactors, unitFactorsGet } from '../../src/unit-converter';

test('duplicate factors', () => {
  const factors = unitFactors([
    ['foo' as UnitType, '2', 'bar' as UnitType],
    ['foo' as UnitType, '2', 'bar' as UnitType],
  ]);
  const conv = unitFactorsGet(factors, 'foo', 'bar')!;
  expect(conv.path).toEqual(['foo', 'bar']);
});
