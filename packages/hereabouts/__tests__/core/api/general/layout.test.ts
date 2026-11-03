import { characterOrder, lineOrder } from '../../../../src/core';
import { generalApi } from '../../_helpers';

test('character order', () => {
  let api = generalApi('en');
  expect(characterOrder(api)).toEqual('ltr');

  api = generalApi('ar-IL');
  expect(characterOrder(api)).toEqual('rtl');
});

test('line order', () => {
  let api = generalApi('en');
  expect(lineOrder(api)).toEqual('ttb');

  api = generalApi('ar-IL');
  expect(lineOrder(api)).toEqual('ttb');
});
