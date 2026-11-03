# Functional rewrite (2.x) — working log

> Written in `billie-coop/cldr-engine-2` (branch `functional-rewrite`, up to `efd22363`) before
> the code moved to this repo as hereabouts. Kept as history: names like "2.x" and `pnpm`
> commands refer to that time.

Branch: `functional-rewrite`. Started 2026-11-01 from `main` @ `3f51c5a4` (v1.16.0).

## Summary

The whole library is ported to plain data + exported functions. No classes remain in runtime code
(the `cldr-compiler` build tool still uses some; it is not shipped to browsers).

**New since the port:** `@phensley/datetime`, days / times of day / instants as plain data with
explicit time zones, plus locale-aware formatters, meant to replace date-fns. See "Dates and
times" below.

- **Tests:** 183 files / **1338 tests, all passing** — the 1.x baseline was 170 / 1309. All 1309
  1.x tests run against the new code with their assertions unchanged (three read 1.x private fields
  and now read the public equivalent, see Deviations); 29 tests are new (23 of them regression tests
  for the review fixes, see "Fixed after the independent review").
- **Lint / types:** `pnpm lint` (tsc for every package incl. tests, benchmarks, stress scripts +
  eslint) is clean. `pnpm build` is clean. API Extractor reports are regenerated.
- **Resource packs:** unchanged format; the packs the compiler builds are byte-identical to 1.x
  (same sha256 for all 204 files). CLDR 48 / tzdb 2025b data untouched; `autogen.zonedata.ts`
  and its `RawData` format are unchanged so the tzdb 2026f update merges cleanly.
- **Tree-shaking** (rollup + terser, `examples/tree-shaking/`), same usage as 1.x, same output:

  | usage | 2.x min+gzip | 1.x min+gzip |
  |---|---|---|
  | load a locale, formatDecimal + formatCurrency | **41.8 KB** (106.9 KB min) | 111.5 KB (363.9 KB min) |
  | load a locale, formatDate | **86.4 KB** (270.8 KB min) | 111.5 KB (364.0 KB min) |
  | Decimal arithmetic only | **2.7 KB** (6.1 KB min) | 5.9 KB (17.4 KB min) |
  | convenience object (everything) | 102.4 KB (316.1 KB min) | — |

  A bundle that uses one trivial export comes out at 30 bytes, so no module has import-time side
  effects. Full UMD bundle of everything: 359 KB vs 384 KB.
- **Differential checks against the 1.x build** (beyond the test suite): decimal and number
  rendering via the suite; timezone ~714k lookups, language-tag/locale/matcher ~325k comparisons,
  plurals/messageformat ~507k cases, unit-converter + rbnf ~830k output lines, calendar dates 620k
  output lines — all identical. Whole locale API: **2.2 million calls across all 429 locales (+40
  extra ids), zero differences** — see "Differential check (locale API)".
- **Performance** (en, node 24, ops/s; see "Performance" below): in an app-style ES-module
  bundle 2.x is at parity or faster — formatDecimal / formatCurrency equal, formatDate from
  `{ date, zoneId }` ~10% faster, formatDate of a prebuilt date within noise. The CommonJS
  entry points are rollup bundles (no re-export getters), which puts the CommonJS build at or
  above the ES-module bundle (see "CommonJS entry points bundled with rollup").

What's left / rough edges are listed at the end, with the things I wasn't sure about.

## Baseline (1.x on `main`, before any change)

| | |
|---|---|
| `pnpm install` | ok (10s) |
| `pnpm build` | ok (27s) — UMD bundle `dist/cldrengine.umd.js` 384.9 KB min, 116.0 KB gzip, 90.5 KB brotli |
| `vitest --run` | **170 files, 1309 tests, all passing** (10.3s wall) |
| `pnpm lint` (tsc + eslint) | clean (16s) |

Tests per package (files / tests): cldr-core 106/508, plurals 6/349, locale-matcher 3/183,
decimal 15/119, messageformat 6/40, unit-converter 7/27, cldr-compiler 7/21, timezone 5/16,
language-tag 3/13, locale 3/11, cldr 3/11, cldr-utils 5/9, cldr-ext-rbnf 1/2.

A frozen 1.x reference build (detached worktree of `3f51c5a4`) is kept outside the repo for
differential checks and the bundle-size comparison.

## Design conventions

These rules apply to every package. They are what the code review should hold the port to.

### 1. Plain data in, plain data out

- No classes in runtime code. State lives in plain, readonly objects; behaviour lives in exported
  functions that take that data as their first argument.
- Value types (`Decimal`, `Rational`, calendar dates, `LanguageTag`, …) are immutable plain
  objects. Functions never mutate their inputs; they return new values.
- "Engine" objects that 1.x built with `new` (plural rules, locale matcher, message formatter,
  unit converter, time zone database) become plain records created by a `create*`/`get*`
  function, plus functions that take the record.
- Interfaces describe data; there are no methods on data types (no `toString()` either — use the
  explicit `*ToString` function).

### 2. Naming

The aggregate package re-exports everything flat, so names must be unique across the library and
easy to find with autocomplete:

- **Value-type operations are prefixed with the type's short name**:
  `decimalAdd(a, b)`, `decimalCompare(a, b)`, `decimalToString(d)`, `rationalMultiply(a, b)`,
  `dateAdd(d, period)`, `dateYear(d)`, `tagRegion(t)`, `tagCompact(t)`.
  The constructor is the bare short name: `decimal('1.5')`, `rational(1, 3)`, `languageTag(...)`.
- 1.x static methods become plain functions named for what they do
  (`LanguageResolver.resolve` → `resolveLanguageTag`, `GregorianDate.fromUnixEpoch` →
  `gregorianFromUnixEpoch`).
- **Locale functions keep their 1.x method names** and take the locale data first:
  `formatDecimal(locale, n, opts)`, `formatDate(locale, date, opts)`,
  `getCurrencySymbol(locale, code)`. That keeps the docs and the convenience layer 1:1.

### 3. Locale data

- A locale is a plain `LocaleData` object `{ locale, bundle, schema }`: the resolved locale id/tag,
  the plain string tables for that locale (from a resource pack), and the schema accessor for the
  active schema config. Every locale function takes it first.
- Anything derived from locale data (number params, context transforms, parsed patterns) is cached
  in a module-level `WeakMap` keyed by the data object, invisible to callers. Caches keyed by
  pattern strings are module-level and bounded.
- The resource pack format, the loader contract and the schema layout are unchanged.

### 4. One swappable input per kind of data

- Locale data: resource packs, through a loader (unchanged contract).
- Time zone data: the `@phensley/timezone` package holds the active tz data. It defaults to the
  bundled `autogen.zonedata.ts` (same file and `RawData` format as 1.x, so the tzdb 2026f update in
  the other clone merges cleanly) and can be replaced with `setTimeZoneData(raw)`.

### 5. Tree-shaking hygiene

- Every package sets `"sideEffects": false`.
- No top-level code with side effects. Top-level calls that build tables are wrapped so bundlers
  can drop them (`/*#__PURE__*/` annotation, or built lazily on first use).
- Nothing is registered by import side effect; if you call a function you imported it, so a
  missing import is a compile error.

### 6. Calendars

- A calendar system (gregorian, iso8601, buddhist, japanese, persian) is a plain record of rules
  (`CalendarSystem`: month/day/year arithmetic, julian-day conversion, era rules). Dates are plain
  data that carry a reference to their calendar record; the shared date functions
  (`dateAdd`, `dateYear`, …) use the record. No class hierarchy.

