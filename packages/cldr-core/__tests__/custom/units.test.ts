import type { Quantity } from '../../lib';
import { formatQuantity } from '../../src';
import { buildConfig, unitsApi } from '../_helpers';

test('custom units', () => {
  const cfg = buildConfig({ 'unit-id': ['mile', 'foot'] });
  const api = unitsApi('en', cfg);
  let s: string;

  const q: Quantity = { value: '123.4567' };
  q.unit = 'mile';

  s = formatQuantity(api, q);
  expect(s).toEqual('123.457 miles');

  q.unit = 'foot';
  s = formatQuantity(api, q);
  expect(s).toEqual('123.457 feet');

  // Missing value
  q.unit = 'kilogram';
  s = formatQuantity(api, q);
  expect(s).toEqual('');
});
