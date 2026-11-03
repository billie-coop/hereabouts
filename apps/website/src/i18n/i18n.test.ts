import { checkCatalogs } from '@billie-coop/hereabouts';
import { describe, expect, test } from 'vitest';
import { translator, translatorFor } from '.';

// The test every app with catalogs should have: each catalog has every source message, with
// the same placeholders, balanced braces and an `other` case in every plural.
test('catalogs match the English source', () => {
  expect(checkCatalogs(translator)).toEqual([]);
});

describe.each(Object.keys(translator.catalogs))('%s', (language) => {
  test('every message formats without leftover braces', () => {
    const t = translatorFor(language);
    for (const key of Object.keys(translator.source) as (keyof typeof translator.source)[]) {
      const args = new Proxy({}, { get: (_, k) => (typeof k === 'string' ? 2 : undefined) });
      const out = (t as (k: string, a: object) => string)(key, args);
      expect(out, key).not.toMatch(/[{}]/);
      expect(out.length, key).toBeGreaterThan(0);
    }
  });
});

test('fallback and plurals', () => {
  const t = translatorFor('de-AT');
  expect(t('Locale')).toEqual('Gebietsschema');
  expect(translatorFor('ko')('Locale')).toEqual('Locale');
  expect(translatorFor('zh-Hant-TW')('Time zone')).toEqual('時區');
  const key =
    'The clocks change in {zone} on {date}: {time} that day comes {hours, plural, one {# hour} other {# hours}} after {time} the day before.';
  const args = { zone: 'Z', date: 'D', time: 'T', hours: 23 };
  expect(translatorFor('en')(key, args)).toContain('23 hours');
  expect(translatorFor('de')(key, args)).toContain('23 Stunden');
  expect(translatorFor('ar')(key, { ...args, hours: 2 })).toContain('ساعتين');
});