### 7. Optional convenience layer

- `@phensley/cldr` keeps a "batteries included" object (`framework.get('en').Numbers.formatDecimal`)
  built by binding the functions to a `LocaleData`. It imports everything; the functions underneath
  stay tree-shakable on their own.

### 8. Tests

- The 1.x tests are the specification. They are ported to the function API mechanically with a
  type-aware codemod (`a.add(b)` → `decimalAdd(a, b)`, `new Decimal(x)` → `decimal(x)`,
  `` `${d}` `` → `` `${decimalToString(d)}` ``), so assertions are untouched.
- No assertion is deleted or loosened. Where 1.x behaviour is a bug, the 1.x behaviour is kept and
  the bug is listed below.

## How the port is done

Each value type / package goes through the same steps, keeping the full suite green between
commits:

1. Write the functional implementation (a faithful port of the class, method by method).
2. While the old class still exists, run a type-aware codemod (ts-morph) over the whole repo:
   it finds calls whose receiver/declaration is the old class and rewrites them
   (`n.setScale(2).stripTrailingZeros()` → `decimalStripTrailingZeros(decimalSetScale(n, 2))`),
   handles statics, `new`, `instanceof` and implicit string conversion, and adds imports.
   Ambiguous receivers (e.g. `string | Decimal`) are reported and fixed by hand.
3. Swap in the new implementation, build, run the full suite, lint, commit.

Independent packages were ported in parallel by helper agents in separate worktrees, each with a
differential check against the 1.x code on top of the existing tests; their call-site mappings
were then applied to the rest of the repo in this branch.

## API overview (2.x)

- **Locale data:** `createFramework({ loader, config? })` → `loadLocale(framework, 'en-US')`
  (or `loadLocaleAsync`) returns a `LocaleData`: the plain `Bundle` of the locale plus
  `{ locale, schema, indices, config }`. `@phensley/cldr` exports `createFramework` /
  `cldrFramework` that default to the config its packs were built with.
- **Locale functions** keep the 1.x method names: `formatDecimal(en, n, opts)`,
  `formatCurrency`, `formatQuantity`, `formatDate`, `formatDateInterval`,
  `formatRelativeTime(Field)`, `getLanguageDisplayName`, `formatList`, `messageFormatter`, …
  Ones that never used locale data don't take it (`resolveTimeZoneId`, `timeZoneFromUTC`,
  `timeZoneFromWall`, `timeZoneIds`, `timePeriodToQuantity`, `getCurrencyFractions`,
  `getCurrencyForRegion`, `resolveLocale`, `parseLanguageTag`, `availableLocales`, `cldrVersion`).
- **Value types:** `decimal(x)` + `decimal*`, `rational(...)` + `rational*`, `languageTag(...)` +
  `tag*`, calendar dates: `gregorianDateFromUnixEpoch(...)` (etc. per calendar) + `date*`
  (`dateAdd`, `dateYear`, `dateUntil`, `dateToISOString`, …). Calendar systems are records:
  `gregorianCalendar`, `iso8601Calendar`, `buddhistCalendar`, `japaneseCalendar`, `persianCalendar`.
- **Engines as records:** `getPluralRules` + `pluralCardinal/Ordinal/Range`,
  `createMessageFormatter` + `formatMessage`, `createLocaleMatcher` + `matchLocale`,
  `createUnitConverter` + `convertUnits`, `createRBNF` + `rbnfSetFormat`, `tz*` functions with
  `setTimeZoneData`.
- **Convenience layer:** `cldrFramework(options).get('en')` returns the 1.x-shaped object
  (`.Numbers.formatDecimal(...)`, `.Calendars.formatDate(...)`, `.General`, `.Units`, `.Schema`,
  plus `.data`, the bound `LocaleData`). Built by `bindCLDR` / `bindNumbers` / … from the functions.

## Design decisions made along the way

- **`LocaleData` extends `Bundle`.** Every 1.x internal took `bundle` plus a hidden `this.internals`
  (schema, config). Making the locale data a bundle that also carries its schema/config let every
  internal keep its shape (`renderDecimal(data, …)` where it was `formatDecimal(bundle, …)`) and let
  the codemod rewrite the call sites mechanically. It is one flat plain object.
- **Caches.** Per-locale derived data (number params, context transforms, calendar patterns,
  exemplar cities) lives in module-level `WeakMap`s keyed by the `LocaleData`. Pattern parse caches
  (number, date, wrapper, day-period rules) are module-level bounded LRUs created on first use;
  `patternCacheSize` is accepted but no longer used (results never depended on it).
- **Mutable containers, deliberately.** Caches and accumulators are mutable records owned by the
  functions that use them: `LRU`/`Cache`/`Heap`/`Checksum` (cldr-utils), the pack's region-index
  cache, the tz database's lazily decoded zone records, `NumberContext` (per format call),
  `DateSkeleton`/`DatePatternMatcher` (1.x `split()` mutates its input; kept), and the string/parts
  value builders. Value types (Decimal, Rational, LanguageTag, CalendarDate, Bundle, LocaleData,
  schema arrows) are never mutated after creation.
- **Records of functions** are used where 1.x had small strategy objects: `stringValue()` /
  `partsValue()`, decimal formatters, number renderers, `MessageMatcher`, `MessageArgConverter`.
  They are closures, not classes, and are created per use.
- **No classes kept.** Nothing turned out to be worse without one.
- **Time zone data** is the one swappable input in `@phensley/timezone` (`setTimeZoneData`), decoded
  lazily; locale data comes in only through packs + loader.
- **`@phensley/cldr`** no longer sets a global default config on import (that side effect is exactly
  what prevents tree-shaking and would be dropped under `sideEffects: false`). It exports
  `createFramework` / `cldrFramework` wrappers that default to its config instead.
- **Internals are not exported from package indexes beyond what 1.x exported**; tests of internal
  modules import them by module path.

## Progress

| Package | Status | Tests (files/tests), baseline → now |
|---|---|---|
| decimal | done | 15/119 → 15/119 |
| timezone | done | 5/16 → 6/18 (+2 for `setTimeZoneData`) |
| language-tag | done | 3/13 → 3/13 |
| locale | done | 3/11 → 3/11 |
| locale-matcher | done | 3/183 → 3/183 |
| plurals | done | 6/349 → 6/349 |
| messageformat | done | 6/40 → 6/40 |
| unit-converter | done | 7/27 → 7/28 (+1 immutability) |
| cldr-ext-rbnf | done | 1/2 → 2/5 (+3 with values recorded from 1.x) |
| cldr-utils | done | 5/9 → 5/9 |
| cldr-types | done (types for the plain arrows/bundle) | — |
| cldr-core | done | 106/508 → 106/508 |
| cldr (aggregate + convenience) | done | 3/11 → 3/11 |
| cldr-compiler | adapted to the new core API (still class-based internally) | 7/21 → 7/21 |

## Performance

Measured after a follow-up fix: the calendar internals imported the `date*` accessors through the
`systems/calendars` index barrel, and in the CommonJS build every re-exported name is read through
a getter, so every field read while formatting paid an extra call (1.x called methods on the date
directly). Internal imports now point at the defining modules (`ts-morph` script; 37 imports).

ES-module bundle (esbuild, as an app would ship it), ops/s, two runs each:

