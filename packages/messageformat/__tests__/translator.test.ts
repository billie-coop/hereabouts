import {
  checkCatalogs,
  createTranslator,
  isMessageKey,
  type MessageArgNames,
  type MessageCatalog,
  messageArgNames,
  resolveMessage,
  translate,
} from '../src';

const en = {
  'Save changes?': 'Save changes?',
  '{count} invoices': '{count, plural, one {# invoice} other {# invoices}}',
  'due {date}': 'due {date}',
  "Here's {name}": "Here's {name}",
  '{count} overdue for {customer}':
    '{count, plural, =0 {Nothing overdue for {customer}} one {# invoice overdue for {customer}} other {# invoices overdue for {customer}}}',
};
type Key = keyof typeof en;

const de: MessageCatalog<Key> = {
  'Save changes?': 'Änderungen speichern?',
  '{count} invoices': '{count, plural, one {# Rechnung} other {# Rechnungen}}',
  "Here's {name}": 'Hier ist {name}',
};
const fr: MessageCatalog<Key> = {
  // ICU: an apostrophe right before { starts quoted text, so French elision needs ''.
  "Here's {name}": "Voici l''{name}",
  'due {date}': "dû le {date} (aujourd'hui)",
};
const pt: MessageCatalog<Key> = {
  '{count} invoices': '{count, plural, one {# fatura} other {# faturas}}',
};
const ptPT: MessageCatalog<Key> = { 'Save changes?': 'Guardar alterações?' };

const t = createTranslator({ source: en, catalogs: { de, fr, pt, 'pt-PT': ptPT } });

test('translate with fallback', () => {
  expect(translate(t, 'de', 'Save changes?')).toEqual('Änderungen speichern?');
  expect(translate(t, 'de-AT', 'Save changes?')).toEqual('Änderungen speichern?');
  expect(translate(t, 'de_CH', '{count} invoices', { count: 3 })).toEqual('3 Rechnungen');
  // Missing from de: English text.
  expect(translate(t, 'de', 'due {date}', { date: '31.1.' })).toEqual('due 31.1.');
  // pt-PT falls back to pt, then English.
  expect(translate(t, 'pt-PT', 'Save changes?')).toEqual('Guardar alterações?');
  expect(translate(t, 'pt-PT', '{count} invoices', { count: 5 })).toEqual('5 faturas');
  expect(translate(t, 'pt-BR', 'Save changes?')).toEqual('Save changes?');
  expect(translate(t, 'ja', 'Save changes?')).toEqual('Save changes?');
  expect(resolveMessage(t, 'pt-PT', '{count} invoices')).toEqual([pt['{count} invoices'], 'pt']);
  expect(resolveMessage(t, 'ja-JP', 'Save changes?')).toEqual(['Save changes?', 'en']);
});

test('plural rules follow the language the text is in', () => {
  // Portuguese (Brazil, the 'pt' default) treats 0 as "one"; an English fallback must not.
  expect(translate(t, 'pt', '{count} invoices', { count: 0 })).toEqual('0 fatura');
  // English fallback on a Japanese device uses English plurals (Japanese has only "other").
  expect(translate(t, 'ja', '{count} invoices', { count: 1 })).toEqual('1 invoice');
  // Polish has few / many; the English fallback still says "invoices".
  expect(translate(t, 'pl', '{count} invoices', { count: 2 })).toEqual('2 invoices');
  // A regional catalog uses the region's rules: pt-PT treats 0 as "other".
  const t2 = createTranslator({ source: en, catalogs: { 'pt-PT': pt } });
  expect(translate(t2, 'pt-PT', '{count} invoices', { count: 0 })).toEqual('0 faturas');
});

test('apostrophes need no escaping', () => {
  expect(translate(t, 'en', "Here's {name}", { name: 'Ada' })).toEqual("Here's Ada");
  expect(translate(t, 'fr', "Here's {name}", { name: 'atelier' })).toEqual("Voici l'atelier");
  expect(translate(t, 'fr', 'due {date}', { date: '31/01' })).toEqual("dû le 31/01 (aujourd'hui)");
  const t2 = createTranslator({
    source: { k: "Use '{' and '}' around '{name}' ({name}), it''s fine" },
  });
  expect(translate(t2, 'en', 'k', { name: 'x' })).toEqual(
    "Use { and } around {name} (x), it's fine",
  );
});

test('nested placeholders and exact matches', () => {
  expect(
    translate(t, 'en', '{count} overdue for {customer}', { count: 0, customer: 'Billie' }),
  ).toEqual('Nothing overdue for Billie');
  expect(
    translate(t, 'en', '{count} overdue for {customer}', { count: 2, customer: 'Billie' }),
  ).toEqual('2 invoices overdue for Billie');
});

