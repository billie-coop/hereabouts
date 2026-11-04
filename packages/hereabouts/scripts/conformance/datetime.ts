/**
 * Builds the shared datetime test cases in `conformance/datetime.json`.
 *
 * Every public function of `src/datetime` is called with fixed inputs (from the unit tests in
 * `__tests__/datetime`) and seeded random ones, densest where calendars and clocks are awkward:
 * month ends and leap days, the ends of the supported range, and time zone transitions.
 *
 * `dtSweep` is a composite case: for one zone, every transition in the data, with `dayAtTime`
 * (all four disambiguations), `dayStartInstant` and `instantToString` around it, folded into a
 * hash. One small case per zone covers every transition of every zone; explicit cases for a
 * few zones are there to debug a mismatch.
 *
 * Nothing here reads the host's time zone or clock: `systemTimeZone` is left out, and `dayToday`
 * is always given `now`. Inputs are integers in the range where JavaScript numbers are exact
 * (the Zig port takes i64 and cannot express fractions, NaN or infinities).
 */

import {
  type Day,
  type DayDuration,
  type DayUnit,
  type Disambiguation,
  day,
  dayAdd,
  dayAtTime,
  dayCompare,
  dayDaysInMonth,
  dayEndOf,
  dayEndOfWeek,
  dayEquals,
  dayFromEpochDay,
  dayFromInstant,
  dayFromString,
  dayIsAfter,
  dayIsBefore,
  dayIsLeapYear,
  dayOfWeek,
  dayOfYear,
  dayParse,
  dayRange,
  dayStartInstant,
  dayStartOf,
  dayStartOfWeek,
  daySubtract,
  dayToday,
  dayToEpochDay,
  dayToString,
  dayUntil,
  instantParse,
  instantToString,
  isDay,
  isTimeOfDay,
  type TimeOfDay,
  timeOfDay,
  timeOfDayCompare,
  timeOfDayFromInstant,
  timeOfDayFromMillis,
  timeOfDayFromString,
  timeOfDayParse,
  timeOfDayToMillis,
  timeOfDayToString,
  timeZoneId,
  timeZoneOffset,
} from '../../src/datetime';
import { daysInMonth, isLeapYear } from '../../src/datetime/day';
import {
  defaultTimeZoneData,
  type RawData,
  setTimeZoneData,
  tzFromUTC,
  tzZoneIds,
} from '../../src/timezone';
import { rawdata } from '../../src/timezone/autogen.zonedata';
import { createTzDatabase, tzdbRecord } from '../../src/timezone/database';
import { type ConformanceCase, collector, random } from './_shared';

const DAY = 86400000;
const MAX = 8.64e15;
const MODES: Disambiguation[] = ['compatible', 'earlier', 'later', 'reject'];

/** A day object as given, not validated (hand-built days are checked by every function). */
const D = (year: number, month: number, d: number): Day => ({ year, month, day: d });
const T = (hour: number, minute = 0, second = 0, millis = 0): TimeOfDay => ({
  hour,
  minute,
  second,
  millis,
});

/** Zig error names for the TypeScript RangeError messages, by message prefix. */
const ERRORS: [string, string][] = [
  ['Invalid day', 'InvalidDay'],
  ['Day out of range', 'DayOutOfRange'],
  ['Invalid time of day', 'InvalidTimeOfDay'],
  ['Milliseconds since midnight', 'InvalidMillis'],
  ['First day of week', 'InvalidFirstDay'],
  ['Range step', 'InvalidStep'],
  ['Unknown time zone', 'UnknownTimeZone'],
  ['Invalid instant', 'InvalidInstant'],
  ['Instant out of range', 'InstantOutOfRange'],
  ['Time happens twice', 'RepeatedTime'],
  ["Time doesn't exist", 'SkippedTime'],
];

const errorName = (msg: string): string => {
  const e = ERRORS.find(([prefix]) => msg.startsWith(prefix));
  if (!e) {
    throw new Error(`unmapped error: ${msg}`);
  }
  return e[1];
};

/** `String(f())`, or `!ErrorName` if it throws. */
const token = (f: () => unknown): string => {
  try {
    return String(f());
  } catch (e) {
    return `!${errorName((e as Error).message)}`;
  }
};

/** 32-bit FNV-1a over the bytes of an ASCII string, continuing from `h`. */
const fnv = (h: number, s: string): number => {
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  }
  return h;
};

const untilsOf = (id: string): number[] => {
  const rec = tzdbRecord(createTzDatabase(rawdata), id);
  return rec ? rec[1].untils : [];
};

