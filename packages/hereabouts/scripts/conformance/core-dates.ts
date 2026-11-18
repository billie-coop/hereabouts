/** Calendar patterns, matching, fields, dates, intervals, relative time and plain values. */
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import ts from 'typescript';
import type {
  CalendarType,
  DateFormatOptions,
  DateIntervalFormatOptions,
  DateRawFormatOptions,
  RelativeTimeFieldFormatOptions,
  RelativeTimeFormatOptions,
} from '../../src/core';
import * as api from '../../src/core/api/calendars';
import * as days from '../../src/core/api/days';
import { getFieldType } from '../../src/core/internals/calendars/fields';
import {
  flexDayPeriod,
  selectCalendar,
  weekFirstDay,
  weekMinDays,
} from '../../src/core/internals/calendars/internal';
import {
  getCalendarPatterns,
  largestSkeletonField,
  maskedFOVD,
} from '../../src/core/internals/calendars/manager';
import {
  patternsMatchAvailable,
  patternsMatchInterval,
} from '../../src/core/internals/calendars/patterns';
import {
  skeletonCanonical,
  skeletonParse,
  skeletonSplit,
} from '../../src/core/internals/calendars/skeleton';
import {
  DATE_PATTERN_CHARS,
  intervalPatternBoundary,
  parseDatePattern,
} from '../../src/core/parsing/date';
import { LOCALES, load, PACK_LANGUAGES } from './_core';
import { type ConformanceCase, collector, random } from './_shared';

interface Spec {
  epoch: number;
  zone: string;
  cal?: CalendarType;
}
const date = (locale: string, spec: Spec) => {
  const input = { date: spec.epoch, zoneId: spec.zone };
  if (!spec.cal) return input;
  const data = load(locale);
  switch (spec.cal) {
    case 'buddhist':
      return api.toBuddhistDate(data, input);
    case 'japanese':
      return api.toJapaneseDate(data, input);
    case 'persian':
      return api.toPersianDate(data, input);
    case 'iso8601':
      return api.toISO8601Date(data, input);
    default:
      return api.toGregorianDate(data, input);
  }
};

