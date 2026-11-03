import {
  day,
  dayAdd,
  dayCompare,
  dayDaysInMonth,
  dayEndOf,
  dayEndOfWeek,
  dayEquals,
  dayFromEpochDay,
  dayFromString,
  dayIsAfter,
  dayIsBefore,
  dayIsLeapYear,
  dayOfWeek,
  dayOfYear,
  dayParse,
  dayRange,
  dayStartOf,
  dayStartOfWeek,
  daySubtract,
  dayToEpochDay,
  dayToString,
  dayUntil,
  isDay,
} from '../src';

const s = dayToString;
const p = dayFromString;

test('create and validate', () => {
  expect(day(2026, 1, 31)).toEqual({ year: 2026, month: 1, day: 31 });
  expect(day(2024, 2, 29)).toEqual({ year: 2024, month: 2, day: 29 });
  expect(() => day(2026, 2, 29)).toThrow(RangeError);
  expect(() => day(2026, 2, 30)).toThrow(RangeError);
  expect(() => day(2026, 13, 1)).toThrow(RangeError);
  expect(() => day(2026, 0, 1)).toThrow(RangeError);
  expect(() => day(2026, 1, 0)).toThrow(RangeError);
  expect(() => day(2026.5, 1, 1)).toThrow(RangeError);
  expect(() => day(NaN, 1, 1)).toThrow(RangeError);
  expect(() => day(300000, 1, 1)).toThrow(RangeError);

  expect(isDay(day(2026, 1, 31))).toBe(true);
  expect(isDay({ year: 2026, month: 2, day: 30 })).toBe(false);
  expect(isDay({ year: 2026, month: 2 })).toBe(false);
  expect(isDay(null)).toBe(false);
  expect(isDay('2026-01-31')).toBe(false);
  expect(isDay(JSON.parse(JSON.stringify(day(2026, 1, 31))))).toBe(true);
});

test('day numbers', () => {
  expect(dayToEpochDay(day(1970, 1, 1))).toEqual(0);
  expect(dayToEpochDay(day(1969, 12, 31))).toEqual(-1);
  expect(dayToEpochDay(day(2000, 3, 1))).toEqual(11017);
  expect(dayToEpochDay(day(1, 1, 1))).toEqual(-719162);
  expect(dayFromEpochDay(20484)).toEqual(day(2026, 1, 31));
  expect(dayFromEpochDay(-719162)).toEqual(day(1, 1, 1));
  expect(() => dayFromEpochDay(1.5)).toThrow(RangeError);
  expect(() => dayFromEpochDay(100000001)).toThrow(RangeError);
  for (let n = -800000; n < 800000; n += 997) {
    expect(dayToEpochDay(dayFromEpochDay(n))).toEqual(n);
  }
});

test('parse and format', () => {
  expect(dayParse('2026-01-31')).toEqual(day(2026, 1, 31));
  expect(dayParse('0001-01-01')).toEqual(day(1, 1, 1));
  expect(dayParse('+012345-06-07')).toEqual(day(12345, 6, 7));
  expect(dayParse('-000044-03-15')).toEqual(day(-44, 3, 15));
  for (const bad of [
    '2026-02-30',
    '2026-1-31',
    '26-01-31',
    '2026-01-31T00:00',
    ' 2026-01-31',
    '-000000-01-01',
    '',
  ]) {
    expect(dayParse(bad)).toBeUndefined();
  }
  expect(dayParse(undefined as any)).toBeUndefined();
  expect(() => dayFromString('2026-02-30')).toThrow(RangeError);

  expect(s(day(2026, 1, 5))).toEqual('2026-01-05');
  expect(s(day(12, 1, 5))).toEqual('0012-01-05');
  expect(s(day(12345, 6, 7))).toEqual('+012345-06-07');
  expect(s(day(-44, 3, 15))).toEqual('-000044-03-15');
});

test('add and subtract', () => {
  const d = p('2026-01-31');
  expect(s(dayAdd(d, { days: 1 }))).toEqual('2026-02-01');
  expect(s(dayAdd(d, { days: 30 }))).toEqual('2026-03-02');
  expect(s(dayAdd(d, { days: -31 }))).toEqual('2025-12-31');
  expect(s(dayAdd(d, { weeks: 2 }))).toEqual('2026-02-14');
  expect(s(dayAdd(d, { months: 1 }))).toEqual('2026-02-28');
  expect(s(dayAdd(p('2024-01-31'), { months: 1 }))).toEqual('2024-02-29');
  expect(s(dayAdd(d, { months: 2 }))).toEqual('2026-03-31');
  expect(s(dayAdd(d, { months: -2 }))).toEqual('2025-11-30');
  expect(s(dayAdd(p('2024-02-29'), { years: 1 }))).toEqual('2025-02-28');
  expect(s(dayAdd(p('2024-02-29'), { years: 4 }))).toEqual('2028-02-29');
  // Months first, then days.
  expect(s(dayAdd(d, { months: 1, days: 1 }))).toEqual('2026-03-01');
  expect(s(dayAdd(d, {}))).toEqual('2026-01-31');
  expect(s(daySubtract(p('2026-03-31'), { months: 1 }))).toEqual('2026-02-28');
  expect(s(daySubtract(d, { years: 1, days: 1 }))).toEqual('2025-01-30');
  expect(() => dayAdd(d, { days: 1.5 })).toThrow(RangeError);
  // The value passed in is never changed.
  expect(d).toEqual(day(2026, 1, 31));
});

