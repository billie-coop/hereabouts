import { type MeasurementCategory, measurementSystem } from '../../../src';
import { generalApi } from '../../_helpers';

const api = generalApi;

test('measurement system', () => {
  // US
  expect(measurementSystem(api('en'))).toEqual('us');
  expect(measurementSystem(api('und-LR'))).toEqual('us');
  expect(measurementSystem(api('und-MM'))).toEqual('us');
  expect(measurementSystem(api('es-US'))).toEqual('us');

  // UK
  expect(measurementSystem(api('und-GB'))).toEqual('uk');

  // Metric
  expect(measurementSystem(api('und-001'))).toEqual('metric');
  expect(measurementSystem(api('de'))).toEqual('metric');
});

test('temperature', () => {
  const c: MeasurementCategory = 'temperature';

  // US
  expect(measurementSystem(api('und-BS'), c)).toEqual('us');
  expect(measurementSystem(api('und-BZ'), c)).toEqual('us');
  expect(measurementSystem(api('es-PR'), c)).toEqual('us');
  expect(measurementSystem(api('en-PW'), c)).toEqual('us');

  // Metric
  expect(measurementSystem(api('und-001'), c)).toEqual('metric');
  expect(measurementSystem(api('de'), c)).toEqual('metric');
});
