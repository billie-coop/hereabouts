# Publishing: decisions and plans

Stephen's decisions and plans for publishing hereabouts, recorded 2026-11-03 when the repo was
created. Nothing here is published yet; update this file as things are decided or done.

## Decided

- **One npm package: `@billie-coop/hereabouts`**, with subpath exports
  (`@billie-coop/hereabouts/decimal`, `@billie-coop/hereabouts/datetime`, ...) instead of the ~15
  separate `@phensley/*` packages. Stephen has claimed the `@billie-coop` npm org. Done
  2026-11-03 in `packages/hereabouts`; decisions and results in
  [single-package-plan.md](single-package-plan.md) ("Outcome"). Not published yet.
- **Versions restart at 0.1.0** (decided 2026-11-03). Until 1.0, a minor version (0.2, 0.3) may
  change the API, which leaves room for the open API decisions below. `packages/hereabouts` and
  the private `packages/cldr-compiler` are both at 0.1.0. The resource pack checksum is derived
  from the version's `major.minor` (`checksumIndices` in
  `packages/hereabouts/src/core/resource/checksum.ts`), so a major or minor bump changes it and
  `yarn build` rebuilds the packs; a patch bump keeps them compatible. Apps must load packs built
  for the same `major.minor`, which a `^0.1.0` range (0.1.x only) already gives them. The packs
  built at 0.1.0 hold the same data as 1.16.0's; only their `version` and `checksum` fields
  differ. cldr-engine's `version.json` and `scripts/version` (a pnpm-era bump script for many
  packages) are removed: bump `packages/hereabouts/package.json` by hand.
- **Placeholder package for the bare name.** `placeholders/hereabouts` is a README-only package
  named `hereabouts` (0.0.1) that points to `@billie-coop/hereabouts`, so nobody squats the name.
  It isn't a workspace and isn't built. `seaq` and `serenity-now` are already real packages at
  their bare names; they get the same treatment if they move under `@billie-coop` later.
- **Docs and the example site deploy to GitHub Pages** at
  `https://billie-coop.github.io/hereabouts/`, as seaq and serenity-now do. The package
  manifests point `homepage` there and `repository` / `bugs` at
  `github.com/billie-coop/hereabouts`. Live since 2026-11-03.
- **CODEOWNERS** is `@stephenlaughton` (no `@billie-coop` team exists).
- **Releases are dry runs unless unticked.** The release workflow's `dry-run` input defaults to
  true (seaq's defaults to false), so running it by accident only checks.
- **The fork `billie-coop/cldr-engine` stays** as a fallback. It is 1.16.0 plus fixes, and is
  where the tzdb 2026f update was first made.

## First release

npm only lets a package's trusted publisher be set once the package exists, so the first
version is published from Stephen's machine; every later one goes through the release workflow.

1. Done 2026-11-03. Created `github.com/billie-coop/hereabouts` (public, with topics), pushed
   `main`, and set Pages to deploy from GitHub Actions
   (`gh api -X POST repos/billie-coop/hereabouts/pages -f build_type=workflow`). Pages was on
   before the first docs run reached its deploy step, so that run deployed. If Pages is ever
   turned off, re-run "Deploy docs". CI ("Build and Test", Node 22 and 24), the docs deploy
   and a Release dry run all passed. The dry run reached `npm publish --dry-run`: npm 11,
   729 files, 4.0 MB packed, README / LICENSE / NOTICE included. The site at
   `https://billie-coop.github.io/hereabouts/` loads its assets and locale packs under
   `/hereabouts/`, and the locale and time zone pickers work. Its only 404 is the browser's own
   `/favicon.ico` (the site has no favicon).
2. Publish 0.1.0 by hand, mirroring the workflow's steps, from a clean checkout of `main`:

   ```sh
   npm login                       # as a member of the billie-coop npm org
   yarn install --immutable && yarn build && yarn lint && yarn test && yarn api
   cd packages/hereabouts
   npm pkg delete devDependencies  # workspace: ranges must not reach the registry
   npm publish --access public
   git checkout package.json
   git tag v0.1.0 && git push origin v0.1.0
   ```

3. Add the trusted publisher: on npmjs.com, `@billie-coop/hereabouts` → Settings → Trusted
   publishing → GitHub Actions: owner `billie-coop`, repository `hereabouts`, workflow
   `release.yml`, no environment. The same from the command line (npm 11, logged in):
   `npm trust github @billie-coop/hereabouts --file release.yml --repo billie-coop/hereabouts --allow-publish`.
   Then, under Settings → Publishing access, choose "Require two-factor authentication and
   disallow tokens", so only the workflow can publish.
4. Publish the placeholder: `cd placeholders/hereabouts && npm publish`.
5. Later releases: bump `packages/hereabouts/package.json` on `main`, run the Release workflow
   once as a dry run, then again with `dry-run` unticked. It publishes with provenance and
   creates the GitHub release and tag.

## Planned, not decided

- **`oss.billie.coop`**: a site listing the co-op's open source packages, with aliases such as
  `oss.billie.coop/hereabouts`. Where it's managed is undecided (maybe Linear, or the billie-coop
  monorepo).
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

