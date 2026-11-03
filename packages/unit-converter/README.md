# @phensley/unit-converter

[![@phensley/unit-converter](https://badge.fury.io/js/%40phensley%2Flocale.svg)](https://www.npmjs.com/package/@phensley/unit-converter) [![min+gzip](https://badgen.net/bundlephobia/minzip/@phensley/unit-converter)](https://bundlephobia.com/result?p=@phensley/unit-converter)

General framework for converting between units. Includes pre-defined factors for conversion between CLDR units.

The converter is a plain immutable record: `unitConverterAdd` returns a new converter. Note that a `MathContext` passed to `convertUnits` also rounds the combined conversion factor, so results can differ in the last digit (`3 foot` below).

```typescript
import { MathContext, decimal, decimalToString, rationalToString } from '@phensley/decimal';
import { LENGTH, convertUnits, createUnitConverter, unitConverterGet, unitFactors } from '@phensley/unit-converter';

const converter = createUnitConverter({ length: unitFactors(LENGTH) });
const ctx: MathContext = { precision: 7 };
const dst = 'yard';
for (const unit of ['foot', 'mile']) {
  const conv = unitConverterGet(converter, 'length', unit, dst)!;
  const factors = conv.factors.map((f) => rationalToString(f)).join(' × ');
  for (const n of [1, 1.5, 2, 3, 10]) {
    const r = convertUnits(converter, 'length', decimal(n), unit, dst, ctx)!;
    const a = `${n} ${unit}`.padStart(10);
    const b = `${decimalToString(r)} ${dst}`.padEnd(16);
    console.log(`${a} == ${b} ${conv.path.join(' → ')}: ${factors}`);
  }
  console.log();
}
```

```
    1 foot == 0.3333333 yard   foot → inch → yard: 12 / 1 × 1 / 36
  1.5 foot == 0.5000000 yard   foot → inch → yard: 12 / 1 × 1 / 36
    2 foot == 0.6666666 yard   foot → inch → yard: 12 / 1 × 1 / 36
    3 foot == 0.9999999 yard   foot → inch → yard: 12 / 1 × 1 / 36
   10 foot == 3.333333 yard    foot → inch → yard: 12 / 1 × 1 / 36

    1 mile == 1760 yard        mile → meter → yard: 1609.344 / 1 × 1 / 0.9144
  1.5 mile == 2640 yard        mile → meter → yard: 1609.344 / 1 × 1 / 0.9144
    2 mile == 3520 yard        mile → meter → yard: 1609.344 / 1 × 1 / 0.9144
    3 mile == 5280 yard        mile → meter → yard: 1609.344 / 1 × 1 / 0.9144
   10 mile == 17600 yard       mile → meter → yard: 1609.344 / 1 × 1 / 0.9144
```
