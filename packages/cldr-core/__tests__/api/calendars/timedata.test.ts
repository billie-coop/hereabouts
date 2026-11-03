import { bindCalendars, type Calendars, type TimeData, timeData } from '../../../src';
import { calendarsApi } from '../../_helpers';

test('time data', () => {
  let api: Calendars = bindCalendars(calendarsApi('en-US'));
  let t: TimeData;

  const date = {
    date: 1579633019000,
    zoneId: 'America/New_York',
  };

  t = api.timeData();
  expect(t.preferred).toEqual('h');
  expect(t.allowed).toEqual(['h', 'hb', 'H', 'hB']);

  expect(api.formatDate(date, { skeleton: t.preferred })).toEqual('1 PM');
  expect(t.allowed.map((skeleton) => api.formatDate(date, { skeleton }))).toEqual([
    '1 PM',
    '1 PM',
    '13',
    '1 in the afternoon',
  ]);

  api = bindCalendars(calendarsApi('es-ES'));
  t = api.timeData();
  expect(t.preferred).toEqual('H');
  expect(t.allowed).toEqual(['H', 'h', 'hB', 'hb']);

  expect(api.formatDate(date, { skeleton: t.preferred })).toEqual('13');
  expect(t.allowed.map((skeleton) => api.formatDate(date, { skeleton }))).toEqual([
    '13',
    '1 p. m.',
    '1 de la tarde',
    '1 p. m.',
  ]);

  t = timeData(calendarsApi('es-419'));
  expect(t.preferred).toEqual('h');
  expect(t.allowed).toEqual(['h', 'H', 'hB', 'hb']);

  t = timeData(calendarsApi('und-AR'));
  expect(t.preferred).toEqual('h');
  expect(t.allowed).toEqual(['h', 'H', 'hB', 'hb']);

  t = timeData(calendarsApi('es-AR'));
  expect(t.preferred).toEqual('h');
  expect(t.allowed).toEqual(['h', 'H', 'hB', 'hb']);

  t = timeData(calendarsApi('es-BR'));
  expect(t.preferred).toEqual('H');
  expect(t.allowed).toEqual(['H', 'h', 'hB', 'hb']);

  t = timeData(calendarsApi('und-BR'));
  expect(t.preferred).toEqual('H');
  expect(t.allowed).toEqual(['H', 'hB']);
});
