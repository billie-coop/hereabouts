import { tzFromUTC, tzResolveId, tzUtcZone, tzZoneIds, type ZoneInfo } from '../../src/timezone';
import { Timestamp } from './_helpers';

const OCT272019_010000 = new Timestamp(1572138000000);

test('invalid zone ids', () => {
  const t = OCT272019_010000;
  let info: ZoneInfo | undefined;

  info = tzFromUTC('RANDOM', t.n);
  expect(info).toEqual(undefined);
});

test('resolve id', () => {
  let alias: string | undefined;

  alias = tzResolveId('RANDOM');
  expect(alias).toEqual(undefined);

  alias = tzResolveId('Pacific/Samoa');
  expect(alias).toEqual('Pacific/Pago_Pago');
});

test('aliases', () => {
  const t = OCT272019_010000;
  let info: ZoneInfo | undefined;

  info = tzFromUTC('Africa/Addis_Ababa', t.n)!;
  expect(info.zoneid).toEqual('Africa/Nairobi');

  info = tzFromUTC('Pacific/Samoa', t.n)!;
  expect(info.zoneid).toEqual('Pacific/Pago_Pago');
});

test('utc zone', () => {
  expect(tzUtcZone()).toEqual({ zoneid: 'Etc/UTC', abbr: 'UTC', dst: 0, offset: 0 });
});

test('zone ids', () => {
  const ids = tzZoneIds();

  expect(ids).toContainEqual('America/New_York');
  expect(ids).toContainEqual('Etc/UTC');

  // aliases will not appear in list of zone ids
  expect(ids).not.toContainEqual('Pacitic/Samoa');
  expect(ids).not.toContainEqual('UTC');
});

test('all zones', () => {
  const ids = tzZoneIds();
  for (const id of ids) {
    const info = tzFromUTC(id, OCT272019_010000.n);
    expect(info).toBeDefined();
  }
});
