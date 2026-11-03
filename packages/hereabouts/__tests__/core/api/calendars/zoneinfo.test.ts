import { type LocaleData, timeZoneInfo } from '../../../../src/core';
import { calendarsApi } from '../../_helpers';

test('timezone exemplar cities', () => {
  let api: LocaleData;
  const utc = 'Etc/UTC';
  const unk = 'Factory';
  const invalid = 'Invalid';
  const newyork = 'America/New_York';
  let tz: any;

  api = calendarsApi('en');

  tz = timeZoneInfo(api, newyork);
  expect(tz.id).toEqual(newyork);
  expect(tz.city).toEqual({ name: 'New York' });
  expect(tz.metazone).toEqual('America_Eastern');
  expect(tz.latitude).toEqual(40.714167);
  expect(tz.longitude).toEqual(-74.006389);
  expect(tz.countries).toEqual(['US']);
  expect(tz.stdoffset).toEqual(-18000000);
  expect(tz.names.long).toEqual({
    generic: 'Eastern Time',
    standard: 'Eastern Standard Time',
    daylight: 'Eastern Daylight Time',
  });
  expect(tz.names.short).toEqual({
    generic: 'ET',
    standard: 'EST',
    daylight: 'EDT',
  });

  tz = timeZoneInfo(api, utc);
  expect(tz.id).toEqual(utc);
  expect(tz.city).toEqual({ name: 'Unknown Location' });
  expect(tz.metazone).toEqual('GMT');
  expect(tz.latitude).toEqual(0);
  expect(tz.longitude).toEqual(0);
  expect(tz.countries).toEqual([]);
  expect(tz.stdoffset).toEqual(0);
  expect(tz.names.long).toEqual({
    generic: '',
    standard: 'Greenwich Mean Time',
    daylight: '',
  });
  expect(tz.names.short).toEqual({
    generic: '',
    standard: 'GMT',
    daylight: '',
  });

  tz = timeZoneInfo(api, unk);
  expect(tz.id).toEqual(unk);
  expect(tz.city).toEqual({ name: 'Unknown Location' });
  expect(tz.metazone).toEqual('');
  expect(tz.names.long).toEqual({
    generic: '',
    standard: '',
    daylight: '',
  });
  expect(tz.names.short).toEqual({
    generic: '',
    standard: '',
    daylight: '',
  });

  tz = timeZoneInfo(api, invalid);
  expect(tz.id).toEqual(unk);
  expect(tz.city).toEqual({ name: 'Unknown Location' });
  expect(tz.names.long).toEqual({
    generic: '',
    standard: '',
    daylight: '',
  });
  expect(tz.names.short).toEqual({
    generic: '',
    standard: '',
    daylight: '',
  });

  api = calendarsApi('es');

  tz = timeZoneInfo(api, newyork);
  expect(tz.id).toEqual(newyork);
  expect(tz.city).toEqual({ name: 'Nueva York' });
  expect(tz.names.long).toEqual({
    generic: 'hora oriental',
    standard: 'hora estándar oriental',
    daylight: 'hora de verano oriental',
  });
  expect(tz.names.short).toEqual({
    generic: '',
    standard: '',
    daylight: '',
  });

  tz = timeZoneInfo(api, utc);
  expect(tz.id).toEqual(utc);
  expect(tz.city).toEqual({ name: 'Ciudad desconocida' });
  expect(tz.names.long).toEqual({
    generic: '',
    standard: 'hora del meridiano de Greenwich',
    daylight: '',
  });
  expect(tz.names.short).toEqual({
    generic: '',
    standard: 'GMT',
    daylight: '',
  });

  tz = timeZoneInfo(api, unk);
  expect(tz.id).toEqual(unk);
  expect(tz.city).toEqual({ name: 'Ciudad desconocida' });
  expect(tz.names.long).toEqual({
    generic: '',
    standard: '',
    daylight: '',
  });
  expect(tz.names.short).toEqual({
    generic: '',
    standard: '',
    daylight: '',
  });
});
