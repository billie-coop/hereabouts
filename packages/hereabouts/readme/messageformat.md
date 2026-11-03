# @phensley/messageformat

[![@phensley/messageformat](https://badge.fury.io/js/%40phensley%2Fmessageformat.svg)](https://www.npmjs.com/package/@phensley/messageformat) [![min+gzip](https://badgen.net/bundlephobia/minzip/@phensley/messageformat)](https://bundlephobia.com/result?p=@phensley/messageformat)

Compact and extensible ICU message formatter with built-in support for `plural`, `select`, and `selectordinal`. Also supports plural calculations using arbitrary precision decimal numbers.

## Installation

NPM:

```
npm install --save @phensley/messageformat
```

Yarn:

```
yarn add @phensley/messageformat
```

## Translating an app

The translator is the recommended way to put an app's own text into several languages. It
covers the whole workflow: catalogs, fallback, plurals, type-checked keys and arguments, and a
test that keeps every catalog in step. The example site in `apps/website` is translated this
way (`apps/website/src/i18n`).

### 1. A source catalog

One object with every message in your source language, keyed by the message itself. Using the
text as the key keeps code readable (`t('Save changes?')`) and means a missing translation still
shows sensible text.

```ts
// i18n/en.ts
export const en = {
  'Save changes?': 'Save changes?',
  'due {date}': 'due {date}',
  '{count} invoices': '{count, plural, one {# invoice} other {# invoices}}',
};
export type MessageKey = keyof typeof en;
```

Messages are ICU message format: `{name}` placeholders, `{n, plural, ...}`, `{x, select, ...}`.
Apostrophes need no escaping (`Here's {name}`), except right before a brace: write `l''{name}`
for a French elision, or use a typographic `’` (`checkCatalogs` reports the mistake as a lost
placeholder).

If your keys are ids instead of text, declare the catalog `as const` so its messages keep their
literal types; placeholders are then read from the messages.

### 2. One catalog per language

```ts
// i18n/de.ts
import type { MessageCatalog } from '@phensley/messageformat';
import type { MessageKey } from './en';

export const de: MessageCatalog<MessageKey> = {
  'Save changes?': 'Änderungen speichern?',
  'due {date}': 'fällig am {date}',
  '{count} invoices': '{count, plural, one {# Rechnung} other {# Rechnungen}}',
};
```

`MessageCatalog<MessageKey>` only accepts keys that exist in the source catalog. Catalog ids are
languages or locales: `'de'`, `'pt'`, `'pt-PT'`, `'zh-Hant'`.

### 3. One translator

```ts
// i18n/index.ts
import { createTranslator, translate } from '@phensley/messageformat';

export const translator = createTranslator({ source: en, catalogs: { de, fr, ja, 'pt-PT': ptPT } });

translate(translator, 'de-AT', '{count} invoices', { count: 3 }); // "3 Rechnungen"
translate(translator, 'ko', 'Save changes?');                      // "Save changes?" (no catalog)
translate(translator, 'de', 'Save chnages?');     // compile error: not a key of the source catalog
translate(translator, 'de', '{count} invoices');  // compile error: count is missing
```

- **Fallback:** a locale uses its most specific catalog that has the message (`pt-PT`, then
  `pt`), then the source.
- **Plurals follow the text:** an English fallback on a Japanese device uses English plural
  rules; a `pt-PT` catalog uses Portugal's rules, a `pt` catalog Brazil's.
- **Cached:** create the translator once. Messages are parsed once and plural rules built once
  per language; a message without braces or apostrophes isn't parsed at all.
- **Locale ids** can be device-style (`en_CA`) or BCP 47 (`en-CA`).

In a UI framework, wrap `translate` with the current locale, e.g. a React hook returning
`(key, ...args) => translate(translator, locale, key, ...args)`; format numbers, dates and
currencies with `@phensley/cldr` and pass the formatted strings as arguments.

### 4. A test

```ts
// i18n.test.ts
import { checkCatalogs } from '@phensley/messageformat';
import { translator } from '.';

test('catalogs match the source', () => {
  expect(checkCatalogs(translator)).toEqual([]);
});
```

`checkCatalogs` reports, per catalog and key: `missing` and `extra` keys, `placeholders` that
differ from the source message, `unbalanced` braces, and plurals or selects with `no-other`
case. Pass `{ complete: false }` while translations are still in progress to skip missing keys.

Related helpers: `messageArgNames(pattern)` lists a message's placeholders, `isMessageKey(translator, s)`
tells whether a runtime string is a key (for messages that arrive as data, such as validation
errors), and `resolveMessage(translator, locale, key)` returns the message and the catalog it
came from.

## Examples

#### Setup

The package allows you to wire up the different types how you want. Things are broken out so that parsing can be done separately from evaluation.

Parsing can be done at build time -- read a YAML file, parse messages and embed them into a YAML/JSON file, or embed them into code, for faster runtime message evaluation.

Custom formatting and argument conversion functions can be defined and plugged into the framework.

```typescript
import { getPluralRules } from '@phensley/plurals';
import {
  buildMessageMatcher,
  createMessageFormatter,
  defaultMessageArgConverter,
  evaluateMessage,
  formatMessage,
  parseMessagePattern,
  MessageArg,
  MessageNamedArgs
} from '@phensley/messageformat';

const FORMATTERS = {
  foo: (args: MessageArg[], options: string[]) =>
    options[0] === 'upper' ? args[0].toUpperCase() : args[0].toLowerCase()
};

const FORMATTER_NAMES = Object.keys(FORMATTERS);

const MATCHER = buildMessageMatcher(FORMATTER_NAMES);

const CONVERTER = defaultMessageArgConverter;

const parse = (message: string) => parseMessagePattern(message, MATCHER);

const dump = (message: string) => console.log(JSON.stringify(parse(message)));

const plurals = (language: string, region?: string) =>
  getPluralRules(language, region);

const format = (
  message: string,
  positional: MessageArg[],
  named: MessageNamedArgs = {}
) => {
  console.log(
    evaluateMessage(plurals('en'), CONVERTER, FORMATTERS, parse(message), positional, named)
  );
};

let msg: string;
```

#### Example 1 - message parsing (cache for repeated use)

Messages can be pre-parsed and embedded into source code, JSON, or YAML files, or parsed and cached at runtime.

```typescript
dump('{0 select, male {his} female {her} other {their}} {item}');
```

```
[4,[[3,[0],[["male",[0,"his"]],["female",[0,"her"]],["other",[0,"their"]]]],[0," "],[1,"item"]]]
```

```typescript
dump('{word} uppercase = {word foo upper} lowercase = {word foo lower}');
```

```
[4,[[1,"word"],[0," uppercase = "],[6,"foo",["word"],["upper"]],[0," lowercase = "],[6,"foo",["word"],["lower"]]]]
```

#### Example 2 - MessageFormatter

If you don't need to embed parsed messages into source code, a `MessageFormatter` created with `createMessageFormatter` can parse and cache messages at runtime. Internally it uses a least-recently-used cache whose size can be configured. There is no need for the elaborate setup in the first example.

```typescript
const rules = plurals('en');
const formatter = createMessageFormatter({
  plurals: rules,
  formatters: FORMATTERS,
  cacheSize: 100
});
msg = '{0 select, male {his} female {her} other {their}} {item}';
console.log(formatMessage(formatter, msg, ['female'], { item: 'parka' }));
```

```
her parka
```

#### Example 3 - plural cardinals

```typescript
msg =
  '{count, plural, offset:1 =0 {Be the first to like this} =1 {You liked this} ' +
  'one {You and someone else liked this} other {You and # others liked this}}';

format(msg, [], { count: 0 });
format(msg, [], { count: 1 });
format(msg, [], { count: 2 });
format(msg, [], { count: 3 });
```

```
Be the first to like this
You liked this
You and someone else liked this
You and 2 others liked this
```

#### Example 4 - select

```typescript
msg = 'Get {0, select, male {his} female {her} other {their}} {item}';

format(msg, ['they'], { item: 'coat' });
format(msg, ['female'], { item: 'jacket' });
format(msg, ['male'], { item: 'parka' });
```

```
Get their coat
Get her jacket
Get his parka
```

#### Example 5 - plural ordinals and select

```typescript
msg =
  '{name} {tied select true {tied for} other {came in}} {place selectordinal one {#st} ' +
  'two {#nd} few {#rd} other {#th}} place';

const racers = [
  { name: 'Lisa', place: 1 },
  { name: 'Bob', place: 2 },
  { name: 'Betty', place: 3 },
  { name: 'Frank', place: 4, tied: true },
  { name: 'George', place: 4, tied: true },
  { name: 'Larry', place: 5 }
];

for (const racer of racers) {
  format(msg, [], racer);
}
```

```
Lisa came in 1st place
Bob came in 2nd place
Betty came in 3rd place
Frank tied for 4th place
George tied for 4th place
Larry came in 5th place
```

#### Example 6 - custom formatter

```typescript
msg = '{word} uppercase = {word foo upper} lowercase = {word foo lower}';

const WORDS = ['Computer', 'Science', 'Mathematics'];

for (const word of WORDS) {
  format(msg, [], { word });
}
```

```
Computer uppercase = COMPUTER lowercase = computer
Science uppercase = SCIENCE lowercase = science
Mathematics uppercase = MATHEMATICS lowercase = mathematics
```