/** Mine literal patterns and skeletons from the existing tests, including the ICU regressions. */
const mined = (): { patterns: string[]; skeletons: string[] } => {
  const patterns = new Set<string>();
  const skeletons = new Set<string>();
  const root = join(__dirname, '../../__tests__/core');
  const files = ['api/calendars', 'internals/calendars'].flatMap((dir) =>
    readdirSync(join(root, dir))
      .filter((f) => f.endsWith('.ts'))
      .sort()
      .map((f) => join(root, dir, f)),
  );
  for (const path of files) {
    const source = ts.createSourceFile(
      path,
      readFileSync(path, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const visit = (n: ts.Node): void => {
      if (ts.isPropertyAssignment(n) && ts.isStringLiteral(n.initializer)) {
        const key = n.name.getText(source);
        if (key === 'pattern') patterns.add(n.initializer.text);
        if (key === 'skeleton') skeletons.add(n.initializer.text);
      }
      ts.forEachChild(n, visit);
    };
    visit(source);
  }
  return { patterns: Array.from(patterns), skeletons: Array.from(skeletons) };
};

export const cases = (): ConformanceCase[] => {
  const { cases, add } = collector();
  const rng = random(0x20261105);
  const input = mined();
  const cals = ['gregory', 'buddhist', 'japanese', 'persian'] as const;
  const widths = ['full', 'long', 'medium', 'short'] as const;
  const zones = [
    'UTC',
    'America/New_York',
    'America/Vancouver',
    'Asia/Kolkata',
    'Asia/Kathmandu',
    'Europe/Paris',
    'Asia/Tehran',
    'Pacific/Tarawa',
    'Etc/GMT+1',
    'Bad/Zone',
  ];
  const epochs = [
    0, -1, -2208988800000, 1514833225000, 1520751625000, 1556668800000, 1720166400123,
    1735689600999, 1741503600000, 1762074000000,
  ];
  const patterns = Array.from(
    new Set([
      '',
      "'week' W 'of' MMMM",
      "yyyy 'o''clock'",
      "''",
      "yyyy'' MM",
      "yyyy 'o'clock'",
      "yyyy'",
      "yyyy 'abc",
      'E, d MMM y G',
      'h:mm !!',
      'MMM d–d, y',
      'h:mm–h:mm a',
      ...input.patterns,
    ]),
  );
  for (const raw of patterns)
    add('parse', [raw], () => ({
      nodes: parseDatePattern(raw),
      boundary: intervalPatternBoundary(parseDatePattern(raw)),
    }));
  for (let i = 0; i < 60; i++) {
    const raw = Array.from({ length: rng.int(0, 35) }, () =>
      rng.pick([...Object.keys(DATE_PATTERN_CHARS), "'", ' ', ':', '!', 'é', '🕒']),
    ).join('');
    add('parse', [raw], () => ({
      nodes: parseDatePattern(raw),
      boundary: intervalPatternBoundary(parseDatePattern(raw)),
    }));
  }
  for (const ch of [...Object.keys(DATE_PATTERN_CHARS), '?'])
    for (const w of [0, 1, 2, 3, 4, 5, 6, 21]) add('fieldType', [ch, w], () => getFieldType(ch, w));
  const skels = Array.from(
    new Set([
      'yMd',
      'yMMMd',
      'yMMMMdE',
      'yyyyMMMMEEEEd',
      'MMMEd',
      'Gy',
      'QQQQ',
      'MMMMW',
      'yw',
      'hm',
      'Hm',
      'hms',
      'HmsSS',
      'j',
      'J',
      'C',
      'jm',
      'jms',
      'Bh',
      'mm',
      's',
      'yMdHm',
      'Ehm',
      ...input.skeletons,
    ]),
  );
  for (const locale of LOCALES)
    add('settings', [locale], () => ({
      first: weekFirstDay(load(locale).region),
      min: weekMinDays(load(locale).region),
      calendar: selectCalendar(load(locale)),
      time: api.timeData(load(locale)),
    }));
  for (let i = 0; i < 100; i++) {
    const locale = rng.pick(PACK_LANGUAGES),
      raw = rng.pick(skels),
      isPattern = i % 3 === 0;
    add('skeleton', [locale, raw, isPattern], () => {
      const p = getCalendarPatterns(load(locale), 'gregory');
      const s = skeletonParse(p.skeletonParser, raw, isPattern);
      const canonical = skeletonCanonical(s);
      const match = patternsMatchAvailable(p, s).skeleton;
      const interval = patternsMatchInterval(p, s)?.skeleton.skeleton || '';
      const time = skeletonSplit(s);
      return {
        canonical,
        match,
        interval,
        date: s.skeleton,
        time: time.skeleton,
        dateType: s.type,
        timeType: time.type,
      };
    });
  }
  for (const locale of PACK_LANGUAGES) {
    const data = load(locale);
    for (const ca of cals)
      for (const width of widths) {
        const spec = { epoch: rng.pick(epochs), zone: rng.pick(zones) };
        for (const options of [
          { date: width, ca },
          { time: width, ca },
          { datetime: width, ca, atTime: false },
        ]) {
          add('format', [locale, spec, options], () =>
            api.formatDate(data, date(locale, spec), options),
          );
        }
      }
    for (let i = 0; i < skels.length; i++) {
      const spec = { epoch: rng.pick(epochs), zone: rng.pick(zones) };
      const options: DateFormatOptions = { skeleton: skels[i], ca: rng.pick(cals) };
      if (i % 5 === 0)
        options.nu = rng.pick(['arab', 'arabext', 'deva', 'thai', 'mathbold', 'hanidec']);
      if (i % 7 === 0) options.context = 'begin-sentence';
      add(i % 4 === 0 ? 'parts' : 'format', [locale, spec, options], () =>
        i % 4 === 0
          ? api.formatDateToParts(data, date(locale, spec), options)
          : api.formatDate(data, date(locale, spec), options),
      );
    }
    for (let i = 0; i < 7; i++) {
      const spec = { epoch: rng.pick(epochs), zone: rng.pick(zones) };
      const raw = Object.keys(DATE_PATTERN_CHARS)
        .map((ch) => ch.repeat(1 + (i % 7)))
        .join(' | ');
      const options: DateRawFormatOptions = {
        pattern: raw,
        ca: cals[i % 4],
        nu: i % 4 === 0 ? 'arab' : undefined,
        alt: i % 3 === 0 ? { era: 'sensitive', dayPeriod: 'casing' } : undefined,
      };
      add(i % 3 === 0 ? 'rawParts' : 'raw', [locale, spec, options], () =>
        i % 3 === 0
          ? api.formatDateRawToParts(data, date(locale, spec), options)
          : api.formatDateRaw(data, date(locale, spec), options),
      );
    }
    for (let i = 0; i < 20; i++) {
      const start = { epoch: rng.pick(epochs), zone: rng.pick(zones) };
      const end = {
        epoch:
          start.epoch + rng.pick([0, 1000, 60000, 7200000, 86400000, 864000000, 366 * 86400000]),
        zone: start.zone,
      };
      const options: DateIntervalFormatOptions = {
        skeleton: rng.pick(skels),
        ca: rng.pick(cals),
        strict: i % 2 === 0,
        atTime: i % 3 !== 0,
      };
      add(i % 4 === 0 ? 'intervalParts' : 'interval', [locale, start, end, options], () =>
        i % 4 === 0
          ? api.formatDateIntervalToParts(data, date(locale, start), date(locale, end), options)
          : api.formatDateInterval(data, date(locale, start), date(locale, end), options),
      );
    }
    for (let i = 0; i < 45; i++) {
      const value = rng.pick([
        '-1000',
        '-3.14159',
        '-2',
        '-1',
        '-0.4',
        '-0',
        '0',
        '0.2',
        '1',
        '2',
        '12.34',
        '25000',
      ]);
      const field = rng.pick([
        'year',
        'quarter',
        'month',
        'week',
        'day',
        'hour',
        'minute',
        'second',
        'sun',
        'mon',
        'tue',
        'wed',
        'thu',
        'fri',
        'sat',
      ] as const);
      const options: RelativeTimeFieldFormatOptions = {
        width: rng.pick(['wide', 'short', 'narrow']),
        numericOnly: i % 3 === 0,
        alwaysNow: i % 4 === 0,
        group: i % 2 === 0,
        maximumFractionDigits: i % 3,
        nu: i % 5 === 0 ? 'arab' : undefined,
        context: i % 6 === 0 ? 'begin-sentence' : undefined,
      };
      add('relativeField', [locale, value, field, options], () =>
        api.formatRelativeTimeField(data, value, field, options),
      );
    }
    for (let i = 0; i < 8; i++) {
      const start = { epoch: 1520751625000, zone: rng.pick(zones) },
        end = {
          epoch:
            start.epoch + rng.pick([0, 250, -1250, 3600000, 86400000, 7 * 86400000, 60 * 86400000]),
          zone: start.zone,
        };
      const options: RelativeTimeFormatOptions = {
        allowWeeks: true,
        dayOfWeek: true,
        field:
          i % 2 === 0
            ? undefined
            : rng.pick(['year', 'month', 'week', 'day', 'hour', 'minute', 'second', 'millis']),
        maximumFractionDigits: 0,
      };
      add('relative', [locale, start, end, options], () =>
        api.formatRelativeTime(data, date(locale, start), date(locale, end), options),
      );
    }
    for (const fn of ['months', 'weekdays', 'quarters', 'dayPeriods', 'eras'] as const) {
      const options = {
        ca: rng.pick(cals),
        width:
          fn === 'eras'
            ? rng.pick(['names', 'abbr', 'narrow'] as const)
            : rng.pick(['wide', 'abbreviated', 'narrow', 'short'] as const),
        context: 'begin-sentence' as const,
      };
      add(fn, [locale, options], () =>
        fn === 'eras'
          ? api.eras(data, { ...options, width: options.width as 'names' })
          : {
              months: api.months,
              weekdays: api.weekdays,
              quarters: api.quarters,
              dayPeriods: api.dayPeriods,
              eras: api.eras,
            }[fn](data, { ...options, width: options.width as 'wide' }),
      );
    }
    for (const zone of zones) add('zoneInfo', [locale, zone], () => api.timeZoneInfo(data, zone));
    for (const width of widths) {
      const options = { width, atTime: width !== 'short' };
      add('wrapper', [locale, 'DATE', 'TIME', options], () =>
        api.formatDateWrapper(data, 'DATE', 'TIME', options),
      );
      add(
        'wrapperParts',
        [locale, [{ type: 'day', value: 'DATE' }], [{ type: 'hour', value: 'TIME' }], options],
        () =>
          api.formatDateWrapperToParts(
            data,
            [{ type: 'day', value: 'DATE' }],
            [{ type: 'hour', value: 'TIME' }],
            options,
          ),
      );
    }
    const d = { year: 2026, month: 1, day: 31 },
      t = { hour: 18, minute: 30, second: 15, millis: 123 };
    add('day', [locale, d, {}], () => days.formatDay(data, d));
    add('dayParts', [locale, d, { skeleton: 'yMMMMdE' }], () =>
      days.formatDayToParts(data, d, { skeleton: 'yMMMMdE' }),
    );
    add('dayInterval', [locale, d, { ...d, month: 2, day: 3 }, {}], () =>
      days.formatDayInterval(data, d, { ...d, month: 2, day: 3 }),
    );
    add('dayIntervalParts', [locale, d, { ...d, day: 20 }, {}], () =>
      days.formatDayIntervalToParts(data, d, { ...d, day: 20 }),
    );
    add('tod', [locale, t, {}], () => days.formatTimeOfDay(data, t));
    add('todParts', [locale, t, { skeleton: 'HmsSSS' }], () =>
      days.formatTimeOfDayToParts(data, t, { skeleton: 'HmsSSS' }),
    );
    add('dayRelative', [locale, d, { ...d, day: 29 }, {}], () =>
      days.formatDayRelative(data, d, { ...d, day: 29 }),
    );
    add('instant', [locale, 1741503600000, 'America/New_York', { datetime: 'full' }], () =>
      days.formatInstant(data, 1741503600000, 'America/New_York', { datetime: 'full' }),
    );
    add('instantParts', [locale, 1741503600000, 'Asia/Kathmandu', {}], () =>
      days.formatInstantToParts(data, 1741503600000, 'Asia/Kathmandu', {}),
    );
    add('instantRelative', [locale, 1741503600000, 1741500000000, 'America/New_York', {}], () =>
      days.formatInstantRelative(data, 1741503600000, 1741500000000, 'America/New_York', {}),
    );
    for (const field of [
      'era',
      'year',
      'month',
      'week',
      'day',
      'weekday',
      'dayperiod',
      'hour',
      'minute',
      'second',
      'zone',
    ] as const)
      add('dateField', [locale, field, { width: 'short', context: 'begin-sentence' }], () =>
        api.dateField(data, field, { width: 'short', context: 'begin-sentence' }),
      );
    for (const mins of [0, 1, 240, 360, 719, 720, 721, 1080, 1320, 1439])
      add('dayPeriodRule', [locale, mins], () => flexDayPeriod(data, mins));
  }
  // Standard + skeleton mixing, raw quoting, numbering and cache regression inputs.
  for (let i = 0; i < 160; i++) {
    const locale = rng.pick(LOCALES),
      spec = { epoch: rng.pick(epochs), zone: rng.pick(zones), cal: rng.pick(cals) };
    const options: DateFormatOptions = {
      skeleton: rng.pick(skels),
      date: i % 3 === 0 ? rng.pick(widths) : undefined,
      time: i % 3 === 1 ? rng.pick(widths) : undefined,
      wrap: rng.pick(widths),
      nu: rng.pick(['latn', 'arab', 'mathbold', 'thai']),
      atTime: i % 2 === 0,
    };
    add('format', [locale, spec, options], () =>
      api.formatDate(load(locale), date(locale, spec), options),
    );
    const pattern = rng.pick(patterns);
    add('raw', [locale, spec, { pattern }], () =>
      api.formatDateRaw(load(locale), date(locale, spec), { pattern }),
    );
  }
  for (const [fn, args] of [
    ['day', ['en', { year: 1500, month: 1, day: 1 }, {}]],
    ['day', ['en', { year: 2026, month: 2, day: 30 }, {}]],
    ['day', ['en', { year: 2026, month: 1, day: 1 }, { skeleton: 'yMdz' }]],
    ['tod', ['en', { hour: 24, minute: 0, second: 0, millis: 0 }, {}]],
    ['tod', ['en', { hour: 12, minute: 0, second: 0, millis: 0 }, { skeleton: 'y' }]],
  ] as const)
    add(fn, [...args], () =>
      fn === 'day'
        ? days.formatDay(
            load('en'),
            args[1] as days.DayFormatOptions & { year: number; month: number; day: number },
            args[2],
          )
        : days.formatTimeOfDay(
            load('en'),
            args[1] as { hour: number; minute: number; second: number; millis: number },
            args[2],
          ),
    );
  // Public conversion wrappers retain locale week rules, calendar identity and zone handling.
  for (const locale of ['en', 'de', 'fa', 'th', 'ja']) {
    const data = load(locale);
    for (const ca of [...cals, 'iso8601'] as const) {
      const convert = {
        gregory: api.toGregorianDate,
        buddhist: api.toBuddhistDate,
        japanese: api.toJapaneseDate,
        persian: api.toPersianDate,
        iso8601: api.toISO8601Date,
      }[ca];
      const construct = {
        gregory: api.newGregorianDate,
        buddhist: api.newBuddhistDate,
        japanese: api.newJapaneseDate,
        persian: api.newPersianDate,
        iso8601: api.newISO8601Date,
      }[ca];
      const fn = {
        gregory: api.nowGregorian,
        buddhist: api.nowBuddhist,
        japanese: api.nowJapanese,
        persian: api.nowPersian,
        iso8601: api.nowISO8601,
      }[ca];
      const spec = { epoch: rng.pick(epochs), zone: rng.pick(zones), cal: rng.pick(cals) };
      const converted = () => convert(data, date(locale, spec));
      const snapshot = (d: ReturnType<typeof api.toGregorianDate>) => ({
        type: d.calendar.type,
        fields: d.fields,
        first: d.firstDay,
        min: d.minDays,
        zone: d.zoneInfo.zoneid,
      });
      add('convert', [locale, ca, spec], () => snapshot(converted()));
      const fields = {
        year: 2024,
        month: 7,
        day: 5,
        hour: 18,
        minute: 30,
        zoneId: 'America/Vancouver',
      };
      add('newDate', [locale, ca, fields], () => snapshot(construct(data, fields)));
      add('now', [locale, ca, 'America/Vancouver'], () => {
        const d = fn(data, 'America/Vancouver');
        return {
          type: d.calendar.type,
          first: d.firstDay,
          min: d.minDays,
          zone: d.zoneInfo.zoneid,
        };
      });
    }
  }
  for (const locale of ['en', 'de']) {
    const data = load(locale);
    for (const x of [-0.5, 0.5, 123.9, -123.9, -8.64e15, 8.64e15]) {
      const spec = { epoch: x, zone: 'Asia/Kathmandu' };
      add('raw', [locale, spec, { pattern: 'u-MM-dd HH:mm:ss.SSS A' }], () =>
        api.formatDateRaw(data, date(locale, spec), { pattern: 'u-MM-dd HH:mm:ss.SSS A' }),
      );
    }
    for (const skeleton of ['yMMMd', 'Hm', 'yMdjm']) {
      for (const delta of [0, 1000, 3600000, 86400000, 400 * 86400000]) {
        const a = { epoch: 1720166400123, zone: 'America/Vancouver' };
        const b = { epoch: a.epoch + delta, zone: delta === 1000 ? 'UTC' : a.zone };
        add('fovd', [locale, a, b], () =>
          api.fieldOfVisualDifference(data, date(locale, a), date(locale, b)),
        );
        const p = getCalendarPatterns(data, 'gregory');
        const sk = skeletonParse(p.skeletonParser, skeleton);
        add('maskedFovd', [locale, a, b, skeleton], () => ({
          largest: largestSkeletonField(sk),
          field: maskedFOVD(
            data,
            api.toGregorianDate(data, date(locale, a)),
            api.toGregorianDate(data, date(locale, b)),
            sk,
          ),
        }));
      }
    }
  }
  for (const zone of [...zones, 'america/new_york', 'US/Eastern', 'Asia/Calcutta']) {
    add('resolveZone', [zone], () => api.resolveTimeZoneId(zone));
    for (const epoch of [0, 1520751625000, 1741503600000, 1762074000000]) {
      add('zoneUTC', [epoch, zone], () => api.timeZoneFromUTC(epoch, zone));
      add('zoneWall', [epoch, zone], () => api.timeZoneFromWall(epoch, zone));
    }
  }
  add('zoneIds', [], api.timeZoneIds);
  // Number inputs use JS integer string conversion and UTF-16 digit lengths, even for S*.
  for (const nu of ['latn', 'mathbold'] as const)
    for (const millis of [0, 3, 123])
      for (const width of [1, 2, 3, 4, 6, 18, 22, 25, 309, 312]) {
        const spec = { epoch: 1720166400000 + millis, zone: 'UTC' };
        const options = { pattern: 'S'.repeat(width), nu };
        add('raw', ['en', spec, options], () =>
          api.formatDateRaw(load('en'), date('en', spec), options),
        );
      }
  for (const period of [
    {},
    { year: 1, month: 2, week: -3, day: 4, hour: 5, minute: 6, second: 7, millis: 8 },
    { year: -0.5, millis: 0.01 },
  ])
    add('quantity', [period], () =>
      api.timePeriodToQuantity(period).map((q) => ({ unit: q.unit, value: String(q.value) })),
    );
  return cases;
};
