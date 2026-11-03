/// <reference path="../../utils/typings.d.ts" />

import type { Suite } from 'benchmark';
import { calendarsApi } from '../../../__tests__/core/_helpers';
import type { RelativeTimeFormatOptions } from '../../../src/core';
import {
  type DateFormatOptions,
  dateAdd,
  dateUnixEpoch,
  formatDate,
  formatRelativeTime,
  gregorianDateFromUnixEpoch,
  type LocaleData,
  type TimePeriod,
} from '../../../src/core';
import { makeSuite } from '../../utils/util';

const BUNDLES: { [x: string]: LocaleData } = {
  en: calendarsApi('en'),
  es: calendarsApi('es'),
};

export const gregorianSuite: Suite = makeSuite('GregorianDate');
export const formatDateSuite: Suite = makeSuite('Calendars.formatDate');

const ZONES = [undefined, 'UTC', 'America/New_York', 'Europe/London'];

const EPOCHS = [
  // Mar 10 2018
  1520693966000,
  // Gregorian Oct 15 1582
  // -12219256128000,
  // Battle of Hastings, Oct 14 1066
  -28502718528000,
  // Fire of London, Sep 2 1666
  // -9572087379000,
  // Magna Carta, Jun 15 1215
  -23811152979000,
];

const DATES = [
  gregorianDateFromUnixEpoch(952761625000, 'UTC', 1, 1),
  gregorianDateFromUnixEpoch(969019200000, 'UTC', 1, 1),
  gregorianDateFromUnixEpoch(967809600000, 'UTC', 1, 1),
];

const INCR: Partial<TimePeriod>[] = [
  { day: 10, hour: 7 },
  { month: -3, day: -3 },
  { year: 0.5, month: 3, day: 82 },
];

ZONES.forEach((z) => {
  EPOCHS.forEach((e) => {
    gregorianSuite.add(`construct ${e} ${z}`, () => {
      gregorianDateFromUnixEpoch(e, z as string, 1, 1);
    });
  });
});

Object.keys(BUNDLES).forEach((k) => {
  ZONES.forEach((z) => {
    EPOCHS.forEach((e) => {
      const opts: DateFormatOptions = { datetime: 'full' };
      const engine = BUNDLES[k];
      const date = { date: e, zoneId: z };
      formatDate(engine, date, opts);
      formatDateSuite.add(`format ${k} ${e} ${z}`, () => {
        formatDate(engine, date, opts);
      });
    });
  });
  DATES.forEach((d) => {
    INCR.forEach((i) => {
      const opts: RelativeTimeFormatOptions = { dayOfWeek: true };
      const engine = BUNDLES[k];
      formatDateSuite.add(`relative time ${k} ${dateUnixEpoch(d)} ${JSON.stringify(i)}`, () => {
        formatRelativeTime(engine, d, dateAdd(d, i), opts);
      });
    });
  });
});
