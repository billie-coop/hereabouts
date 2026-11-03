/// <reference path="../../utils/typings.d.ts" />

import { join } from 'path';
import { decimal, decimalToString } from '../../../src/decimal';
import { makeSuite, readLines } from '../../utils/util';

export const numberFormatSuite = makeSuite('Number Format');

const CASES = readLines(join(__dirname, './numbers.txt'));

CASES.forEach((n) => {
  const parsed = decimal(n);
  numberFormatSuite.add(`format ${n}`, () => {
    decimalToString(parsed);
  });
});
