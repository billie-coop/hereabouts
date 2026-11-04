/**
 * Builds the shared timezone test cases in `conformance/timezone.json`.
 *
 * Every function of `src/timezone` is called with fixed inputs (from the unit tests in
 * `__tests__/timezone`) and seeded random ones. Transitions get the most attention:
 *
 * - `tzFromUTC` / `tzFromWall` cases right around transitions (gaps, overlaps, historic and
 *   odd offsets) for a list of zones, and for transitions picked at random from every zone.
 * - `tzSweep`: for one zone, every transition in the data, probed at the instants listed in
 *   `sweepPoints` below, folded into a hash. One small case per zone covers every transition
 *   of every zone; the explicit cases are there to debug a mismatch.
 * - `tzCustom`: a call made while replacement data is active (`setTimeZoneData`).
 *
 * Instants are integers within the range where JavaScript numbers are exact.
 */

import {
  defaultTimeZoneData,
  type RawData,
  setTimeZoneData,
  tzFromUTC,
  tzFromWall,
  tzResolveId,
  tzUtcZone,
  tzZoneIds,
  tzZoneMeta,
  type ZoneInfo,
} from '../../src/timezone';
import { rawdata } from '../../src/timezone/autogen.zonedata';
import { createTzDatabase, tzdbRecord } from '../../src/timezone/database';
import { type ConformanceCase, collector, random } from './_shared';

const DAY = 86400000;

/** Transition instants of a zone, decoded from raw data (the bundled data by default). */
const untilsOf = (id: string, raw: RawData = rawdata): number[] => {
  const rec = tzdbRecord(createTzDatabase(raw), id);
  return rec ? rec[1].untils : [];
};

/**
 * Instants probed around one transition `u`: just before and at it in UTC, and in wall clock
 * time at both edges of the gap or overlap, its middle, and a day either side. `a` and `b` are
 * the offsets before and after.
 */
export const sweepPoints = (
  u: number,
  a: number,
  b: number,
): { utc: number[]; wall: number[] } => ({
  utc: [u - 1, u, u + 1],
  wall: [
    u + a - 1,
    u + a,
    u + b - 1,
    u + b,
    Math.floor((2 * u + a + b) / 2),
    u + a - DAY,
    u + b + DAY,
  ],
});

/** 32-bit FNV-1a over the bytes of an ASCII string, continuing from `h`. */
const fnv = (h: number, s: string): number => {
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  }
  return h;
};

const infoText = (i: ZoneInfo): string => `${i.zoneid}|${i.abbr}|${i.dst}|${i.offset}`;

/**
 * Every transition of a zone in the active data (decoded from `raw`), probed at `sweepPoints`,
 * as a count and a hash.
 */
const sweep = (id: string, raw: RawData = rawdata): { count: number; hash: number } => {
  let h = 2166136261;
  let count = 0;
  for (const u of untilsOf(id, raw)) {
    const a = tzFromUTC(id, u - 1)!.offset;
    const b = tzFromUTC(id, u)!.offset;
    const p = sweepPoints(u, a, b);
    for (const t of p.utc) {
      h = fnv(h, `U${t}|${infoText(tzFromUTC(id, t)!)};`);
      count++;
    }
    for (const t of p.wall) {
      const [utc, info] = tzFromWall(id, t)!;
      h = fnv(h, `W${t}|${utc}|${infoText(info)};`);
      count++;
    }
  }
  return { count, hash: h };
};

// Zones with interesting transitions: ordinary DST both sides of the equator, DST at
// midnight, negative DST, 30 and 45 minute offsets and DST, a 2 hour DST, a skipped day, the
// 2026 Canadian switches to permanent time, a zone with no transitions.
const FOCUS = [
  'America/New_York',
  'Europe/Berlin',
  'Europe/London',
  'Europe/Dublin',
  'Africa/Casablanca',
  'America/Santiago',
  'America/Sao_Paulo',
  'Australia/Sydney',
  'Australia/Lord_Howe',
  'Pacific/Chatham',
  'Pacific/Apia',
  'Pacific/Kiritimati',
  'Antarctica/Troll',
  'Asia/Kathmandu',
  'Asia/Kolkata',
  'America/St_Johns',
  'America/Vancouver',
  'America/Edmonton',
  'Europe/Paris',
  'Africa/Monrovia',
  'Asia/Tehran',
  'America/Havana',
  'Etc/UTC',
];

