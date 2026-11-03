import { config as defaultconfig } from '../../cldr/src/config';
import {
  createFramework,
  formatDecimal,
  formatMessage,
  loadLocale,
  loadLocaleAsync,
  messageFormatter,
} from '../src';
import { asyncLoader, getCLDR, loader } from './_helpers';

test('loading the same locale again returns the same locale data', async () => {
  let calls = 0;
  const fw = createFramework({
    config: defaultconfig,
    loader: (l) => (calls++, loader(l)),
    asyncLoader,
  });
  const a = loadLocale(fw, 'en-CA');
  expect(loadLocale(fw, 'en-CA')).toBe(a);
  expect(await loadLocaleAsync(fw, 'en-CA')).toBe(a);
  // Same language, other locales: one pack load, distinct locale data.
  const b = loadLocale(fw, 'en-GB');
  expect(b).not.toBe(a);
  expect(b.region).toEqual('GB');
  // The id is kept as given.
  const c = loadLocale(fw, 'en_CA');
  expect(c).not.toBe(a);
  expect(c.locale.id).toEqual('en_CA');
  expect(a.locale.id).toEqual('en-CA');
  expect(calls).toEqual(1);
  expect(formatDecimal(a, '1234.5')).toEqual(formatDecimal(c, '1234.5'));
});

test('the locale cache is bounded', () => {
  const fw = createFramework({ config: defaultconfig, loader, localeCacheSize: 2 });
  const a = loadLocale(fw, 'en-US');
  loadLocale(fw, 'en-GB');
  loadLocale(fw, 'en-AU');
  const a2 = loadLocale(fw, 'en-US');
  expect(a2).not.toBe(a);
  expect(a2).toEqual(a);
});

test('the default message formatter is shared per locale', () => {
  const fw = createFramework({ config: defaultconfig, loader });
  const en = loadLocale(fw, 'en');
  const f = messageFormatter(en);
  expect(messageFormatter(en)).toBe(f);
  expect(messageFormatter(loadLocale(fw, 'en'))).toBe(f);
  expect(messageFormatter(en, { cacheSize: 10 })).not.toBe(f);
  expect(formatMessage(f, '{n, plural, one {# item} other {# items}}', [], { n: 2 })).toEqual(
    '2 items',
  );
});

test('the convenience object is reused per locale', async () => {
  const framework = getCLDR();
  const en = framework.get('en-US');
  expect(framework.get('en-US')).toBe(en);
  expect(await framework.getAsync('en-US')).toBe(en);
  expect(framework.get('en-GB')).not.toBe(en);
  expect(en.General.messageFormatter()).toBe(en.General.messageFormatter());
});