test('parsed messages are cached in the translator', () => {
  const t2 = createTranslator({ source: en, catalogs: { de } });
  for (let i = 0; i < 100; i++) {
    translate(t2, 'de', '{count} invoices', { count: i });
    translate(t2, 'en', '{count} invoices', { count: i });
    translate(t2, 'de', 'Save changes?');
  }
  // Two patterns parsed once each; text without braces or apostrophes isn't parsed at all.
  expect(t2.state.parsed.size).toEqual(2);
  expect(t2.state.plurals.size).toEqual(2);
});

test('keys', () => {
  expect(isMessageKey(t, 'Save changes?')).toBe(true);
  expect(isMessageKey(t, 'Required')).toBe(false);
  expect(isMessageKey(t, 'toString')).toBe(false);
});

test('argument names', () => {
  expect(messageArgNames('{count} invoices')).toEqual(['count']);
  expect(messageArgNames(en['{count} overdue for {customer}'])).toEqual(['count', 'customer']);
  expect(messageArgNames("it's '{literal}' {x}")).toEqual(['x']);
  expect(messageArgNames('{g, select, a {{x}} other {{y}}}')).toEqual(['g', 'x', 'y']);
  expect(messageArgNames('{n, number} {d, date}', { formatters: ['number', 'date'] })).toEqual([
    'd',
    'n',
  ]);
  expect(messageArgNames('plain')).toEqual([]);
});

test('an apostrophe before a placeholder quotes it, and the check catches that', () => {
  const t2 = createTranslator({
    source: en,
    catalogs: { fr: { "Here's {name}": "Voici l'{name}" } },
  });
  expect(translate(t2, 'fr', "Here's {name}", { name: 'atelier' })).toEqual('Voici l{name}');
  expect(checkCatalogs(t2, { complete: false })).toEqual([
    {
      language: 'fr',
      key: "Here's {name}",
      problem: 'placeholders',
      detail: 'has none, source has {name}',
    },
  ]);
});

test('check catalogs', () => {
  expect(
    checkCatalogs(createTranslator({ source: en, catalogs: { de } }), { complete: false }),
  ).toEqual([]);
  const broken = createTranslator({
    source: en,
    catalogs: {
      xx: {
        'Save changes?': 'ok',
        '{count} invoices': '{count, plural, one {# x}}',
        'due {date}': 'due {datum}',
        "Here's {name}": 'unbalanced {name',
        Nope: 'extra',
      } as MessageCatalog<Key>,
    },
  });
  const issues = checkCatalogs(broken).map((i) => `${i.language} ${i.problem} ${i.key}`);
  expect(issues).toEqual([
    'xx no-other {count} invoices',
    'xx placeholders due {date}',
    "xx unbalanced Here's {name}",
    'xx missing {count} overdue for {customer}',
    'xx extra Nope',
  ]);
  expect(checkCatalogs(broken).find((i) => i.problem === 'placeholders')?.detail).toEqual(
    'has {datum}, source has {date}',
  );
});

// Compile-time checks: tsc fails if any of these is wrong (yarn ts-check).
type Expect<T extends true> = T;
type Eq<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
export type TypeTests = [
  Expect<Eq<MessageArgNames<'{count} invoices'>, 'count'>>,
  Expect<
    Eq<
      MessageArgNames<'{count, plural, one {# for {customer}} other {# invoices}}'>,
      'count' | 'customer'
    >
  >,
  Expect<Eq<MessageArgNames<'{count, plural, one {invoice} other {invoices}}'>, 'count'>>,
  Expect<Eq<MessageArgNames<'{g, select, male {he} other {{name}}}'>, 'g' | 'name'>>,
  Expect<Eq<MessageArgNames<'Save changes?'>, never>>,
  Expect<Eq<MessageArgNames<'paid {date} for {amount, number}'>, 'date' | 'amount'>>,
  Expect<Eq<MessageArgNames<'{ count , plural, =0 {none} other {#}}'>, 'count'>>,
  Expect<Eq<MessageArgNames<string>, never>>,
];

test('type checks on keys and arguments', () => {
  const ids = { greeting: 'Hello {name}', bye: 'Bye' } as const;
  const t2 = createTranslator({ source: ids });
  expect(translate(t2, 'en', 'greeting', { name: 'Ada' })).toEqual('Hello Ada');
  expect(translate(t2, 'en', 'bye')).toEqual('Bye');
  const unchecked = () => {
    // @ts-expect-error unknown key
    translate(t, 'de', 'Save chnages?');
    // @ts-expect-error missing argument
    translate(t, 'de', '{count} invoices');
    // @ts-expect-error wrong argument name
    translate(t, 'de', '{count} invoices', { n: 3 });
    // @ts-expect-error id-keyed catalogs read placeholders from the literal message
    translate(t2, 'en', 'greeting');
    // @ts-expect-error a catalog can only have source keys
    const bad: MessageCatalog<Key> = { Nope: 'x' };
    return bad;
  };
  expect(typeof unchecked).toEqual('function');
});
