/// <reference path="../../../cldr-utils/__benchmarks__/typings.d.ts" />

import { decimal, decimalToString } from '@phensley/decimal';
import { join } from 'path';
import { makeSuite, readLines } from '../../../cldr-utils/__benchmarks__/util';

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
