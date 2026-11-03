# hereabouts

Internationalization for JavaScript and TypeScript, built on Unicode CLDR data: numbers, exact
decimal math, currencies, dates and time zones, units, plurals, messages, app translations and
locale matching, for 429 locales.

Everything is plain data and plain functions. Locale data is a plain object you pass to the
functions you import, and bundlers drop the rest: formatting numbers for one locale is about
42 KB min+gzip, decimal math alone about 3 KB.

hereabouts is a port of [cldr-engine](https://github.com/phensley/cldr-engine) by Patrick
Hensley. See [A port of cldr-engine](#a-port-of-cldr-engine).

**Status:** not published yet. The packages in this repo still have their cldr-engine names
(`@phensley/cldr`, `@phensley/decimal`, ...), so the examples import from those. They will be
consolidated into one package, `@billie-coop/hereabouts`, with subpath exports
(`@billie-coop/hereabouts/decimal`, ...); see [notes/publishing.md](notes/publishing.md) and
[notes/single-package-plan.md](notes/single-package-plan.md).

Live examples: [billie-coop.github.io/hereabouts](https://billie-coop.github.io/hereabouts/)
(source in [apps/website](apps/website)).

## Example

```typescript
import {
  createFramework, loadLocale, formatDecimal, formatCurrency,
  dayFromString, dayAdd, formatDay, formatInstant,
  decimal, decimalAdd, decimalToString, localeFlag,
} from '@phensley/cldr';

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

App translations, with keys and placeholders checked by TypeScript:

```typescript
import { createTranslator, translate } from '@phensley/messageformat';

const en = { '{count} invoices': '{count, plural, one {# invoice} other {# invoices}}' };
const de = { '{count} invoices': '{count, plural, one {# Rechnung} other {# Rechnungen}}' };
const translator = createTranslator({ source: en, catalogs: { de } });

translate(translator, 'de-AT', '{count} invoices', { count: 3 }); // '3 Rechnungen'
```

The cldr-engine 1.x object is still available as a convenience layer. It includes everything,
so it doesn't tree-shake:

```typescript
import { cldrFramework } from '@phensley/cldr';

const cldr = cldrFramework({ loader }).get('en-US');
cldr.Numbers.formatDecimal('1234.567');
```

More in the package READMEs: [datetime](packages/datetime/README.md),
[messageformat](packages/messageformat/README.md) ("Translating an app"),
[locale](packages/locale/README.md) (flags), [decimal](packages/decimal/README.md),
[timezone](packages/timezone/README.md), [plurals](packages/plurals/README.md),
[locale-matcher](packages/locale-matcher/README.md),
[unit-converter](packages/unit-converter/README.md), and
[examples/date-fns-migration](examples/date-fns-migration) for moving off date-fns.

## What's in it

- Number, currency, percent, compact and unit formatting, as strings or parts.
- Arbitrary precision decimal and rational math (`decimal`, `decimalAdd`, `decimalDivide`, ...).
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

CLDR 48.2.0, 429 locales. Each language's data is one resource pack that covers all its scripts
and regions (English: 260 KB, 47 KB gzipped). Packs are built by `yarn build` into
`packages/hereabouts/packs` and loaded at runtime; a pack must come from the same `major.minor`
version as the library.

## Packages

| package | contents |
|---|---|
| `@phensley/cldr` | cldr-core, datetime, decimal, messageformat, plurals, language-tag, locale and locale-matcher re-exported; the convenience layer; the locale packs |
| `@phensley/cldr-core` | locale data and the locale functions (formatting, display names, calendars) |
| `@phensley/datetime` | `Day`, `TimeOfDay`, instants, zones |
| `@phensley/decimal` | arbitrary precision decimals and rationals |
| `@phensley/messageformat` | ICU message formatting and the translator |
| `@phensley/plurals` | plural rules |
| `@phensley/timezone` | the IANA time zone database |
| `@phensley/language-tag` | BCP 47 language tag parsing |
| `@phensley/locale` | locale resolution and emoji flags |
| `@phensley/locale-matcher` | locale matching |
| `@phensley/unit-converter` | unit conversion |
| `@phensley/cldr-ext-rbnf` | rule-based number formatting (spelled-out numbers) |
| `@phensley/cldr-types`, `@phensley/cldr-utils` | shared types and helpers |
| `@phensley/cldr-compiler` | build-time CLI that turns CLDR JSON into resource packs |

## A port of cldr-engine

hereabouts is derived from [cldr-engine](https://github.com/phensley/cldr-engine)
(`@phensley/cldr` 1.16.0), written by Patrick Hensley and licensed under Apache-2.0. Nearly
all of the hard work is his: the resource pack design that fits a language's CLDR data into one
compact file, the decimal math, the time zone encoding, the date skeleton matcher, the
message formatter, the locale matcher, and the test suite that made this port checkable. Thank
you, Patrick.

The port was started in a fork (`billie-coop/cldr-engine`) and changed enough to become its own
library. The files here are modified from cldr-engine's; the original copyright notices are kept,
and [NOTICE](NOTICE) records the derivation.

### What changed

- **Plain data and functions instead of classes.** Values (`Decimal`, dates, language tags,
  ...) are immutable plain objects; engines (plural rules, message formatter, locale matcher,
  unit converter) are plain records made by `create*`/`get*` functions. A locale is a plain
  `LocaleData` object passed to functions such as `formatDecimal(locale, n)`, which keep their
  1.x method names. Every package is `sideEffects: false`, so bundlers drop what isn't used:
  numbers for one locale went from 111.5 KB to 41.8 KB min+gzip, decimal math alone from 5.9 KB
  to 2.7 KB ([examples/tree-shaking](examples/tree-shaking)).
- **`@phensley/datetime`** (new): `Day`, `TimeOfDay`, epoch-ms instants and explicit IANA zones,
  with Temporal-style disambiguation around clock changes, and locale formatters (`formatDay`,
  `formatInstant`, ...). Meant to replace date-fns
  ([examples/date-fns-migration](examples/date-fns-migration)).
- **App translations** (new): `createTranslator`, `translate` and `checkCatalogs` in
  `@phensley/messageformat`, with type-checked keys and placeholders, catalog fallback, and ICU's
  apostrophe rules.
- **Caching:** loaded locale data, bound convenience objects and default message formatters are
  cached, where 1.x rebuilt them on every call.
- **Emoji flags** (new): `regionFlag`, `localeFlag`, `subdivisionFlag`, `flagRegion` in
  `@phensley/locale`.
- **Repo:** Yarn 4 workspaces (`packages/*`, `apps/*`) and Biome instead of pnpm, ESLint and
  Prettier; CommonJS entry points are rollup bundles; a live example site in `apps/website`
  (Vite, React, Tailwind).

### What didn't change

- CLDR data (48.2.0). The tz database is newer: 2026f, from the fork's update (1.16.0 has
  2025b).
- The resource pack format: packs built here are byte-identical to 1.16.0's.
- Formatting results: differential runs against 1.16.0 over all 429 locales (2.2 million locale
  API calls, plus the value types and engines) found no differences. The 1.x test suite runs
  with its assertions unchanged.

The full working log, with the design rules, measurements, deviations from 1.x and open
questions, is [notes/functional-rewrite.md](notes/functional-rewrite.md). A migration guide
from `@phensley/cldr` 1.x is still to be written.

## Development

Yarn 4 workspaces: the library in `packages/*`, apps in `apps/*` (`.prototools` pins Node and Yarn).

```sh
yarn install
yarn build      # every package, then the locale packs
yarn test       # vitest
yarn lint       # TypeScript checks + Biome
yarn api        # API Extractor reports (packages/*/etc)
yarn website    # live examples (apps/website)
```

## Benchmarks

Benchmark suites use Vitest's bench mode and live in `packages/*/__benchmarks__/*.bench.ts`
(decimal, plurals, messageformat, cldr-core numbers/units/dates/date formatting, and a CommonJS
suite in `packages/cldr`). They are not part of the test run. Build first: the suites import
other packages through their built output.

```sh
yarn build
yarn bench                                   # all suites
yarn bench --project @phensley/cldr-core     # one package
yarn bench dates                             # files matching "dates"

# save a baseline, change something, then compare against it
yarn bench --outputJson bench-results/before.json
yarn bench --compare bench-results/before.json
```

`bench-results/` is git-ignored. Run a comparison at least twice; differences under ~5% are
usually noise.

Vitest runs the TypeScript sources through its own module loader, which adds a cost to every
cross-module call, so absolute numbers are lower than in a Node app and costs specific to the
published builds don't show. `packages/hereabouts/__benchmarks__/cjs.bench.ts` loads the built
CommonJS `lib/` with Node's own `require`, as a server would, to cover that. The older
`benchmark.js` suites are still available as `yarn bench:legacy`.

## License

Apache-2.0 ([LICENSE](LICENSE)). See [NOTICE](NOTICE) for the copyright notices.

    Copyright 2018-present Patrick Hensley (cldr-engine)
    Copyright 2026 Billie Co-op (hereabouts, modifications)

## Affiliation

This project is not affiliated with [Unicode Inc.](https://unicode.org) or the
[Unicode CLDR](https://cldr.unicode.org/) project.
