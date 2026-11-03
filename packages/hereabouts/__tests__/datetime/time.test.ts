import {
  day,
  dayAtTime,
  dayFromInstant,
  dayStartInstant,
  dayToday,
  dayToString,
  instantParse,
  instantToString,
  isTimeOfDay,
  systemTimeZone,
  timeOfDay,
  timeOfDayCompare,
  timeOfDayFromInstant,
  timeOfDayFromMillis,
  timeOfDayFromString,
  timeOfDayParse,
  timeOfDayToMillis,
  timeOfDayToString,
  timeZoneOffset,
} from '../../src/datetime';

const NY = 'America/New_York';

test('time of day', () => {
  expect(timeOfDay(6, 30)).toEqual({ hour: 6, minute: 30, second: 0, millis: 0 });
  expect(() => timeOfDay(24, 0)).toThrow(RangeError);
  expect(() => timeOfDay(6, 60)).toThrow(RangeError);
  expect(() => timeOfDay(6, 0, 60)).toThrow(RangeError);
  expect(() => timeOfDay(6, 0, 0, 1000)).toThrow(RangeError);
  expect(() => timeOfDay(6.5)).toThrow(RangeError);
  expect(isTimeOfDay(timeOfDay(23, 59, 59, 999))).toBe(true);
  expect(isTimeOfDay({ hour: 6, minute: 30 })).toBe(false);

  expect(timeOfDayToMillis(timeOfDay(6, 30))).toEqual(23400000);
  expect(timeOfDayFromMillis(23400000)).toEqual(timeOfDay(6, 30));
  expect(timeOfDayFromMillis(86399999)).toEqual(timeOfDay(23, 59, 59, 999));
  expect(() => timeOfDayFromMillis(86400000)).toThrow(RangeError);
  expect(() => timeOfDayFromMillis(-1)).toThrow(RangeError);

  expect(timeOfDayParse('06:30')).toEqual(timeOfDay(6, 30));
  expect(timeOfDayParse('06:30:15')).toEqual(timeOfDay(6, 30, 15));
  expect(timeOfDayParse('06:30:15.25')).toEqual(timeOfDay(6, 30, 15, 250));
  expect(timeOfDayParse('06:30:15.123456789')).toEqual(timeOfDay(6, 30, 15, 123));
  for (const bad of ['6:30', '24:00', '06:60', '06:30:60', '06:30Z', '06:30:15.', '']) {
    expect(timeOfDayParse(bad)).toBeUndefined();
  }
  expect(() => timeOfDayFromString('25:00')).toThrow(RangeError);

  expect(timeOfDayToString(timeOfDay(6, 30))).toEqual('06:30');
  expect(timeOfDayToString(timeOfDay(6, 30, 15))).toEqual('06:30:15');
  expect(timeOfDayToString(timeOfDay(6, 30, 0, 5))).toEqual('06:30:00.005');

  expect(timeOfDayCompare(timeOfDay(6, 30), timeOfDay(18, 0))).toEqual(-1);
  expect(timeOfDayCompare(timeOfDay(6, 30), timeOfDay(6, 30))).toEqual(0);
});

test('day and time at an instant', () => {
  // 2026-01-31T03:30Z is still the 30th in New York and already the 31st in Tokyo.
  const t = Date.UTC(2026, 0, 31, 3, 30);
  expect(dayToString(dayFromInstant(t, NY))).toEqual('2026-01-30');
  expect(timeOfDayToString(timeOfDayFromInstant(t, NY))).toEqual('22:30');
  expect(dayToString(dayFromInstant(t, 'Asia/Tokyo'))).toEqual('2026-01-31');
  expect(timeOfDayToString(timeOfDayFromInstant(t, 'Asia/Tokyo'))).toEqual('12:30');
  expect(dayToString(dayToday('Pacific/Kiritimati', Date.UTC(2026, 0, 31, 12)))).toEqual(
    '2026-02-01',
  );
  expect(dayToString(dayToday('Pacific/Pago_Pago', Date.UTC(2026, 0, 31, 9)))).toEqual(
    '2026-01-30',
  );
  // Before 1970.
  expect(dayToString(dayFromInstant(Date.UTC(1969, 11, 31, 23), 'UTC'))).toEqual('1969-12-31');
  expect(timeOfDayToString(timeOfDayFromInstant(-1, 'UTC'))).toEqual('23:59:59.999');
  // Aliases and letter case are accepted; unknown zones throw.
  expect(dayFromInstant(t, 'asia/calcutta')).toEqual(dayFromInstant(t, 'Asia/Kolkata'));
  expect(() => dayFromInstant(t, 'Mars/Olympus')).toThrow(RangeError);
  expect(() => dayFromInstant(NaN, NY)).toThrow(RangeError);
  expect(() => dayFromInstant(9e15, NY)).toThrow(RangeError);
  expect(timeZoneOffset(NY, t)).toEqual(-5 * 3600000);
  expect(timeZoneOffset(NY, Date.UTC(2026, 6, 1))).toEqual(-4 * 3600000);
});

