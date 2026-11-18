/** TypeScript calendar behavior, including the historical calendar and DST quirks. */
import * as refs from '../../__tests__/core/systems/calendars/_referencedates';
import { getTZC } from '../../src/core/internals/calendars/zoneutil';
import * as C from '../../src/core/systems/calendars';
import { metazoneData } from '../../src/core/systems/calendars/autogen.zonedata';
import {
  currentMetazone,
  getStableTimeZoneId,
  substituteZoneAlias,
  timeZoneAliases,
  zoneInfoFromUTC,
} from '../../src/core/systems/calendars/timezone';
import { numarray } from '../../src/core/utils/string';
import { defaultTimeZoneData, type RawData, setTimeZoneData } from '../../src/timezone';
import { japaneseEras } from '../zig/core-calendars';
import { type ConformanceCase, collector, random } from './_shared';

type Spec = {
  cal: C.CalendarType;
  epoch?: number;
  zone?: string;
  fields?: Partial<C.CalendarDateFields>;
  fd?: number;
  md?: number;
};
const CALS: Record<C.CalendarType, C.CalendarSystem> = {
  gregory: C.gregorianCalendar,
  iso8601: C.iso8601Calendar,
  buddhist: C.buddhistCalendar,
  japanese: C.japaneseCalendar,
  persian: C.persianCalendar,
};
const TYPES = Object.keys(CALS) as C.CalendarType[];
const ZONES = [
  'UTC',
  'America/New_York',
  'America/Vancouver',
  'Europe/London',
  'Asia/Tokyo',
  'Asia/Tehran',
  'Asia/Kathmandu',
  'Australia/Lord_Howe',
  'Pacific/Apia',
  'Africa/Monrovia',
  'Asia/Calcutta',
  'Etc/GMT+1',
  'Missing/Zone',
];
const make = (s: Spec): C.CalendarDate =>
  s.fields
    ? C.dateFromFields(CALS[s.cal], s.fields, s.fd ?? 1, s.md ?? 1)
    : C.dateFromUnixEpoch(CALS[s.cal], s.epoch!, s.zone ?? 'UTC', s.fd ?? 1, s.md ?? 1);
const spec = (epoch: number, zone = 'UTC', cal: C.CalendarType = 'gregory'): Spec => ({
  cal,
  epoch,
  zone,
});
const zone = (z: ReturnType<typeof zoneInfoFromUTC>) => [
  z.zoneid,
  z.stableid,
  z.abbr,
  z.dst,
  z.offset,
  z.metazoneid,
];
const period = (p: C.TimePeriod) => C.TIME_PERIOD_FIELDS.map((f) => p[f]);
const snapshot = (d: C.CalendarDate) => ({
  f: d.fields,
  z: zone(d.zoneInfo),
  fd: C.dateFirstDayOfWeek(d),
  md: C.dateMinDaysInFirstWeek(d),
  e: C.dateUnixEpoch(d),
  jd: C.dateJulianDay(d),
  type: C.dateType(d),
  df: C.dateFields(d),
  w: [
    C.dateWeekOfYear(d),
    C.dateYearOfWeekOfYear(d),
    C.dateWeekOfYearISO(d),
    C.dateYearOfWeekOfYearISO(d),
    C.dateWeekOfMonth(d),
    C.dateOrdinalDayOfWeek(d),
    C.dateDayOfWeekInMonth(d),
    C.dateRelatedYear(d),
  ],
  b: [
    C.dateIsAM(d),
    C.dateIsLeapYear(d),
    C.dateIsDaylightSavings(d),
    C.isGregorianDate(d),
    C.isISO8601Date(d),
    C.isBuddhistDate(d),
    C.isJapaneseDate(d),
    C.isPersianDate(d),
  ],
  s: [
    C.dateToString(d),
    C.dateToISOString(d),
    C.dateToLocalISOString(d),
    C.dateToDateString(d),
    C.dateToDateTimeString(d, { includeZoneOffset: true, optionalMilliseconds: true }),
  ],
});

