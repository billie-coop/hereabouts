import {
  defaultTimeZoneData,
  type RawData,
  setTimeZoneData,
  tzFromUTC,
  tzResolveId,
  tzZoneIds,
  tzZoneMeta,
} from '../../src/timezone';

// Minimal data set: two zones with no transitions, one alias.
const CUSTOM: RawData = {
  zoneids: 'Etc/UTC|Foo/Bar',
  links: 'Zulu:0|Foo/Baz:1',
  index: '',
  zoneinfo: ['0_0_0__UTC:0:0__', `${(3600).toString(36)}_0_0_XX_FOO:0:${(3600).toString(36)}__`],
};

afterEach(() => setTimeZoneData(defaultTimeZoneData));

test('replace active data', () => {
  const before = tzFromUTC('America/New_York', 0);
  expect(before).toBeDefined();

  setTimeZoneData(CUSTOM);
  expect(tzZoneIds()).toEqual(['Etc/UTC', 'Foo/Bar']);
  expect(tzFromUTC('America/New_York', 0)).toEqual(undefined);
  expect(tzResolveId('foo/baz')).toEqual('Foo/Bar');
  expect(tzFromUTC('Foo/Baz', 0)).toEqual({
    zoneid: 'Foo/Bar',
    abbr: 'FOO',
    dst: 0,
    offset: 3600000,
  });
  expect(tzZoneMeta('Zulu')).toEqual({
    zoneid: 'Etc/UTC',
    stdoffset: 0,
    latitude: 0,
    longitude: 0,
    countries: [],
  });

  // Restoring the default decodes it again; the raw data must be intact.
  setTimeZoneData(defaultTimeZoneData);
  expect(tzFromUTC('America/New_York', 0)).toEqual(before);
  expect(tzZoneIds()).toContainEqual('America/New_York');
});

test('raw data is not modified', () => {
  const copy = JSON.stringify(CUSTOM);
  setTimeZoneData(CUSTOM);
  tzFromUTC('Foo/Bar', 0);
  tzFromUTC('Etc/UTC', 0);
  expect(JSON.stringify(CUSTOM)).toEqual(copy);
});