| call | 1.x | 2.x |
|---|---|---|
| formatDecimal | 1.77–1.82M | 1.79–1.83M |
| formatCurrency | 1.03–1.06M | 1.06–1.07M |
| formatDate prebuilt date, datetime long | 1.36–1.37M | 1.29–1.32M |
| formatDate prebuilt date, date short | 3.71–3.89M | 3.80–3.87M |
| formatDate `{ date, zoneId }`, datetime long | 0.85M | 0.92–0.96M |

Date creation is ~60% faster than 1.x (no per-instance class setup); plain accessors are equal;
week accessors are ~3× slower (recomputed per call, see open items).

### Benchmarks in the repo (Vitest bench)

`pnpm bench` runs Vitest bench suites in `packages/*/__benchmarks__/*.bench.ts`: decimal
(parse, arithmetic, toString/toParts), plurals (en/fr/ru/ar cardinal, ordinal), messageformat
(parse, evaluate, formatMessage), cldr-core numbers (formatDecimal styles, formatCurrency incl.
compact/accounting/name), units (formatQuantity, sequences), dates (creation, accessors incl.
week fields, dateAdd/dateUntil/dateDifference), date formatting (prebuilt dates and
`{ date, zoneId }`, widths, skeletons, intervals, relative time), plus `packages/cldr`'s
`cjs.bench.ts`, which loads the built CommonJS `lib/` with Node's `require`. Save/compare with
`--outputJson` / `--compare` (README "Benchmarks"). The suites stay out of the test run
(`benchmark.include` in `vitest.shared.ts`) and are linted. The old benchmark.js suites are
`pnpm bench:legacy`.

Under Vitest the sources run through Vite's SSR transform, which turns every export into a getter
and every import into a property read on a module object, and tinybench times each iteration, so
absolute numbers are well below plain Node (formatDecimal ~1.1M ops/s vs ~2.0M in the CJS
suite; a week-field read ~6.5M vs ~28M). Use them for before/after comparisons of the same
suite; use the CJS suite (or the esbuild scripts) for absolute numbers.

### Experiment: week fields at creation (reverted)

Tried computing the week fields once in `newDate` (commit c1be86a5) and reverted it:
it sped up only the week accessors, which only week-number patterns use and which already took
~25–50 ns, while the paths a server formatting invoices runs got slower (date creation −21%,
`dateAdd` −21%, formatDate `{ date, zoneId }` −5%). The accessors still recompute per call.
What was measured:

`newDate` (every date is built there) computed week of month, day of week in month, week of
year + its year for the date's rule and for ISO-8601, into the `fields` slots 1.x used for its
memo; `dateWeekOfYear`, `dateYearOfWeekOfYear(ISO)`, `dateWeekOfYearISO`, `dateWeekOfMonth`,
`dateDayOfWeekInMonth` were plain reads. Same arithmetic as 1.x `computeWeekFields`; when the
rule is ISO's (Monday, 4 days: de, fr, en-GB, …) the ISO pass was skipped and copied.
Checked against 1.x: 4.28M comparisons (5 calendars, firstDay 1–7 × minDays 1/4/7, every day
±10 around 1580–2101 new years and Persian new years, 3000 random epochs, 4 zones, NaN and
extreme epochs): identical, including the NaN epoch error.

CommonJS `lib/`, node 24, ops/s, two runs (`week.js` / `parts.js` scratch scripts):

| | 1.x | 2.x before | 2.x after |
|---|---|---|---|
| week accessors (5 kinds) | 65–146M | 19–43M | 73–158M |
| create gregorian date | 2.32–2.34M | 3.36–3.44M | 2.69–2.72M (−21%) |
| create persian date | 2.24–2.33M | 3.29–3.38M | 2.54–2.56M (−23%) |
| create + weekOfYear | 1.96–1.99M | 3.12–3.17M | 2.54M |
| dateAdd {day,hour} / {month} | 0.71–0.73M | 0.89–0.92M | 0.71–0.74M (−21%) |
| dateUntil / dateDifference | 2.6M / 2.1M | 2.5–2.6M / 2.1–2.2M | 2.5M / 2.0–2.1M (noise) |
| formatDate `{date,zoneId}` long | | 0.86–0.89M | 0.84M (−5%) |
| formatDate prebuilt long/short | | 1.26–1.32M / 3.08–3.31M | 1.29–1.30M / 3.21–3.27M |

Creation is ~75 ns slower (two `weekOfYear` passes), still ~15% faster than 1.x; `dateAdd`
creates two dates (an intermediate UTC date via `dateSet`, then the result), so it pays twice
and is back at 1.x speed. Avoiding that would need a second, week-less construction path for
the intermediate date (~5–7% of `dateAdd`); not done. Vitest bench (`pnpm bench`, before →
after, 2 runs each): week accessors +115–135%, `YwE` skeleton +22%, creation −20 to −32%,
dateAdd −23%, dateUntil/dateDifference/number/unit formatting unchanged. Vitest overstates the
creation cost: it compiles files in isolation, so the `DateField` const enum isn't inlined and
each field index is an import read. Bundle sizes unchanged (dates 86.6 KB gzip, was 86.4).

### CommonJS entry points bundled with rollup

tsc's CommonJS output reads every name re-exported through an `export *` barrel via a getter
(tslib `__createBinding`), so every call into another package (cldr-core → decimal, a user's
`require('@phensley/cldr').formatDate` → cldr → cldr-core) paid one or more extra calls; ES-module
bundles don't. Each runtime package's build now ends with `build:cjs-bundle`: rollup bundles
`lib-es/` into `lib/index.js` (+ source map), with plain `exports.x = x` assignments and
`externalLiveBindings: false`, so `export * from '@phensley/...'` copies values instead of
defining getters (no export is ever reassigned). Shared config: `rollup.cjs.config.mjs`.

- **What stays the same:** `main`/`module`/`types` entry points, `lib-es/`, the `.d.ts` files
  and per-module files in `lib/` (tsc still emits them), the UMD bundle and the packs
  (both byte-identical), tree-shaking sizes. The bundle's source map chains through the tsc maps
  to the TypeScript sources (`node --enable-source-maps` stack traces show `src/*.ts` lines).
- **Checks:** exports of all 13 bundled entry points vs the tsc ones: same names, types, values
  (functions by name/arity), the `__esModule` marker, and all 1132 cross-package identities
  (`cldr.decimalAdd === decimal.decimalAdd`). The locale-API differential harness against 1.x
  through `packages/cldr/lib`: 2,197,323 calls each for direct functions and the convenience
  layer, only the expected `xx` load-path line differs.
- **Cost in build complexity:** one config file (~60 lines, mostly comments), one script per
  package, no new dependencies (rollup and its json/node-resolve plugins were already used for the
  UMD build). Build time unchanged (~22 s; each bundle takes 30–300 ms).
- **Caveats:** a deep import (`@phensley/cldr-core/lib/internals/schema`, used by cldr-compiler
  and the stress scripts) loads tsc's per-module files, a second copy of that package's modules
  next to the bundle, so module-level state (caches, `setTimeZoneData`) isn't shared between the
  two. Deep imports aren't public API and the ones in the repo use pure functions.
  `build:watch` (tsc -w) rewrites `lib/index.js` as plain tsc output (works, just unbundled)
  until the next `pnpm build`. Rollup's AMBIGUOUS_EXTERNAL_NAMESPACES / CIRCULAR_DEPENDENCY
  warnings are silenced in the config with the reason.

