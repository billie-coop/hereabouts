import {
  day,
  dayAdd,
  dayAtTime,
  dayCompare,
  dayFromEpochDay,
  dayFromInstant,
  dayOfWeek,
  dayRange,
  dayStartInstant,
  dayToday,
  dayToString,
  dayUntil,
  instantParse,
  instantToString,
  timeOfDay,
  timeOfDayFromInstant,
  timeOfDayToString,
  timeZoneId,
  timeZoneOffset,
} from '../../src/datetime';

// Regression tests for the independent review of the datetime package (2026-11-02).

const BAD_DAY = { year: 2026, month: 2, day: 30 };
const BAD_TIME = { hour: 24, minute: 0, second: 0, millis: 0 };

test('hand-built invalid days and times throw instead of rolling over', () => {
  expect(() => dayAtTime(BAD_DAY, timeOfDay(9), 'UTC')).toThrow(RangeError);
  expect(() => dayAtTime(day(2026, 1, 1), BAD_TIME, 'UTC')).toThrow(RangeError);
  expect(() => dayStartInstant(BAD_DAY, 'UTC')).toThrow(RangeError);
  expect(() => dayAdd(BAD_DAY, { days: 1 })).toThrow(RangeError);
  expect(() => dayUntil(BAD_DAY, day(2026, 3, 1))).toThrow(RangeError);
  expect(() => dayCompare(BAD_DAY, day(2026, 3, 1))).toThrow(RangeError);
  expect(() => dayOfWeek(BAD_DAY)).toThrow(RangeError);
  expect(() => dayToString(BAD_DAY)).toThrow(RangeError);
  expect(() => dayRange(BAD_DAY, day(2026, 3, 1))).toThrow(RangeError);
  expect(() => timeOfDayToString(BAD_TIME)).toThrow(RangeError);
  expect(() => dayToString(null as any)).toThrow(RangeError);
});

test('invalid instants throw', () => {
  for (const t of [NaN, Infinity, -Infinity, 9e15]) {
    expect(() => timeZoneOffset('UTC', t)).toThrow(RangeError);
    expect(() => dayFromInstant(t, 'UTC')).toThrow(RangeError);
    expect(() => instantToString(t)).toThrow(RangeError);
  }
});

test('range boundaries', () => {
  const max = dayFromEpochDay(100000000);
  expect(dayToString(max)).toEqual('+275760-09-13');
  expect(dayUntil(day(275760, 8, 31), max, 'months')).toEqual(0);
  expect(dayUntil(day(275760, 8, 13), max, 'months')).toEqual(1);
  expect(dayRange(max, max)).toEqual([max]);
  expect(dayRange(dayFromEpochDay(99999990), max, { months: 1 }).length).toEqual(1);
  expect(() => dayAdd(max, { days: 1 })).toThrow(RangeError);
  // 23:00 in New York on the last day is past the last instant JavaScript can represent.
  expect(() => dayAtTime(max, timeOfDay(23), 'America/New_York')).toThrow(RangeError);
  expect(dayAtTime(max, timeOfDay(0), 'UTC')).toEqual(8.64e15);
});

test('start of day when the clocks jump over midnight from before it', () => {
  // Toronto went from 1919-03-30 23:30 to 1919-03-31 00:30: the 31st starts at 00:30 local.
  expect(instantToString(dayStartInstant(day(1919, 3, 31), 'America/Toronto'))).toEqual(
    '1919-03-31T04:30:00.000Z',
  );
  expect(
    timeOfDayToString(
      timeOfDayFromInstant(dayStartInstant(day(1919, 3, 31), 'America/Toronto'), 'America/Toronto'),
    ),
  ).toEqual('00:30');
  // Santiago springs forward at midnight: the day starts at 01:00.
  const z = 'America/Santiago';
  expect(instantToString(dayStartInstant(day(2025, 9, 7), z), z)).toEqual(
    '2025-09-07T01:00:00.000-03:00',
  );
  // Apia skipped 2011-12-30 entirely.
  expect(
    dayToString(dayFromInstant(dayStartInstant(day(2011, 12, 31), 'Pacific/Apia'), 'Pacific/Apia')),
  ).toEqual('2011-12-31');
});

test('zone ids in any letter case', () => {
  const t = Date.UTC(2026, 0, 31, 3);
  expect(dayFromInstant(t, 'AMERICA/VANCOUVER')).toEqual(dayFromInstant(t, 'America/Vancouver'));
  expect(dayToday('asia/TOKYO', t)).toEqual(day(2026, 1, 31));
});

test('offsets with seconds keep the instant', () => {
  const t = instantParse('1900-01-01T00:00Z')!;
  expect(instantToString(t, 'Europe/Paris')).toEqual('1900-01-01T00:09:21.000+00:09:21');
  expect(instantParse(instantToString(t, 'Europe/Paris'))).toEqual(t);
  expect(instantParse(instantToString(t, 'Africa/Monrovia'))).toEqual(t);
  expect(instantParse(instantToString(t, 'Asia/Kolkata'))).toEqual(t);
  expect(instantParse('2026-01-31T09:00+00:00:60')).toBeUndefined();
});

test('fractional instants are floored', () => {
  expect(instantToString(-0.5)).toEqual('1969-12-31T23:59:59.999Z');
  expect(instantToString(1.9)).toEqual('1970-01-01T00:00:00.001Z');
  expect(timeOfDayToString(timeOfDayFromInstant(-0.5, 'UTC'))).toEqual('23:59:59.999');
});

test('re-check: canonical zone ids, parse at the range limits, huge range steps', () => {
  expect(timeZoneId('AMERICA/VANCOUVER')).toEqual('America/Vancouver');
  expect(timeZoneId('asia/calcutta')).toEqual('Asia/Kolkata');
  expect(() => timeZoneId('Mars/Olympus')).toThrow(RangeError);

  // Out-of-range text returns undefined; an offset that brings it back in range parses.
  expect(instantParse('+275760-09-13T00:01Z')).toBeUndefined();
  expect(instantParse('+275760-09-13T01:00+01:00')).toEqual(8.64e15);
  expect(instantParse('+275760-09-13T00:00', 'America/New_York')).toBeUndefined();
  expect(() => instantParse('2026-01-31T09:00', 'Mars/Olympus')).toThrow(RangeError);

  expect(() => dayRange(day(2026, 1, 1), day(2026, 1, 1), { years: 1e308 })).toThrow(RangeError);
  expect(dayRange(day(2026, 1, 1), day(2026, 1, 1), { days: 1e300 })).toEqual([day(2026, 1, 1)]);
});
