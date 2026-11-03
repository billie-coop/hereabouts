import { type LocaleData, type NumberSystemType, vectorMapping } from '../../../../src/core';
import { getNumberParams } from '../../../../src/core/api/private';
import type { NumberParams } from '../../../../src/core/common/private';
import { languageBundle } from '../../_helpers';

const LATN_DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

// Number params are cached per locale data object.
const getCache = (tag: string): LocaleData => languageBundle(tag);

test('number systems', () => {
  const bundle = languageBundle('zh');
  const res = vectorMapping(bundle.schema.Numbers.numberSystems, bundle);
  expect(res.finance).toEqual('hansfin');
});

test('v39 symbols', () => {
  const cache = getCache('en');
  const params = getNumberParams(cache, 'latn');
  expect(params.symbols.approximatelySign).toEqual('~');
});

test('invalid system', () => {
  let params: NumberParams;
  let cache: LocaleData;

  const bundle = languageBundle('zh-u-nu-invalid');
  expect(bundle.numberSystem).toEqual('invalid');

  cache = getCache('zh-u-nu-unknown');
  params = getNumberParams(cache, 'invalid' as NumberSystemType);
  expect(params.digits).toEqual(LATN_DIGITS);

  params = getNumberParams(cache);
  expect(params.digits).toEqual(LATN_DIGITS);

  cache = getCache('zh-u-nu-x');
  expect(params.digits).toEqual(LATN_DIGITS);
});

test('number params cache', () => {
  let cache: LocaleData;
  let params: NumberParams;

  cache = getCache('en');
  params = getNumberParams(cache, 'finance');
  expect(params.digits).toEqual(LATN_DIGITS);
  expect(params.primaryGroupingSize).toEqual(3);

  // NOTE: hansfin not implemented, so falls back to 'latn'
  cache = getCache('zh');
  params = getNumberParams(cache, 'finance');
  expect(params.digits).toEqual(LATN_DIGITS);
  expect(params.primaryGroupingSize).toEqual(3);

  cache = getCache('fa-AF');
  params = getNumberParams(cache, 'finance');
  expect(params.digits).toEqual(['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']);
  expect(params.primaryGroupingSize).toEqual(3);

  params = getNumberParams(cache, 'mathbold');
  expect(params.digits).toEqual(['𝟎', '𝟏', '𝟐', '𝟑', '𝟒', '𝟓', '𝟔', '𝟕', '𝟖', '𝟗']);

  params = getNumberParams(cache, 'brah');
  expect(params.digits).toEqual(['𑁦', '𑁧', '𑁨', '𑁩', '𑁪', '𑁫', '𑁬', '𑁭', '𑁮', '𑁯']);

  params = getNumberParams(cache, 'cakm');
  expect(params.digits).toEqual(['𑄶', '𑄷', '𑄸', '𑄹', '𑄺', '𑄻', '𑄼', '𑄽', '𑄾', '𑄿']);

  params = getNumberParams(cache, 'osma');
  expect(params.digits).toEqual(['𐒠', '𐒡', '𐒢', '𐒣', '𐒤', '𐒥', '𐒦', '𐒧', '𐒨', '𐒩']);
});