Node 24, CommonJS `lib/`, ops/s, two interleaved runs (scratch scripts; load average 6–8 from
other agents, so ±5%):

| | tsc `lib/` | rollup bundle |
|---|---|---|
| 7 date accessors from user code (`c.dateYear(d)` …) | 6.4–6.6M | 18.1–18.4M (×2.8) |
| date from epoch | 3.30–3.48M | 3.71–3.81M (+11%) |
| formatDate prebuilt long / short | 1.33M / 3.25–3.31M | 1.40M / 3.69–3.70M (+5% / +13%) |
| formatDate `{date,zoneId}` long | 0.89–0.92M | 0.96–0.98M (+7%) |
| formatDate datetime / skeleton (`bench.js`) | 0.81–0.83M / 0.77–0.78M | 0.89–0.90M / 0.85–0.88M (+9% / +12%) |
| formatDecimal / short | 1.58–1.68M / 1.33–1.42M | 1.86–1.87M / 1.52–1.58M (+15% / +12%) |
| dateAdd / dateUntil | 0.92–0.94M / 2.62M | 0.96–0.98M / 2.79–2.80M (+5% / +7%) |
| formatCurrency | 0.99–1.01M | 0.97–0.98M (−2%, noise level) |

For comparison the esbuild ES-module bundle on the same machine: formatDecimal 1.68–1.71M,
formatCurrency 0.99–1.04M, formatDate prebuilt long 1.26–1.28M, `{date,zoneId}` 0.87–0.94M. The
in-repo `cjs.bench.ts` (`--compare` against the pre-change baseline) agrees: date from epoch +39%,
`{date,zoneId}` long +15%, dateAdd +19%, formatDecimal +8%, formatCurrency −4%..0%.

## Deviations from 1.x

- Test ports: `decimal/__tests__/parse.test.ts` compared against literals with the private
  1.x field name `_exp`; the plain-data field is the public `exp`, so the expected literals use
  that key. Values asserted are unchanged.
- `@phensley/cldr` re-exports `@phensley/cldr-core` wholesale instead of an explicit name list.
- timezone: the raw tz data is no longer blanked after decoding (1.x mutated its input), so it
  stays in memory next to the decoded records; that is what makes `setTimeZoneData` reversible.
  The zone-type lookup table is replaced by `parseInt(c, 36)` (same result for every character
  the encoder emits).
- language-tag: `tagExtensions`/`tagExtensionSubtags`/`tagExtlangs` return readonly arrays.
  `isLanguageTag` is a shape check, so a plain object shaped like a tag passes where 1.x
  `instanceof` would fail.
- locale-matcher: the matcher record's internal fields are `{ supported, defaultEntry, exactMap }`;
  `LocaleMatcherEntry` is newly exported because the public type refers to it.

- Test ports that read 1.x private fields: `cldr-core/__tests__/cldr.test.ts` checked the path
  `bundle._id` on the 1.x `CLDRImpl` object; it now checks `data.id` (async loader tests) and
  `bundle.id`. Values asserted are unchanged.
- `CLDRFramework` is no longer a class: `cldrFramework(options, defaultConfig?)` returns the
  loader object; `setDefaultConfig`, `CLDRFramework.resolveLocale/parseLanguageTag/
  availableLocales/version` are plain functions. The `CLDR` object has no `Internals`; it has
  `data` (the bound `LocaleData`). Its function groups are non-enumerable getters, so `toEqual`
  between two CLDR objects compares their data (as 1.x, where methods lived on the prototype).
- `General.bundle()` (convenience layer) returns the `LocaleData`, which is a `Bundle`.
- `patternCacheSize` no longer configures anything (shared fixed-size caches).
- `buildOrigin` (1.x `CodeBuilder.origin()`) still sets `config.calendars = ['gregory']` on the
  config object passed in when it is empty — mutation of the caller's config kept from 1.x.
- messageformat: `evaluateMessage` is stateless; 1.x `MessageEngine` kept its output buffer on the
  instance, so calling `evaluate` twice on one engine concatenated results (nothing in the library
  did that).
- unit-converter: `unitConverterAdd` returns a new converter (1.x `add` mutated in place).
- cldr-ext-rbnf: the algorithmic numbering systems no longer append the root rule names into the
  shared rule set's `pubnames` array (1.x mutated it, so building the systems twice duplicated
  names). Only visible through `systems.rbnfset.pubnames`. **See "Unsure" below.**
- calendars: the calendar module's own `ZoneInfo` type is `DateZoneInfo` (it clashed with the
  timezone package's `ZoneInfo` in the flat exports). `CalendarDate`/`GregorianDate`/... are
  types only; use `isCalendarDate`/`isGregorianDate`/... instead of `instanceof`
  (`isGregorianDate` is true for iso8601/buddhist/japanese, as `instanceof GregorianDate` was).
  `currentMetazone()` builds its index on first use (1.x threw if called before anything had
  initialised it).
- plurals: `getPluralRules` returns a plain record; `numberOperands` is a plain record.

### Fixed after the independent review

- **calendars + `setTimeZoneData` (P1, bug in the port).** The generated metazone index and
  stable-id map are positional, generated against the bundled tz zone list, but were resolved
  against the *active* `tzZoneIds()` once, on first calendar use. Replacing the tz data with a
  different canonical list crashed date creation (`2 != 341`, then `toLowerCase` of undefined) or,
  with a reordered list, gave zones the wrong metazone — and the cached result depended on whether
  a calendar operation ran before the replacement. They are now resolved against the list they
  were generated from (`defaultTimeZoneData`) and joined to the active data by zone id. If the
  active data makes a bundled *alias* canonical (e.g. `Asia/Calcutta` instead of `Asia/Kolkata`;
  found by the reviewer's re-check), lookups fall back through the bundled alias map, so the zone
  keeps its metazone and stable id. Zones the active data adds have no metazone (as `Etc/GMT+1`
  has none). No change with the bundled data: no bundled canonical id is also a bundled alias, so
  the fallback is never taken (1.x had no way to replace the data). Maintenance condition: the
  generated `metazoneData` must stay in sync with the bundled tz data's zone list (the existing
  `2 != 341` sanity check reports a mismatch). Tests:
  `cldr-core/__tests__/systems/calendars/tzdata.test.ts`.
- **Shared parse caches exposed (P2, API).** `parseDatePattern`, `getHourPattern`,
  `getNumberPattern` and `parseWrapper` returned the arrays/objects stored in the module-level
  pattern caches, and were importable from `@phensley/cldr(-core)` (via `export * from
  './internals'`), so a caller could edit them and change formatting for every framework.
  **API change:** cldr-core's index no longer re-exports `./internals` or `./api/private` (every
  name there was `@internal`; nothing outside cldr-core used them; 1.x only reached them through
  `cldr.Internals`, already dropped). Removed from the public entry points: `parseDatePattern`,
  `getHourPattern`, `getNumberPattern`, `parseWrapper`, `PATTERN_CACHE_SIZE`, `weekFirstDay`,
  `weekMinDays`, `getCalendarFormatter`, `renderDateTime`, `renderDateInterval`, `selectCalendar`,
  `flexDayPeriod`, `renderRelativeTimeField`, `contextTransform`, `formatListValue`,
  `formatWrapper`, `adjustNumber`, `currencySymbol`, `currencyDisplayName`, `currencyPluralName`,
  `renderDecimal`, `renderCurrency`, `renderUnit`, `getUnitInfo`, `stringRenderer`,
  `partsRenderer`, `RE_SYMBOL`, `RE_DIGIT`, `CURRENCY_SPACING_MATCHERS`, `getNumberParams`,
  `getContextTransformInfo` and the types `NumberRenderer`, `NumberParams`, `CurrencySpacing`
  (`NumberSymbols` stays exported: the public `decimalNumberingSystem` takes one).
  `getCurrencyForRegion` / `getCurrencyFractions` stay (explicit export, as in 1.x). The parsed node types are now deeply readonly (`DateTimeField = readonly [string, number]`,
  `readonly DateTimeNode[]`, `readonly WrapperNode[]`, all-readonly `NumberPattern`), so internal
  code can't mutate them either; no copying was added. Formatting output unchanged.
  Test: `cldr-core/__tests__/internals/patterncache.test.ts`.
