# Publishing: decisions and plans

Stephen's decisions and plans for publishing hereabouts, recorded 2026-11-03 when the repo was
created. Nothing here is published yet; update this file as things are decided or done.

## Decided

- **One npm package: `@billie-coop/hereabouts`**, with subpath exports
  (`@billie-coop/hereabouts/decimal`, `@billie-coop/hereabouts/datetime`, ...) instead of the ~15
  separate `@phensley/*` packages this repo still builds. Stephen has claimed the `@billie-coop`
  npm org. How to get there: [single-package-plan.md](single-package-plan.md).
- **Placeholder packages for the bare names.** `hereabouts` (and likewise `seaq` and
  `serenity-now`) get a placeholder package whose README says the maintained package is the
  scoped one, so nobody squats the name.
- **Docs and the example site deploy to GitHub Pages** at
  `https://billie-coop.github.io/hereabouts/`, as seaq and serenity-now do. The package
  manifests already point `homepage` there and `repository` / `bugs` at
  `github.com/billie-coop/hereabouts`, which doesn't exist yet.
- **The fork `billie-coop/cldr-engine` stays** as a fallback. It is 1.16.0 plus fixes, and is
  where the tzdb 2026f update was first made.

## Planned, not decided

- **`oss.billie.coop`**: a site listing the co-op's open source packages, with aliases such as
  `oss.billie.coop/hereabouts`. Where it's managed is undecided (maybe Linear, or the billie-coop
  monorepo).
- **Versioning.** Undecided. The packages are all still at 1.16.0. The resource pack checksum is
  derived from the version's `major.minor` (`checksumIndices` in
  `packages/cldr-core/src/resource/checksum.ts`), so a major or minor bump changes it and the
  packs are rebuilt; `yarn build` does that. A patch bump keeps packs compatible. Apps must load packs
  built for the same `major.minor`.
- **Open API decisions before 1.0** (details in [functional-rewrite.md](functional-rewrite.md),
  "What's left / rough edges"):
  - Two date systems: the CLDR calendar dates (`CalendarDate`, five calendars, `date*`
    functions) and `@phensley/datetime`'s `Day` / `TimeOfDay` / instants. Decide whether both
    stay public and how the docs present them.
  - Shared mutable lists: `availableLocales()`, `timeZoneIds()`, `tzZoneMeta(id).countries`,
    `getCurrencyFractions(code)` and a few others return the same module-level object to every
    caller, as 1.x did. Fix with `readonly` return types (a compile break for callers that sort
    or push) or copies.
  - The message formatter's apostrophe default: `createMessageFormatter` defaults to the 1.x
    mode; the translator uses ICU's `'double-optional'`. Probably flip the default.
  - Long function names from the type-prefix rule (`decimalStripTrailingZeros`,
    `dateYearOfWeekOfYearISO`).

## Data versions

- **tzdb is 2026f** (was 2025b in cldr-engine 1.16.0), brought over 2026-11-03 from
  `../cldr-engine` branch `tzdb-2026f` (`4ab7940c`): the two generated data files, the version in
  the tz tool, and that branch's tests. No existing test's expected values changed. The packs
  don't contain tz data and are unchanged.
- **CLDR is 48.2.0**, unchanged from 1.16.0.

## Left over from cldr-engine, to change before publishing

- `release` / `prerelease` run `pnpm publish -r` (the repo uses Yarn 4 now) and publish every
  package; replace with publishing the single package.
- `CODEOWNERS` lists `@phensley`.
- The `author` fields are Patrick Hensley's, and `@phensley/cldr`'s README is cldr-engine 1.x's.
  Decide what the published package says (Patrick stays credited in README and NOTICE either
  way).
- The cldr-engine documentation site (`phensley.github.io/cldr-engine`, linked from package
  READMEs) describes the 1.x API. hereabouts needs its own docs; a migration guide from
  `@phensley/cldr` 1.x is a separate task.
- `packages/cldr/etc/cldr.api.md` quotes an API Extractor warning with the absolute path of the
  checkout, so it changes on every machine. Cause: the public `PackScript.cache` field's type
  refers to the `@internal` `ExceptionIndex`. Fixing it changes a public type; 1.16.0 had no
  such warning.
