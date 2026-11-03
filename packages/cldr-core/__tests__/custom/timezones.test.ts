import { formatDateRaw } from '../../src';
import { buildConfig, calendarsApi } from '../_helpers';

test('custom calendars', () => {
  const cfg = buildConfig({ 'timezone-id': ['America/New_York'] });
  const api = calendarsApi('en', cfg);
  let s: string;

  // The 'timezone-id' setting is used to pull in the exemplar city for each zone.
  // All metazones still work, so we get full timezone names.

  // June 10, 2019 12:34:56 PM EDT (UTC-4) == 16:34:56 UTC
  const date = { date: new Date(1560184496000), zoneId: 'America/New_York' };

  s = formatDateRaw(api, date, { pattern: 'VV' });
  expect(s).toEqual('America/New_York');

  s = formatDateRaw(api, date, { pattern: 'VVV' });
  expect(s).toEqual('New York');

  date.zoneId = 'UTC';
  s = formatDateRaw(api, date, { pattern: 'VV' });
  expect(s).toEqual('Etc/UTC');

  s = formatDateRaw(api, date, { pattern: 'VVV' });
  expect(s).toEqual('');

  date.zoneId = 'Europe/Paris';
  s = formatDateRaw(api, date, { pattern: 'VV' });
  expect(s).toEqual('Europe/Paris');

  s = formatDateRaw(api, date, { pattern: 'VVV' });
  expect(s).toEqual('');
});
