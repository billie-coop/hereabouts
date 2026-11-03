# cldr-engine

Internationalization in Typescript with Unicode CLDR, batteries included.

[![build](https://github.com/phensley/cldr-engine/workflows/Build%20and%20Test/badge.svg)](https://github.com/phensley/cldr-engine/actions)
[![npm version](https://badge.fury.io/js/%40phensley%2Fcldr.svg)](https://www.npmjs.com/package/@phensley/cldr)

- [cldr-engine](#cldr-engine)
  - [Links](#links)
  - [Install](#install)
  - [Versioning](#versioning)
  - [Features](#features)
  - [Package Naming](#package-naming)
  - [Goals](#goals)
  - [License](#license)
  - [Affiliation](#affiliation)

## Links

- [Documentation](https://phensley.github.io/cldr-engine/) on the library API and usage.
- [CodeSandbox example](https://codesandbox.io/s/qqr1rl40r6) can be used to experiment, report bugs, etc.
- [Demonstration app](https://phensley.github.io/cldr-engine-react-demo/) provides an example using React and Redux. ([source code](https://github.com/phensley/cldr-engine-react-demo))

## Install

Install the [NPM package](https://www.npmjs.com/package/@phensley/cldr):

```bash
npm install --save @phensley/cldr
```

Using Yarn:

```bash
yarn add @phensley/cldr
```

## Usage (2.x, functional API)

> The `functional-rewrite` branch replaces the 1.x classes with plain data and functions, so
> bundlers can drop what you don't use. See [notes/functional-rewrite.md](notes/functional-rewrite.md).

```typescript
import { createFramework, loadLocale, formatDecimal, formatDate, decimal, decimalAdd } from '@phensley/cldr';

// Load locale data (a plain object) from a resource pack.
const framework = createFramework({ loader: (language) => fetchPack(language) });
const en = loadLocale(framework, 'en-US');

formatDecimal(en, '1234.567', { maximumFractionDigits: 2 }); // "1,234.57"
formatDate(en, { date: Date.now(), zoneId: 'America/New_York' }, { datetime: 'long' });

// Value types are immutable plain data with functions.
decimalAdd(decimal('0.1'), '0.2'); // { data: [3], sign: 1, exp: -1, flag: 0 }
```

The 1.x-style object is still available as a convenience layer (it includes everything):

```typescript
import { cldrFramework } from '@phensley/cldr';

const cldr = cldrFramework({ loader }).get('en-US');
cldr.Numbers.formatDecimal('1234.567');
```

## Versioning

This project follows [semantic versioning](https://semver.org/):

**PATCH**

- Bug fixes
- Backwards-compatible
- Resource pack compatibility maintained (packs from `1.0.0` are guaranteed to work for all `1.0.*` versions)

**MINOR**

- New features
- Backwards-compatible
- Internal schema breaking changes (applications must load resource packs from the same `major.minor` version)
- CLDR data upgrades which maintain backwards-compatibility

**MAJOR**

- Public API breaking changes
- CLDR data upgrades which change break API compatibility (unit deprecation / renaming, etc)

## Features

- Implementation folows the [CLDR specification](https://www.unicode.org/reports/tr35/tr35-general.html) supporting [CLDR version 48.0.0](https://cldr.unicode.org/index/downloads/cldr-48)
- [429 locales](https://phensley.github.io/cldr-engine/docs/en/api-cldrframework#availablelocales)
- [Compact resource packs](https://phensley.github.io/cldr-engine/docs/en/doc-design-bundles) containing [all scripts and regions for a given language](https://unpkg.com/@phensley/cldr/packs/)
- [Language tag parsing](https://phensley.github.io/cldr-engine/docs/en/api-cldrframework#parselanguagetag), [locale resolution](https://phensley.github.io/cldr-engine/docs/en/api-cldrframework#resolvelocale), and distance-based [enhanced language matching](https://phensley.github.io/cldr-engine/docs/en/api-localematcher) for improved locale fallback
- [Fast, compact, and extensible ICU message formatting](packages/messageformat/README.md)
- Both string and [parts formatting](https://phensley.github.io/cldr-engine/docs/en/api-cldr-numbers#formatdecimaltoparts) for flexible markup styling
- [Date time](https://phensley.github.io/cldr-engine/docs/en/api-cldr-calendars#formatdate), [date interval](https://phensley.github.io/cldr-engine/docs/en/api-cldr-calendars#formatdateinterval), and [relative time](https://phensley.github.io/cldr-engine/docs/en/api-cldr-calendars#formatrelativetime) formatting
- Full IANA and CLDR [timezone support](https://phensley.github.io/cldr-engine/docs/en/api-cldr-calendars#resolvetimezoneid) covering the full range of IANA timezone untils, automatic handling of deprecated timezone identifiers and aliases
- [Gregorian](https://phensley.github.io/cldr-engine/docs/en/api-gregoriandate), [ISO-8601](https://phensley.github.io/cldr-engine/docs/en/api-iso8601date), [Japanese](https://phensley.github.io/cldr-engine/docs/en/api-japanesedate), [Persian](https://phensley.github.io/cldr-engine/docs/en/api-persiandate) and [Buddhist](https://phensley.github.io/cldr-engine/docs/en/api-buddhistdate) calendars.
- Date formatting using [flexible skeleton-based pattern matching](https://phensley.github.io/cldr-engine/docs/en/api-dateskeleton)
- [Date addition](https://phensley.github.io/cldr-engine/docs/en/api-calendardate#add), [date subtraction](https://phensley.github.io/cldr-engine/docs/en/api-calendardate#subtract), [date differencing](https://phensley.github.io/cldr-engine/docs/en/api-calendardate#difference) and ["field of visual difference"](https://phensley.github.io/cldr-engine/docs/en/api-calendardate#fieldofvisualdifference) calculation
- [Cardinal and ordinal pluralization](https://phensley.github.io/cldr-engine/docs/en/api-cldr-numbers#getpluralcardinal) rules
- [Decimal numbers](https://phensley.github.io/cldr-engine/docs/en/api-cldr-numbers#formatdecimal), [currencies](https://phensley.github.io/cldr-engine/docs/en/api-cldr-numbers#formatcurrency), [units](https://phensley.github.io/cldr-engine/docs/en/api-cldr-units#formatquantity), and [unit sequence](https://phensley.github.io/cldr-engine/docs/en/api-cldr-units#formatquantitysequence) formatting, with [184 different units](https://phensley.github.io/cldr-engine/docs/en/api-unittype)
- [Arbitrary precision decimal math](https://phensley.github.io/cldr-engine/docs/en/doc-math)
- Display names for [languages](https://phensley.github.io/cldr-engine/docs/en/api-cldr-general#getlanguagedisplayname), [scripts](https://phensley.github.io/cldr-engine/docs/en/api-cldr-general#getscriptdisplayname), [regions](https://phensley.github.io/cldr-engine/docs/en/api-cldr-general#getregiondisplayname), [currencies](https://phensley.github.io/cldr-engine/docs/en/api-cldr-numbers#getcurrencydisplayname), [units](https://phensley.github.io/cldr-engine/docs/en/api-cldr-units#getunitdisplayname), [calendar fields](https://phensley.github.io/cldr-engine/docs/en/api-cldr-calendars#months), etc
- [List formatting](https://phensley.github.io/cldr-engine/docs/en/api-cldr-general#formatlist), [measurement system](https://phensley.github.io/cldr-engine/docs/en/api-cldr-general#measurementsystem), [character order](https://phensley.github.io/cldr-engine/docs/en/api-cldr-general#characterorder), and [line order](https://phensley.github.io/cldr-engine/docs/en/api-cldr-general#lineorder) information
- Optional [Unit conversion package](packages/unit-converter) to convert quantities between CLDR units

## Package Naming

Packages with the `cldr-*` prefix represent pieces of the larger library and are designed to work together. The [`@phensley/cldr`](https://www.npmjs.com/package/@phensley/cldr) package pulls in the full functionality of the library.

Packages without the `cldr-*` prefix can be used in an application individually without pulling in the larger core library.

You can use any of the packages independent of the rest of the library:

| package                                                                              | size                                                                                                                                       | dependencies                                                  |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| [`@phensley/cldr-utils`](https://www.npmjs.com/package/@phensley/cldr-utils)         | [![min+gzip](https://badgen.net/bundlephobia/minzip/@phensley/cldr-utils)](https://bundlephobia.com/result?p=@phensley/cldr-utils)         |                                                               |
| [`@phensley/decimal`](https://www.npmjs.com/package/@phensley/decimal)               | [![min+gzip](https://badgen.net/bundlephobia/minzip/@phensley/decimal)](https://bundlephobia.com/result?p=@phensley/decimal)               |                                                               |
| [`@phensley/language-tag`](https://www.npmjs.com/package/@phensley/language-tag)     | [![min+gzip](https://badgen.net/bundlephobia/minzip/@phensley/language-tag)](https://bundlephobia.com/result?p=@phensley/language-tag)     |                                                               |
| [`@phensley/locale`](https://www.npmjs.com/package/@phensley/locale)                 | [![min+gzip](https://badgen.net/bundlephobia/minzip/@phensley/locale)](https://bundlephobia.com/result?p=@phensley/locale)                 | size includes `language-tag` package                          |
| [`@phensley/locale-matcher`](https://www.npmjs.com/package/@phensley/locale-matcher) | [![min+gzip](https://badgen.net/bundlephobia/minzip/@phensley/locale-matcher)](https://bundlephobia.com/result?p=@phensley/locale-matcher) | size includes `locale` and `language-tag` packages            |
| [`@phensley/messageformat`](https://www.npmjs.com/package/@phensley/messageformat)   | [![min+gzip](https://badgen.net/bundlephobia/minzip/@phensley/messageformat)](https://bundlephobia.com/result?p=@phensley/messageformat)   | size includes `cldr-utils`, `decimal`, and `plurals` packages |
| [`@phensley/plurals`](https://www.npmjs.com/package/@phensley/plurals)               | [![min+gzip](https://badgen.net/bundlephobia/minzip/@phensley/plurals)](https://bundlephobia.com/result?p=@phensley/plurals)               | size includes `decimal` package                               |
| [`@phensley/timezone`](https://www.npmjs.com/package/@phensley/timezone)             | [![min+gzip](https://badgen.net/bundlephobia/minzip/@phensley/timezone)](https://bundlephobia.com/result?p=@phensley/timezone)             | size includes `cldr-utils` package                            |
| [`@phensley/unit-converter`](https://www.npmjs.com/package/@phensley/unit-converter) | [![min+gzip](https://badgen.net/bundlephobia/minzip/@phensley/unit-converter)](https://bundlephobia.com/result?p=@phensley/unit-converter) | size includes `cldr-utils` and `decimal` packages             |

## Goals

- Support a broad set of CLDR features in the browser "out of the box".
- Support all scripts and regions for a language in a single compact resource pack.
- Resolve the CLDR data size and dimensionality problems.
  - In the case of English: ~49MB of JSON for 106 locales is compressed to a 227KB resource pack (42KB gzip), a factor of approx. 220:1 uncompressed, 1200:1 with gzip compression.
- No additional library dependencies required.
- No custom extraction of CLDR data or precompilation of formatters required.
- Correctness and consistency across browsers, Node.js, and other Javascript ES5 runtime environments.
- Provide type-safety, reducing programming errors.
- No familiarity with CLDR structure is required for developers to use this library.
- High performance.
- Arbitrary precision decimal math, to achieve the same accuracy in the browser as on the server.

## Development

Yarn 4 workspaces: the library in `packages/*`, apps in `apps/*` (`.prototools` pins Node and Yarn).

```sh
yarn install
yarn build      # every package, then the locale packs
yarn test       # vitest
yarn lint       # TypeScript checks + Biome
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
published builds don't show. `packages/cldr/__benchmarks__/cjs.bench.ts` loads the built
CommonJS `lib/` with Node's own `require`, as a server would, to cover that. The older
`benchmark.js` suites are still available as `yarn bench:legacy`.

## License

    Copyright 2018-present Patrick Hensley

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

## Affiliation

This project is not affiliated with the [Unicode Inc.](https://unicode.org) or the [Unicode CLDR](http://cldr.unicode.org/) project.
