# hereabouts

Internationalization for JavaScript and TypeScript, built on Unicode CLDR data: numbers, exact
decimal math, currencies, dates and time zones, units, plurals, messages, app translations and
locale matching, for 429 locales.

Everything is plain data and plain functions. Locale data is a plain object you pass to the
functions you import, and bundlers drop the rest: formatting numbers for one locale is about
42 KB min+gzip, decimal math alone about 3 KB.

hereabouts is a port of [cldr-engine](https://github.com/phensley/cldr-engine) by Patrick
Hensley. See [A port of cldr-engine](#a-port-of-cldr-engine).

**Status:** early releases (0.x) on npm as `@billie-coop/hereabouts`. Until 1.0, a minor
version (0.2, 0.3) may change the API.

Live examples: [billie-coop.github.io/hereabouts](https://billie-coop.github.io/hereabouts/)
([source](https://github.com/billie-coop/hereabouts/tree/main/apps/website)).

- [Install](#install)
- [Example](#example)
- [Entry points](#entry-points)
- [Locale data](#locale-data)
- Guides: [numbers and currencies](#numbers-and-currencies), [decimal math](#decimal-math),
  [days, times and time zones](#days-times-and-time-zones),
  [time zone data](#time-zone-data), [translating an app](#translating-an-app),
  [ICU messages](#icu-messages), [plurals](#plurals),
  [language tags, locales and flags](#language-tags-locales-and-flags),
  [locale matching](#locale-matching), [unit conversion](#unit-conversion),
  [the convenience object](#the-convenience-object)
- [What's in it](#whats-in-it)
- [A port of cldr-engine](#a-port-of-cldr-engine)
- [Development](#development)

## Install

```sh
npm install @billie-coop/hereabouts
```

## Example

```typescript
import {
  createFramework, loadLocale, formatDecimal, formatCurrency,
  dayFromString, dayAdd, formatDay, formatInstant,
  decimal, decimalAdd, decimalToString, localeFlag,
} from '@billie-coop/hereabouts';

// Locale data comes from resource packs, one per language, loaded however you like.
const framework = createFramework({ loader: (language) => readPack(language) });
const de = loadLocale(framework, 'de-DE');

formatDecimal(de, '1234.567', { maximumFractionDigits: 2 }); // '1.234,57'
formatCurrency(de, '1234.5', 'EUR');                           // '1.234,50 €'

// Days have no time and no zone; instants are epoch ms, read in an explicit zone.
const due = dayFromString('2026-01-31');
formatDay(de, dayAdd(due, { months: 1 }));                     // '28.02.2026'
formatInstant(de, Date.UTC(2026, 2, 29, 12), 'Europe/Berlin', { datetime: 'short' });
                                                               // '29.03.26, 14:00'

decimalToString(decimalAdd(decimal('0.1'), '0.2'));           // '0.3'
localeFlag('de-AT');                                           // '🇦🇹'
```

## Entry points

One package with subpath exports. The root has everything that needs locale data plus most
of the subpaths; a subpath is useful when you only need that part, or for what the root doesn't
include (`/timezone`, `/unit-converter`). The same function imported from the root and from a
subpath is the same function.

| import from | contents |
|---|---|
| `@billie-coop/hereabouts` | locale data and the locale functions (number, currency, unit, date and list formatting, display names, calendars), plus everything in `/datetime`, `/decimal`, `/messageformat`, `/plurals`, `/language-tag`, `/locale`, `/locale-matcher`; the [convenience object](#the-convenience-object) |
| `@billie-coop/hereabouts/datetime` | `Day`, `TimeOfDay`, instants, zones |
| `@billie-coop/hereabouts/decimal` | arbitrary precision decimals and rationals |
| `@billie-coop/hereabouts/timezone` | the IANA time zone database (`tz*`, `setTimeZoneData`) |
| `@billie-coop/hereabouts/messageformat` | ICU message formatting and the translator |
| `@billie-coop/hereabouts/plurals` | plural rules |
| `@billie-coop/hereabouts/language-tag` | BCP 47 language tag parsing |
| `@billie-coop/hereabouts/locale` | locale resolution and emoji flags |
| `@billie-coop/hereabouts/locale-matcher` | locale matching |
| `@billie-coop/hereabouts/unit-converter` | unit conversion |
| `@billie-coop/hereabouts/packs/<language>.json` | the resource packs |

Node gets CommonJS (`require` and `import` both work). Bundlers that read the `module`
condition (Vite, webpack, esbuild, Rollup) get ES modules and drop what you don't use; the
package has no side effects on import. TypeScript finds the types with any
`moduleResolution` (`node`, `node16`, `bundler`).

## Locale data

Each language's CLDR data is one resource pack, a JSON file that covers all its scripts and
regions (English: 260 KB, 47 KB gzipped). The packs ship in the package under `packs/`. You
give the framework a loader and it asks for packs by language:

```typescript
// Node: read the pack from the package.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createFramework, loadLocale } from '@billie-coop/hereabouts';

const readPack = (language: string) =>
  readFileSync(
    fileURLToPath(import.meta.resolve(`@billie-coop/hereabouts/packs/${language}.json`)),
    'utf8',
  );
const framework = createFramework({ loader: readPack });
const en = loadLocale(framework, 'en-US');
```

In a browser, use `asyncLoader` and `loadLocaleAsync`, and fetch the packs from wherever you
serve them (copy them to your static files), or let your bundler split them into chunks; the
example site does that with Vite's `import.meta.glob`
([apps/website/src/locale.ts](https://github.com/billie-coop/hereabouts/blob/main/apps/website/src/locale.ts)).

```typescript
const framework = createFramework({
  asyncLoader: (language) => fetch(`/packs/${language}.json`).then((r) => r.text()),
});
const fr = await loadLocaleAsync(framework, 'fr-CA');
```

A loaded locale is cached per framework (64 by default, `localeCacheSize`). Packs must come
from the same `major.minor` version of the library: the framework checks a checksum and
throws on a mismatch. `availableLocales()` lists the 429 locales; `resolveLocale` and
`createLocaleMatcher` pick one for a user.

## Numbers and currencies

```typescript
import { formatCurrency, formatDecimal, formatQuantity, getCurrencyForRegion } from '@billie-coop/hereabouts';

formatDecimal(en, '1234567.891', { style: 'short' });              // '1.2M'
formatDecimal(en, 0.256, { style: 'percent' });                      // '26%'
formatCurrency(en, '1234.5', 'JPY');                                 // '¥1,234' (no decimals, half-even)
formatCurrency(en, '-1234.5', 'EUR', { style: 'accounting' });      // '(€1,234.50)'
formatQuantity(en, { value: '42.195', unit: 'kilometer' }, { length: 'short' }); // '42.195 km'
getCurrencyForRegion('CH');                                          // 'CHF'
```

Numbers can be strings, numbers or decimals, and are formatted from their exact digits.
Every formatter has a `...ToParts` variant that returns typed parts for markup.

## Decimal math

Decimals are immutable plain values. Create one with `decimal()` from a number or string, and
operate on it with the `decimal*` functions, which return new values. Functions that take a
decimal also accept a number or string. Rationals work the same way (`rational()`,
`rationalAdd()`, `rationalToDecimal()`, ...). Decimals are plain objects, so they survive
`JSON.stringify` and `structuredClone`.

```typescript
import { decimal, decimalAdd, decimalCompare, decimalMultiply, decimalSetScale, decimalToString } from '@billie-coop/hereabouts/decimal';

const total = decimalAdd(decimal('0.1'), '0.2');
decimalToString(total); // '0.3'
decimalCompare(total, 0.3); // 0
decimalToString(decimalSetScale('2.665', 2)); // '2.66' (half-even rounding by default)

// Multiplication is exact; division and rounding take a MathContext ({ scale } or { precision }).
decimalToString(decimalMultiply('4.32', '9.461e12', { precision: 30 })); // '40871520000000'
```

## Days, times and time zones

A JavaScript `Date` is an instant read in the device's time zone, so a due date stored as
`2026-01-31` becomes a different moment on every device and the wrong day on a server running
in UTC. `@billie-coop/hereabouts/datetime` keeps the kinds of value apart:

- **`Day`**: a calendar day, `{ year, month, day }`. No time, no zone. Due dates, birthdays.
- **`TimeOfDay`**: a wall clock time, `{ hour, minute, second, millis }`. No day, no zone.
  "Remind me at 9:00", an alarm.
- **Instant**: a moment, milliseconds since 1970 UTC (`Date.now()`). Payments, `created_at`.
- **Zone**: an IANA id such as `'America/Vancouver'`.

Day and time-of-day math is exact integer arithmetic and never touches a zone. Only a few
functions take one: they answer "what day is it there?" and "when is 9:00 there?". Daylight
saving time is handled in those functions and nowhere else.

```typescript
import { dayAdd, dayAtTime, dayFromString, dayToday, dayToString, dayUntil, timeOfDay } from '@billie-coop/hereabouts/datetime';

const due = dayFromString('2026-01-31');
dayToString(dayAdd(due, { months: 1 })); // '2026-02-28' (clamped to the month end)
dayUntil(dayToday('America/Vancouver'), due); // days left, in Vancouver

// 9:00 on the due date in Tokyo, as an instant (skipped / repeated times handled like Temporal)
dayAtTime(due, timeOfDay(9), 'Asia/Tokyo');
```

Values are plain objects (readonly in the types, not frozen). Every function checks its
inputs: an invalid day or time of day (including a hand-built `{ year: 2026, month: 2, day: 30 }`),
a non-integer duration, an unknown zone, or an instant that is NaN, infinite or outside
JavaScript `Date`'s range throws a `RangeError`. The parse functions return `undefined` for
text that isn't valid (an unknown zone passed to `instantParse` still throws). Nothing rolls
over silently. Instants are milliseconds; a fractional one is floored.

**Scheduling.** To schedule something at a wall clock time, store the day (or a rule that picks
days), the `TimeOfDay`, and either a zone ("9:00 Vancouver time", pinned) or nothing ("9:00
wherever I am", floating, resolved with the device's current zone). Compute the instant with
`dayAtTime` when you need it. Don't store the computed instant as the source of truth: a daily
9:00 is not every 24 hours across a clock change, and governments change time zone rules.

**Formatting** with locale data, from the root: `formatDay`, `formatDayInterval`,
`formatDayRelative`, `formatTimeOfDay`, `formatInstant`, `formatInstantRelative`. The CLDR
calendar dates (`formatDate`, Gregorian, ISO-8601, Japanese, Persian and Buddhist calendars,
skeletons, intervals, relative time) are in the root too.

Day math alone is about 1.3 KB min+gzip; the zone functions add the time zone database
(about 32 KB). Moving from date-fns:
[examples/date-fns-migration](https://github.com/billie-coop/hereabouts/tree/main/examples/date-fns-migration).

## Time zone data

The full IANA tz database (2026f), compact, decoded on first use. Deprecated ids and aliases
resolve to their canonical zone. Offsets are in milliseconds.

```typescript
import { defaultTimeZoneData, setTimeZoneData, tzFromUTC, tzFromWall, tzResolveId } from '@billie-coop/hereabouts/timezone';

tzResolveId('Pacific/Samoa'); // 'Pacific/Pago_Pago'
tzFromUTC('America/New_York', 1584549000000);
// { abbr: 'EDT', dst: 1, offset: -14400000, zoneid: 'America/New_York' }

// A wall clock time in a zone: the UTC instant and the zone info
tzFromWall('America/New_York', 1583633400000);
// [1583651400000, { abbr: 'EDT', dst: 1, offset: -14400000, zoneid: 'America/New_York' }]

// Replace the data (same RawData format, e.g. generated by tztool from a newer release)
setTimeZoneData(myRawData);
setTimeZoneData(defaultTimeZoneData); // back to the bundled data
```

`setTimeZoneData` changes the data every function in the package uses, the root's date
formatters included.

## Translating an app

The translator puts an app's own text into several languages: catalogs, fallback, plurals,
type-checked keys and arguments, and a test that keeps every catalog in step. The example
site is translated this way
([apps/website/src/i18n](https://github.com/billie-coop/hereabouts/tree/main/apps/website/src/i18n)).

**1. A source catalog.** One object with every message in your source language, keyed by the
message itself. Using the text as the key keeps code readable (`t('Save changes?')`) and means a
missing translation still shows sensible text.

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
placeholder). If your keys are ids instead of text, declare the catalog `as const` so its
messages keep their literal types; placeholders are then read from the messages.

**2. One catalog per language.**

```ts
// i18n/de.ts
import type { MessageCatalog } from '@billie-coop/hereabouts/messageformat';
import type { MessageKey } from './en';

export const de: MessageCatalog<MessageKey> = {
  'Save changes?': 'Änderungen speichern?',
  'due {date}': 'fällig am {date}',
  '{count} invoices': '{count, plural, one {# Rechnung} other {# Rechnungen}}',
};
```

`MessageCatalog<MessageKey>` only accepts keys that exist in the source catalog. Catalog ids are
languages or locales: `'de'`, `'pt'`, `'pt-PT'`, `'zh-Hant'`.

**3. One translator.**

```ts
// i18n/index.ts
import { createTranslator, translate } from '@billie-coop/hereabouts/messageformat';

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
currencies with the locale functions and pass the formatted strings as arguments.

**4. A test.**

```ts
// i18n.test.ts
import { checkCatalogs } from '@billie-coop/hereabouts/messageformat';
import { translator } from '.';

test('catalogs match the source', () => {
  expect(checkCatalogs(translator)).toEqual([]);
});
```

`checkCatalogs` reports, per catalog and key: `missing` and `extra` keys, `placeholders` that
differ from the source message, `unbalanced` braces, and plurals or selects with `no-other`
case. Pass `{ complete: false }` while translations are still in progress to skip missing keys.

Related helpers: `messageArgNames(pattern)` lists a message's placeholders,
`isMessageKey(translator, s)` tells whether a runtime string is a key (for messages that arrive
as data, such as validation errors), and `resolveMessage(translator, locale, key)` returns the
message and the catalog it came from.

## ICU messages

For messages that aren't part of a translated catalog, a message formatter parses and caches
ICU messages. With locale data, `messageFormatter(locale)` returns one that uses the locale's
plural rules and number formatting. Standalone, from `/messageformat` with plural rules from
`/plurals`:

```typescript
import { createMessageFormatter, formatMessage } from '@billie-coop/hereabouts/messageformat';
import { getPluralRules } from '@billie-coop/hereabouts/plurals';

const formatter = createMessageFormatter({ plurals: getPluralRules('en') });
const likes =
  '{count, plural, offset:1 =0 {Be the first to like this} =1 {You liked this} ' +
  'one {You and someone else liked this} other {You and # others liked this}}';

formatMessage(formatter, likes, [], { count: 3 }); // 'You and 2 others liked this'
formatMessage(formatter, '{0, select, male {his} female {her} other {their}} {item}', ['female'], { item: 'parka' });
// 'her parka'
formatMessage(formatter, '{place, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}', [], { place: 3 });
// '3rd'
```

Messages can also be parsed ahead of time (`parseMessagePattern`) and evaluated later
(`evaluateMessage`), and custom formatters (`{word foo upper}`) plugged in through
`formatters`. `createMessageFormatter` defaults to cldr-engine 1.x's apostrophe handling;
pass `apostropheMode: 'double-optional'` for ICU's (the translator uses it).

## Plurals

Cardinal, ordinal and range plural rules for every CLDR language, evaluated on exact decimals.

```typescript
import { getPluralRules, pluralCardinal, pluralOrdinal } from '@billie-coop/hereabouts/plurals';

pluralCardinal(getPluralRules('en'), '1.0'); // 'other'
pluralCardinal(getPluralRules('fr'), '1.0'); // 'one'
pluralCardinal(getPluralRules('pl'), 5);     // 'many'
pluralOrdinal(getPluralRules('en'), 23);     // 'few'
```

## Language tags, locales and flags

```typescript
import { languageTag, parseLanguageTag, tagCompact, tagExpanded } from '@billie-coop/hereabouts/language-tag';
import { flagRegion, localeFlag, regionFlag, resolveLanguageTag } from '@billie-coop/hereabouts/locale';

tagCompact(parseLanguageTag('en_us'));                    // 'en-US'
tagExpanded(languageTag(undefined, 'latn', 'us', 'PoSiX', { u: ['ca-gregory'] }));
// 'und-Latn-US-posix-u-ca-gregory'

// Likely subtags and aliases
tagExpanded(resolveLanguageTag('und-Hant')); // 'zh-Hant-TW'
tagExpanded(resolveLanguageTag('iw'));       // 'he-Hebr-IL'
```

Emoji flags need no emoji data: a flag is two regional indicator characters, and the 259
regions that have one are a short list in the code.

```typescript
regionFlag('SC');                // '🇸🇨'
regionFlag('419');               // undefined: Latin America has no flag
localeFlag('ja');                // '🇯🇵', from the likely region
localeFlag('en-UK');             // '🇬🇧', old codes are replaced
localeFlag('en-GB-u-sd-gbsct');  // '🏴󠁧󠁢󠁳󠁣󠁴󠁿', Scotland, from the subdivision extension
flagRegion('🇫🇷');               // 'FR'
```

## Locale matching

Picks the supported locale closest to what the user asked for, using CLDR's language distance
data, so `en-AU` gets `en-GB` and `es-MX` gets `es-419`.

```typescript
import { createLocaleMatcher, matchLocale } from '@billie-coop/hereabouts/locale-matcher';

const matcher = createLocaleMatcher('en, en_GB, zh, pt_AR, es-419');
matchLocale(matcher, 'en-AU'); // distance 3, locale en_GB
matchLocale(matcher, 'es-MX'); // distance 4, locale es-419
```

## Unit conversion

Exact conversion between CLDR units, with factors kept as rationals.

```typescript
import { decimalToString } from '@billie-coop/hereabouts/decimal';
import { convertUnits, createUnitConverter, LENGTH, unitFactors } from '@billie-coop/hereabouts/unit-converter';

const converter = createUnitConverter({ length: unitFactors(LENGTH) });
decimalToString(convertUnits(converter, 'length', '1.5', 'mile', 'yard')!); // '2640'
```

The converter is a plain immutable record: `unitConverterAdd` returns a new one. A
`MathContext` passed to `convertUnits` also rounds the combined conversion factor, so results
can differ in the last digit (3 feet at precision 7 is 0.9999999 yards).

## The convenience object

cldr-engine 1.x's object API is still available, built from the functions. It includes
everything, so it doesn't tree-shake:

```typescript
import { cldrFramework } from '@billie-coop/hereabouts';

const cldr = cldrFramework({ loader: readPack }).get('en-US');
cldr.Numbers.formatDecimal('1234.567'); // '1,234.567'
cldr.Calendars.formatDate({ date: Date.now(), zoneId: 'America/New_York' }, { date: 'long' });
```

## What's in it

- Number, currency, percent, compact and unit formatting, as strings or parts.
- Arbitrary precision decimal and rational math.
- `Day`, `TimeOfDay` and instants with explicit IANA time zones, and date, interval and relative
  time formatting. Gregorian, ISO-8601, Japanese, Persian and Buddhist calendars.
- The IANA time zone database, with aliases and deprecated ids resolved.
- Cardinal, ordinal and range plural rules.
- ICU message formatting, and a translator for an app's own text.
- Display names for languages, scripts, regions, currencies, units and calendar fields; list
  formatting; measurement system and text direction.
- Language tag parsing, likely-subtag resolution and distance-based locale matching.
- Emoji flags for regions and locales.
- Unit conversion between CLDR units.

CLDR 48.2.0 and tzdb 2026f, 429 locales.

## A port of cldr-engine

hereabouts is derived from [cldr-engine](https://github.com/phensley/cldr-engine)
(`@phensley/cldr` 1.16.0), written by Patrick Hensley and licensed under Apache-2.0. Nearly
all of the hard work is his: the resource pack design that fits a language's CLDR data into one
compact file, the decimal math, the time zone encoding, the date skeleton matcher, the
message formatter, the locale matcher, and the test suite that made this port checkable. Thank
you, Patrick.

The port was started in a fork (`billie-coop/cldr-engine`) and changed enough to become its own
library. The files here are modified from cldr-engine's; the original copyright notices are kept,
and [NOTICE](https://github.com/billie-coop/hereabouts/blob/main/NOTICE) records the derivation.

### What changed

- **One package.** cldr-engine's ~15 `@phensley/*` packages are one package,
  `@billie-coop/hereabouts`, with [subpath exports](#entry-points). The root exports what
  `@phensley/cldr` exported.
- **Plain data and functions instead of classes.** Values (`Decimal`, dates, language tags,
  ...) are immutable plain objects; engines (plural rules, message formatter, locale matcher,
  unit converter) are plain records made by `create*`/`get*` functions. A locale is a plain
  `LocaleData` object passed to functions such as `formatDecimal(locale, n)`, which keep their
  1.x method names. Nothing runs on import, so bundlers drop what isn't used: numbers for one
  locale went from 111.5 KB to 41.7 KB min+gzip, decimal math alone from 5.9 KB to 2.7 KB
  ([examples/tree-shaking](https://github.com/billie-coop/hereabouts/tree/main/examples/tree-shaking)).
- **Days, times and instants** (new): `Day`, `TimeOfDay`, epoch-ms instants and explicit IANA
  zones, with Temporal-style disambiguation around clock changes, and locale formatters. Meant
  to replace date-fns.
- **App translations** (new): `createTranslator`, `translate` and `checkCatalogs`, with
  type-checked keys and placeholders, catalog fallback, and ICU's apostrophe rules.
- **Caching:** loaded locale data, bound convenience objects and default message formatters are
  cached, where 1.x rebuilt them on every call.
- **Emoji flags** (new): `regionFlag`, `localeFlag`, `subdivisionFlag`, `flagRegion`.
- **tzdb 2026f** (1.16.0 has 2025b).
- **Repo:** Yarn 4 workspaces and Biome instead of pnpm, ESLint and Prettier; a live example
  site in `apps/website` (Vite, React, Tailwind). The UMD bundle is gone.

### What didn't change

- CLDR data (48.2.0).
- The resource pack format: packs hold the same data as 1.16.0's; only their `version` and
  `checksum` fields differ.
- Formatting results: differential runs against 1.16.0 over all 429 locales (2.2 million locale
  API calls, plus the value types and engines) found no differences. The 1.x test suite runs
  with its assertions unchanged.

The full working log, with the design rules, measurements, deviations from 1.x and open
questions, is
[notes/functional-rewrite.md](https://github.com/billie-coop/hereabouts/blob/main/notes/functional-rewrite.md).
A migration guide from `@phensley/cldr` 1.x is still to be written.

## Development

Yarn 4 workspaces (`.prototools` pins Node and Yarn):

- `packages/hereabouts`: the library. Sources in `src/<entry>` (`src/core` is the root's
  locale functions; `src/types` and `src/utils` are internal), tests in `__tests__/<entry>`.
- `packages/cldr-compiler`: private build tool that downloads CLDR and writes the resource
  packs and generated code. It runs from its TypeScript sources with tsx.
- `apps/website`: the live examples.
- `zig/`: a port of the library to Zig ([zig/README.md](zig/README.md)), kept in step with the
  TypeScript by the shared cases in `conformance/` (`yarn conformance`, `yarn zig-data`).

```sh
yarn install
yarn build      # the library (dist/esm, dist/types, dist/cjs), then the resource packs
yarn test       # vitest
yarn lint       # TypeScript checks + Biome
yarn api        # API Extractor reports, one per entry (packages/hereabouts/etc)
yarn website    # live examples (apps/website)

packages/hereabouts/smoke/run.sh   # pack, install with Vite/webpack/esbuild/TypeScript, check
```

### Benchmarks

Benchmark suites use Vitest's bench mode and live in
`packages/hereabouts/__benchmarks__/<entry>/*.bench.ts`. They are not part of the test run.
Build first: some read the built output.

```sh
yarn build
yarn bench                    # all suites
yarn bench dates              # files matching "dates"

# save a baseline, change something, then compare against it
yarn bench --outputJson bench-results/before.json
yarn bench --compare bench-results/before.json
```

`bench-results/` is git-ignored. Run a comparison at least twice; differences under ~5% are
usually noise. Vitest runs the TypeScript sources through its own module loader, which adds a
cost to every cross-module call, so absolute numbers are lower than in a Node app.
`__benchmarks__/root/cjs.bench.ts` loads the built CommonJS (`dist/cjs`) with Node's own
`require`, as a server would. The older `benchmark.js` suites are `yarn bench:legacy`.

## License

Apache-2.0 ([LICENSE](https://github.com/billie-coop/hereabouts/blob/main/LICENSE)). See
[NOTICE](https://github.com/billie-coop/hereabouts/blob/main/NOTICE) for the copyright notices.

    Copyright 2018-present Patrick Hensley (cldr-engine)
    Copyright 2026 Billie Co-op (hereabouts, modifications)

## Affiliation

This project is not affiliated with [Unicode Inc.](https://unicode.org) or the
[Unicode CLDR](https://cldr.unicode.org/) project.