- **Plural rules shallowly readonly (P2, types).** `PluralRules.cardinals/ordinals` were
  `readonly Rule[]`, but each `Rule` and its condition arrays were writable and point into the
  generated, module-wide rule tables (`rules.cardinals[0][0] = 5` compiled and changed `en`
  everywhere). `Rule`, `Expr`, `Range` and the condition lists are now readonly at every level.
  Type-only; reading rules is unchanged. Test: `plurals/__tests__/readonly.test.ts`.
- **Decimal aliasing through `decimalProperties` (P2, behaviour + type).** `decimal(d)` returns `d`
  itself (values are immutable), where 1.x `new Decimal(d)` copied; but `decimalProperties()`
  returned the live coefficient array (cast to `number[]`), so editing it changed every value
  sharing it. 1.x `properties()` also returned its live array, but the copy constructor kept
  original and copy apart. `decimalProperties` now returns a copy of the coefficient, typed
  `readonly number[]` (**API change**: return type `[readonly number[], number, number, number]`;
  writing into it no longer changes the decimal, which 1.x allowed for its own instance).
  `decimal(d)` still returns `d`. `numberOperands` (plurals, a hot path) reads the fields directly
  instead of going through `decimalProperties`, so no copy is added there. Values and outputs
  unchanged. Test: `decimal/__tests__/aliasing.test.ts`.
- **Writable `zoneInfo` on dates (P2, types).** `CalendarDate.zoneInfo` was a readonly property
  holding an object with writable fields (1.x kept it protected), so `d.zoneInfo.offset = …`
  compiled and changed the date's instant without recomputing its fields. Every `DateZoneInfo`
  field is now readonly; `dateWithZone` / `dateSet` are the supported ways to change the zone.
  Type-only. Test: `cldr-core/__tests__/systems/calendars/readonly.test.ts`.
- **Loose shape guards (P3, behaviour).** `isDecimal` only checked `data` and a numeric `flag`, so
  incomplete objects like `{ data: [1], flag: 2 }` passed; message formatting dispatches on it,
  so `formatMessage('<{0}>', [{ data: [1], flag: 2 }])` gave `<-Infinity>` where 1.x gave `<>`.
  The guards now check every field of the declared type, including nested records:
  `isDecimal` (array of integer base-1e7 words, sign 1/-1/0, numeric exponent, flag 0/1/2;
  `isRational` builds on it), `isCalendarDate` (numeric fields array, numeric firstDay/minDays, a
  non-null zone info with all its fields typed, and every field of the `CalendarSystem` record;
  previously `zoneInfo: null` passed), `isLanguageTag` (optional string subtags, string arrays
  for extlangs and each extension), and the schema arrow guards (`isFieldArrow`, … checked only
  `kind`; now also offset/map/len/factors and the nested `KeyIndex` records). These are type
  checks, not semantic validation (e.g. a calendar record's functions aren't called). The
  exponent is only required to be a number because the library itself produces fractional
  exponents from fractional precision/scale/digit arguments (`decimalScientific('123', 1.5)`).
  Values the library creates all pass (reviewer's sweep: ~15.6k decimals, 2k dates in five
  calendars, 1.3k tags, 331 schema arrows); the remaining deviation from 1.x `instanceof` is that
  a *complete* plain object of the right shape is accepted. The stricter `isCalendarDate` costs
  ~4 ns per `formatDate` call (≈0.5–1%). Message-format
  outputs for the review's inputs are back to 1.x's. Tests: `decimal/__tests__/guards.test.ts`,
  `language-tag/__tests__/guards.test.ts`, `messageformat/__tests__/richargs.test.ts`,
  `cldr-core/__tests__/systems/calendars/guards.test.ts`,
  `cldr-core/__tests__/schema/schema/guards.test.ts`.
- **`packages/decimal/README.md`** still taught `new Decimal(...)` / `.multiply(...)`. Rewritten for
  the function API (usage section + the same example, which prints exactly the output already in
  the README); also fixed its broken `@phensley/clde` link.
- **API-export pass (API).** Besides the internals barrel above, three 1.x protected helpers had
  become public functions through `export *` barrels: `gregorianDaysInYear` and
  `gregorianResolveFields` (1.x `GregorianDate.daysInYear` / `_set` internals; shared by the
  Gregorian-based calendar records) and `negatePeriod` (1.x `CalendarDate._negatePeriod`).
  They are no longer exported (`negatePeriod` moved to the internal `systems/calendars/math.ts`;
  the calendar barrel lists `gregorian.ts`'s public names explicitly). Method: listed every
  runtime export of each 2.x package that isn't a 1.x export name, and checked it against the
  1.x declarations; everything else is a 1.x public method/static as a function, a 1.x export,
  or part of the documented 2.x API (records, `bind*`, `localeData`, …). Names still exported
  but tagged `@internal` are all 1.x exports the compiler uses (`origin`, `scope`, `vector`,
  `checksumIndices`, …) or 1.x exported classes' public methods (`decimalNumberingSystem`,
  `numberingFormatString`, `fastFormatDecimal`). Other packages' 1.x private members became
  fields of the plain records (by design), not exported functions. Test:
  `cldr-core/__tests__/exports.test.ts`.

## 1.x bugs / oddities found (behaviour preserved unless noted)

- timezone 1.x `TzImpl` constructor mutated the `RawData` passed to it (blanked strings after
  decoding), so a second instance from the same data broke. Fixed as a side effect of making the
  data swappable (no behaviour visible through the public API changes).
- timezone README wall-clock example called `fromUTC` and destructured a pair; should be
  `fromWall`. README fixed.
- language-tag: the extlang pattern `/^[a-z]{3}$/i` also matches 3-letter region codes, so
  `en-AAA` resolves to `aaa-Latn-AA` (asserted by a test; kept).
- language-tag: parsing keeps only the first variant; resolving drops extlangs; `fr-u-ca` gives
  `{u: ['ca']}` (kept).
- language-tag: the constructor keeps the caller's `extensions` object by reference (kept).
- messageformat: the argument regexp `(0[1..9]+|\d+|…)` uses the class `[1..9]` (matches `1`, `.`,
  `9`); `[1-9]` was clearly intended. Kept.
- messageformat/plurals docs: `DefaultMessageArgConverter.asDecimal` says it returns zero but
  returns NaN; `NumberOperands` docs list an `e` operand that isn't implemented; the plurals README
  was titled "@phensley/timezone".
- calendars: Persian `set`/`fromFields` ignore `zoneId` (keep the date's zone; `fromFields` builds
  in UTC), so `add()`'s `set({zoneId:'UTC'})` is a no-op for Persian dates. Kept.
