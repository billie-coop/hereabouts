import { isLanguageTag, languageTag, parseLanguageTag } from '../../src/language-tag';

test('isLanguageTag accepts tags', () => {
  const tags = [
    languageTag(),
    languageTag('en', 'Latn', 'US'),
    parseLanguageTag('en-US-u-ca-gregory-x-foo'),
    parseLanguageTag('zh-yue-Hant-HK-t-en'),
    { extensions: {}, privateUse: '', extlangs: [] },
    { language: 'en', extensions: { u: ['ca', 'buddhist'] }, privateUse: 'x-a', extlangs: ['yue'] },
  ];
  for (const t of tags) {
    expect(isLanguageTag(t)).toBe(true);
  }
});

test('isLanguageTag rejects other objects', () => {
  const ext = { extensions: {}, privateUse: '', extlangs: [] };
  const bad: any[] = [
    undefined,
    null,
    'en',
    {},
    { privateUse: '', extlangs: [] },
    { ...ext, extensions: null },
    { ...ext, extensions: [] },
    { ...ext, extensions: { u: 'ca' } },
    { ...ext, extensions: { u: [1] } },
    { ...ext, privateUse: undefined },
    { ...ext, extlangs: 'yue' },
    { ...ext, extlangs: [1] },
    { ...ext, language: 1 },
    { ...ext, script: null },
    { ...ext, region: 840 },
    { ...ext, variant: {} },
  ];
  for (const x of bad) {
    expect(isLanguageTag(x)).toBe(false);
  }
});
