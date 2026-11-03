import { formatList, formatListToParts } from '../../../../src/core';
import { generalApi } from '../../_helpers';

const ZERO: string[] = [];
const ONE = ['1'];
const TWO = ONE.concat(['2']);
const THREE = TWO.concat(['3']);
const FOUR = THREE.concat(['4']);
const FIVE = FOUR.concat(['5']);
const SIX = FIVE.concat(['6']);

test('list patterns and', () => {
  let api = generalApi('en');

  expect(formatList(api, ZERO)).toEqual('');
  expect(formatList(api, ONE)).toEqual('1');
  expect(formatList(api, TWO)).toEqual('1 and 2');
  expect(formatList(api, THREE)).toEqual('1, 2, and 3');
  expect(formatList(api, FOUR)).toEqual('1, 2, 3, and 4');
  expect(formatList(api, FIVE)).toEqual('1, 2, 3, 4, and 5');
  expect(formatList(api, SIX)).toEqual('1, 2, 3, 4, 5, and 6');

  api = generalApi('fr');

  expect(formatList(api, ZERO)).toEqual('');
  expect(formatList(api, ONE)).toEqual('1');
  expect(formatList(api, TWO)).toEqual('1 et 2');
  expect(formatList(api, THREE)).toEqual('1, 2 et 3');
  expect(formatList(api, FOUR)).toEqual('1, 2, 3 et 4');
  expect(formatList(api, FIVE)).toEqual('1, 2, 3, 4 et 5');
  expect(formatList(api, SIX)).toEqual('1, 2, 3, 4, 5 et 6');

  api = generalApi('th');

  expect(formatList(api, ZERO)).toEqual('');
  expect(formatList(api, ONE)).toEqual('1');
  expect(formatList(api, TWO)).toEqual('1และ2');
  expect(formatList(api, THREE)).toEqual('1 2 และ3');
  expect(formatList(api, FOUR)).toEqual('1 2 3 และ4');
  expect(formatList(api, FIVE)).toEqual('1 2 3 4 และ5');
  expect(formatList(api, SIX)).toEqual('1 2 3 4 5 และ6');
});

test('list patterns and parts', () => {
  const api = generalApi('en');

  expect(formatListToParts(api, ONE)).toEqual([{ type: 'item', value: '1' }]);

  expect(formatListToParts(api, TWO)).toEqual([
    { type: 'item', value: '1' },
    { type: 'literal', value: ' and ' },
    { type: 'item', value: '2' },
  ]);

  expect(formatListToParts(api, THREE)).toEqual([
    { type: 'item', value: '1' },
    { type: 'literal', value: ', ' },
    { type: 'item', value: '2' },
    { type: 'literal', value: ', and ' },
    { type: 'item', value: '3' },
  ]);

  expect(formatListToParts(api, FOUR)).toEqual([
    { type: 'item', value: '1' },
    { type: 'literal', value: ', ' },
    { type: 'item', value: '2' },
    { type: 'literal', value: ', ' },
    { type: 'item', value: '3' },
    { type: 'literal', value: ', and ' },
    { type: 'item', value: '4' },
  ]);

  expect(formatListToParts(api, FIVE)).toEqual([
    { type: 'item', value: '1' },
    { type: 'literal', value: ', ' },
    { type: 'item', value: '2' },
    { type: 'literal', value: ', ' },
    { type: 'item', value: '3' },
    { type: 'literal', value: ', ' },
    { type: 'item', value: '4' },
    { type: 'literal', value: ', and ' },
    { type: 'item', value: '5' },
  ]);

  expect(formatListToParts(api, SIX)).toEqual([
    { type: 'item', value: '1' },
    { type: 'literal', value: ', ' },
    { type: 'item', value: '2' },
    { type: 'literal', value: ', ' },
    { type: 'item', value: '3' },
    { type: 'literal', value: ', ' },
    { type: 'item', value: '4' },
    { type: 'literal', value: ', ' },
    { type: 'item', value: '5' },
    { type: 'literal', value: ', and ' },
    { type: 'item', value: '6' },
  ]);
});

