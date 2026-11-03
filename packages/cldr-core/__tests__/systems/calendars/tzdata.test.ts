import { defaultTimeZoneData, type RawData } from '@phensley/timezone';

// The metazone index is built on the first calendar operation and kept for the life of the
// module, so each test loads a fresh copy of the calendar code to control whether it is built
// before or after the time zone data is replaced. The time zone package is taken from the same
// fresh module graph, so `tz.setTimeZoneData` reaches the copy the calendar code uses (Vitest may
// re-evaluate the package on reset, e.g. when its CommonJS entry point is a single bundle).
let tz: typeof import('@phensley/timezone') | undefined;

const load = async () => {
  vi.resetModules();
  const c = await import('../../../src');
  tz = await import('@phensley/timezone');
  return c;
};

const setTimeZoneData = (raw: RawData): void => tz!.setTimeZoneData(raw);

const JAN_2024 = Date.UTC(2024, 0, 15, 12);

// Two zones with no transitions, one alias: a canonical list unrelated to the bundled one.
const CUSTOM: RawData = {
  zoneids: 'Etc/UTC|Foo/Bar',
  links: 'Zulu:0|Foo/Baz:1',
  index: '',
  zoneinfo: ['0_0_0__UTC:0:0__', `${(3600).toString(36)}_0_0_XX_FOO:0:${(3600).toString(36)}__`],
};

/**
 * Copy of the bundled data with two zones swapped in the canonical list (zone records and
 * link targets moved with them), so the data is consistent but every positional index into
 * the bundled list is wrong for those two zones.
 */
const swapped = (a: string, b: string): RawData => {
  const ids = defaultTimeZoneData.zoneids.split('|');
  const i = ids.indexOf(a);
  const j = ids.indexOf(b);
  const swap = (k: number) => (k === i ? j : k === j ? i : k);
  const zoneinfo = defaultTimeZoneData.zoneinfo.slice();
  [ids[i], ids[j]] = [ids[j], ids[i]];
  [zoneinfo[i], zoneinfo[j]] = [zoneinfo[j], zoneinfo[i]];
  const links = defaultTimeZoneData.links
    .split('|')
    .map((e) => {
      const [alias, k] = e.split(':');
      return `${alias}:${swap(Number(k))}`;
    })
    .join('|');
  return { ...defaultTimeZoneData, zoneids: ids.join('|'), links, zoneinfo };
};

afterEach(() => tz && tz.setTimeZoneData(defaultTimeZoneData));

const check = (c: Awaited<ReturnType<typeof load>>) => {
  let d = c.gregorianDateFromUnixEpoch(JAN_2024, 'America/New_York');
  expect(c.dateTimeZoneOffset(d)).toEqual(-18000000);
  expect(c.dateMetaZoneId(d)).toEqual('America_Eastern');
  expect(c.dateTimeZoneStableId(d)).toEqual('America/New_York');

  d = c.gregorianDateFromUnixEpoch(JAN_2024, 'Europe/London');
  expect(c.dateTimeZoneOffset(d)).toEqual(0);
  expect(c.dateMetaZoneId(d)).toEqual('GMT');
  expect(c.dateTimeZoneStableId(d)).toEqual('Europe/London');
};

test('different canonical zone list installed before first use', async () => {
  const c = await load();
  setTimeZoneData(CUSTOM);

  let d = c.gregorianDateFromUnixEpoch(0, 'Foo/Bar');
  expect(c.dateTimeZoneId(d)).toEqual('Foo/Bar');
  expect(c.dateTimeZoneOffset(d)).toEqual(3600000);
  expect(c.dateMetaZoneId(d)).toEqual('');
  expect(c.dateTimeZoneStableId(d)).toEqual('Foo/Bar');

  d = c.gregorianDateFromUnixEpoch(0, 'Etc/UTC');
  expect(c.dateTimeZoneOffset(d)).toEqual(0);
  expect(c.dateMetaZoneId(d)).toEqual('GMT');

  // Zones missing from the active data fall back to UTC, as for any unknown zone.
  d = c.gregorianDateFromUnixEpoch(0, 'America/New_York');
  expect(c.dateTimeZoneId(d)).toEqual('Etc/UTC');

  setTimeZoneData(defaultTimeZoneData);
  check(c);
});

test('reordered zone list installed before first use', async () => {
  const c = await load();
  setTimeZoneData(swapped('America/New_York', 'Europe/London'));
  check(c);

  // Restoring the bundled data gives the same answers.
  setTimeZoneData(defaultTimeZoneData);
  check(c);
});

test('reordered zone list installed after first use', async () => {
  const c = await load();
  check(c);
  setTimeZoneData(swapped('America/New_York', 'Europe/London'));
  check(c);
  setTimeZoneData(defaultTimeZoneData);
  check(c);
});

test('metazone lookups by zone id', async () => {
  await load();
  setTimeZoneData(swapped('America/New_York', 'Europe/London'));
  const c = await import('../../../src/systems/calendars/timezone');
  expect(c.getStableTimeZoneId('america/new_york')).toEqual('America/New_York');
  expect(c.getStableTimeZoneId('Asia/Calcutta')).toEqual('Asia/Calcutta');
  expect(c.getStableTimeZoneId('Asia/Kolkata')).toEqual('Asia/Calcutta');
  expect(c.currentMetazone('Europe/London')).toEqual('GMT');
  expect(c.currentMetazone('America/New_York')).toEqual('America_Eastern');
});

/**
 * Copy of the bundled data where an alias becomes the canonical id of its zone, e.g. a tzdb
 * release that renames a zone back (the zone record is unchanged).
 */
const promoted = (canonical: string, alias: string): RawData => {
  const ids = defaultTimeZoneData.zoneids.split('|');
  const i = ids.indexOf(canonical);
  ids[i] = alias;
  const links = defaultTimeZoneData.links
    .split('|')
    .filter((e) => !e.startsWith(`${alias}:`))
    .concat(`${canonical}:${i}`)
    .join('|');
  return { ...defaultTimeZoneData, zoneids: ids.join('|'), links };
};

test('bundled alias made canonical keeps its metazone', async () => {
  const c = await load();
  const tzc = await import('../../../src/systems/calendars/timezone');
  const show = () => {
    const d = c.gregorianDateFromUnixEpoch(JAN_2024, 'Asia/Calcutta');
    return [
      c.dateTimeZoneId(d),
      c.dateMetaZoneId(d),
      c.dateTimeZoneStableId(d),
      c.dateTimeZoneOffset(d),
    ];
  };
  const before = show();
  expect(before).toEqual(['Asia/Kolkata', 'India', 'Asia/Calcutta', 19800000]);

  setTimeZoneData(promoted('Asia/Kolkata', 'Asia/Calcutta'));
  expect(show()).toEqual(['Asia/Calcutta', 'India', 'Asia/Calcutta', 19800000]);
  const d = c.gregorianDateFromUnixEpoch(JAN_2024, 'Asia/Kolkata');
  expect(c.dateTimeZoneId(d)).toEqual('Asia/Calcutta');
  expect(c.dateMetaZoneId(d)).toEqual('India');
  expect(tzc.currentMetazone('Asia/Calcutta')).toEqual('India');
  expect(tzc.getStableTimeZoneId('Asia/Kolkata')).toEqual('Asia/Calcutta');

  setTimeZoneData(defaultTimeZoneData);
  expect(show()).toEqual(before);
});
