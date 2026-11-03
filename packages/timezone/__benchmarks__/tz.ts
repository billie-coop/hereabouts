/// <reference path="../../cldr-utils/__benchmarks__/typings.d.ts" />

import type { Suite } from 'benchmark';
import { tzFromUTC } from '../src';
import { makeSuite } from './util';

const asUTC = (d: number | Date) =>
  typeof d === 'number' ? d : +d - d.getTimezoneOffset() * 60000;

const DATES = [
  new Date(1000, 3, 1),
  new Date(1890, 3, 1),
  new Date(1962, 3, 1),
  new Date(1987, 3, 5),
  new Date(1998, 6, 11),
  new Date(),
];

const ZONES = ['UTC', 'America/New_York', 'Asia/Qyzylorda', 'Europe/Istanbul', 'Asia/Beijing'];

export const timezoneSuite: Suite = makeSuite('Timezone');

ZONES.forEach((zid) => {
  DATES.forEach((date) => {
    const utc = asUTC(date);
    timezoneSuite.add(`lookup ${zid} ${date.toUTCString()}`, () => {
      tzFromUTC(zid, utc);
    });
  });
});