test('compare', () => {
  const a = p('2026-01-31');
  const b = p('2026-02-01');
  expect(dayCompare(a, b)).toEqual(-1);
  expect(dayCompare(b, a)).toEqual(1);
  expect(dayCompare(a, p('2026-01-31'))).toEqual(0);
  expect(dayCompare(p('2025-12-31'), a)).toEqual(-1);
  expect(dayEquals(a, p('2026-01-31'))).toBe(true);
  expect(dayIsBefore(a, b)).toBe(true);
  expect(dayIsAfter(a, b)).toBe(false);
  const sorted = ['2026-03-01', '2025-12-31', '2026-01-15'].map(p).sort(dayCompare).map(s);
  expect(sorted).toEqual(['2025-12-31', '2026-01-15', '2026-03-01']);
});

test('until', () => {
  const today = p('2026-01-29');
  expect(dayUntil(today, p('2026-01-31'))).toEqual(2);
  expect(dayUntil(today, p('2026-01-20'))).toEqual(-9);
  expect(dayUntil(p('2025-01-01'), p('2026-01-01'))).toEqual(365);
  expect(dayUntil(today, p('2026-02-11'), 'weeks')).toEqual(1);
  expect(dayUntil(today, p('2026-01-16'), 'weeks')).toEqual(-1);
  expect(dayUntil(p('2026-01-31'), p('2026-02-28'), 'months')).toEqual(1);
  expect(dayUntil(p('2026-01-15'), p('2026-02-14'), 'months')).toEqual(0);
  expect(dayUntil(p('2026-01-15'), p('2026-02-15'), 'months')).toEqual(1);
  expect(dayUntil(p('2026-03-31'), p('2026-02-28'), 'months')).toEqual(-1);
  expect(dayUntil(p('2026-03-15'), p('2026-02-20'), 'months')).toEqual(0);
  expect(dayUntil(p('2024-02-29'), p('2025-02-28'), 'years')).toEqual(1);
  expect(dayUntil(p('2024-03-01'), p('2025-02-28'), 'years')).toEqual(0);
  expect(dayUntil(p('2026-06-01'), p('2020-06-02'), 'years')).toEqual(-5);
  expect(dayUntil(today, today, 'months')).toEqual(0);
});

test('fields', () => {
  // 2026-01-31 is a Saturday: 7 in CLDR numbering (1 = Sunday).
  expect(dayOfWeek(p('2026-01-31'))).toEqual(7);
  expect(dayOfWeek(p('2026-02-01'))).toEqual(1);
  expect(dayOfWeek(p('1970-01-01'))).toEqual(5);
  expect(dayOfWeek(p('1969-12-28'))).toEqual(1);
  expect(dayOfYear(p('2026-01-01'))).toEqual(1);
  expect(dayOfYear(p('2024-12-31'))).toEqual(366);
  expect(dayDaysInMonth(p('2024-02-10'))).toEqual(29);
  expect(dayDaysInMonth(p('2100-02-10'))).toEqual(28);
  expect(dayDaysInMonth(p('2000-02-10'))).toEqual(29);
  expect(dayIsLeapYear(p('2026-06-01'))).toBe(false);
});

test('start and end of week, month and year', () => {
  const wed = p('2026-01-28');
  expect(s(dayStartOfWeek(wed, 1))).toEqual('2026-01-25'); // Sunday
  expect(s(dayStartOfWeek(wed, 2))).toEqual('2026-01-26'); // Monday
  expect(s(dayStartOfWeek(wed, 4))).toEqual('2026-01-28'); // Wednesday
  expect(s(dayStartOfWeek(wed, 7))).toEqual('2026-01-24'); // Saturday
  expect(s(dayEndOfWeek(wed, 1))).toEqual('2026-01-31');
  expect(s(dayEndOfWeek(wed, 2))).toEqual('2026-02-01');
  expect(() => dayStartOfWeek(wed, 0)).toThrow(RangeError);
  expect(() => dayStartOfWeek(wed, 8)).toThrow(RangeError);
  expect(s(dayStartOf(wed, 'month'))).toEqual('2026-01-01');
  expect(s(dayEndOf(p('2024-02-03'), 'month'))).toEqual('2024-02-29');
  expect(s(dayStartOf(wed, 'year'))).toEqual('2026-01-01');
  expect(s(dayEndOf(wed, 'year'))).toEqual('2026-12-31');
});

test('ranges', () => {
  expect(dayRange(p('2026-01-30'), p('2026-02-02')).map(s)).toEqual([
    '2026-01-30',
    '2026-01-31',
    '2026-02-01',
    '2026-02-02',
  ]);
  expect(dayRange(p('2026-02-02'), p('2026-01-30'))).toEqual([]);
  expect(dayRange(p('2026-01-31'), p('2026-01-31')).map(s)).toEqual(['2026-01-31']);
  // Weeks of a month view starting on Monday.
  const first = p('2026-02-01');
  expect(dayRange(dayStartOfWeek(first, 2), dayEndOf(first, 'month'), { weeks: 1 }).map(s)).toEqual(
    ['2026-01-26', '2026-02-02', '2026-02-09', '2026-02-16', '2026-02-23'],
  );
  // Monthly from the 31st stays on month ends.
  expect(dayRange(p('2026-01-31'), p('2026-05-31'), { months: 1 }).map(s)).toEqual([
    '2026-01-31',
    '2026-02-28',
    '2026-03-31',
    '2026-04-30',
    '2026-05-31',
  ]);
  expect(() => dayRange(first, first, { days: 0 })).toThrow(RangeError);
  expect(() => dayRange(first, first, { days: -1 })).toThrow(RangeError);
});
