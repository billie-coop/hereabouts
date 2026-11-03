/// <reference path="../../../cldr-utils/__benchmarks__/typings.d.ts" />

import { decimal } from '@phensley/decimal';
import { join } from 'path';
import { makeSuite, readLines } from '../../../cldr-utils/__benchmarks__/util';

export const numberParseSuite = makeSuite('Number Parse');

const CASES = readLines(join(__dirname, './numbers.txt'));

CASES.forEach((n) => {
  numberParseSuite.add(`parse ${n}`, () => {
    decimal(n);
  });
});
