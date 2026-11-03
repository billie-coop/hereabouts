import {
  day,
  dayStartOfWeek,
  dayToString,
  firstDayOfWeek,
  formatDay,
  formatDayInterval,
  formatDayIntervalToParts,
  formatDayRelative,
  formatDayToParts,
  formatInstant,
  formatInstantRelative,
  formatInstantToParts,
  formatTimeOfDay,
  formatTimeOfDayToParts,
  timeOfDay,
} from '../../../../src/core';
import { calendarsApi } from '../../_helpers';

const DUE = day(2026, 1, 31);

test('format day', () => {
  const en = calendarsApi('en');
  expect(formatDay(en, DUE)).toEqual('Jan 31, 2026');
  expect(formatDay(en, DUE, { date: 'full' })).toEqual('Saturday, January 31, 2026');
  expect(formatDay(en, DUE, { date: 'short' })).toEqual('1/31/26');
  expect(formatDay(en, DUE, { skeleton: 'MMMEd' })).toEqual('Sat, Jan 31');
  expect(formatDay(en, DUE, { skeleton: 'yMMMM' })).toEqual('January 2026');
  expect(formatDay(en, DUE, { ca: 'japanese', date: 'long' })).toEqual('January 31, 8 Reiwa');
  expect(formatDay(en, DUE, { nu: 'arab' })).toEqual('Jan ٣١, ٢٠٢٦');
  expect(formatDayToParts(en, DUE, { skeleton: 'MMMd' })).toEqual([
    { type: 'month', value: 'Jan' },
    { type: 'literal', value: ' ' },
    { type: 'day', value: '31' },
  ]);

  expect(formatDay(calendarsApi('de'), DUE)).toEqual('31.01.2026');
  expect(formatDay(calendarsApi('de'), DUE, { date: 'full' })).toEqual('Samstag, 31. Januar 2026');
  expect(formatDay(calendarsApi('ja'), DUE, { date: 'long' })).toEqual('2026年1月31日');
  expect(formatDay(calendarsApi('fr'), DUE)).toEqual('31 janv. 2026');

  // The day is the same in every zone: no shift at either end of the day.
  expect(formatDay(en, day(2026, 1, 1))).toEqual('Jan 1, 2026');
  expect(formatDay(en, day(2025, 12, 31))).toEqual('Dec 31, 2025');
});

test('format day interval', () => {
  const en = calendarsApi('en');
  expect(formatDayInterval(en, day(2026, 1, 1), DUE)).toEqual('Jan 1\u2009–\u200931, 2026');
  expect(formatDayInterval(en, day(2025, 12, 15), DUE)).toEqual(
    'Dec 15, 2025\u2009–\u2009Jan 31, 2026',
  );
  expect(formatDayInterval(en, DUE, DUE)).toEqual('Jan 31, 2026');
  expect(formatDayInterval(en, day(2026, 1, 1), DUE, { skeleton: 'MMMd' })).toEqual(
    'Jan 1\u2009–\u200931',
  );
  expect(formatDayInterval(calendarsApi('de'), day(2026, 1, 1), DUE)).toEqual('1.–31. Jan. 2026');
  expect(
    formatDayIntervalToParts(en, day(2026, 1, 1), DUE)
      .map((p) => p.value)
      .join(''),
  ).toEqual('Jan 1\u2009–\u200931, 2026');
});

test('format time of day', () => {
  const en = calendarsApi('en');
  const de = calendarsApi('de');
  const t = timeOfDay(6, 30);
  expect(formatTimeOfDay(en, t)).toEqual('6:30\u202fAM');
  expect(formatTimeOfDay(de, t)).toEqual('06:30');
  expect(formatTimeOfDay(calendarsApi('ja'), timeOfDay(18, 5))).toEqual('18:05');
  expect(formatTimeOfDay(en, timeOfDay(18, 5, 7), { skeleton: 'jms' })).toEqual('6:05:07\u202fPM');
  expect(formatTimeOfDay(en, timeOfDay(18, 5), { skeleton: 'Hm' })).toEqual('18:05');
  expect(formatTimeOfDay(de, timeOfDay(18, 5), { skeleton: 'hm' })).toEqual('6:05\u202fPM');
  expect(formatTimeOfDay(en, timeOfDay(0, 0))).toEqual('12:00\u202fAM');
  expect(formatTimeOfDayToParts(en, t).map((p) => p.type)).toEqual([
    'hour',
    'literal',
    'minute',
    'literal',
    'dayperiod',
  ]);
});

test('format day relative', () => {
  const en = calendarsApi('en');
  const today = day(2026, 1, 29);
  expect(formatDayRelative(en, today, today)).toEqual('today');
  expect(formatDayRelative(en, day(2026, 1, 30), today)).toEqual('tomorrow');
  expect(formatDayRelative(en, day(2026, 1, 28), today)).toEqual('yesterday');
  expect(formatDayRelative(en, DUE, today)).toEqual('in 2 days');
  expect(formatDayRelative(en, day(2026, 1, 19), today)).toEqual('10 days ago');
  expect(formatDayRelative(en, DUE, today, { numericOnly: true })).toEqual('in 2 days');
  expect(formatDayRelative(en, day(2026, 1, 30), today, { numericOnly: true })).toEqual('in 1 day');
  expect(formatDayRelative(calendarsApi('de'), DUE, today)).toEqual('übermorgen');
  expect(formatDayRelative(calendarsApi('es'), day(2026, 1, 30), today)).toEqual('mañana');
});

