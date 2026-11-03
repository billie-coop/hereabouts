import {
  type CalendarDate,
  dateToString,
  type LocaleData,
  now,
  nowBuddhist,
  nowGregorian,
  nowISO8601,
  nowJapanese,
  nowPersian,
} from '../../../src';
import { calendarsApi } from '../../_helpers';

test('now', () => {
  const zone = 'America/New_York';
  let api: LocaleData;
  let d: CalendarDate;

  api = calendarsApi('en');

  d = now(api);
  expect(dateToString(d)).toContain('Gregorian');
  expect(dateToString(d)).toContain('Etc/UTC');

  d = now(api, zone);
  expect(dateToString(d)).toContain('Gregorian');
  expect(dateToString(d)).toContain(zone);

  d = nowGregorian(api);
  expect(dateToString(d)).toContain('Gregorian');
  expect(dateToString(d)).toContain('Etc/UTC');

  d = nowGregorian(api, zone);
  expect(dateToString(d)).toContain('Gregorian');
  expect(dateToString(d)).toContain(zone);

  d = nowBuddhist(api);
  expect(dateToString(d)).toContain('Buddhist');
  expect(dateToString(d)).toContain('Etc/UTC');

  d = nowBuddhist(api, zone);
  expect(dateToString(d)).toContain('Buddhist');
  expect(dateToString(d)).toContain(zone);

  d = nowISO8601(api);
  expect(dateToString(d)).toContain('ISO8601');
  expect(dateToString(d)).toContain('Etc/UTC');

  d = nowISO8601(api, zone);
  expect(dateToString(d)).toContain('ISO8601');
  expect(dateToString(d)).toContain(zone);

  d = nowJapanese(api);
  expect(dateToString(d)).toContain('Japanese');
  expect(dateToString(d)).toContain('Etc/UTC');

  d = nowJapanese(api, zone);
  expect(dateToString(d)).toContain('Japanese');
  expect(dateToString(d)).toContain(zone);

  d = nowPersian(api);
  expect(dateToString(d)).toContain('Persian');
  expect(dateToString(d)).toContain('Etc/UTC');

  d = nowPersian(api, zone);
  expect(dateToString(d)).toContain('Persian');
  expect(dateToString(d)).toContain(zone);
});