export const cases = (): ConformanceCase[] => {
  const { cases, add } = collector();
  const ids = tzZoneIds();

  const fromUTC = (id: string, t: number) => add('tzFromUTC', [id, t], () => tzFromUTC(id, t));
  const fromWall = (id: string, t: number) => add('tzFromWall', [id, t], () => tzFromWall(id, t));

  // Simple lookups.
  add('tzUtcZone', [], () => tzUtcZone());
  add('tzZoneIds', [], () => tzZoneIds());
  for (const id of [
    'RANDOM',
    'Pacific/Samoa',
    'pacific/samoa',
    'PACIFIC/SAMOA',
    'UTC',
    'utc',
    '',
  ]) {
    add('tzResolveId', [id], () => tzResolveId(id));
  }
  // Every id and alias, as given and in lower case: what the data indexes.
  const db = createTzDatabase(rawdata);
  for (const key of Array.from(db.linkindex.keys()).sort()) {
    add('tzResolveId', [key], () => tzResolveId(key));
  }
  for (const id of ids) {
    add('tzZoneMeta', [id], () => tzZoneMeta(id));
  }
  for (const id of [
    'Africa/Bamako',
    'CET',
    'europe/london',
    'FOO',
    'Asia/Calcutta',
    'US/Pacific',
  ]) {
    add('tzZoneMeta', [id], () => tzZoneMeta(id));
  }

  // From the unit tests.
  const OCT272019 = 1572138000000;
  for (const id of ['RANDOM', 'Africa/Addis_ababa', 'Africa/Addis_Ababa', 'Pacific/Samoa']) {
    fromUTC(id, OCT272019);
  }
  for (const id of ids) {
    fromUTC(id, OCT272019);
  }
  const SAFE = Number.MAX_SAFE_INTEGER;
  for (const id of ['America/New_York', 'Europe/Berlin', 'Asia/Tokyo', 'Etc/UTC']) {
    for (const t of [-SAFE, SAFE, -8.64e15, 8.64e15, -1e14, 1e14, 0, -1, 1]) {
      fromUTC(id, t);
    }
    // Wall times far enough inside the safe range that subtracting an offset stays exact.
    for (const t of [-8.64e15, 8.64e15, -8.64e15 - DAY, 8.64e15 + DAY, -1e14, 1e14, 0]) {
      fromWall(id, t);
    }
  }
  for (const t of [-2524524620000, -2524524680000, 1572137970000, 1572138030000]) {
    fromUTC('Europe/Berlin', t);
  }
  for (const t of [1552201170000, 1552201199000, 1552201200000, 1552201230000]) {
    fromUTC('America/New_York', t);
  }
  for (const t of [-2717650800000, -2717650860000]) {
    fromUTC('America/New_York', t);
  }
  for (const [id, h] of [
    ['America/Vancouver', 9],
    ['America/Edmonton', 8],
  ] as const) {
    const sw = Date.UTC(2026, 10, 1, h);
    for (const t of [
      Date.UTC(2025, 6, 15, 20),
      Date.UTC(2025, 11, 15, 20),
      Date.UTC(2026, 6, 15, 20),
      sw - 1000,
      sw - 1,
      sw,
      Date.UTC(2026, 11, 15, 20),
      Date.UTC(2027, 2, 15, 20),
      Date.UTC(2027, 6, 15, 20),
      Date.UTC(2030, 0, 15, 20),
    ]) {
      fromUTC(id, t);
    }
  }
  for (const t of [
    1583629200000, 1583632740000, 1583632800000, 1583632860000, 1583636340000, 1583636400000,
    1583639940000, 1583640000000, 1604192400000, 1604195940000, 1604196000000, 1604196060000,
    1604197800000, 1604199540000, 1604199600000, 1604203140000, -2776975260000, 4776975260000,
  ]) {
    fromWall('America/New_York', t);
  }
  for (const t of [
    1585443600000, 1585447140000, 1585447200000, 1585447260000, 1585450740000, 1585450800000,
    1603587600000, 1603591140000, 1603591200000, 1603594740000, 1603594800000, 1603594860000,
    1603598340000, 1603598400000,
  ]) {
    fromWall('Europe/Berlin', t);
  }

  // Around transitions of the focus zones: every transition from 1900 to 2040 for two, the
  // ones from 2015 to 2035 for the rest.
  FOCUS.forEach((id, k) => {
    const lo = k < 2 ? Date.UTC(1900, 0, 1) : Date.UTC(2015, 0, 1);
    const hi = k < 2 ? Date.UTC(2040, 0, 1) : Date.UTC(2035, 0, 1);
    for (const u of untilsOf(id)) {
      if (u < lo || u > hi) {
        continue;
      }
      const a = tzFromUTC(id, u - 1)!.offset;
      const b = tzFromUTC(id, u)!.offset;
      const p = sweepPoints(u, a, b);
      fromUTC(id, p.utc[0]);
      fromUTC(id, p.utc[1]);
      for (const t of p.wall.slice(0, 5)) {
        fromWall(id, t);
      }
    }
    // Each zone's first and last transitions, and past them.
    const us = untilsOf(id);
    for (const u of [...us.slice(0, 2), ...us.slice(-2)]) {
      fromUTC(id, u - 1);
      fromUTC(id, u);
      fromWall(id, u);
    }
  });

  // Transitions picked at random from every zone.
  const r = random(20261104);
  for (let i = 0; i < 600; i++) {
    const id = r.pick(ids);
    const us = untilsOf(id);
    if (us.length === 0) {
      continue;
    }
    const u = r.pick(us);
    const a = tzFromUTC(id, u - 1)!.offset;
    const b = tzFromUTC(id, u)!.offset;
    const p = sweepPoints(u, a, b);
    fromUTC(id, r.pick(p.utc));
    fromWall(id, r.pick(p.wall));
  }

  // Random instants and wall times, 1800 to 2130, in random zones.
  for (let i = 0; i < 300; i++) {
    const id = r.pick(ids);
    const t = r.int(-5364662400, 4985000000) * 1000 + r.int(0, 999);
    fromUTC(id, t);
    fromWall(r.pick(ids), t);
  }

  // Every transition of every zone, hashed.
  for (const id of ids) {
    add('tzSweep', [id], () => sweep(id));
  }

  // Replacement data. CUSTOM is from the unit tests: two zones with no transitions, one alias.
  const CUSTOM: RawData = {
    zoneids: 'Etc/UTC|Foo/Bar',
    links: 'Zulu:0|Foo/Baz:1',
    index: '',
    zoneinfo: ['0_0_0__UTC:0:0__', `${(3600).toString(36)}_0_0_XX_FOO:0:${(3600).toString(36)}__`],
  };
  // Two real zones under other names, so their transitions decode from the replacement data.
  const ny = rawdata.zoneids.split('|').indexOf('America/New_York');
  const lh = rawdata.zoneids.split('|').indexOf('Australia/Lord_Howe');
  const REAL: RawData = {
    zoneids: 'Test/East|Test/Howe|Test/East',
    links: 'Alias/One:0|ALIAS/TWO:1|Test/Howe:0|Alias/Last:2',
    index: rawdata.index,
    zoneinfo: [rawdata.zoneinfo[ny], rawdata.zoneinfo[lh], rawdata.zoneinfo[lh]],
  };
  const custom = (raw: RawData, name: string, fn: string, args: unknown[], f: () => unknown) =>
    add('tzCustom', [name, fn, ...args], () => {
      setTimeZoneData(raw);
      try {
        return f();
      } finally {
        setTimeZoneData(defaultTimeZoneData);
      }
    });
  const customs: [string, RawData][] = [
    ['custom', CUSTOM],
    ['real', REAL],
  ];
  for (const [name, raw] of customs) {
    custom(raw, name, 'tzZoneIds', [], () => tzZoneIds());
    for (const id of ['Test/East', 'Test/Howe', 'Foo/Bar']) {
      custom(raw, name, 'tzSweep', [id], () => sweep(id, raw));
    }
    for (const id of [
      'America/New_York',
      'foo/baz',
      'Foo/Baz',
      'Zulu',
      'zulu',
      'Etc/UTC',
      'etc/utc',
      'foo/bar',
      'Test/East',
      'test/east',
      'test/howe',
      'alias/one',
      'ALIAS/TWO',
      'alias/two',
      'Alias/Last',
    ]) {
      custom(raw, name, 'tzResolveId', [id], () => tzResolveId(id));
      custom(raw, name, 'tzZoneMeta', [id], () => tzZoneMeta(id));
      for (const t of [0, -SAFE, SAFE, 1583632800000, 1604196000000, 1585443600000]) {
        custom(raw, name, 'tzFromUTC', [id, t], () => tzFromUTC(id, t));
        // Near the safe integer limits a wall time minus an offset is rounded in JavaScript.
        if (Math.abs(t) < 1e15) {
          custom(raw, name, 'tzFromWall', [id, t], () => tzFromWall(id, t));
        }
      }
    }
  }
  // Data replaced and restored: the bundled data is back.
  setTimeZoneData(CUSTOM);
  setTimeZoneData(defaultTimeZoneData);
  fromUTC('America/New_York', 0);
  return cases;
};