- calendars: `add`/`until` for Persian dates use Gregorian month lengths and 12-month arithmetic.
  Kept.
- calendars: ISO8601 and Japanese `fromFields` apply no defaults, so e.g. `{ year: 2024 }` without a
  month throws "Cannot read properties of undefined". Kept.
- calendars: `millisToTimePeriod` never sets `day`, so the `time.day` added in `add()` is always 0.
  `toLocalISOString` zero-pads possibly negative hour/minute offsets. Kept.
- cldr-ext-rbnf: the id loop in the algorithmic systems never stops at the first match — the last id
  wins, and an undefined last id falls back to root even when an earlier id matched. Kept.
- unit-converter: categories are stored in a plain `{}`, so `unitConverterHas(c, 'constructor')`
  is true and a category named `toString` throws; `convertUnits` rounds the combined factor to the
  MathContext before multiplying (3 ft → 0.9999999 yd at precision 7). Kept.


## Differential check (locale API)

The 1.x reference build and this branch were run side by side (separate node processes, same
seeded inputs, one JSON line per call, diffed line by line): **2,197,323 calls, zero
differences**, both through the 2.x functions directly and through the convenience layer. Errors
(20,704 calls, e.g. currency formatting of NaN) have identical messages on both sides.

- Locales: all 429 available, plus 40 extra ids (unicode extensions `-u-nu-arab`, `-u-ca-japanese`,
  `-u-hc-h23`, …; unknown regions/scripts like `ar-Arab-XX`, `en-Cyrl`; aliases; `und`; private use).
- Numbers: formatDecimal(+ToParts) ~409k, formatCurrency(+ToParts) ~332k (every style, digit
  option, rounding mode, 12 numbering systems, cash, narrow symbols), symbols/names/plurals/adjust.
- Units: formatQuantity(+ToParts, Sequence) ~130k+, display names, availableUnits.
- Calendars: formatDate(+ToParts) ~348k (37 epochs incl. DST edges, era changes, years 1–9999 and
  negative × 28 zones incl. invalid/alias × ~130 skeletons/widths × ca/nu/context/alt);
  intervals ~130k; relative time ~103k; raw/wrapper formats; field names for every calendar
  ~190k; timeZoneInfo, timeData, week data, fieldOfVisualDifference, to*/new*Date in all five
  calendars (compared through 35 date fields).
- General: lists, ~114k display names, measurement system, layout, ~19.5k message formats.
- Locale-independent: tag parsing/resolution, time zone lookups, time periods, currency data.

The only flagged line is the deliberately unknown locale `xx`, which fails to load on both sides
with an error that contains each checkout's own pack path.

Shared oddity seen there (kept from 1.x): `newJapaneseDate` / `newISO8601Date` throw "Cannot read
properties of undefined" for some field sets (no defaults are applied; listed under 1.x bugs).

## Flags and the site's searchable pickers (added 2026-11-02)

- `@phensley/locale` has `regionFlag`, `localeFlag`, `subdivisionFlag` and `flagRegion`,
  re-exported from `@phensley/cldr`. Flags are built from regional indicator characters; the
  259 RGI two-letter flags (Emoji 16.0, Sark included) are a 780-byte string. `localeFlag`
  uses likely subtags and aliases (`ja` → 🇯🇵, `en-UK` → 🇬🇧) and the `u-sd` subdivision
  extension (England, Scotland, Wales). This replaces the monorepo's `emojiFlags`, which loads
  all of `emoji-datasource` and matches the last two characters of the expanded tag.