/**
 * Wall clock times around a transition at `u` from offset `a` to offset `b`: both edges of the
 * gap or overlap, and its middle.
 */
const transitionWalls = (u: number, a: number, b: number): number[] => [
  u + a - 1,
  u + a,
  u + b - 1,
  u + b,
  Math.floor((2 * u + a + b) / 2),
];

const dayOfWall = (w: number): Day => dayFromEpochDay(Math.floor(w / DAY));
const timeOfWall = (w: number): TimeOfDay => timeOfDayFromMillis(w - Math.floor(w / DAY) * DAY);

/**
 * Every transition of a zone: for each, `instantToString` just before and at it, `dayAtTime`
 * at `transitionWalls` in every mode, and `dayStartInstant` for the days the transition
 * touches. Hashed as `<fn>|<inputs>|<result or !Error>;` strings.
 */
const sweep = (zone: string): { count: number; hash: number } => {
  let h = 2166136261;
  let count = 0;
  const put = (s: string) => {
    h = fnv(h, s + ';');
    count++;
  };
  for (const u of untilsOf(zone)) {
    const a = tzFromUTC(zone, u - 1)!.offset;
    const b = tzFromUTC(zone, u)!.offset;
    put(`S|${u - 1}|${token(() => instantToString(u - 1, zone))}`);
    put(`S|${u}|${token(() => instantToString(u, zone))}`);
    for (const w of transitionWalls(u, a, b)) {
      const d = dayOfWall(w);
      const t = timeOfWall(w);
      for (const mode of MODES) {
        put(`A|${w}|${mode}|${token(() => dayAtTime(d, t, zone, { disambiguation: mode }))}`);
      }
    }
    const n0 = Math.floor((u + a) / DAY);
    const n1 = Math.floor((u + b) / DAY);
    for (const n of n1 === n0 ? [n0] : [n0, n1]) {
      put(`B|${n}|${token(() => dayStartInstant(dayFromEpochDay(n), zone))}`);
      put(`B|${n + 1}|${token(() => dayStartInstant(dayFromEpochDay(n + 1), zone))}`);
    }
  }
  return { count, hash: h };
};

