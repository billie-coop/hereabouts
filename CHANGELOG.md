# Changelog

All notable changes to this project will be documented in this file.

The first entry describes hereabouts relative to cldr-engine 1.16.0. The entries after it are
cldr-engine's (`@phensley/cldr`), kept as history; they used a modified semantic versioning
scheme in which packs must come from the same `major.minor` version as the library.

## [Unreleased] hereabouts

hereabouts is a port of [cldr-engine](https://github.com/phensley/cldr-engine) 1.16.0 by
Patrick Hensley. Packages keep their `@phensley/*` names for now and are still at version
1.16.0; they will be published as one package, `@billie-coop/hereabouts`
([notes/publishing.md](notes/publishing.md)). The full log of the port, with measurements and
every deviation from 1.x, is [notes/functional-rewrite.md](notes/functional-rewrite.md). A
migration guide from `@phensley/cldr` 1.x is still to be written.

Unchanged: CLDR data (48.2.0), tz data (2025b), the resource pack format (packs are
byte-identical to 1.16.0's) and formatting results (differential runs against 1.16.0 over all
429 locales found no differences).

### Added

- `@phensley/datetime`: `Day` (`{ year, month, day }`), `TimeOfDay`, instants as epoch
  milliseconds, and explicit IANA zones. Day math never touches a zone; `dayAtTime` resolves
  clock changes with Temporal's `disambiguation` option. Locale formatters in `@phensley/cldr`:
  `formatDay`, `formatDayInterval`, `formatDayRelative`, `formatTimeOfDay`, `formatInstant`,
  `formatInstantRelative` (and `*ToParts`). A date-fns migration table and drop-in helper are in
  `examples/date-fns-migration`.
- App translations in `@phensley/messageformat`: `createTranslator`, `translate`,
  `checkCatalogs`, `resolveMessage`, `messageArgNames`, `isMessageKey`, and the `MessageCatalog`
  type. Keys and placeholders are type-checked; catalogs fall back from `pt-PT` to `pt` to the
  source; plural rules follow the catalog the text came from.
- `ApostropheMode` `'double-optional'` (ICU's default), used by the translator.
- Emoji flags in `@phensley/locale`: `regionFlag`, `localeFlag`, `subdivisionFlag`,
  `flagRegion`.
- `setTimeZoneData` in `@phensley/timezone`, to replace the bundled tz data at runtime.
- `isDecimal`, `isCalendarDate`, `isLanguageTag` and other shape checks, in place of
  `instanceof`.
- `apps/website`: live examples (Vite, React, Tailwind), translated into 8 languages.
- `examples/tree-shaking`: bundle size measurements against 1.x.
- Vitest bench suites (`yarn bench`).

### Changed

- Classes are now plain data and exported functions. Values are immutable plain objects
  (`decimal('1.5')`, `decimalAdd(a, b)`, `decimalToString(d)`; `languageTag(...)` and `tag*`;
  `gregorianDateFromUnixEpoch(...)` and `date*`). Engines are plain records made by functions
  (`getPluralRules`, `createMessageFormatter`, `createLocaleMatcher`, `createUnitConverter`).
  1.x static methods are plain functions (`LanguageResolver.resolve` is
  `resolveLanguageTag`).
- Locale data is a plain `LocaleData` object from `loadLocale(framework, id)` /
  `loadLocaleAsync`, passed first to the locale functions, which keep their 1.x method names
  (`formatDecimal(locale, n, options)`, `formatDate(locale, date, options)`, ...).
- `cldrFramework(options).get(id)` still returns the 1.x-shaped object (`.Numbers`,
  `.Calendars`, `.General`, `.Units`, `.Schema`), built from the functions, with a `data` field
  holding the `LocaleData`.
- Every package is `sideEffects: false` and nothing runs on import, so bundlers drop unused
  code: number formatting for one locale is 41.8 KB min+gzip (111.5 KB in 1.16.0), decimal math
  alone 2.7 KB (5.9 KB).
- Loaded locale data (up to `localeCacheSize`, default 64), `cldrFramework().get()` objects and
  `messageFormatter(locale)` without options are cached.
- `@phensley/cldr` no longer sets a global default config on import; `createFramework` and
  `cldrFramework` default to its config instead.
- `@phensley/cldr` re-exports `@phensley/cldr-core` wholesale.
- `decimalProperties` returns a copy of the coefficient, typed `readonly number[]`.
- Parsed patterns, plural rules and date zone info are readonly in the types.
- `unitConverterAdd` returns a new converter (1.x `add` changed it in place).
- The brace matcher in message parsing honours `disableEscapes`.
- CommonJS entry points (`lib/index.js`) are rollup bundles.
- Yarn 4 workspaces (`packages/*`, `apps/*`) and Biome replace pnpm, ESLint and Prettier.

### Removed

- The classes themselves (`Decimal`, `Rational`, `LanguageTag`, `GregorianDate` and the other
  calendar classes, `CLDRFramework`, ...). Their types remain as plain data types.
- `Internals` on the convenience object.
- Internal helpers that were reachable from the package indexes: `parseDatePattern`,
  `getNumberPattern`, `parseWrapper`, `renderDecimal`, `gregorianDaysInYear`, `negatePeriod`
  and others (full list in the notes). They returned shared cached objects that callers could
  change.
- The `patternCacheSize` option no longer does anything (caches are shared and fixed-size).

## [1.14.0]

## Fixed/Changed

- Upgrade to [CLDR v48.0.0](https://cldr.unicode.org/downloads/cldr-48)

## [1.13.1]

## Fixed/Changed

- Fix for [Temporal date difference spec bug](https://github.com/tc39/proposal-temporal/issues/3141).

## [1.13.0]

## Fixed/Changed

- [Temporal](https://tc39.es/proposal-temporal/docs/)-compatible date math and date difference:
  - New `CalendarDate` `until` and `since` methods and modification of existing `add`, `subtract`, and `difference` methods to be Temporal-compatible.
  - Only integers can be used when adding to a date instance.
- Improvements to `CalendarDate.relativeTime`.
- Exposed currency functions globally
- Added more fine-grained `CalendarDate` to-string methods.

## [1.12.2]

## Fixed/Changed

- Include patch files in `cldr-compiler` package distribution.

## [1.12.1]

## Fixed/Changed

- Fix timezone offset bug in calendar math

## [1.12.0]

## Fixed/Changed

- Upgrade to [CLDR v47](https://cldr.unicode.org/index/downloads/cldr-47)
- Upgrade to [tzdb 2025b](https://www.iana.org/time-zones)

## 1.11.0 skipped

- Upgrade to CLDR v46.1

## [1.10.2]

## Fixed/Changed

- Improvements to interval formatting.
- Added `startOf` and `endOf` methods to `CalendarDate`.
- Exposed additional date methods.

## [1.10.1]

## Fixed/Changed

- Fixed bug in timeData resolution

## [1.10.0]

## Fixed/Changed

- Improvements and fixes to date interval formatting

## [1.9.2]

### Fixed/Changed

- Upgrade to [tzdb 2024b](https://www.iana.org/time-zones)

## [1.9.1]

### Fixed/Changed

- Convert some enums to non-const for use at runtime

## [1.9.0]

### Fixed/Changed

- Upgrade to [CLDR v45](https://cldr.unicode.org/index/downloads/cldr-45)
- Upgrade to [tzdb 2024a](https://www.iana.org/time-zones)

## [1.8.3]

### Fixed/Changed

- Fix for spaces in Japanese unit patterns

## [1.8.2]

### Fixed/Changed

- Clamp all dates to our bounded range for Julian days

## [1.8.1]

## Fixed/Changed

- Fix bug in default calendar selection
- Fix bug in generating Finnish timezones

## [1.8.0]

## Fixed/Changed

- Upgrade to [CLDR v44](https://cldr.unicode.org/index/downloads/cldr-44)
- Upgrade to Typescript 5.3.2
- Created `LocaleResolver` class to split a merged declaration with the `Locale` interface.

## [1.7.3]

## Fixed/Changed

- Fixed context bug affecting datetime intervals.

## [1.7.2]

## Fixed/Changed

- Patch display name for `ajp` language in English locales.

## [1.7.1]

## Fixed/Changed

- Upgrade to [CLDR v43.1](https://cldr.unicode.org/index/downloads/cldr-43#h.qobmda543waj)

## [1.7.0]

## Fixed/Changed

- Upgrade to [CLDR v43](https://cldr.unicode.org/index/downloads/cldr-43)
- Upgrade to [tzdb 2023c](https://www.iana.org/time-zones)

## [1.6.6]

## Added

- Added message formatting option to disable apostrophe escapes.

## [1.6.5]

## Fixed/Changed

- Upgrade to [tzdb 2022g](https://www.iana.org/time-zones)

## [1.6.4]

## Fixed/Changed

- Add `Calendars.timeData` method to fetch preferred and allowed hour cycle skeletons.

## [1.6.3]

## Fixed/Changed

- Add long/short timezone names to `timeZoneInfo` results.

## [1.6.2]

## Fixed/Changed

- Enhanced type safety for unit factor conversions.

## [1.6.1]

## Fixed/Changed

- Fixed missing `node-fetch` runtime dependency for `@phensley/cldr-compiler` package.

## [1.6.0]

## Fixed/Changed

- Upgrade to [CLDR v42](https://cldr.unicode.org/index/downloads/cldr-42)

## [1.5.2]

## Fixed/Changed

- Upgrade to [tzdb 2022e](https://www.iana.org/time-zones)

## [1.5.1]

## Fixed/Changed

- Upgrade to [tzdb 2022b](https://www.iana.org/time-zones)

## [1.5.0]

## Fixed/Changed

- Upgrade to [CLDR v41](https://cldr.unicode.org/index/downloads/cldr-41)

## [1.4.1]

## Fixed/Changed

- Upgrade to [tzdb 2022a](https://www.iana.org/time-zones)

## [1.4.0]

## Fixed/Changed

- Upgrade to [CLDR v40](https://cldr.unicode.org/index/downloads/cldr-40)

## [1.3.3]

## Fixed/Changed

- Fixed internal package dependencies. Packages must depend on others from the same patch level.

## [1.3.2]

## Fixed/Changed

- Fixed internal package dependencies. Packages must depend on others from the same patch level.

## [1.3.1]

## Fixed/Changed

- Set `inlineSources: true` to add Typescript source code to source maps.

## [1.3.0]

## Fixed/Changed

- Upgrade to [CLDR v39](http://cldr.unicode.org/index/downloads/cldr-39)

## [1.2.18]

### Fixed/Changed

- Convert some enums to non-const for use at runtime

## [1.2.17]

### Fixed/Changed

- Backport: Fix for spaces in Japanese unit patterns
- Backport: Clamp all dates to our bounded range for Julian days

## [1.2.16]

### Fixed/Changed

- Fix interval date formatter context

## [1.2.15]

### Fixed/Changed

- Fixed imports in type declaration files

## [1.2.14]

### Added

- Add option to disabled escapes in message formatter

## [1.2.13]

### Fixed/Changed

- Removed unused parameter on `timeData` method.

## [1.2.12]

### Fixed/Changed

- Add `Calendars.timeData` method to fetch preferred and allowed time cycles.

## [1.2.11]

### Fixed/Changed

- Add long/short timezone names to timeZoneInfo results.

## [1.2.10]

### Fixed/Changed

- Build improvements.

## [1.2.9]

### Fixed/Changed

- Fix parsing of extended language subtag.
- Ping all dependencies to same minor version.

## [1.2.8]

## Fixed/Changed

- Set `inlineSources: true` to add Typescript source code to source maps.

## [1.2.7]

### Fixed/Changed

- Upgrade to [tzdb 2021a](https://www.iana.org/time-zones)

## [1.2.6]

### Added

- The `cldr-compiler pack` command now includes the ability to apply patches to the resource packs, allowing you to replace CLDR values with your own. See [the included example](./packages/cldr/example-patch.yaml).
- A new command `cldr-compiler schema` will dump the CLDR data schema used to generate resource packs. This is helpful in identifying the full path to a value you may want to patch.

## [1.2.5]

### Fixed/Changed

- Fix types for character/line order.
- Use default JSON export for version string.

## [1.2.4]

### Added

- Methods on `CalendarDate` for ISO weeks.

## [1.2.3]

### Fixed/Changed

- Upgrade to [tzdb 2020f](https://www.iana.org/time-zones)

## [1.2.2]

### Added

- The `phensley/timezone` package includes a new `TZ.zoneMeta` method to return metadata for a timezone. This can be useful for displaying user interfaces for choosing a timezone. The new properties are:
  - `stdoffset` - Current standard offset, in milliseconds.
  - `latitude` - Latitude to 6 decimal places, for the timezone's "principal location"
  - `longitude` - Latitude to 6 decimal places, for the timezone's "principal location"
  - `countries` - List of ISO 3166 2-letter country codes for countries which overlap the timezone.

- The `cldr.Calendars.timeZoneInfo` result `TimeZoneInfo` now includes the same properties as `TZ.zoneMeta` above, plus the following property:
  - `metazone` Current [CLDR metazone](http://www.unicode.org/reports/tr35/tr35-dates.html#Metazone_Names) for the timezone.

## [1.2.1]

### Fixed/Changed

- Use `tslib ^1.13.0`

## [1.2.0]

### Fixed/Changed

- Project now uses standard semantic versioning, see [README](https://github.com/phensley/cldr-engine/#versioning)
- All `@phensley/*` package interdependencies now use the `^x.x.x` constraint.
- Removed the internal package `@phensley/cldr-schema`, merging its code into `@phensley/cldr-core`.
- Switched from tslint to eslint.
- Modified checksum so that resource packs are now compatible at the patch level. Resource packs must match the `major.minor` version of the `@phensley/cldr-core` package at runtime to ensure schema compatibility.

[1.14.0]: https://github.com/phensley/cldr-engine/compare/v1.13.1...v1.14.0
[1.13.1]: https://github.com/phensley/cldr-engine/compare/v1.13.0...v1.13.1
[1.13.0]: https://github.com/phensley/cldr-engine/compare/v1.12.2...v1.13.0
[1.12.2]: https://github.com/phensley/cldr-engine/compare/v1.12.1...v1.12.2
[1.12.1]: https://github.com/phensley/cldr-engine/compare/v1.12.0...v1.12.1
[1.12.0]: https://github.com/phensley/cldr-engine/compare/v1.10.2...v1.12.0
[1.10.2]: https://github.com/phensley/cldr-engine/compare/v1.10.1...v1.10.2
[1.10.1]: https://github.com/phensley/cldr-engine/compare/v1.10.0...v1.10.1
[1.10.0]: https://github.com/phensley/cldr-engine/compare/v1.9.2...v1.10.0
[1.9.2]: https://github.com/phensley/cldr-engine/compare/v1.9.1...v1.9.2
[1.9.1]: https://github.com/phensley/cldr-engine/compare/v1.9.0...v1.9.1
[1.9.0]: https://github.com/phensley/cldr-engine/compare/v1.8.3...v1.9.0
[1.8.3]: https://github.com/phensley/cldr-engine/compare/v1.8.2...v1.8.3
[1.8.2]: https://github.com/phensley/cldr-engine/compare/v1.8.1...v1.8.2
[1.8.1]: https://github.com/phensley/cldr-engine/compare/v1.8.0...v1.8.1
[1.8.0]: https://github.com/phensley/cldr-engine/compare/v1.7.3...v1.8.0
[1.7.3]: https://github.com/phensley/cldr-engine/compare/v1.7.2...v1.7.3
[1.7.2]: https://github.com/phensley/cldr-engine/compare/v1.7.1...v1.7.2
[1.7.1]: https://github.com/phensley/cldr-engine/compare/v1.7.0...v1.7.1
[1.7.0]: https://github.com/phensley/cldr-engine/compare/v1.6.6...v1.7.0
[1.6.6]: https://github.com/phensley/cldr-engine/compare/v1.6.5...v1.6.6
[1.6.5]: https://github.com/phensley/cldr-engine/compare/v1.6.4...v1.6.5
[1.6.4]: https://github.com/phensley/cldr-engine/compare/v1.6.3...v1.6.4
[1.6.3]: https://github.com/phensley/cldr-engine/compare/v1.6.2...v1.6.3
[1.6.2]: https://github.com/phensley/cldr-engine/compare/v1.6.1...v1.6.2
[1.6.1]: https://github.com/phensley/cldr-engine/compare/v1.6.0...v1.6.1
[1.6.0]: https://github.com/phensley/cldr-engine/compare/v1.5.2...v1.6.0
[1.5.2]: https://github.com/phensley/cldr-engine/compare/v1.5.1...v1.5.2
[1.5.1]: https://github.com/phensley/cldr-engine/compare/v1.5.0...v1.5.1
[1.5.0]: https://github.com/phensley/cldr-engine/compare/v1.4.1...v1.5.0
[1.4.1]: https://github.com/phensley/cldr-engine/compare/v1.4.0...v1.4.1
[1.4.0]: https://github.com/phensley/cldr-engine/compare/v1.3.3...v1.4.0
[1.3.3]: https://github.com/phensley/cldr-engine/compare/v1.3.1...v1.3.3
[1.3.1]: https://github.com/phensley/cldr-engine/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/phensley/cldr-engine/compare/v1.2.7...v1.3.0
[1.2.18]: https://github.com/phensley/cldr-engine/compare/v1.2.17...v1.2.18
[1.2.17]: https://github.com/phensley/cldr-engine/compare/v1.2.16...v1.2.17
[1.2.16]: https://github.com/phensley/cldr-engine/compare/v1.2.15...v1.2.16
[1.2.15]: https://github.com/phensley/cldr-engine/compare/v1.2.14...v1.2.15
[1.2.14]: https://github.com/phensley/cldr-engine/compare/v1.2.13...v1.2.14
[1.2.13]: https://github.com/phensley/cldr-engine/compare/v1.2.12...v1.2.13
[1.2.12]: https://github.com/phensley/cldr-engine/compare/v1.2.11...v1.2.12
[1.2.11]: https://github.com/phensley/cldr-engine/compare/v1.2.10...v1.2.11
[1.2.10]: https://github.com/phensley/cldr-engine/compare/v1.2.9...v1.2.10
[1.2.9]: https://github.com/phensley/cldr-engine/compare/v1.2.8...v1.2.9
[1.2.8]: https://github.com/phensley/cldr-engine/compare/v1.2.7...v1.2.8
[1.2.7]: https://github.com/phensley/cldr-engine/compare/v1.2.6...v1.2.7
[1.2.6]: https://github.com/phensley/cldr-engine/compare/v1.2.5...v1.2.6
[1.2.5]: https://github.com/phensley/cldr-engine/compare/v1.2.4...v1.2.5
[1.2.4]: https://github.com/phensley/cldr-engine/compare/v1.2.3...v1.2.4
[1.2.3]: https://github.com/phensley/cldr-engine/compare/v1.2.2...v1.2.3
[1.2.2]: https://github.com/phensley/cldr-engine/compare/v1.2.1...v1.2.2
[1.2.1]: https://github.com/phensley/cldr-engine/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/phensley/cldr-engine/compare/v1.1.2...v1.2.0