- The site's locale and time zone pickers are `SearchSelect` (apps/website/src), a combobox
  over seaq 2.0.0-rc.2 (npm's `latest` is still the 2021 1.1.5 with the old API). Rows show the
  flag, names in the page's language and the id or current offset; the footer shows the likely
  tag and currency (locales) or the zone id and its countries (zones). English names, CLDR's
  own locale names ("Swiss High German"), the id with spaces, zone ids and country names are
  searchable.
- seaq scores a match lower the further into the string it falls, so a long field of extra
  names lost to weak fuzzy matches elsewhere. Each name is now its own short entry; results
  keep each item's best entry. Threshold 0.5 drops weak matches.
- Not searchable: a language's name for itself ("Deutsch"), since that needs every
  language's pack. A small generated autonym table would fix it.
- Fixed in passing: long code samples widened the page on phones (grid items need
  `minmax(0,1fr)`).

## App translations: `createTranslator` (added 2026-11-02)

Stephen's apps had built their own translation layer on 1.x (`@billie-coop/intl`: English text
as keys, catalogs per language, English fallback with English plural rules, a catalog test that
walked the parser's internal opcodes, and a yarn patch for ICU apostrophes). That pattern is now
part of `@phensley/messageformat`, with the fixes:
- `createTranslator({ source, catalogs })` + `translate(translator, locale, key, args)`: fallback
  `pt-PT` -> `pt` -> source; plural rules from the language of the catalog the text came from (the
  app applied the device's regional rules to the language catalog); parsed messages and plural
  rules cached in the translator (the app re-parsed every message on every call).
- Type checking: keys must be source keys, and `MessageArgNames` reads the placeholders out of the
  pattern type, so a missing or misspelled argument is a compile error. An unknown key's error
  names the key.
- `checkCatalogs` (missing / extra keys, placeholder mismatches, unbalanced braces, plural or
  select without `other`), `messageArgNames`, `isMessageKey`, `resolveMessage`.
- `ApostropheMode` `'double-optional'` (ICU's default), used by the translator; identical to the
  app's yarn patch on all 15,525 catalog messages + edge cases. `createMessageFormatter` still
  defaults to the 1.x mode; worth flipping for 2.0. The brace matcher now honours
  `disableEscapes` (1.x ignored it there).
- Caching on the locale side: `loadLocale`/`loadLocaleAsync` return cached locale data per locale
  (`localeCacheSize`, default 64), `cldrFramework.get` returns the same bound object, and
  `messageFormatter(locale)` without options is one shared formatter per locale. 1.x rebuilt all
  of these per call, so code like `framework.get(tag).Numbers.formatCurrency(...)` in a render
  path started its caches cold every time.

The README of `@phensley/messageformat` has a "Translating an app" guide. The example site is
translated this way into de, fr, es, pt, ja, zh, zh-Hant and ar (49 messages each, written by an
AI, flagged as unreviewed on the page), with `i18n.test.ts` running `checkCatalogs`; the page
switches to right-to-left for Arabic. Root vitest now includes `apps/*`.

## Repo layout and tooling (2026-11-02)

Restructured to match Stephen's other repos (seaq, billie-coop monorepo):
- **Yarn 4.18** workspaces (`packages/*` for the library, `apps/*` for apps), node-modules
  linker, `.prototools` pinning Node 24.22.1 and Yarn, `yarn.lock` committed. pnpm files removed.
- **Biome 2.5.9** replaces ESLint + Prettier (100 columns, single quotes), run from the root:
  `yarn check` / `yarn check:fix`; `yarn ts-check` runs the TypeScript checks (declarations per
  package, then each package's `build:lint` incl. tests); `yarn lint` runs both. Rules the old
  ESLint config had off stay off. The reformat + Biome's fixes are one commit (`style: ...`),
  checked with the full suite, pack identity and the 2.2M-call differential (still zero diffs).
  Two Biome "safe" fixes were wrong and reverted: an empty interface used for declaration merging
  became a type alias, and a sticky-flag `new RegExp('.', 'y')` used for feature detection became
  a literal (an ES5 build error, and a syntax error on engines without the flag).
- Tools are declared once at the root, as in the other repos, so package scripts work when run
  through the root scripts (`yarn build`, `yarn api`, ...); Yarn doesn't put root tools on the
  PATH of a script run directly inside a package. Apps declare their own tools.
- The library build is unchanged (tsc CJS + ES modules, rollup CommonJS bundles, API Extractor);
  seaq's tsup would drop the CommonJS bundle work and the API reports.

**`apps/website`**: live examples (Vite 7 + React 19 + Tailwind 4), the successor of the old
`cldr-engine-react-demo` (CRA + Redux). Sections for numbers, currency, decimal math (with an
invoice line), days / times / zones (due date, reminder time, `dayAtTime`, next clock change,
month grid with the locale's week start), units with conversion, lists / plurals / ICU messages,
and locale matching; every example shows the call next to its live result for any of the 429
locales and any zone. Locale packs load on demand, one chunk per language (28-74 KB gzipped);
the app chunk is 188 KB gzipped (React, the formatters used, tz data). Checked headlessly
(Playwright) in en-US, ar-EG, ja-JP and de-DE: no errors, no failed examples, no horizontal
scroll at phone width. `yarn website` / `yarn website:build`.

## Dates and times: `@phensley/datetime` (added 2026-11-02, branch `datetime`)

New feature, not part of the 1.x port: Stephen asked for date/time primitives that don't have
JavaScript `Date`'s problems, so his apps can drop date-fns. New package `packages/datetime`
(depends only on `@phensley/timezone`), re-exported from `@phensley/cldr-core` / `@phensley/cldr`,
plus locale-aware formatters in `cldr-core/src/api/days.ts`.

**The model.** Four kinds of value, kept apart:

| Value | Type | Means |
|---|---|---|
| Day | `Day` `{ year, month, day }` | a calendar day, no time, no zone (due date) |
| Time of day | `TimeOfDay` `{ hour, minute, second, millis }` | a wall clock time, no zone (alarm at 06:30) |
| Instant | `number`, epoch ms | one moment, same everywhere (payment received) |
| Zone | IANA id string | whose clock |

Day and time-of-day math is integer arithmetic (day number = days since 1970-01-01, Howard
Hinnant's civil-from-days) and never sees a zone. Only these take one: `dayToday`,
`dayFromInstant`, `timeOfDayFromInstant`, `dayAtTime`, `dayStartInstant`, `timeZoneOffset`,
`instantParse` / `instantToString` (optional zone), and the `formatInstant*` formatters.
Daylight saving is handled in `dayAtTime` only, with Temporal's `disambiguation` option
(`compatible` / `earlier` / `later` / `reject`).

**Choices made:**
- `Day` stores year/month/day rather than the day number, so it reads well in logs and JSON;
  the day number is computed when needed (cheap, exact).
- Invalid input throws `RangeError` (`day(2026, 2, 30)`, unknown zone, fractional durations);
  `*Parse` functions return `undefined`. Nothing rolls over or falls back to UTC silently (the
  existing calendar code reads an unknown zone as UTC; the new functions don't).
- Day of week uses CLDR numbering, 1 = Sunday … 7 = Saturday, to match `firstDayOfWeek(locale)`
  and `dateDayOfWeek`. `dayStartOfWeek(d, firstDay)` takes the first day explicitly.
- `dayUntil(from, to, 'months' | 'years')` = largest whole count you can `dayAdd` without
  passing `to`, so it is consistent with `dayAdd`'s month-end clamping.
- `formatDay` defaults to `{ date: 'medium' }` (not `formatDate`'s `'full'`); `formatTimeOfDay`
  defaults to skeleton `'jm'` (locale's 12/24 h clock). Both format in UTC internally so the
  output never shifts. `formatInstant` requires a zone.
- Recurrence rules (every Monday, 3 days before due) stay in apps; the package gives the parts.

**API:** `day`, `isDay`, `dayParse`, `dayFromString`, `dayToString`, `dayToEpochDay`,
`dayFromEpochDay`, `dayAdd`, `daySubtract`, `dayUntil`, `dayCompare`, `dayEquals`,
`dayIsBefore`, `dayIsAfter`, `dayOfWeek`, `dayOfYear`, `dayDaysInMonth`, `dayIsLeapYear`,
`dayStartOfWeek`, `dayEndOfWeek`, `dayStartOf`, `dayEndOf`, `dayRange`; `timeOfDay`,
`isTimeOfDay`, `timeOfDayParse`, `timeOfDayFromString`, `timeOfDayToString`,
`timeOfDayToMillis`, `timeOfDayFromMillis`, `timeOfDayCompare`; `systemTimeZone`,
`timeZoneOffset`, `dayFromInstant`, `timeOfDayFromInstant`, `dayToday`, `dayAtTime`,
`dayStartInstant`, `instantParse`, `instantToString`. In cldr-core: `formatDay(ToParts)`,
`formatDayInterval(ToParts)`, `formatTimeOfDay(ToParts)`, `formatDayRelative`,
`formatInstant(ToParts)`, `formatInstantRelative`.

**Checks** (scripts in the session scratchpad, not in the repo):
- vs **date-fns 4.1.0**: 1,227,014 comparisons (every day 1999-2031 + 20k random days
  1750-2190, random offsets, all 7 week starts) of add/sub, differences, start/end of
  week/month/year, getDay/getDayOfYear/getDaysInMonth/isLeapYear, each*OfInterval, parse/format:
  identical except `differenceInMonths` in 4 month-end cases (date-fns says 28 Feb → 28 Mar is
  0 months; `dayUntil` says 1, consistent with `dayAdd`).
- vs **Intl** (Node 24, ICU tz 2026e) for 340 zones × 400 random instants 1990-2035:
  `dayFromInstant` / `timeOfDayFromInstant` and the `dayAtTime` round trip agree everywhere up
  to 2026-11. All 167 mismatches are after that, in Morocco and several Canadian zones, from
  tz rule changes newer than the bundled 2025b data (they go away with the 2026f update).
- vs **Temporal** (`node --harmony-temporal`): `dayAtTime` at every clock change 1990-2026-06
  in 340 zones (10,696 transitions), every 15 minutes of the day before and the day of, all four
  disambiguation modes: 8,214,528 comparisons. 568 differ, all in America/Bogota (1992) and
  Europe/Chisinau, and in every one the two tz data sets (bundled 2025b vs Node ICU 2026e)
  disagree about the offsets around that time; where the data agree the results are identical.
- **Unit tests:** `packages/datetime/__tests__` (23) and
  `cldr-core/__tests__/api/calendars/days.test.ts` (8). Suite now 187 files / 1369 tests.
- **Benchmarks** (`packages/datetime/__benchmarks__`, Node 24, after the review's input
  validation): dayParse 6.8M ops/s, dayToString 15.5M, dayAdd 9.0M (days) / 8.0M (months),
  dayUntil 14.9M, dayStartOfWeek 8.3M, dayFromInstant 4.9M, dayAtTime 1.7M.
- **Size** (rollup + terser, min+gzip): day math only 1.3 KB; with zone functions 31.7 KB (tz
  data); `formatDay` + `formatDayRelative` with a locale 89.0 KB.

**Independent review (Codex, 2026-11-02)** found no errors in the calendar math or DST
resolution (its own checks: 200k epoch days over the full range vs Date, 200k month/year
differences, 643,692 disambiguation checks at every bundled transition) but 11 issues at the
edges, all fixed with regression tests (`packages/datetime/__tests__/review.test.ts`, extra
cases in `days.test.ts`):
- every function now validates Day / TimeOfDay arguments (hand-built `{ month: 2, day: 30 }`
  rolled over in `dayAtTime` and was clamped by `formatDay`); `timeZoneOffset` and the instant
  formatters reject NaN / Infinity / out-of-range instants (`formatInstant(en, NaN)` printed
  1 Jan 1970);
- `formatDay*` throws outside 1582-10-15 … 8652-12-31: the shared calendar formatter uses the
  Julian calendar before the reform and clamps at 8652, so those days came out wrong;
- `formatDay` / `formatTimeOfDay` / `formatDayInterval` reject skeleton fields that don't
  belong to the value (`'jmsz'` printed a made-up "GMT");
- `instantToString` keeps seconds in historical offsets (`+00:09:21`) and `instantParse`
  accepts them, so zoned text parses back to the same instant (102,300 round trips checked);
- `dayUntil` / `dayRange` no longer build an out-of-range intermediate at the range limits;
  `dayAtTime` throws if the result is outside Date's range;
- `dayStartInstant` finds the first instant of the day when a gap starts before midnight
  (Toronto 1919-03-31 starts at 00:30, not 01:00);
- zone ids are accepted in any letter case;
- date-utils port: falls back to the host clock (not UTC) when the platform's zone is unknown,
  copies date-fns' fractional-amount rule, and is described as replacing the `DateUtils`
  object, not the whole module (its date-fns re-exports must move in the same change);
- docs: `differenceInYears` also differs at Feb 29 anniversaries; parse functions throw for an
  unknown zone; fractional instants are floored.

Codex re-checked the fixes (reran all its probes: 643,692 DST checks, 200k calendar samples,
200k month/year checks, no mismatches) and found three regressions from them plus one gap, all
fixed with tests: a zone id in another letter case passed validation but the instant formatters
forwarded it to the shared formatter, which read it as UTC (now `timeZoneId(zone)` resolves the
canonical id and that is passed on); `instantParse` threw for out-of-range text and for a valid
boundary instant written with an offset (now only the final instant is range checked, and
returns undefined); `dayRange` with an absurd step (`{ years: 1e308 }`) looped forever; and
`formatInstant*` silently clamped instants after 8652 (now the same 1582-10-15 … 8652-12-31
range as `formatDay`, throwing outside it).

**date-fns migration.** `examples/date-fns-migration/` has a function-by-function table and
`date-utils.ts`, a replacement for the monorepo's `@billie-coop/date-utils` `DateUtils` object
(same API, no date-fns, only needs `@phensley/datetime`, so it works next to cldr 1.13.1). It is
not a whole-module drop-in: the module's date-fns re-exports go away, so their callers (below)
move in the same change.
Compared with the original in 11 TZ settings (incl. POSIX `UTC+8`, `EST5EDT`) with a mocked
clock over 2018-2030, plus 99 fractional/NaN amounts: identical for every `YYYY-MM-DD` input; differs only for invalid days (`2025-02-30` no longer rolls over),
partial ISO forms (`2025-12`), and two old quirks with timestamp inputs (`getDaysUntil` counted
24-hour periods; `isThisWeek` stopped at Saturday 00:00).

Monorepo call sites that import date-fns functions through `date-utils` (not via `DateUtils`),
to move in the same change: `format` (6: `yyyy-MM` keys, `d` / `yyyy-MM-dd` in `ui/Calendar.component.tsx`,
one English-only `MMM d, h:mm a` in oddlog `Tracker.screen.tsx`), `subMonths`/`subDays`/
`startOfMonth`/`addMonths` (3 each), `startOfWeek` (2, incl. `invoice-utils/invoiceReminderPlan.ts`),
`parseISO` (2), `differenceInDays` (2, incl. `invoiceStatus.ts`), and singles in the calendar
component (`eachDayOfInterval`, `eachWeekOfInterval`, `endOfWeek`, `endOfMonth`, `isSameMonth`,
`isSameDay`) and sketch-mobile (`formatDistanceToNow`). `invoiceReminderPlan.atReminderHour`
is exactly `dayAtTime(day, timeOfDay(9), zone)`.

## What's left / rough edges

- **Versioning and changelog.** Package versions are still 1.16.0 and there is no CHANGELOG
  entry. The pack checksum is derived from `major.minor`, so bumping to 2.0 changes it and the
  packs must be rebuilt at release (the build does that). Left for Stephen to decide.
- **Docs.** The README has a short 2.x usage section and the per-package READMEs touched by the
  ports were updated, but the documentation site / `docs` content still describes the 1.x API.
- **cldr-compiler** (build-time CLI) still contains classes internally; it only had its imports
  adapted. It isn't bundled into apps, so it was out of scope for tree-shaking.
- **Week accessors** (`dateWeekOfYear`, `dateWeekOfMonth`, ...) recompute per call (~3× slower than
  1.x, which memoized them on the mutable date). Only patterns with week fields use them.
  Computing them at creation was tried and reverted: it slows creation, `dateAdd` and formatDate
  of `{ date, zoneId }` (see "Experiment: week fields at creation").
- **Naming.** The value-type prefix rule produces some long names (`decimalStripTrailingZeros`,
  `dateYearOfWeekOfYearISO`). It keeps the flat export namespace collision-free and makes
  autocomplete work by type; worth a look before the API is frozen.
- **Merging the tzdb 2026f work.** The data file `packages/timezone/src/autogen.zonedata.ts` and its
  format are unchanged here, so a data-only update merges cleanly. If the other clone also edited
  `packages/timezone/src/index.ts`, that will conflict: the runtime code moved to `src/tz.ts` and
  `src/database.ts`.
- **`examples/tree-shaking/measure.mjs`** needs a built 1.x checkout for the 1.x columns
  (`--v1 <path>`); the 2.x numbers don't.

- **Shared values still returned mutable (same as 1.x).** Found while checking the review's
  findings: `availableLocales()`, `timeZoneIds()` / `tzZoneIds()`, `tzUtcZone()`,
  `tzZoneMeta(id).countries` and `getCurrencyFractions(code)` return the same module-level
  object on every call, typed mutable, as 1.x did. Editing them affects every caller. Fixing
  means `readonly` return types (a compile break for callers that sort/push the result) or
  copies; left for the 2.0 API decision.

## Unsure / worth a second look

- **cldr-ext-rbnf `pubnames`** (above): the helper that ported it removed a 1.x in-place mutation of
  shared rule-set data instead of reproducing it. Reproducing it would mean mutating shared data;
  the extension isn't used by cldr-core. I left the fix in and flagged it, since the brief says to
  keep 1.x behaviour.
- **`patternCacheSize`** is now a no-op. If anyone tuned it for memory, they'd want a way to size
  the shared caches; easy to add back as a function if needed.
- **Convenience object shape:** I dropped `Internals` (undocumented, `@internal`) and added `data`.
- **`isLanguageTag` / `isCalendarDate` / `isDecimal`** are shape checks, so a hand-made object of the
  right shape passes where 1.x `instanceof` failed. Since the review they check every field of
  the type (see "Fixed after the independent review"), so only complete objects pass.
