import { getPluralCardinal, getPluralOrdinal } from '../../../../src/core';
import { decimal } from '../../../../src/decimal';
import { numbersApi } from '../../_helpers';

test('cardinals', () => {
  // Main test cases are under engine/plurals. These are here to confirm
  // the public interface is covered.

  let api = numbersApi('en');
  expect(getPluralCardinal(api, '0')).toEqual('other');
  expect(getPluralCardinal(api, '1')).toEqual('one');
  expect(getPluralCardinal(api, '2')).toEqual('other');

  expect(getPluralCardinal(api, '1.0')).toEqual('other');
  expect(getPluralCardinal(api, '1.5')).toEqual('other');

  expect(getPluralCardinal(api, decimal('1.0'))).toEqual('other');
  expect(getPluralCardinal(api, decimal('1.5'))).toEqual('other');

  api = numbersApi('fr');
  expect(getPluralCardinal(api, '0')).toEqual('one');
  expect(getPluralCardinal(api, '1')).toEqual('one');
  expect(getPluralCardinal(api, '2')).toEqual('other');
  expect(getPluralCardinal(api, '10')).toEqual('other');

  expect(getPluralCardinal(api, '1.2')).toEqual('one');
  expect(getPluralCardinal(api, '1.7')).toEqual('one');

  api = numbersApi('az');
  expect(getPluralCardinal(api, '1')).toEqual('one');
  for (const n of ['0', '2', '3', '4', '5']) {
    expect(getPluralCardinal(api, n)).toEqual('other');
  }
});

test('cardinals with options', () => {
  const api = numbersApi('en');

  expect(getPluralCardinal(api, '0.5', { round: 'down' })).toEqual('other');
  expect(getPluralCardinal(api, '1', { minimumFractionDigits: 1 })).toEqual('other');

  expect(getPluralCardinal(api, '1', { minimumFractionDigits: 0 })).toEqual('one');
  expect(getPluralCardinal(api, '1.1', { maximumFractionDigits: 0 })).toEqual('one');
});

test('ordinals', () => {
  let api = numbersApi('en');
  expect(getPluralOrdinal(api, '0')).toEqual('other');
  expect(getPluralOrdinal(api, '1')).toEqual('one');
  expect(getPluralOrdinal(api, '2')).toEqual('two');
  expect(getPluralOrdinal(api, '3')).toEqual('few');
  expect(getPluralOrdinal(api, '4')).toEqual('other');

  expect(getPluralOrdinal(api, '0', { minimumFractionDigits: 1 })).toEqual('other');

  api = numbersApi('fr');
  expect(getPluralOrdinal(api, '1')).toEqual('one');
  for (const n of ['0', '2', '3', '4']) {
    expect(getPluralOrdinal(api, n)).toEqual('other');
  }

  api = numbersApi('az');
  for (const n of ['1', '2', '5', '7', '8']) {
    expect(getPluralOrdinal(api, n)).toEqual('one');
  }
  for (const n of ['3', '4']) {
    expect(getPluralOrdinal(api, n)).toEqual('few');
  }
  for (const n of ['0', '6', '16', '26']) {
    expect(getPluralOrdinal(api, n)).toEqual('many');
  }
  for (const n of ['9', '10', '19', '29']) {
    expect(getPluralOrdinal(api, n)).toEqual('other');
  }
});
