# Publishing: decisions and plans

Stephen's decisions and plans for publishing hereabouts, recorded 2026-11-03 when the repo was
created. Nothing here is published yet; update this file as things are decided or done.

## Decided

- **One npm package: `@billie-coop/hereabouts`**, with subpath exports
  (`@billie-coop/hereabouts/decimal`, `@billie-coop/hereabouts/datetime`, ...) instead of the ~15
  separate `@phensley/*` packages. Stephen has claimed the `@billie-coop` npm org. Done
  2026-11-03 in `packages/hereabouts`; decisions and results in
  [single-package-plan.md](single-package-plan.md) ("Outcome"). Not published yet.
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
- **Versioning.** Undecided. `packages/hereabouts` is still at 1.16.0. The resource pack checksum is
  derived from the version's `major.minor` (`checksumIndices` in
  `packages/hereabouts/src/core/resource/checksum.ts`), so a major or minor bump changes it and the
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

## Release and docs workflows

- `.github/workflows/release.yml` publishes `packages/hereabouts` with npm trusted publishing
  (OIDC, no token), modelled on seaq's. Manual only (`workflow_dispatch`), dry run by default,
  must run from `main`, and refuses a version whose `v<version>` tag or npm version already
  exists. Before the first real run: create the GitHub repo, the `@billie-coop/hereabouts`
  package on npm, and the trusted publisher (owner billie-coop, repo hereabouts, workflow
  `release.yml`).
- `.github/workflows/docs.yml` builds `apps/website` with base `/hereabouts/` and deploys it to
  GitHub Pages on pushes to `main` that touch the site or the library (or by hand). Pages must
  be set to "GitHub Actions" in the repo settings.
- The old `release` / `prerelease` scripts (`pnpm publish -r`, one package each) are removed.

## Found along the way, not fixed

- **Translator argument check with a one-key catalog.** `translate(t, locale, key)` without
  arguments is a compile error when the message has placeholders, except when the source
  catalog has exactly one key: `KeyArgs` in `src/messageformat/translator.ts` treats "the key
  is every key of the catalog" as its unknown-key fallback, which is also true then, so the
  arguments become optional. Real catalogs have more keys; a fix is a small type change.
- **`LanguageTagField` is a getter in the CommonJS build** (compiled enums reassign their
  variable, so rollup keeps a live binding). Harmless; noted in the export test.

## Left over from cldr-engine

- `CODEOWNERS` has a TODO: no `@billie-coop` team was visible, so there is no owner yet.
- The cldr-engine documentation site (`phensley.github.io/cldr-engine`) describes the 1.x API.
  hereabouts needs its own API docs; a migration guide from `@phensley/cldr` 1.x is a separate
  task.
- Done: `author` is "Billie Co-op" with Patrick Hensley under `contributors` in every manifest;
  the API Extractor warning that put the checkout path in `cldr.api.md` is fixed
  (`ExceptionIndex` is tagged `@public`).
