import { formatDateRaw, timeZoneIds } from '../../../src';
import { calendarsApi } from '../../_helpers';

const EN = calendarsApi('en-US');

test('timezone identifiers', () => {
  const ids = timeZoneIds();
  expect(ids).toContain('America/New_York');
  expect(ids).toContain('Europe/Rome');
  expect(ids).toContain('Pacific/Tarawa'); // Changed in 2022b See NEWS re: backzone
});

test('stability', () => {
  const date = { date: 1554263155000, zoneId: '' };
  let s: string;

  date.zoneId = 'America/New_York';
  s = formatDateRaw(EN, date, { pattern: 'zzzz' });
  expect(s).toEqual('Eastern Daylight Time');

  date.zoneId = 'America/Argentina/La_Rioja';
  s = formatDateRaw(EN, date, { pattern: 'zzzz' });
  expect(s).toEqual('Argentina Standard Time');

  s = formatDateRaw(EN, date, { pattern: 'VVV' });
  expect(s).toEqual('La Rioja');

  date.zoneId = 'America/Catamarca';
  s = formatDateRaw(EN, date, { pattern: 'zzzz' });
  expect(s).toEqual('Argentina Standard Time');

  s = formatDateRaw(EN, date, { pattern: 'VVV' });
  expect(s).toEqual('Catamarca');

  date.zoneId = 'America/Argentina/Catamarca';
  s = formatDateRaw(EN, date, { pattern: 'zzzz' });
  expect(s).toEqual('Argentina Standard Time');

  s = formatDateRaw(EN, date, { pattern: 'VVV' });
  expect(s).toEqual('Catamarca');

  date.zoneId = 'Europe/Isle_of_Man';
  s = formatDateRaw(EN, date, { pattern: 'zzzz' });
  expect(s).toEqual('GMT+01:00');

  s = formatDateRaw(EN, date, { pattern: 'VVV' });
  expect(s).toEqual('Isle of Man');

  date.zoneId = 'Europe/Jersey';
  s = formatDateRaw(EN, date, { pattern: 'zzzz' });
  expect(s).toEqual('GMT+01:00');

  date.zoneId = 'Europe/Jersey';
  s = formatDateRaw(EN, date, { pattern: 'ZZZZZ' });
  expect(s).toEqual('+01:00');

  s = formatDateRaw(EN, date, { pattern: 'VVV' });
  expect(s).toEqual('Jersey');

  date.zoneId = 'Asia/Harbin';
  s = formatDateRaw(EN, date, { pattern: 'zzzz' });
  expect(s).toEqual('China Standard Time');
});

test('iso8601 X/x offset formats (TR35)', () => {
  // ISO 8601 local time difference format (X family) per TR35. Expected cells
  // verified against ICU4J: 'Z' is the UTC indicator and is used only when the
  // offset is zero and the specifier is X* (uppercase) — for EVERY width 1..5.
  // Lowercase x* renders the numeric offset ('+00', '+0000', ...), never 'Z'.
  // Colon appears for XXX (extended) and XXXXX only; XXXX stays basic, and
  // width 1 (X) appends minutes whenever they are non-zero.
  const url = (zoneId: string, pattern: string): string =>
    formatDateRaw(EN, { date: 1554263155000, zoneId }, { pattern });

  // Zero offset (UTC).
  expect(url('UTC', 'X')).toEqual('Z');
  expect(url('UTC', 'XX')).toEqual('Z');
  expect(url('UTC', 'XXX')).toEqual('Z');
  expect(url('UTC', 'XXXX')).toEqual('Z');
  expect(url('UTC', 'XXXXX')).toEqual('Z');
  expect(url('UTC', 'x')).toEqual('+00');
  expect(url('UTC', 'xx')).toEqual('+0000');
  expect(url('UTC', 'xxx')).toEqual('+00:00');
  expect(url('UTC', 'xxxx')).toEqual('+0000');
  expect(url('UTC', 'xxxxx')).toEqual('+00:00');

  // Fractional offset +05:30 (Asia/Kolkata has no DST, so the offset holds
  // for any date).
  const tzid = 'Asia/Kolkata';
  expect(timeZoneIds()).toContain(tzid);
  expect(url(tzid, 'X')).toEqual('+0530');
  expect(url(tzid, 'XX')).toEqual('+0530');
  expect(url(tzid, 'XXX')).toEqual('+05:30');
  expect(url(tzid, 'XXXX')).toEqual('+0530');
  expect(url(tzid, 'XXXXX')).toEqual('+05:30');
  expect(url(tzid, 'x')).toEqual('+0530');
  expect(url(tzid, 'xx')).toEqual('+0530');
  expect(url(tzid, 'xxx')).toEqual('+05:30');
  expect(url(tzid, 'xxxx')).toEqual('+0530');
  expect(url(tzid, 'xxxxx')).toEqual('+05:30');
});

test('british columbia and alberta permanent time (tzdb 2026b / 2026c)', () => {
  // Both switches take effect in tzdb at 2026-11-01 02:00 local time.
  // Only offsets are checked here: the zone *names* still come from the CLDR
  // 48.2 metazones, which call post-switch Vancouver "Pacific Standard Time"
  // and Edmonton "Mountain Standard Time" despite the new offsets.
  const fmt = (zoneId: string, date: number): string =>
    formatDateRaw(EN, { date, zoneId }, { pattern: 'yyyy-MM-dd HH:mm xxx' });

  const VAN = 'America/Vancouver';
  expect(fmt(VAN, Date.UTC(2025, 11, 15, 20))).toEqual('2025-12-15 12:00 -08:00');
  expect(fmt(VAN, Date.UTC(2026, 6, 15, 20))).toEqual('2026-07-15 13:00 -07:00');
  expect(fmt(VAN, Date.UTC(2026, 10, 1, 8, 59))).toEqual('2026-11-01 01:59 -07:00');
  expect(fmt(VAN, Date.UTC(2026, 10, 1, 9, 0))).toEqual('2026-11-01 02:00 -07:00');
  expect(fmt(VAN, Date.UTC(2026, 11, 15, 20))).toEqual('2026-12-15 13:00 -07:00');
  expect(fmt(VAN, Date.UTC(2027, 6, 15, 20))).toEqual('2027-07-15 13:00 -07:00');

  const EDM = 'America/Edmonton';
  expect(fmt(EDM, Date.UTC(2025, 11, 15, 20))).toEqual('2025-12-15 13:00 -07:00');
  expect(fmt(EDM, Date.UTC(2026, 6, 15, 20))).toEqual('2026-07-15 14:00 -06:00');
  expect(fmt(EDM, Date.UTC(2026, 10, 1, 7, 59))).toEqual('2026-11-01 01:59 -06:00');
  expect(fmt(EDM, Date.UTC(2026, 10, 1, 8, 0))).toEqual('2026-11-01 02:00 -06:00');
  expect(fmt(EDM, Date.UTC(2026, 11, 15, 20))).toEqual('2026-12-15 14:00 -06:00');
  expect(fmt(EDM, Date.UTC(2027, 6, 15, 20))).toEqual('2027-07-15 14:00 -06:00');
});