test('format instant', () => {
  const en = calendarsApi('en');
  const t = Date.UTC(2026, 0, 31, 17);
  expect(formatInstant(en, t, 'America/Vancouver', { datetime: 'medium' })).toEqual(
    'Jan 31, 2026, 9:00:00\u202fAM',
  );
  expect(formatInstant(en, t, 'Asia/Tokyo', { datetime: 'medium' })).toEqual(
    'Feb 1, 2026, 2:00:00\u202fAM',
  );
  expect(formatInstant(en, t, 'America/Vancouver', { skeleton: 'MMMdjmz' })).toEqual(
    'Jan 31, 9:00\u202fAM PST',
  );
  expect(
    formatInstantToParts(en, t, 'UTC', { skeleton: 'Hm' })
      .map((p) => p.value)
      .join(''),
  ).toEqual('17:00');
  expect(() => formatInstant(en, t, 'Mars/Olympus')).toThrow(RangeError);

  const z = 'America/Vancouver';
  expect(formatInstantRelative(en, t - 2 * 3600000, t, z)).toEqual('2 hours ago');
  expect(formatInstantRelative(en, t + 3 * 86400000, t, z)).toEqual('in 3 days');
  expect(formatInstantRelative(calendarsApi('de'), t - 2 * 3600000, t, z)).toEqual('vor 2 Stunden');
  expect(() => formatInstantRelative(en, t, t, 'Mars/Olympus')).toThrow(RangeError);
});

test('locale week start', () => {
  const wed = day(2026, 1, 28);
  expect(dayToString(dayStartOfWeek(wed, firstDayOfWeek(calendarsApi('en-US'))))).toEqual(
    '2026-01-25',
  );
  expect(dayToString(dayStartOfWeek(wed, firstDayOfWeek(calendarsApi('de-DE'))))).toEqual(
    '2026-01-26',
  );
});

test('invalid values, unsupported days and foreign skeleton fields throw', () => {
  const en = calendarsApi('en');
  const bad = { year: 2026, month: 2, day: 30 };
  expect(() => formatDay(en, bad)).toThrow(RangeError);
  expect(() => formatDayInterval(en, day(2026, 2, 1), bad)).toThrow(RangeError);
  expect(() => formatDayRelative(en, bad, DUE)).toThrow(RangeError);
  expect(() => formatTimeOfDay(en, { hour: 24, minute: 0, second: 0, millis: 0 })).toThrow(
    RangeError,
  );

  // The shared calendar formatter uses the Julian calendar before the 1582 reform.
  expect(formatDay(en, day(1582, 10, 15), { date: 'full' })).toEqual('Friday, October 15, 1582');
  expect(() => formatDay(en, day(1582, 10, 14))).toThrow(RangeError);
  expect(formatDay(en, day(8652, 12, 31))).toEqual('Dec 31, 8652');
  expect(() => formatDay(en, day(8653, 1, 1))).toThrow(RangeError);

  expect(() => formatTimeOfDay(en, timeOfDay(9), { skeleton: 'jmsz' })).toThrow(RangeError);
  expect(() => formatTimeOfDay(en, timeOfDay(9), { skeleton: 'yMMMd' })).toThrow(RangeError);
  expect(() => formatDay(en, DUE, { skeleton: 'yMMMdjm' })).toThrow(RangeError);
  expect(() => formatDayInterval(en, DUE, DUE, { skeleton: 'MMMdHm' })).toThrow(RangeError);

  for (const t of [NaN, Infinity, 9e15]) {
    expect(() => formatInstant(en, t, 'UTC')).toThrow(RangeError);
    expect(() => formatInstantRelative(en, t, 0, 'UTC')).toThrow(RangeError);
  }
});

test('re-check: zone ids in any case are formatted in that zone; instant range', () => {
  const en = calendarsApi('en');
  const t = Date.UTC(2026, 0, 31, 17);
  const want = formatInstant(en, t, 'America/Vancouver', { datetime: 'medium' });
  expect(formatInstant(en, t, 'AMERICA/VANCOUVER', { datetime: 'medium' })).toEqual(want);
  expect(formatInstant(en, t, 'aMeRiCa/VaNcOuVeR', { datetime: 'medium' })).toEqual(want);
  const a = Date.UTC(2025, 2, 8, 17);
  const b = Date.UTC(2025, 2, 9, 16);
  expect(formatInstantRelative(en, b, a, 'AMERICA/VANCOUVER')).toEqual(
    formatInstantRelative(en, b, a, 'America/Vancouver'),
  );
  expect(() => formatInstant(en, Date.UTC(9000, 0, 1), 'UTC')).toThrow(RangeError);
  expect(() => formatInstant(en, Date.UTC(1500, 0, 1), 'UTC')).toThrow(RangeError);
});
