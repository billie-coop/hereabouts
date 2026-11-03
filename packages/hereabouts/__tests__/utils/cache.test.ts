import { cacheGet, cacheSize, createCache } from '../../src/utils';

interface Foo {
  key: string;
}

const parser = (k: string): Foo => ({ key: k });

test('basics', () => {
  const cache = createCache<Foo>(parser, 3);
  expect(cacheGet(cache, 'foo')).toEqual({ key: 'foo' });
  expect(cacheSize(cache)).toEqual(1);
  expect(cacheGet(cache, 'foo')).toEqual({ key: 'foo' });
  expect(cacheSize(cache)).toEqual(1);

  expect(cacheGet(cache, 'bar')).toEqual({ key: 'bar' });
  expect(cacheGet(cache, 'quux')).toEqual({ key: 'quux' });
  expect(cacheSize(cache)).toEqual(3);

  expect(cacheGet(cache, 'zzz')).toEqual({ key: 'zzz' });
  expect(cacheSize(cache)).toEqual(3);
});
