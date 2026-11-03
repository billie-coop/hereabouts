import { formatDate, formatDateRaw, type ZonedDateTime } from '../../../src';
import { calendarsApi } from '../../_helpers';

const unix = (date: number, zoneId: string): ZonedDateTime => ({ date, zoneId });

// March 11, 2018 7:00:25 AM UTC
const MARCH_11_2018_070025_UTC = 1520751625000;

const LOS_ANGELES = 'America/Los_Angeles';

test('buddhist', () => {
  const mar11 = unix(MARCH_11_2018_070025_UTC, LOS_ANGELES);

  const api = calendarsApi('en');
  let s: string;

  s = formatDate(api, mar11, { datetime: 'full', ca: 'buddhist' });
  expect(s).toEqual('Saturday, March 10, 2561 BE at 11:00:25 PM Pacific Standard Time');

  // April 27, 500 1:38:09 PM
  const fiveh = unix(-46378606911000, LOS_ANGELES);

  // Extended year
  s = formatDateRaw(api, fiveh, { pattern: 'uuuuuuuuuu', ca: 'buddhist' });
  expect(s).toEqual('0000000500');
});