test('system time zone', () => {
  // Tests run with TZ=UTC (vitest.shared.ts).
  expect(systemTimeZone()).toEqual('Etc/UTC');
});

test('wall time to instant', () => {
  const iso = (d: number) => instantToString(d, NY);
  expect(iso(dayAtTime(day(2026, 1, 31), timeOfDay(9, 0), NY))).toEqual(
    '2026-01-31T09:00:00.000-05:00',
  );
  expect(iso(dayAtTime(day(2026, 7, 31), timeOfDay(9, 0), NY))).toEqual(
    '2026-07-31T09:00:00.000-04:00',
  );

  // Spring forward, 2025-03-09: 02:00-02:59 is skipped.
  const spring = day(2025, 3, 9);
  const skipped = timeOfDay(2, 30);
  expect(iso(dayAtTime(spring, skipped, NY))).toEqual('2025-03-09T03:30:00.000-04:00');
  expect(iso(dayAtTime(spring, skipped, NY, { disambiguation: 'later' }))).toEqual(
    '2025-03-09T03:30:00.000-04:00',
  );
  expect(iso(dayAtTime(spring, skipped, NY, { disambiguation: 'earlier' }))).toEqual(
    '2025-03-09T01:30:00.000-05:00',
  );
  expect(() => dayAtTime(spring, skipped, NY, { disambiguation: 'reject' })).toThrow(RangeError);
  expect(iso(dayAtTime(spring, timeOfDay(3, 0), NY, { disambiguation: 'reject' }))).toEqual(
    '2025-03-09T03:00:00.000-04:00',
  );

  // Fall back, 2025-11-02: 01:00-01:59 happens twice.
  const fall = day(2025, 11, 2);
  const repeated = timeOfDay(1, 30);
  expect(iso(dayAtTime(fall, repeated, NY))).toEqual('2025-11-02T01:30:00.000-04:00');
  expect(iso(dayAtTime(fall, repeated, NY, { disambiguation: 'earlier' }))).toEqual(
    '2025-11-02T01:30:00.000-04:00',
  );
  expect(iso(dayAtTime(fall, repeated, NY, { disambiguation: 'later' }))).toEqual(
    '2025-11-02T01:30:00.000-05:00',
  );
  expect(() => dayAtTime(fall, repeated, NY, { disambiguation: 'reject' })).toThrow(RangeError);

  // A daily 9:00 in New York is not every 24 hours.
  const nine = (d: number) => dayAtTime(day(2025, 3, d), timeOfDay(9, 0), NY);
  expect(nine(9) - nine(8)).toEqual(23 * 3600000);
  expect(nine(10) - nine(9)).toEqual(24 * 3600000);
});

test('start of day', () => {
  expect(instantToString(dayStartInstant(day(2026, 1, 31), NY))).toEqual(
    '2026-01-31T05:00:00.000Z',
  );
  // Santiago springs forward at midnight: 2025-09-07 starts at 01:00.
  const z = 'America/Santiago';
  expect(instantToString(dayStartInstant(day(2025, 9, 7), z), z)).toEqual(
    '2025-09-07T01:00:00.000-03:00',
  );
});

test('parse and format instants', () => {
  expect(instantParse('2026-01-31T17:00:00Z')).toEqual(Date.UTC(2026, 0, 31, 17));
  expect(instantParse('2026-01-31T09:00:00.5-08:00')).toEqual(Date.UTC(2026, 0, 31, 17, 0, 0, 500));
  expect(instantParse('2026-01-31 22:30+0530')).toEqual(Date.UTC(2026, 0, 31, 17));
  expect(instantParse('2026-01-31T22:30+05')).toEqual(Date.UTC(2026, 0, 31, 17, 30));
  // No offset: a wall clock time, needs a zone.
  expect(instantParse('2026-01-31T09:00')).toBeUndefined();
  expect(instantParse('2026-01-31T09:00', 'America/Vancouver')).toEqual(Date.UTC(2026, 0, 31, 17));
  // A date alone is a day, not an instant.
  expect(instantParse('2026-01-31')).toBeUndefined();
  for (const bad of [
    '2026-02-30T00:00Z',
    '2026-01-31T24:00Z',
    '2026-01-31T09:00+24:00',
    'yesterday',
    '',
  ]) {
    expect(instantParse(bad)).toBeUndefined();
  }

  const t = Date.UTC(2026, 0, 31, 17, 0, 0, 5);
  expect(instantToString(t)).toEqual(new Date(t).toISOString());
  expect(instantToString(t, 'America/Vancouver')).toEqual('2026-01-31T09:00:00.005-08:00');
  expect(instantToString(t, 'Asia/Kolkata')).toEqual('2026-01-31T22:30:00.005+05:30');
  expect(instantToString(Date.UTC(-50, 0, 1))).toEqual(new Date(Date.UTC(-50, 0, 1)).toISOString());
  expect(instantParse(instantToString(t, 'Asia/Kolkata'))).toEqual(t);
  expect(() => instantToString(NaN)).toThrow(RangeError);
});
