/** Lists, names, layout, context transforms and the bound convenience API. */

import * as plainDays from '../../src/core/api/days';
import * as gen from '../../src/core/api/general';
import { getContextTransformInfo } from '../../src/core/api/private/api';
import { bindCLDR } from '../../src/core/cldr';
import type { ContextTransformInfo } from '../../src/core/common/private';
import {
  contextTransform,
  formatWrapper,
  parseWrapper,
} from '../../src/core/internals/general/internal';
import {
  type CalendarDate,
  dateFields,
  dateFirstDayOfWeek,
  dateMinDaysInFirstWeek,
  dateTimeZoneId,
  dateType,
  dateUnixEpoch,
} from '../../src/core/systems/calendars';
import { parseLanguageTag } from '../../src/language-tag';
import { createMessageFormatter, formatMessage } from '../../src/messageformat';
import { load, PACK_LANGUAGES } from './_core';
import { type ConformanceCase, collector, random } from './_shared';

export const cases = (): ConformanceCase[] => {
  const { cases, add } = collector();
  const rng = random(0x20261104);
  const types = [
    undefined,
    'and',
    'and-short',
    'or',
    'unit-long',
    'unit-narrow',
    'unit-short',
  ] as const;
  const contexts = [
    undefined,
    'begin-sentence',
    'middle-of-text',
    'standalone',
    'ui-list-or-menu',
  ] as const;
  const alts = ['none', 'short', 'narrow', 'variant', 'stand-alone', 'long', 'menu'] as const;
  const nameFunctions = {
    getLanguageDisplayName: gen.getLanguageDisplayName,
    getScriptDisplayName: gen.getScriptDisplayName,
    getRegionDisplayName: gen.getRegionDisplayName,
  };
  const names = {
    getLanguageDisplayName: [
      'en',
      'en-US',
      'en-GB',
      'en-GB-x-foo',
      'en_Zzzz_ZZ',
      'en-Zzzz-ZZ',
      'und-Zzzz-ZZ',
      'und',
      'root',
      '',
      'xx',
      'xx-Zzzz-TW',
      'es-419',
      'de-CH',
      'yue',
      'zh',
      'zh-Hans',
      'zh-Hant',
      'zh-Zzzz-CN',
      'zh-Zzzz-TW',
      'zh-CN',
      'zh-TW',
      'sr-Latn',
      'sr-Cyrl',
      'iw',
      'sh',
      'i-klingon',
    ],
    getScriptDisplayName: [
      'Latn',
      'Cyrl',
      'Hant',
      'Hans',
      'Arab',
      'Cans',
      'Zzzz',
      'Qaaa',
      'en-Zzzz',
      'und-Zzzz',
      'en',
      'zh-CN',
      'zh-TW',
      'und-Arab',
      '',
      'xx',
    ],
    getRegionDisplayName: [
      '001',
      'US',
      'GB',
      'DE',
      'CI',
      'HK',
      'MO',
      'PS',
      'FK',
      'ZZ',
      'XX',
      'und-US',
      'und-ZZ',
      'en-ZZ',
      'zh-Hant',
      'es-419',
      '',
      'xx',
    ],
  };
  for (const id of [
    ...PACK_LANGUAGES,
    'en-GB',
    'de-CH',
    'sr-Latn',
    'zh-Hant-TW',
    'ar-EG',
    'en-LR',
    'en-MM',
    'en-BS',
    'en-BZ',
    'es-PR',
    'en-PW',
  ]) {
    const data = load(id);
    add('characterOrder', [id], () => gen.characterOrder(data));
    add('lineOrder', [id], () => gen.lineOrder(data));
    for (const category of [undefined, 'temperature'] as const) {
      add('measurementSystem', [id, category ?? null], () => gen.measurementSystem(data, category));
    }
    add('getContextTransformInfo', [id], () => getContextTransformInfo(data));
    for (const type of types) {
      for (let len = 0; len <= 7; len++) {
        const items = ['A', '', '世界', 'ßeta', '😀', '{0}', "a'b"].slice(0, len);
        add('formatList', [id, items, type ?? null], () => gen.formatList(data, items, type));
        add('formatListToParts', [id, items, type ?? null], () =>
          gen.formatListToParts(data, items, type),
        );
      }
    }
    for (const fn of Object.keys(names) as (keyof typeof names)[]) {
      for (const code of names[fn]) {
        for (const isTag of [false, true]) {
          const options = { type: rng.pick(alts), context: rng.pick(contexts) };
          add(fn, [id, code, isTag, options], () =>
            nameFunctions[fn](data, isTag ? parseLanguageTag(code) : code, options),
          );
        }
      }
    }
    for (let i = 0; i < 12; i++) {
      const fn = rng.pick(Object.keys(names) as (keyof typeof names)[]);
      const code = rng.pick(names[fn]);
      const opts = { type: rng.pick(alts), context: rng.pick(contexts) };
      add(fn, [id, code, false, opts], () => nameFunctions[fn](data, code, opts));
    }
    for (const context of contexts) {
      for (const value of ['', 'abc', 'ßeta', 'éclair', 'ǳabc', '😀abc']) {
        const field = rng.pick([
          'languages',
          'script',
          'calendar-field',
          'currencyName',
          'missing',
        ]);
        add('contextTransformLocale', [id, value, context ?? null, field], () =>
          contextTransform(value, getContextTransformInfo(data), context, field as any),
        );
      }
    }
    const fmt = gen.messageFormatter(data);
    for (const n of [0, 1, 2, 3, 5, 11, 21, 100, 1.5]) {
      const message = '{0 plural =0 {none} one {# item} few {# few} many {# many} other {# items}}';
      add('messageFormatter', [id, message, n], () => formatMessage(fmt, message, [n], {}));
    }
    // Options' plural rules must be replaced by this locale's rules.
    const custom = gen.messageFormatter(data, {
      ...createMessageFormatter({ language: 'en' }),
      cacheSize: 3,
    });
    add('messageFormatterOptions', [id, '{0 plural one {one} other {other}}', 1], () =>
      formatMessage(custom, '{0 plural one {one} other {other}}', [1], {}),
    );
    const api = bindCLDR(data);
    add('bindCLDR', [id], () => ({
      characterOrder: api.General.characterOrder(),
      lineOrder: api.General.lineOrder(),
      list: api.General.formatList(['a', 'b', 'c']),
      language: api.General.getLanguageDisplayName('en-GB', { type: 'short' }),
      decimal: api.Numbers.formatDecimal('1234.5'),
      currency: api.Numbers.formatCurrency('19.95', 'USD'),
      quantity: api.Units.formatQuantity(
        { value: '17.69', unit: 'pound' },
        { maximumFractionDigits: 1 },
      ),
    }));
  }
  for (const flags of ['', 'NN', 'TN', 'NT', 'TT']) {
    for (const context of contexts) {
      for (const value of ['', 'abc', 'ßeta', 'éclair', '😀abc']) {
        add('contextTransform', [value, flags, context ?? null], () =>
          contextTransform(
            value,
            { languages: flags } as ContextTransformInfo,
            context,
            'languages',
          ),
        );
      }
    }
  }
  for (const pattern of [
    '{0} {1}',
    '{0} {1} {2} {3}',
    "'{0}' {1}",
    '{ }-{x}-{9}',
    '{0}{0}',
    'plain',
    '{12}',
    '{0',
    "a''b",
  ]) {
    add('parseWrapper', [pattern], () => parseWrapper(pattern));
    for (const args of [[], ['a', 'b'], ['a', '', 'c']]) {
      add('formatWrapper', [pattern, args], () => formatWrapper(pattern, args));
    }
  }
  calendarCases(add);
  return cases;
};

