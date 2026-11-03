import { bench, describe } from 'vitest';
import {
  type Day,
  dayAdd,
  dayAtTime,
  dayFromEpochDay,
  dayFromInstant,
  dayParse,
  dayStartOfWeek,
  dayToString,
  dayUntil,
  timeOfDay,
} from '../../src/datetime';

// Inputs vary per call so results can't be cached or constant-folded.
const N = 1024;
const DAYS: Day[] = Array.from({ length: N }, (_, i) => dayFromEpochDay(18000 + i * 7));
const STRINGS = DAYS.map(dayToString);
const INSTANTS = Array.from({ length: N }, (_, i) => Date.UTC(2026, 0, 1) + i * 3600000 * 17);
const ZONES = ['America/New_York', 'Europe/Berlin', 'Asia/Tokyo', 'America/Vancouver'];
const NINE = timeOfDay(9);

let i = 0;
const next = () => i++ & (N - 1);

describe('day', () => {
  bench('dayParse', () => {
    dayParse(STRINGS[next()]);
  });
  bench('dayToString', () => {
    dayToString(DAYS[next()]);
  });
  bench('dayAdd days', () => {
    dayAdd(DAYS[next()], { days: 30 });
  });
  bench('dayAdd months', () => {
    dayAdd(DAYS[next()], { months: 1 });
  });
  bench('dayUntil', () => {
    const k = next();
    dayUntil(DAYS[k], DAYS[(k + 5) & (N - 1)]);
  });
  bench('dayStartOfWeek', () => {
    dayStartOfWeek(DAYS[next()], 2);
  });
});

describe('zone', () => {
  bench('dayFromInstant', () => {
    const k = next();
    dayFromInstant(INSTANTS[k], ZONES[k & 3]);
  });
  bench('dayAtTime', () => {
    const k = next();
    dayAtTime(DAYS[k], NINE, ZONES[k & 3]);
  });
});