export const cases = (): ConformanceCase[] => {
  const { cases, add } = collector();
  const r = random(20261105);
  const zones = tzZoneIds();

  // -------------------------------------------------------------------------------------------
  // Days
  // -------------------------------------------------------------------------------------------

  const fixedDays: [number, number, number][] = [
    [2026, 1, 31],
    [2024, 2, 29],
    [2026, 2, 29],
    [2026, 2, 30],
    [2026, 13, 1],
    [2026, 0, 1],
    [2026, 1, 0],
    [2026, 1, -1],
    [300000, 1, 1],
    [1900, 2, 29],
    [2000, 2, 29],
    [2100, 2, 29],
    [0, 2, 29],
    [-4, 2, 29],
    [-1, 2, 29],
    [-100, 2, 29],
    [-400, 2, 29],
    [1970, 1, 1],
    [1969, 12, 31],
    [1, 1, 1],
    [0, 1, 1],
    [9999, 12, 31],
    [10000, 1, 1],
    [-1, 12, 31],
    [275760, 9, 13],
    [275760, 9, 14],
    [-271821, 4, 20],
    [-271821, 4, 19],
    [275760, 12, 31],
    [-271821, 1, 1],
    [2026, 4, 31],
    [2026, 6, 30],
    [2026, 12, 32],
  ];
  for (const [y, m, d] of fixedDays) {
    add('day', [y, m, d], () => day(y, m, d));
    add('isDay', [D(y, m, d)], () => isDay(D(y, m, d)));
  }
  for (let i = 0; i < 150; i++) {
    const y = r.pick([r.int(1900, 2100), r.int(-3000, 3000), r.int(-300000, 300000)]);
    const m = r.int(-1, 14);
    const d = r.int(-1, 32);
    add('day', [y, m, d], () => day(y, m, d));
  }

  // A spread of valid days: month ends, leap days, the range ends, random ones.
  const days: Day[] = [];
  for (const y of [2024, 2025, 2026, 1900, 2000, 2100, 1600, 0, -1, -4]) {
    for (let m = 1; m <= 12; m++) {
      days.push(day(y, m, 1), day(y, m, daysInMonth(y, m)));
    }
  }
  days.push(dayFromEpochDay(1e8), dayFromEpochDay(-1e8), dayFromEpochDay(1e8 - 40));
  days.push(dayFromEpochDay(-1e8 + 40), day(2026, 1, 28), day(2026, 1, 29), day(2026, 1, 30));
  for (let i = 0; i < 30; i++) {
    days.push(dayFromEpochDay(r.pick([r.int(-1e8, 1e8), r.int(-80000, 80000)])));
  }
  const bad: Day[] = [
    D(2026, 2, 30),
    D(2026, 13, 1),
    D(2026, 0, 1),
    D(300000, 1, 1),
    D(2026, 1, 0),
  ];

  for (const n of [
    0,
    -1,
    1,
    11017,
    -719162,
    20484,
    1e8,
    -1e8,
    1e8 + 1,
    -1e8 - 1,
    2 ** 40,
    -(2 ** 40),
  ]) {
    add('dayFromEpochDay', [n], () => dayFromEpochDay(n));
  }
  for (let i = 0; i < 100; i++) {
    const n = r.int(-1e8, 1e8);
    add('dayFromEpochDay', [n], () => dayFromEpochDay(n));
  }
  for (const d of [...days, ...bad]) {
    add('dayToEpochDay', [d], () => dayToEpochDay(d));
    add('dayToString', [d], () => dayToString(d));
    add('dayOfWeek', [d], () => dayOfWeek(d));
    add('dayOfYear', [d], () => dayOfYear(d));
    add('dayDaysInMonth', [d], () => dayDaysInMonth(d));
    add('dayIsLeapYear', [d], () => dayIsLeapYear(d));
  }
  for (const y of [2024, 2026, 1900, 2000, 0, -1, -4, -100, -400, 275760, -271821]) {
    add('isLeapYear', [y], () => isLeapYear(y));
    for (let m = 1; m <= 12; m++) {
      add('daysInMonth', [y, m], () => daysInMonth(y, m));
    }
  }

  // Parsing.
  for (const s of [
    '2026-01-31',
    '0001-01-01',
    '+012345-06-07',
    '-000044-03-15',
    '2026-02-30',
    '2026-1-31',
    '26-01-31',
    '2026-01-31T00:00',
    ' 2026-01-31',
    '2026-01-31 ',
    '2026-01-31\n',
    '-000000-01-01',
    '+000000-01-01',
    '0000-01-01',
    '',
    '2024-02-29',
    '2023-02-29',
    '+275760-09-13',
    '+275760-09-14',
    '-271821-04-20',
    '-271821-04-19',
    '12026-01-31',
    '+12026-01-31',
    '2026/01/31',
    '２０２６-01-31',
    '2026-00-10',
    '2026-12-00',
    '2026-13-01',
    '9999-12-31',
    '+010000-01-01',
    '-000001-12-31',
  ]) {
    add('dayParse', [s], () => dayParse(s));
    add('dayFromString', [s], () => dayFromString(s));
  }

  // Arithmetic, dense at month ends.
  const durations: DayDuration[] = [
    {},
    { days: 0 },
    { days: 1 },
    { days: -1 },
    { days: 30 },
    { days: -31 },
    { days: 365 },
    { days: 366 },
    { weeks: 2 },
    { weeks: -1 },
    { months: 1 },
    { months: -1 },
    { months: 2 },
    { months: -2 },
    { months: 11 },
    { months: 12 },
    { months: 13 },
    { months: -13 },
    { months: 25 },
    { years: 1 },
    { years: -1 },
    { years: 4 },
    { years: 100 },
    { years: -400 },
    { months: 1, days: 1 },
    { years: 1, days: 1 },
    { years: 1, months: -12 },
    { years: 1, months: 1, weeks: 1, days: 1 },
    { years: -1, months: -1, weeks: -1, days: -1 },
    { days: 1e8 },
    { days: 2e8 },
    { days: -2e8 },
    { years: 300000 },
    { years: -300000 },
    { months: 1e12, days: -30436875000000 },
    { months: -1200000, days: 36524250 },
    { days: Number.MAX_SAFE_INTEGER },
    { days: -Number.MAX_SAFE_INTEGER },
  ];
  const monthEnds = [
    D(2026, 1, 31),
    D(2026, 1, 30),
    D(2026, 1, 29),
    D(2026, 1, 28),
    D(2024, 1, 31),
    D(2024, 2, 29),
    D(2023, 2, 28),
    D(2026, 3, 31),
    D(2026, 5, 31),
    D(2026, 8, 31),
    D(2026, 12, 31),
    D(2000, 2, 29),
    D(1900, 2, 28),
    D(-1, 12, 31),
    D(0, 2, 29),
    D(275760, 9, 13),
    D(-271821, 4, 20),
  ];
  for (const d of [...monthEnds, ...bad.slice(0, 2)]) {
    for (const x of durations) {
      add('dayAdd', [d, x], () => dayAdd(d, x));
      add('daySubtract', [d, x], () => daySubtract(d, x));
    }
  }
  for (let i = 0; i < 200; i++) {
    const d = r.pick(days);
    const x: DayDuration = {};
    for (const k of ['years', 'months', 'weeks', 'days'] as const) {
      if (r.next() < 0.4) {
        x[k] = r.pick([r.int(-30, 30), r.int(-5000, 5000), r.int(-1e6, 1e6)]);
      }
    }
    const fn = r.next() < 0.5 ? 'dayAdd' : 'daySubtract';
    add(fn, [d, x], () => (fn === 'dayAdd' ? dayAdd(d, x) : daySubtract(d, x)));
  }

  // Comparisons and differences.
  const pairs: [Day, Day][] = [
    [D(2026, 1, 31), D(2026, 2, 1)],
    [D(2026, 2, 1), D(2026, 1, 31)],
    [D(2026, 1, 31), D(2026, 1, 31)],
    [D(2025, 12, 31), D(2026, 1, 31)],
    [D(2026, 1, 29), D(2026, 1, 31)],
    [D(2026, 1, 29), D(2026, 1, 20)],
    [D(2025, 1, 1), D(2026, 1, 1)],
    [D(2026, 1, 29), D(2026, 2, 11)],
    [D(2026, 1, 29), D(2026, 1, 16)],
    [D(2026, 1, 31), D(2026, 2, 28)],
    [D(2026, 1, 15), D(2026, 2, 14)],
    [D(2026, 1, 15), D(2026, 2, 15)],
    [D(2026, 3, 31), D(2026, 2, 28)],
    [D(2026, 3, 15), D(2026, 2, 20)],
    [D(2024, 2, 29), D(2025, 2, 28)],
    [D(2024, 3, 1), D(2025, 2, 28)],
    [D(2026, 6, 1), D(2020, 6, 2)],
    [D(2025, 2, 28), D(2024, 2, 29)],
    [D(2024, 2, 29), D(2028, 2, 28)],
    [D(2024, 2, 29), D(2028, 2, 29)],
    [D(2026, 3, 31), D(2026, 4, 30)],
    [D(2026, 5, 31), D(2026, 4, 30)],
    [D(275760, 8, 31), D(275760, 9, 13)],
    [D(275760, 8, 13), D(275760, 9, 13)],
    [D(-271821, 4, 20), D(275760, 9, 13)],
    [D(275760, 9, 13), D(-271821, 4, 20)],
    [D(2026, 2, 30), D(2026, 3, 1)],
    [D(2026, 3, 1), D(2026, 2, 30)],
  ];
  for (let i = 0; i < 150; i++) {
    const a = r.pick(days);
    const near = Math.max(-1e8, Math.min(1e8, dayToEpochDay(a) + r.int(-800, 800)));
    pairs.push([a, r.next() < 0.5 ? r.pick(days) : dayFromEpochDay(near)]);
  }
  for (const [a, b] of pairs) {
    add('dayCompare', [a, b], () => dayCompare(a, b));
    add('dayEquals', [a, b], () => dayEquals(a, b));
    add('dayIsBefore', [a, b], () => dayIsBefore(a, b));
    add('dayIsAfter', [a, b], () => dayIsAfter(a, b));
    for (const unit of [undefined, 'days', 'weeks', 'months', 'years'] as (DayUnit | undefined)[]) {
      add('dayUntil', unit ? [a, b, unit] : [a, b], () => dayUntil(a, b, unit));
    }
  }
  // Month ends against each other, for months and years.
  for (const a of monthEnds.slice(0, 13)) {
    for (const b of monthEnds.slice(0, 13)) {
      add('dayUntil', [a, b, 'months'], () => dayUntil(a, b, 'months'));
      add('dayUntil', [a, b, 'years'], () => dayUntil(a, b, 'years'));
    }
  }

  // Weeks, months and years.
  for (const d of [
    D(2026, 1, 28),
    D(2026, 2, 1),
    D(1970, 1, 1),
    D(1969, 12, 28),
    dayFromEpochDay(1e8),
    dayFromEpochDay(-1e8),
    dayFromEpochDay(1e8 - 3),
    dayFromEpochDay(-1e8 + 3),
    D(2026, 2, 30),
    ...days.slice(-12),
  ]) {
    for (const f of [0, 1, 2, 3, 4, 5, 6, 7, 8, -1]) {
      add('dayStartOfWeek', [d, f], () => dayStartOfWeek(d, f));
      add('dayEndOfWeek', [d, f], () => dayEndOfWeek(d, f));
    }
    for (const u of ['month', 'year'] as const) {
      add('dayStartOf', [d, u], () => dayStartOf(d, u));
      add('dayEndOf', [d, u], () => dayEndOf(d, u));
    }
  }

  // Ranges.
  const ranges: [Day, Day, DayDuration | undefined][] = [
    [D(2026, 1, 30), D(2026, 2, 2), undefined],
    [D(2026, 2, 2), D(2026, 1, 30), undefined],
    [D(2026, 1, 31), D(2026, 1, 31), undefined],
    [D(2026, 1, 26), D(2026, 2, 28), { weeks: 1 }],
    [D(2026, 1, 31), D(2026, 5, 31), { months: 1 }],
    [D(2024, 2, 29), D(2036, 3, 1), { years: 1 }],
    [D(2024, 2, 29), D(2036, 3, 1), { years: 4 }],
    [D(2026, 1, 31), D(2027, 1, 31), { months: 1, days: 1 }],
    [D(2026, 1, 1), D(2026, 1, 1), { days: 0 }],
    [D(2026, 1, 1), D(2026, 1, 1), { days: -1 }],
    [D(2026, 1, 1), D(2026, 1, 1), { months: 1, days: -1 }],
    [D(2026, 1, 1), D(2026, 1, 1), {}],
    [D(2026, 1, 1), D(2026, 1, 1), { days: Number.MAX_SAFE_INTEGER }],
    [D(2026, 1, 1), D(2026, 1, 1), { months: Number.MAX_SAFE_INTEGER }],
    [D(2026, 1, 1), D(2026, 1, 1), { years: 1e15 }],
    [dayFromEpochDay(1e8), dayFromEpochDay(1e8), undefined],
    [dayFromEpochDay(99999990), dayFromEpochDay(1e8), { months: 1 }],
    [dayFromEpochDay(99999990), dayFromEpochDay(1e8), { days: 3 }],
    [dayFromEpochDay(-1e8), dayFromEpochDay(-1e8 + 5), undefined],
    [D(2026, 2, 30), D(2026, 3, 1), undefined],
    [D(2026, 3, 1), D(2026, 2, 30), undefined],
  ];
  for (let i = 0; i < 40; i++) {
    const a = r.pick(days);
    const b = dayFromEpochDay(Math.min(1e8, dayToEpochDay(a) + r.int(-5, 60)));
    ranges.push([
      a,
      b,
      r.pick([
        undefined,
        { days: r.int(1, 9) },
        { weeks: 1 },
        { months: r.int(0, 2), days: r.int(1, 3) },
      ]),
    ]);
  }
  for (const [a, b, step] of ranges) {
    add('dayRange', step ? [a, b, step] : [a, b], () => dayRange(a, b, step));
  }

  // -------------------------------------------------------------------------------------------
  // Times of day
  // -------------------------------------------------------------------------------------------

  const times: [number, number?, number?, number?][] = [
    [6, 30],
    [24, 0],
    [6, 60],
    [6, 0, 60],
    [6, 0, 0, 1000],
    [-1],
    [0],
    [23, 59, 59, 999],
    [12, 0, 0, 5],
    [0, 0, 1],
    [6, -1],
    [6, 0, -1],
    [6, 0, 0, -1],
  ];
  for (const [h, m, s, ms] of times) {
    const args = [h, m, s, ms].filter((x) => x !== undefined);
    add('timeOfDay', args, () => timeOfDay(h, m, s, ms));
    const t = T(h, m ?? 0, s ?? 0, ms ?? 0);
    add('isTimeOfDay', [t], () => isTimeOfDay(t));
    add('timeOfDayToMillis', [t], () => timeOfDayToMillis(t));
    add('timeOfDayToString', [t], () => timeOfDayToString(t));
  }
  for (const ms of [0, 1, 999, 1000, 23400000, 86399999, 86400000, -1, 3600000, 59999]) {
    add('timeOfDayFromMillis', [ms], () => timeOfDayFromMillis(ms));
  }
  for (let i = 0; i < 100; i++) {
    const ms = r.int(-1000, 86401000);
    add('timeOfDayFromMillis', [ms], () => timeOfDayFromMillis(ms));
    const t = timeOfDayFromMillis(r.int(0, 86399999));
    const t2 = r.next() < 0.5 ? T(t.hour, t.minute, 0, 0) : t;
    add('timeOfDayToString', [t2], () => timeOfDayToString(t2));
    add('timeOfDayToMillis', [t2], () => timeOfDayToMillis(t2));
    add('timeOfDayParse', [timeOfDayToString(t2)], () => timeOfDayParse(timeOfDayToString(t2)));
  }
  for (const s of [
    '06:30',
    '06:30:15',
    '06:30:15.25',
    '06:30:15.123456789',
    '06:30:15.1234567890',
    '06:30:15,25',
    '6:30',
    '24:00',
    '23:59:59.999',
    '06:60',
    '06:30:60',
    '06:30Z',
    '06:30:15.',
    '06:30.5',
    '',
    '0630',
    '06:30:5',
    ' 06:30',
    '06:30\n',
    '00:00',
    '25:00',
    '١٢:٠٠',
  ]) {
    add('timeOfDayParse', [s], () => timeOfDayParse(s));
    add('timeOfDayFromString', [s], () => timeOfDayFromString(s));
  }
  const tpairs: [TimeOfDay, TimeOfDay][] = [
    [T(6, 30), T(18, 0)],
    [T(6, 30), T(6, 30)],
    [T(18, 0), T(6, 30)],
    [T(6, 30, 0, 1), T(6, 30)],
    [T(24, 0), T(6, 30)],
    [T(6, 30), T(6, 30, 60)],
  ];
  for (let i = 0; i < 30; i++) {
    tpairs.push([timeOfDayFromMillis(r.int(0, 86399999)), timeOfDayFromMillis(r.int(0, 86399999))]);
  }
  for (const [a, b] of tpairs) {
    add('timeOfDayCompare', [a, b], () => timeOfDayCompare(a, b));
  }

  // -------------------------------------------------------------------------------------------
  // Zones
  // -------------------------------------------------------------------------------------------

  for (const z of [
    'America/Vancouver',
    'AMERICA/VANCOUVER',
    'america/vancouver',
    'asia/calcutta',
    'Asia/Calcutta',
    'asia/TOKYO',
    'UTC',
    'utc',
    'Etc/UTC',
    'Z',
    'Mars/Olympus',
    '',
    'Europe/Kiev',
    'ASIA/KOLKATA',
    'Europe/Kİev',
    'EST5EDT',
    'est5edt',
    'US/Pacific',
    'Pacific/Samoa',
  ]) {
    add('timeZoneId', [z], () => timeZoneId(z));
  }
  for (const z of zones) {
    add('timeZoneId', [z.toUpperCase()], () => timeZoneId(z.toUpperCase()));
  }

  const NY = 'America/New_York';
  const instants = [
    0,
    -1,
    1,
    Date.UTC(2026, 0, 31, 3, 30),
    Date.UTC(2026, 6, 1),
    Date.UTC(1969, 11, 31, 23),
    Date.UTC(-50, 0, 1),
    Date.UTC(1900, 0, 1),
    Date.UTC(1883, 10, 18, 17),
    MAX,
    -MAX,
    MAX + 1,
    -MAX - 1,
    MAX - 1,
    -MAX + 1,
    9e15,
    Number.MAX_SAFE_INTEGER,
  ];
  const instantZones = [
    NY,
    'Asia/Tokyo',
    'Pacific/Kiritimati',
    'Pacific/Pago_Pago',
    'UTC',
    'Asia/Kolkata',
    'Europe/Paris',
    'Africa/Monrovia',
    'America/Vancouver',
    'Mars/Olympus',
  ];
  for (const t of instants) {
    add('instantToString', [t], () => instantToString(t));
    for (const z of instantZones) {
      add('timeZoneOffset', [z, t], () => timeZoneOffset(z, t));
      add('dayFromInstant', [t, z], () => dayFromInstant(t, z));
      add('timeOfDayFromInstant', [t, z], () => timeOfDayFromInstant(t, z));
      add('dayToday', [z, t], () => dayToday(z, t));
      add('instantToString', [t, z], () => instantToString(t, z));
    }
  }
  for (let i = 0; i < 180; i++) {
    const t = r.pick([r.int(-4e12, 4.2e12), r.int(-MAX, MAX), r.int(1.5e12, 1.9e12)]);
    const z = r.pick(zones);
    add('timeZoneOffset', [z, t], () => timeZoneOffset(z, t));
    add('dayFromInstant', [t, z], () => dayFromInstant(t, z));
    add('timeOfDayFromInstant', [t, z], () => timeOfDayFromInstant(t, z));
    const s = instantToString(t, z);
    add('instantToString', [t, z], () => s);
    add('instantParse', [s], () => instantParse(s));
    add('instantToString', [t], () => instantToString(t));
  }

  // Parsing instants.
  const parses: [string, string?][] = [
    ['2026-01-31T17:00:00Z'],
    ['2026-01-31T09:00:00.5-08:00'],
    ['2026-01-31 22:30+0530'],
    ['2026-01-31T22:30+05'],
    ['2026-01-31t22:30z'],
    ['2026-01-31T09:00'],
    ['2026-01-31T09:00', 'America/Vancouver'],
    ['2026-01-31'],
    ['2026-02-30T00:00Z'],
    ['2026-01-31T24:00Z'],
    ['2026-01-31T09:00+24:00'],
    ['2026-01-31T09:00+23:59:59'],
    ['2026-01-31T09:00+00:60'],
    ['2026-01-31T09:00+00:00:60'],
    ['2026-01-31T09:00+0530:15'],
    ['2026-01-31T09:00+053015'],
    ['2026-01-31T09:00+05:3015'],
    ['2026-01-31T09:00+05:'],
    ['2026-01-31T09:00+5'],
    ['2026-01-31T09:00-00:00'],
    ['2026-01-31T09:00:00,123456789Z'],
    ['2026-01-31T09:00:00.1234567891Z'],
    ['2026-01-31T09:00:00.Z'],
    ['2026-01-31T09:00.5Z'],
    ['2026-01-31T9:00Z'],
    ['2026-01-31T09:00:00Z\n'],
    ['2026-01-31T09:00:00ZZ'],
    ['yesterday'],
    [''],
    ['1900-01-01T00:00Z'],
    ['+275760-09-13T00:00Z'],
    ['+275760-09-13T00:00:00.001Z'],
    ['+275760-09-13T00:01Z'],
    ['+275760-09-13T01:00+01:00'],
    ['+275760-09-13T00:00', 'America/New_York'],
    ['+275760-09-13T00:00', 'Asia/Tokyo'],
    ['-271821-04-20T00:00Z'],
    ['-271821-04-20T00:00+01:00'],
    ['-271821-04-20T00:00-01:00'],
    ['-271821-04-19T23:00-01:00'],
    ['-000000-01-01T00:00Z'],
    ['+000000-01-01T00:00Z'],
    ['0000-01-01T00:00Z'],
    ['2026-01-31T09:00', 'Mars/Olympus'],
    ['2026-01-31T09:00Z', 'Mars/Olympus'],
    ['2026-01-31', 'Mars/Olympus'],
    ['2025-03-09T02:30', NY],
    ['2025-03-09T03:00', NY],
    ['2025-03-09T01:59:59.999', NY],
    ['2025-11-02T01:30', NY],
    ['2025-11-02T00:59:59.999', NY],
    ['2025-11-02T02:00', NY],
    ['2025-09-07T00:30', 'America/Santiago'],
    ['2011-12-30T12:00', 'Pacific/Apia'],
    ['1919-03-31T00:15', 'America/Toronto'],
    ['2026-01-31T09:00', 'asia/calcutta'],
  ];
  for (const [s, z] of parses) {
    add('instantParse', z === undefined ? [s] : [s, z], () => instantParse(s, z));
  }
  for (const z of instantZones.slice(0, 9)) {
    const t = instantParse('1900-01-01T00:00Z')!;
    add('instantParse', [instantToString(t, z)], () => instantParse(instantToString(t, z)));
  }

  // Wall clock times to instants, from the unit tests.
  const spring = D(2025, 3, 9);
  const fall = D(2025, 11, 2);
  const atCases: [Day, TimeOfDay, string, Disambiguation?][] = [
    [D(2026, 1, 31), T(9), NY],
    [D(2026, 7, 31), T(9), NY],
    [D(2026, 1, 31), T(9), 'Asia/Tokyo'],
    [D(2026, 2, 30), T(9), 'UTC'],
    [D(2026, 1, 1), T(24), 'UTC'],
    [D(2026, 1, 1), T(9), 'Mars/Olympus'],
    [D(2026, 2, 30), T(24), 'Mars/Olympus'],
    [dayFromEpochDay(1e8), T(23), NY],
    [dayFromEpochDay(1e8), T(0), 'UTC'],
    [dayFromEpochDay(1e8), T(0), 'Asia/Tokyo'],
    [dayFromEpochDay(-1e8), T(0), 'UTC'],
    [dayFromEpochDay(-1e8), T(0), NY],
    [dayFromEpochDay(-1e8), T(0), 'Asia/Tokyo'],
  ];
  for (const mode of [undefined, ...MODES]) {
    for (const t of [T(2, 30), T(3, 0), T(1, 59, 59, 999), T(2, 0), T(1, 30), T(0, 59, 59, 999)]) {
      atCases.push([spring, t, NY, mode], [fall, t, NY, mode]);
    }
  }
  for (let k = 3; k <= 12; k++) {
    atCases.push([D(2025, 3, k), T(9), NY]);
  }
  for (const [d, t, z, mode] of atCases) {
    add('dayAtTime', mode ? [d, t, z, { disambiguation: mode }] : [d, t, z], () =>
      dayAtTime(d, t, z, mode ? { disambiguation: mode } : undefined),
    );
  }

  // Start of day.
  const starts: [Day, string][] = [
    [D(2026, 1, 31), NY],
    [D(2025, 9, 7), 'America/Santiago'],
    [D(1919, 3, 31), 'America/Toronto'],
    [D(2011, 12, 31), 'Pacific/Apia'],
    [D(2011, 12, 30), 'Pacific/Apia'],
    [D(2011, 12, 29), 'Pacific/Apia'],
    [D(2026, 2, 30), 'UTC'],
    [D(2026, 1, 31), 'Mars/Olympus'],
    [dayFromEpochDay(1e8), 'UTC'],
    [dayFromEpochDay(1e8), NY],
    [dayFromEpochDay(1e8), 'Asia/Tokyo'],
    [dayFromEpochDay(-1e8), 'Asia/Tokyo'],
    [dayFromEpochDay(-1e8), NY],
  ];
  for (let i = 0; i < 80; i++) {
    starts.push([dayFromEpochDay(r.int(-60000, 60000)), r.pick(zones)]);
  }
  for (const [d, z] of starts) {
    add('dayStartInstant', [d, z], () => dayStartInstant(d, z));
  }

  // Explicit cases around the transitions of a few zones, 2021 to 2027 (the sweeps below
  // cover every transition of every zone).
  for (const z of [
    NY,
    'Europe/Berlin',
    'America/Santiago',
    'Australia/Lord_Howe',
    'Africa/Casablanca',
    'Europe/Dublin',
    'Antarctica/Troll',
    'America/Havana',
  ]) {
    for (const u of untilsOf(z)) {
      if (u < Date.UTC(2021, 0, 1) || u > Date.UTC(2027, 0, 1)) {
        continue;
      }
      const a = tzFromUTC(z, u - 1)!.offset;
      const b = tzFromUTC(z, u)!.offset;
      add('instantToString', [u - 1, z], () => instantToString(u - 1, z));
      add('instantToString', [u, z], () => instantToString(u, z));
      for (const w of transitionWalls(u, a, b)) {
        const d = dayOfWall(w);
        const t = timeOfWall(w);
        for (const mode of MODES) {
          add('dayAtTime', [d, t, z, { disambiguation: mode }], () =>
            dayAtTime(d, t, z, { disambiguation: mode }),
          );
        }
        add('dayStartInstant', [d, z], () => dayStartInstant(d, z));
      }
    }
  }

  // Random wall clock times in random zones.
  for (let i = 0; i < 200; i++) {
    const z = r.pick(zones);
    const d = dayFromEpochDay(r.int(-50000, 50000));
    const t = timeOfDayFromMillis(r.int(0, 86399999));
    const mode = r.pick(MODES);
    add('dayAtTime', [d, t, z, { disambiguation: mode }], () =>
      dayAtTime(d, t, z, { disambiguation: mode }),
    );
  }

  // A forward jump crossing midnight with unequal offsets forces the start-of-day
  // binary search to converge to the exact millisecond, beyond its first midpoint.
  const midnightGap: RawData = {
    zoneids: 'Test/Midnight',
    links: '',
    index: (86400).toString(36),
    zoneinfo: ['230_0_0__BEF:0:-1e0|AFT:1:230_1_0'],
  };
  add('dayStartInstantCustom', [midnightGap, D(1970, 1, 2), 'Test/Midnight'], () => {
    setTimeZoneData(midnightGap);
    try {
      return dayStartInstant(D(1970, 1, 2), 'Test/Midnight');
    } finally {
      setTimeZoneData(defaultTimeZoneData);
    }
  });

  // Every transition of every zone.
  for (const z of zones) {
    add('dtSweep', [z], () => sweep(z));
  }

  return cases;
};