test('list patterns and-short', () => {
  let api = generalApi('en');

  expect(formatList(api, ZERO, 'and-short')).toEqual('');
  expect(formatList(api, ONE, 'and-short')).toEqual('1');
  expect(formatList(api, TWO, 'and-short')).toEqual('1 & 2');
  expect(formatList(api, THREE, 'and-short')).toEqual('1, 2, & 3');
  expect(formatList(api, FOUR, 'and-short')).toEqual('1, 2, 3, & 4');
  expect(formatList(api, FIVE, 'and-short')).toEqual('1, 2, 3, 4, & 5');
  expect(formatList(api, SIX, 'and-short')).toEqual('1, 2, 3, 4, 5, & 6');

  api = generalApi('fr');

  expect(formatList(api, ZERO, 'and-short')).toEqual('');
  expect(formatList(api, ONE, 'and-short')).toEqual('1');
  expect(formatList(api, TWO, 'and-short')).toEqual('1 et 2');
  expect(formatList(api, THREE, 'and-short')).toEqual('1, 2 et 3');
  expect(formatList(api, FOUR, 'and-short')).toEqual('1, 2, 3 et 4');
  expect(formatList(api, FIVE, 'and-short')).toEqual('1, 2, 3, 4 et 5');
  expect(formatList(api, SIX, 'and-short')).toEqual('1, 2, 3, 4, 5 et 6');

  api = generalApi('th');

  expect(formatList(api, ZERO, 'and-short')).toEqual('');
  expect(formatList(api, ONE, 'and-short')).toEqual('1');
  expect(formatList(api, TWO, 'and-short')).toEqual('1และ2');
  expect(formatList(api, THREE, 'and-short')).toEqual('1 2 และ3');
  expect(formatList(api, FOUR, 'and-short')).toEqual('1 2 3 และ4');
  expect(formatList(api, FIVE, 'and-short')).toEqual('1 2 3 4 และ5');
  expect(formatList(api, SIX, 'and-short')).toEqual('1 2 3 4 5 และ6');
});

test('list patterns or', () => {
  let api = generalApi('en');

  expect(formatList(api, ZERO, 'or')).toEqual('');
  expect(formatList(api, ONE, 'or')).toEqual('1');
  expect(formatList(api, TWO, 'or')).toEqual('1 or 2');
  expect(formatList(api, THREE, 'or')).toEqual('1, 2, or 3');
  expect(formatList(api, FOUR, 'or')).toEqual('1, 2, 3, or 4');
  expect(formatList(api, FIVE, 'or')).toEqual('1, 2, 3, 4, or 5');
  expect(formatList(api, SIX, 'or')).toEqual('1, 2, 3, 4, 5, or 6');

  api = generalApi('fr');

  expect(formatList(api, ZERO, 'or')).toEqual('');
  expect(formatList(api, ONE, 'or')).toEqual('1');
  expect(formatList(api, TWO, 'or')).toEqual('1 ou 2');
  expect(formatList(api, THREE, 'or')).toEqual('1, 2 ou 3');
  expect(formatList(api, FOUR, 'or')).toEqual('1, 2, 3 ou 4');
  expect(formatList(api, FIVE, 'or')).toEqual('1, 2, 3, 4 ou 5');
  expect(formatList(api, SIX, 'or')).toEqual('1, 2, 3, 4, 5 ou 6');

  api = generalApi('th');

  expect(formatList(api, ZERO, 'or')).toEqual('');
  expect(formatList(api, ONE, 'or')).toEqual('1');
  expect(formatList(api, TWO, 'or')).toEqual('1 หรือ 2');
  expect(formatList(api, THREE, 'or')).toEqual('1, 2 หรือ 3');
  expect(formatList(api, FOUR, 'or')).toEqual('1, 2, 3 หรือ 4');
  expect(formatList(api, FIVE, 'or')).toEqual('1, 2, 3, 4 หรือ 5');
  expect(formatList(api, SIX, 'or')).toEqual('1, 2, 3, 4, 5 หรือ 6');
});