## Not planned

- **Custom resource packs.** cldr-engine let users build packs with their own CLDR subset
  through the published compiler. Here the compiler is private and builds only the packs the
  package ships. Revisit if someone asks.
- **Native ES modules for Node.** Node loads the CommonJS build; bundlers get `dist/esm`. See
  [single-package-plan.md](single-package-plan.md).

## Data versions

- **tzdb is 2026f** (was 2025b in cldr-engine 1.16.0), brought over 2026-11-03 from
  `../cldr-engine` branch `tzdb-2026f` (`4ab7940c`): the two generated data files, the version in
  the tz tool, and that branch's tests. No existing test's expected values changed. The packs
  don't contain tz data.
- **CLDR is 48.2.0**, unchanged from 1.16.0.

## Release and docs workflows

- `.github/workflows/release.yml` publishes `packages/hereabouts` with npm trusted publishing
  (OIDC, no token), modelled on seaq's. Manual only (`workflow_dispatch`), dry run by default,
  must run from `main`, and refuses a version whose `v<version>` tag or npm version already
  exists.
- `.github/workflows/docs.yml` builds `apps/website` with base `/hereabouts/` and deploys it to
  GitHub Pages on pushes to `main` that touch the site or the library (or by hand).
- The old `release` / `prerelease` scripts (`pnpm publish -r`, one package each) are removed.
- The workflows use action versions that run on Node 24 (`checkout@v6`, `setup-node@v6`,
  `cache@v5`, `configure-pages@v6`, `upload-pages-artifact@v5`, `deploy-pages@v5`); the earlier
  ones ran on Node 20, which GitHub has deprecated.

## Dependency pins

cldr-engine held some compiler dependencies below their latest major (notes from its removed
`scripts/upgrade-deps` and `scripts/set-version`): `chalk` 4 (5 is ESM-only), `minimatch` 7
(9 uses private class fields, which the ES5 target rejects, and changed its API), `yargs` 17
(18 has breaking changes) and `node-fetch` 2. Check these before upgrading.

## Found along the way, not fixed

- **`LanguageTagField` is a getter in the CommonJS build** (compiled enums reassign their
  variable, so rollup keeps a live binding). Harmless; noted in the export test.

## Left over from cldr-engine

- The cldr-engine documentation site (`phensley.github.io/cldr-engine`) describes the 1.x API.
  hereabouts needs its own API docs; a migration guide from `@phensley/cldr` 1.x is a separate
  task.
- Done: `author` is "Billie Co-op" with Patrick Hensley under `contributors` in every manifest;
  the API Extractor warning that put the checkout path in `cldr.api.md` is fixed
  (`ExceptionIndex` is tagged `@public`).