/** Exercise the bound group against the TypeScript convenience API and plain-day functions. */
const calendarCases = (add: ReturnType<typeof collector>['add']): void => {
  const epoch = 1109934428000;
  const zoneId = 'America/New_York';
  const day = { year: 2005, month: 3, day: 4 };
  const nextDay = { year: 2005, month: 3, day: 7 };
  const time = { hour: 6, minute: 7, second: 8, millis: 0 };
  const summarize = (d: CalendarDate) => ({
    type: dateType(d),
    fields: dateFields(d),
    epoch: dateUnixEpoch(d),
    firstDay: dateFirstDayOfWeek(d),
    minDays: dateMinDaysInFirstWeek(d),
  });
  for (const id of [
    'en',
    'en-GB',
    'de',
    'fr',
    'es',
    'ar',
    'fa',
    'ja',
    'ja-u-ca-japanese',
    'th',
    'zh-Hant',
  ]) {
    const data = load(id);
    const c = bindCLDR(data).Calendars;
    const start = { date: epoch, zoneId };
    const end = { date: epoch + 3 * 86400000, zoneId };
    const fields = { ...day, ...time, zoneId };
    add('boundCalendarRules', [id], () => [c.firstDayOfWeek(), c.minDaysInFirstWeek()]);
    const constructors = {
      toBuddhistDate: () => c.toBuddhistDate(start),
      toGregorianDate: () => c.toGregorianDate(start),
      toISO8601Date: () => c.toISO8601Date(start),
      toJapaneseDate: () => c.toJapaneseDate(start),
      toPersianDate: () => c.toPersianDate(start),
      newBuddhistDate: () => c.newBuddhistDate({ ...fields, year: 2548 }),
      newGregorianDate: () => c.newGregorianDate(fields),
      newISO8601Date: () => c.newISO8601Date(fields),
      newJapaneseDate: () => c.newJapaneseDate(fields),
      newPersianDate: () => c.newPersianDate({ ...fields, year: 1383 }),
    };
    for (const name of Object.keys(constructors) as (keyof typeof constructors)[]) {
      add('boundCalendarConstruct', [id, name], () => summarize(constructors[name]()));
    }
    const formats = {
      formatDate: () => c.formatDate(start, { datetime: 'medium' }),
      formatDateToParts: () => c.formatDateToParts(start, { datetime: 'medium' }),
      formatDateRaw: () => c.formatDateRaw(start, { pattern: 'yyyy-MM-dd HH:mm' }),
      formatDateRawToParts: () => c.formatDateRawToParts(start, { pattern: 'yyyy-MM-dd HH:mm' }),
      formatDateInterval: () => c.formatDateInterval(start, end, { skeleton: 'yMMMd' }),
      formatDateIntervalToParts: () =>
        c.formatDateIntervalToParts(start, end, { skeleton: 'yMMMd' }),
      formatDateWrapper: () => c.formatDateWrapper('DATE', 'TIME', { width: 'long' }),
      formatDateWrapperToParts: () =>
        c.formatDateWrapperToParts(
          [{ type: 'date', value: 'DATE' }],
          [{ type: 'time', value: 'TIME' }],
          { width: 'long' },
        ),
      formatRelativeTimeField: () => c.formatRelativeTimeField(3, 'day', { numericOnly: true }),
      formatRelativeTime: () =>
        c.formatRelativeTime(start, end, { field: 'day', numericOnly: true }),
      dateField: () => c.dateField('month', { width: 'short', context: 'begin-sentence' }),
      fieldOfVisualDifference: () =>
        c.fieldOfVisualDifference(c.toGregorianDate(start), c.toGregorianDate(end)),
      months: () => c.months({ width: 'abbreviated' }),
      weekdays: () => c.weekdays({ width: 'short' }),
      quarters: () => c.quarters({ width: 'narrow' }),
      dayPeriods: () => c.dayPeriods({ width: 'wide' }),
      eras: () => c.eras({ width: 'abbr' }),
      timeData: () => c.timeData(),
      timeZoneInfo: () => c.timeZoneInfo(zoneId),
      resolveTimeZoneId: () => c.resolveTimeZoneId('US/Eastern'),
      timeZoneIds: () => c.timeZoneIds().length,
      timeZoneFromUTC: () => c.timeZoneFromUTC(epoch, zoneId),
      timeZoneFromWall: () => c.timeZoneFromWall(epoch, zoneId),
      timePeriodToQuantity: () => c.timePeriodToQuantity({ year: 1, day: 3, millis: 25 }),
      formatDay: () => plainDays.formatDay(data, day),
      formatDayToParts: () => plainDays.formatDayToParts(data, day),
      formatDayInterval: () => plainDays.formatDayInterval(data, day, nextDay),
      formatDayIntervalToParts: () => plainDays.formatDayIntervalToParts(data, day, nextDay),
      formatTimeOfDay: () => plainDays.formatTimeOfDay(data, time),
      formatTimeOfDayToParts: () => plainDays.formatTimeOfDayToParts(data, time),
      formatDayRelative: () => plainDays.formatDayRelative(data, nextDay, day),
      formatInstant: () => plainDays.formatInstant(data, epoch, zoneId, { date: 'short' }),
      formatInstantToParts: () =>
        plainDays.formatInstantToParts(data, epoch, zoneId, { date: 'short' }),
      formatInstantRelative: () =>
        plainDays.formatInstantRelative(data, epoch + 3 * 86400000, epoch, zoneId, {
          field: 'day',
          numericOnly: true,
        }),
    };
    for (const name of Object.keys(formats) as (keyof typeof formats)[]) {
      add('boundCalendarCall', [id, name], formats[name]);
    }
    const clocks = {
      now: () => c.now(zoneId),
      nowBuddhist: () => c.nowBuddhist(zoneId),
      nowGregorian: () => c.nowGregorian(zoneId),
      nowISO8601: () => c.nowISO8601(zoneId),
      nowJapanese: () => c.nowJapanese(zoneId),
      nowPersian: () => c.nowPersian(zoneId),
    };
    for (const name of Object.keys(clocks) as (keyof typeof clocks)[]) {
      add('boundCalendarNow', [id, name], () => {
        const d = clocks[name]();
        return [dateType(d), dateTimeZoneId(d), dateFirstDayOfWeek(d), dateMinDaysInFirstWeek(d)];
      });
    }
  }
};
