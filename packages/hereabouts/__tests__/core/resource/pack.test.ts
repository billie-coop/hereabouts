import { packGet, loadPack as parsePack } from '../../../src/core';
import { languageTag } from '../../../src/language-tag';
import { loadPack } from '../_helpers';

test('error bad format', () => {
  expect(() => parsePack({})).toThrowError('Severe error');
  expect(() => parsePack('')).toThrowError('JSON input');
  expect(() => parsePack('{}')).toThrowError('Severe error');
});

test('resolve tag', () => {
  const pack = loadPack('en');
  const b = packGet(pack, languageTag(undefined));
  expect(b.id).toEqual('en-Latn-US');
});