export const cases = (): ConformanceCase[] => {
  const { cases, add } = collector();
  const r = random(20261104);
  const date = (s: Spec) => add('date', [s], () => snapshot(make(s)));
  const mutate = (fn: 'dateAdd' | 'dateSubtract', s: Spec, p: Partial<C.TimePeriod>) =>
    add(fn, [s, p], () => snapshot((fn === 'dateAdd' ? C.dateAdd : C.dateSubtract)(make(s), p)));
  const until = (a: Spec, b: Spec, o: C.DateDiffOptions = {}) =>
    add('dateUntil', [a, b, o], () => period(C.dateUntil(make(a), make(b), o)));
  add('timePeriod', [], () => period(C.timePeriod()));

  // Reference timestamps from the unit tests, BCE, cutover, and Julian-day range clamps.
  const epochs = [
    0,
    -1,
    1,
    -62167305600000,
    -12219292800000,
    -12219292800001,
    -42599935200000,
    -21344688000000,
    -1406978704000,
    1523491199123,
    -8640000000000000,
    8640000000000000,
    -210866803200001,
    -210866803200000,
    210895142400000,
    210895228799999,
    ...(Object.values(refs) as (number | string)[])
      .filter((v): v is number => typeof v === 'number')
      .sort((a, b) => a - b),
  ];
  for (const cal of TYPES) {
    for (const epoch of epochs) date(spec(epoch, r.pick(ZONES), cal));
    for (const fields of [
      {},
      { year: 0, month: 1, day: 1 },
      { year: -400, month: 2, day: 29 },
      { year: 1582, month: 10, day: 10 },
      { year: 1e10, month: 13, day: 32, hour: 25, minute: -1, second: 60, millis: 1000 },
      { year: -2147483649, month: 0, day: 0, zoneId: 'Missing/Zone' },
      { month: 1, day: 1 },
      { year: 2024, month: 2, day: 29, zoneId: 'Asia/Tokyo' },
      { year: 2025, month: 3, day: 9, hour: 2, minute: 30, zoneId: 'America/New_York' },
      { year: 2025, month: 11, day: 2, hour: 1, minute: 30, zoneId: 'America/Vancouver' },
    ]) {
      // Japanese/ISO missing fields produce NaN or throw; normalize to the documented Zig error.
      if ((cal === 'japanese' || cal === 'iso8601') && !('month' in fields)) {
        add('invalidFields', [{ cal, fields }], () => {
          try {
            const d = make({ cal, fields });
            if (d.fields.every(Number.isFinite)) return 'valid';
          } catch {
            /* Both NaN dates and throws become InvalidFields in Zig. */
          }
          return { error: 'InvalidFields' };
        });
      } else date({ cal, fields });
    }
    // Seeded arbitrary epochs and field combinations, with varied locale week rules.
    for (let i = 0; i < 24; i++) {
      date({ ...spec(r.int(-8e13, 8e13), r.pick(ZONES), cal), fd: r.int(1, 7), md: r.int(1, 7) });
      date({
        cal,
        fields: {
          year: r.int(-5000, 9000),
          month: r.int(-2, 15),
          day: r.int(-5, 36),
          hour: r.int(-5, 28),
          minute: r.int(-5, 65),
          second: r.int(-5, 65),
          millis: r.int(-5, 1100),
          zoneId: r.pick(ZONES),
        },
        fd: r.int(1, 7),
        md: r.int(1, 7),
      });
    }
    for (const year of [-33, -1, 0, 1, 1399, 1400, 1403, 1404, 1582, 1900, 2000, 2024]) {
      const sys = CALS[cal];
      add('calendarMath', [cal, year], () => [
        sys.daysInYear(year),
        Array.from({ length: 12 }, (_, m) => sys.daysInMonth(year, m)),
        Array.from({ length: 12 }, (_, m) => sys.monthStart(year, m, true)),
        sys.monthStart(year, 4.5, false),
      ]);
    }
  }
  // Every era boundary, using calendar fields so pre-cutover epochs stay Julian.
  const eras = japaneseEras();
  for (let i = 0; i < eras.length; i += 3) {
    const d = make({
      cal: 'japanese',
      fields: { year: eras[i], month: eras[i + 1], day: eras[i + 2] },
    });
    for (const delta of [-86400000, 0, 86400000]) {
      add('era', [C.dateUnixEpoch(d) + delta], () => {
        const e = make(spec(C.dateUnixEpoch(d) + delta, 'UTC', 'japanese'));
        return [C.dateEra(e), C.dateYear(e), C.dateExtendedYear(e)];
      });
    }
  }
  for (let fd = 1; fd <= 7; fd++)
    for (let md = 1; md <= 7; md++) {
      for (const epoch of [1609372800000, 1609459200000, 1640995200000]) {
        const s = { ...spec(epoch), fd, md };
        add('weeks', [s], () => snapshot(make(s)).w);
      }
    }
  for (const cal of TYPES)
    for (const year of [-2, -1, 0, 1, 1399, 1400, 1403, 1404]) {
      if (cal !== 'persian') continue;
      for (const month of [1, 12])
        for (const day of [1, 29, 30, 31]) date({ cal, fields: { year, month, day } });
    }

  const periods: Partial<C.TimePeriod>[] = [
    {},
    { month: 1 },
    { year: 1 },
    { day: 33 },
    { day: -33 },
    { year: 1, month: 6, week: 7, day: 4, hour: 9, minute: 3, second: 2, millis: 5 },
    { year: -2, month: -13, day: -31, hour: -25 },
    { year: 1e4 },
    { day: 1e7 },
    { hour: 1e9 },
  ];
  for (const f of C.TIME_PERIOD_FIELDS)
    for (const n of [0.5, -0.5, 1.7, -1.7]) periods.push({ [f]: n });
  for (const cal of TYPES) {
    for (const [i, p] of Array.from(periods.entries())) {
      const s = spec(i % 2 ? 1762074000000 : refs.JAN_30_2024, 'America/Vancouver', cal);
      mutate(i % 2 ? 'dateSubtract' : 'dateAdd', s, p);
    }
    const s = spec(refs.MAR_09_2025, 'America/New_York', cal);
    for (const field of ['year', 'month', 'day', 'hour', 'minute', 'second'] as const) {
      for (const [fn, f] of [
        ['dateStartOf', C.dateStartOf],
        ['dateEndOf', C.dateEndOf],
      ] as const)
        add(fn, [s, field], () => snapshot(f(make(s), field)));
    }
    for (const fields of [
      { month: 0, day: 0 },
      { month: 13, day: 32 },
      { year: 0 },
      { zoneId: 'UTC' },
      { hour: 25, millis: -1 },
      { year: 1e10 },
    ]) {
      add('dateSet', [s, fields], () => snapshot(C.dateSet(make(s), fields)));
    }
    for (const z of ['Asia/Kathmandu', 'UTC', 'Missing/Zone']) {
      add('dateWithZone', [s, z], () => snapshot(C.dateWithZone(make(s), z)));
    }
    for (let flags = 0; flags < 8; flags++) {
      const o = {
        includeZoneId: !!(flags & 1),
        includeZoneOffset: !!(flags & 2),
        optionalMilliseconds: !!(flags & 4),
      };
      add('dateToTimeString', [s, o], () => C.dateToTimeString(make(s), o));
    }
  }

  // Every requested field, mixed subsets, unsorted fields (last one controls fractional rollup).
  const options: C.DateDiffOptions[] = [
    {},
    { includeWeeks: true },
    { fields: [] },
    ...C.TIME_PERIOD_FIELDS.flatMap((f) => [
      { fields: [f] },
      { fields: [f], rollupFractional: true },
    ]),
    { fields: ['year', 'month'], rollupFractional: true },
    { fields: ['month', 'day'] },
    { fields: ['hour', 'day'], rollupFractional: true },
    { fields: ['week', 'hour'], includeWeeks: true, rollupFractional: true },
  ];
  const pairs: [number, number, string][] = [
    [957258000000, 954669600000, 'America/Vancouver'],
    [949132800000, 972889200000, 'America/Vancouver'],
    [951991200000, 956005200000, 'America/Vancouver'],
    [0, 5340000, 'Africa/Monrovia'],
    [1762070460000, 1762074000000, 'America/Vancouver'],
    [1742205000000, 1741517400000, 'America/Vancouver'],
    [refs.JAN_30_2024, refs.MAR_03_2024, 'America/New_York'],
    [refs.FEB_29_2024, refs.FEB_29_2024 + 400 * 86400000 + 45296567, 'UTC'],
    [refs.FEB_29_2024, refs.FEB_29_2024, 'UTC'],
  ];
  for (const [i, [x, y, z]] of Array.from(pairs.entries()))
    for (const o of options) {
      for (const [a, b] of [
        [spec(x, z), spec(y, z)],
        [spec(y, z), spec(x, z)],
      ]) {
        until(a, b, o);
        if (i === 6)
          for (const [fn, f] of [
            ['dateSince', C.dateSince],
            ['dateDifference', C.dateDifference],
            ['dateDifferenceSigned', C.dateDifferenceSigned],
          ] as const) {
            add(fn, [a, b, o], () => period(f(make(a), make(b), o)));
          }
      }
    }
  // Scan both sides of spring/fall gaps, in both directions, including same-day duplicates.
  for (const z of ['America/Vancouver', 'America/New_York']) {
    for (const edge of z === 'America/Vancouver'
      ? [1741514400000, 1762074000000]
      : [1741503600000, 1762063200000]) {
      for (const delta of [-86400000, -3600000, -60000, -1, 0, 1, 60000, 3600000, 86400000]) {
        const a = spec(edge + delta, z),
          b = spec(edge + 3600000, z);
        until(a, b);
        until(b, a);
        mutate('dateAdd', a, { day: 1, hour: -1 });
      }
    }
  }
  for (let i = 0; i < 100; i++) {
    const cal = r.pick(TYPES),
      z = r.pick(ZONES);
    const a = spec(r.int(0, 2e12), z, cal),
      b = spec(a.epoch! + r.int(-1e11, 1e11), z, cal);
    until(a, b, r.pick(options));
    const field = i % 9 === 8 ? undefined : C.TIME_PERIOD_FIELDS[i % 9];
    const o = { rollupFractional: i % 2 === 0 };
    add('dateRelativeTime', [a, b, field ?? null, o], () =>
      C.dateRelativeTime(make(a), make(b), field, o),
    );
    add('dateCompare', [a, b], () => C.dateCompare(make(a), make(b)));
  }
  const base = spec(refs.JAN_30_2024);
  for (const p of [{}, ...C.TIME_PERIOD_FIELDS.map((f) => ({ [f]: 1 })), { year: -2024 }]) {
    const b = spec(C.dateUnixEpoch(C.dateAdd(make(base), p)));
    add('dateFieldOfVisualDifference', [base, b], () =>
      C.dateFieldOfVisualDifference(make(base), make(b)),
    );
  }

  // All canonical zones, tzdb links, CLDR aliases, and each metazone transition +/- 1ms.
  const ids = defaultTimeZoneData.zoneids.split('|');
  const links = defaultTimeZoneData.links.split('|').map((s) => s.split(':')[0]);
  for (const id of Array.from(
    new Set([
      ...ids,
      ...links,
      ...Object.keys(timeZoneAliases),
      'Missing/Zone',
      'america/new_york',
    ]),
  )) {
    add('zoneIds', [id], () => [
      getStableTimeZoneId(id),
      currentMetazone(id) ?? null,
      substituteZoneAlias(id),
    ]);
  }
  for (const id of ids)
    add('zoneInfoFromUTC', [id, refs.MAR_09_2025], () =>
      zone(zoneInfoFromUTC(id, refs.MAR_09_2025)),
    );
  const index = numarray(metazoneData.index, 36),
    zi = numarray(metazoneData.zoneindex, 36);
  const untils = numarray(metazoneData.untils, 36);
  // One representative for each shared history avoids duplicate transition cases.
  for (const mi of Array.from(new Set(zi.filter((n) => n >= 0)))) {
    const id = ids[zi.indexOf(mi)];
    for (let j = index[mi * 2] + 1; j < index[mi * 2 + 1]; j++) {
      for (const delta of [-1, 0, 1]) {
        const epoch = untils[j] * 1000 + delta;
        add('zoneInfoFromUTC', [id, epoch], () => zone(zoneInfoFromUTC(id, epoch)));
      }
    }
  }
  for (const n of [0, 1, -1, 60000, -17762000, 20700000, -86400000, 1e12]) {
    add('getTZC', [n], () => getTZC(n));
  }
  // Replacement data may reorder zones, omit bundled zones, or promote an alias to canonical.
  const custom: RawData = {
    zoneids: 'Asia/Calcutta|Etc/UTC|Foo/Bar',
    links: 'Asia/Kolkata:0|Zulu:1|Foo/Baz:2',
    index: '',
    zoneinfo: [
      `${(19800).toString(36)}_0_0_IN_IST:0:${(19800).toString(36)}__`,
      '0_0_0__UTC:0:0__',
      `${(3600).toString(36)}_0_0_XX_FOO:0:${(3600).toString(36)}__`,
    ],
  };
  const customIds = ['Asia/Calcutta', 'Asia/Kolkata', 'Etc/UTC', 'Foo/Baz', 'America/New_York'];
  add('zoneDatabase', [custom, customIds], () => {
    setTimeZoneData(custom);
    try {
      return customIds.map((id) => [
        snapshot(make(spec(refs.JAN_30_2024, id))),
        getStableTimeZoneId(id),
        currentMetazone(id) ?? null,
      ]);
    } finally {
      setTimeZoneData(defaultTimeZoneData);
    }
  });
  return cases;
};
