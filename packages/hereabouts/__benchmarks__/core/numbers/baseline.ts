/// <reference path="../../utils/typings.d.ts" />

import { join } from 'path';
import { decimal, decimalToString } from '../../../src/decimal';
import { makeSuite, readLines } from '../../utils/util';

export const numberFormatBaselineSuite = makeSuite('Number Format Baseline');

const CASES = readLines(join(__dirname, './numbers.txt'));

CASES.forEach((n) => {
  const parsed = decimal(n);
  const raw = decimalToString(parsed).split('').reverse();

  // Benchmark baseline for append / reverse / join
  numberFormatBaselineSuite.add(`baseline append ${n}`, () => {
    const r: string[] = [];
    for (const c of raw) {
      r.push(c);
    }
    r.reverse().join('');
  });
});
