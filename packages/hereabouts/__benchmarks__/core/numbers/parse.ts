/// <reference path="../../utils/typings.d.ts" />

import { join } from 'path';
import { decimal } from '../../../src/decimal';
import { makeSuite, readLines } from '../../utils/util';

export const numberParseSuite = makeSuite('Number Parse');

const CASES = readLines(join(__dirname, './numbers.txt'));

CASES.forEach((n) => {
  numberParseSuite.add(`parse ${n}`, () => {
    decimal(n);
  });
});
