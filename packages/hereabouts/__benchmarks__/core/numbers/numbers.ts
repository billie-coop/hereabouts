/// <reference path="../../utils/typings.d.ts" />

import { numbersApi } from '../../../__tests__/core/_helpers';
import { type DecimalFormatStyleType, formatDecimal, type LocaleData } from '../../../src/core';
import { makeSuite } from '../../utils/util';

export const numberEngineSuite = makeSuite('Number Engine');

const CASES = ['1.2', '123.45', '12345.678', '69900.12', '9876543210.12345', '100000000000000'];

const STYLES: DecimalFormatStyleType[] = ['decimal', 'percent', 'short', 'long'];

const BUNDLES: { [x: string]: LocaleData } = {
  en: numbersApi('en'),
  es: numbersApi('es'),
};

Object.keys(BUNDLES).forEach((k) => {
  CASES.forEach((n) => {
    STYLES.forEach((style) => {
      const opts = { style: style, group: true };
      const engine = BUNDLES[k];
      let s = formatDecimal(engine, n, opts);
      numberEngineSuite.add(`engine ${k} format decimal ${style} ${n}: ${s}`, () => {
        s = formatDecimal(engine, n, opts);
      });
    });
  });
});
