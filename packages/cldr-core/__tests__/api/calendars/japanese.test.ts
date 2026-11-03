import { formatDate, toJapaneseDate, type ZonedDateTime } from '../../../src';
import { calendarsApi } from '../../_helpers';

const unix = (date: number, zoneId: string): ZonedDateTime => ({ date, zoneId });

// March 11, 2018 7:00:25 AM UTC
const MARCH_11_2018_070025_UTC = 1520751625000;

// May 01, 2019 12:00:00 PM UTC
const MAY_01_2019_120000_UTC = 1556712000000;

const NEW_YORK = 'America/New_York';
const LOS_ANGELES = 'America/Los_Angeles';

test('japanese', () => {
  const mar11 = unix(MARCH_11_2018_070025_UTC, LOS_ANGELES);

  const api = calendarsApi('en');
  let s: string;

  s = formatDate(api, mar11, { datetime: 'full', ca: 'japanese' });
  expect(s).toEqual('Saturday, March 10, 30 Heisei at 11:00:25 PM Pacific Standard Time');

  const may01 = unix(MAY_01_2019_120000_UTC, NEW_YORK);

  s = formatDate(api, may01, { datetime: 'full', ca: 'japanese' });
  expect(s).toEqual('Wednesday, May 1, 1 Reiwa at 8:00:00 AM Eastern Daylight Time');
});

test('japanese date', () => {
  const api = calendarsApi('en-u-ca-japanese');
  let s: string;
  const date = toJapaneseDate(api, { date: MARCH_11_2018_070025_UTC });

  s = formatDate(api, date);
  expect(s).toEqual('Sunday, March 11, 30 Heisei');
});

test('japanese default', () => {
  const api = calendarsApi('ja');
  let s: string;
  const date = { date: MARCH_11_2018_070025_UTC, zoneId: 'America/New_York' };

  // TODO: once rbnf is implemented the year will be formatted
  // using the 'jpanyear' rule.
  s = formatDate(api, date); // default options { date: 'full' }
  expect(s).toEqual('2018年3月11日日曜日');

  s = formatDate(api, date, { ca: 'gregory' });
  expect(s).toEqual('2018年3月11日');

  s = formatDate(api, date, { ca: 'gregory', date: 'full' });
  expect(s).toEqual('2018年3月11日日曜日');

  s = formatDate(api, date, { ca: 'japanese' });
  expect(s).toEqual('平成30年3月11日');
});
