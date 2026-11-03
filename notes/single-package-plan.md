# Plan: one package, `@billie-coop/hereabouts`

Status: plan only, nothing implemented. Written 2026-11-03 against commit `5bcc706`. The
decisions in the first section need Stephen's approval before work starts.

## Decisions needed

1. **Layout.** Merge the library packages' sources into one package (recommended, below), or
   keep the workspace packages and assemble a single package at publish time. Assembling keeps
   today's layout, but the published files would still be built from 13 packages that import
   each other by name, and keeping one copy of each module gets harder (see "CommonJS bundles").
2. **Subpath names.** Proposed: `/decimal`, `/datetime`, `/timezone`, `/plurals`,
   `/messageformat`, `/language-tag`, `/locale`, `/locale-matcher`, `/unit-converter`. Shorter
   names (`/messages`, `/units`, `/tags`) are possible; these keep the current package names.
3. **Root export.** Proposed: exactly what `@phensley/cldr` exports today, so moving an app is
   a change of import path. Alternatively also export the timezone functions (`setTimeZoneData`,
   `tz*`) and the unit converter from the root (no name clashes; free for ES module bundles,
   adds to the CommonJS root bundle).
4. **`cldr-compiler`.** Keep it a private workspace tool (recommended unless custom packs are
   a supported use), or publish it as `@billie-coop/hereabouts-compiler`, version-locked to the
   library.
5. **Resource packs.** Ship them in the package, as `@phensley/cldr` does today (recommended),
   or in a separate package.
6. **UMD bundle** (`dist/cldrengine.umd.js`, a `<script>` build): keep as
   `dist/hereabouts.umd.js` with global `hereabouts`, or drop.
7. **Node ES modules.** Ship CommonJS for Node and ES modules for bundlers first (recommended),
   or build Node-loadable ES modules now (see "Export map").

## Today

15 workspace packages. 13 are runtime libraries, each built three ways: tsc CommonJS per module
(`lib/`, with `.d.ts`), tsc ES modules per module (`lib-es/`), and a rollup CommonJS bundle that
replaces `lib/index.js` (other packages external). Each has an API Extractor report
(`packages/*/etc/*.api.md`). `@phensley/cldr` also builds the resource packs (with
`cldr-compiler`) and a UMD bundle.

`@phensley/cldr` re-exports `@phensley/cldr-core`, which re-exports datetime, decimal,
language-tag, locale, locale-matcher, messageformat and plurals, plus some `cldr-types` types and
the timezone `ZoneInfo` type. It overrides `createFramework` / `cldrFramework` with versions
that default to the config its packs were built with. Not reachable from it: the timezone
functions, unit-converter, cldr-utils, cldr-ext-rbnf, cldr-compiler.

Source files import other packages by name 187 times (61 files in cldr-core, 27 in
cldr-compiler, the rest a handful each). Deep imports into another package's `lib/`: the
compiler (cldr-core's `internals/schema`, `resource/checksum`, `utils/version`; cldr-ext-rbnf's
`rbnftypes`), one stress script and one test.

## Proposed layout

```
packages/hereabouts/          the published package
  package.json                name, version, exports
  src/index.ts                root entry (today's packages/cldr/src)
  src/core/                   today's cldr-core (not a public subpath; it is the root)
  src/decimal/ src/datetime/ src/timezone/ src/plurals/ src/messageformat/
  src/language-tag/ src/locale/ src/locale-matcher/ src/unit-converter/
  src/types/ src/utils/       today's cldr-types and cldr-utils (internal)
  __tests__/<entry>/          tests, moved with their sources
  etc/                        API Extractor configs and reports, one per entry
  packs/                      resource packs (build output)
packages/cldr-compiler/       build-time CLI, takes cldr-ext-rbnf (its only user)
apps/website/
```

Moves are `git mv`, so `git log --follow` and blame keep working (this repo's history starts at
the import anyway).

## Export map

```json
{
  "name": "@billie-coop/hereabouts",
  "sideEffects": false,
  "main": "./cjs/index.js",
  "module": "./esm/index.js",
  "types": "./types/index.d.ts",
  "exports": {
    ".": {
      "types": "./types/index.d.ts",
      "module": "./esm/index.js",
      "default": "./cjs/index.js"
    },
    "./decimal": {
      "types": "./types/decimal/index.d.ts",
      "module": "./esm/decimal/index.js",
      "default": "./cjs/decimal.js"
    },
    "...": "one entry like ./decimal per subpath",
    "./packs/*": "./packs/*",
    "./package.json": "./package.json"
  },
  "typesVersions": { "*": { "*": ["./types/*/index.d.ts"] } }
}
```

- **No `import` condition yet.** The ES module build is tsc output with extensionless relative
  imports and no `"type": "module"`, so Node can't load it (checked: `import()` of
  `packages/decimal/lib-es/index.js` fails with `ERR_MODULE_NOT_FOUND`). Today only bundlers
  read it, through the `module` field. The `module` condition does the same in an export map
  (Vite, Rollup's node-resolve and webpack use it; esbuild needs checking). Node gets CommonJS
  for both `require` and `import`; named imports from the CommonJS bundles work because rollup
  writes plain `exports.x = x`. A Node-loadable ES module build (TypeScript's
  `rewriteRelativeImportExtensions` or `.mjs` output) can add an `import` condition later.
- **`typesVersions`** lets TypeScript find subpath types with `moduleResolution: "node"`, which
  ignores `exports`. This repo's own tsconfig uses it, and so do many apps.
- **Deep imports are closed.** With an export map, `@billie-coop/hereabouts/lib/...` can't be
  imported. That is intended for users; the compiler needs another way in (below).
- Output folders: `types/`, `esm/`, `cjs/` instead of `lib/` + `lib-es/`, because the CommonJS
  bundles and tsc's per-module CommonJS can no longer share `lib/`. Names are open.

## Root export

The root is today's `packages/cldr/src/index.ts`: everything cldr-core exports (so also
datetime, decimal, language-tag, locale, locale-matcher, messageformat and plurals),
`createFramework` / `cldrFramework` with the bundled config, and `config`. A function reachable
from both the root and a subpath is the same function: in the ES module build both point at the
same file, and in CommonJS see the next section.

Name clashes if every subpath were also merged into the root: only `binarySearch`, exported by
both cldr-utils and cldr-ext-rbnf, neither of which becomes public. The 1.x convenience layer
(`cldrFramework(...).get('en').Numbers...`) stays in the root.

## Internal imports

- The 187 `from '@phensley/<pkg>'` imports in sources become relative (`'../decimal'`), done with
  a codemod and checked by tsc. They can point at an entry's `index.ts` or straight at the
  defining module; the CommonJS getter cost that made the port point at defining modules is gone
  once everything is bundled together.
- `VERSION` comes from `cldr-core/src/utils/pkginfo.json`, a symlink to cldr-core's
  `package.json`. Point it at `packages/hereabouts/package.json`. It feeds `cldrVersion()`, the
  version string in each pack, and the pack checksum (`major.minor`), so the packs and the
  library must always come from the same build.
- tsconfig `paths` (`@phensley/*` → `packages/*`) are replaced by
  `@billie-coop/hereabouts/*` → `packages/hereabouts/src/*` for tests, benchmarks, the
  compiler and the website's type checks.

## Builds

- **tsc:** one project instead of 13, emitting `types/` (declarations), `esm/` (ES modules per
  file) and the input for the CommonJS bundles. Same compiler options (ES5 target, tslib
  helpers).
- **CommonJS bundles.** Today each package's `lib/index.js` bundles that package and leaves the
  others external, so every module exists once. Bundling each subpath separately inside one
  package would inline shared modules into every entry: `setTimeZoneData` from `/timezone` would
  change a different copy of the tz data than the one the root's `formatDate` reads, and every
  cache would exist twice. Instead run rollup once with every entry as an input (`output.dir`):
  rollup puts shared modules into shared chunks, so each module exists once. Keep the current
  output options (`externalLiveBindings: false`, ES5 generated code, source maps chained to the
  TypeScript sources). Check: the port's identity test (`cldr.decimalAdd === decimal.decimalAdd`
  over 1132 names) becomes root vs subpath.
- **Tree-shaking** is unaffected: the ES module build stays one file per module and the package
  is `sideEffects: false`. Check with `examples/tree-shaking` (its resolver maps `@phensley/<name>`
  to `packages/<name>`; it needs to map subpaths instead). Expected: the same sizes (numbers for
  one locale 41.8 KB min+gzip, decimal alone 2.7 KB) and the side-effects probe still ~30 bytes.
- **UMD**, if kept: the same rollup config with the new input and name.
- **Packs:** `cldr-compiler pack -o packages/hereabouts/packs` as part of the package build.
  Same files and format; 101 languages, 16 MB of JSON (2.8 MB as `.json.gz`). Today the package
  publishes the `.json` files, `resource.json` and `sha*.txt`; keep that `files` list.

## API Extractor

API Extractor (7.58 here) reads one entry point per config, so there is one config and one
report per subpath: `etc/hereabouts.api.md`, `etc/hereabouts-decimal.api.md`, and so on, run by
`yarn api` as today.

The reports change shape once. Types used in a subpath's signatures but defined in another
subpath (`Decimal` in plurals and messageformat, `LanguageTag` in locale) are now local symbols
instead of another package's exports, so API Extractor reports them as `ae-forgotten-export`
unless that entry also exports the type. Recommended: re-export those types from the entries
that use them (type-only, no runtime cost). Review that diff for accidental API changes, since
the reports are the main record of the public API. Also fix the existing warning that puts the
checkout's absolute path in `cldr.api.md` (public `PackScript.cache` uses the internal
`ExceptionIndex`).

## cldr-compiler

A CLI that downloads CLDR JSON and writes resource packs. It has heavy dependencies (prettier,
node-fetch, tar, yargs, yaml, partial.lenses, ...) that must not become dependencies of the
library, and it uses library internals: `buildSchema`, `checksumIndices`, `VERSION` and the
rbnf types. cldr-ext-rbnf's public index exports only `binarySearch`; its code is used by the
compiler, so it moves into the compiler.

- **Private tool (recommended for now):** the compiler stays in the workspace, imports the
  library's sources through tsconfig paths, and is only used by the build. Users get the
  prebuilt packs.
- **Published:** needed only if users should build custom packs (a subset config, patches like
  `packages/cldr/example-patch.yaml`), which 1.x supported. It would bundle the internals it
  uses (a CLI having its own copy is fine: packs are just files), and must have the same
  `major.minor` as the library or its packs fail the checksum.

## Tests, website and examples

- **Tests** (191 files) move with their sources. Relative imports into `../src` change depth;
  the 47 files that import other packages by name import the subpaths instead, resolved to
  `src/` by a vitest alias and tsconfig paths. Today those resolve to built output through
  `node_modules`, so this also lets the tests run without a build. Exceptions that should keep
  loading the build: `packages/cldr/__benchmarks__/cjs.bench.ts` and the pack-building helper
  (`cldr-core/__tests__/_helpers/bundle.ts`, which runs the compiler).
- **Website:** `@phensley/cldr` → `@billie-coop/hereabouts`, `@phensley/unit-converter` →
  `@billie-coop/hereabouts/unit-converter`; the pack glob points at `packages/hereabouts/packs`.
  Vite resolves the `module` condition, so it keeps getting ES modules.
- **Examples:** `examples/date-fns-migration` imports `@phensley/datetime`;
  `examples/tree-shaking` needs its resolver changed (above). Benchmarks and stress scripts import
  by package name too.
- **Docs:** the root README, package READMEs (merged into one README or a docs site),
  CHANGELOG.

## Steps

Each step keeps `yarn build`, `yarn lint`, `yarn test` and `yarn api` passing, one commit each.

1. Create `packages/hereabouts` with the root entry (today's `packages/cldr`), package.json
   with the export map, build scripts and the multi-entry rollup config; other packages still
   separate and imported by name.
2. Move the leaf packages in (decimal, cldr-utils, cldr-types, language-tag, timezone, then
   plurals, locale, datetime, locale-matcher, messageformat, unit-converter, then cldr-core),
   rewriting their imports to relative ones. Move tests with them.
3. Move cldr-ext-rbnf into the compiler and point the compiler at the library sources.
4. Switch the website, examples, benchmarks and stress scripts to the new names.
5. One API Extractor config per entry; review the report diff.
6. Check: tree-shaking sizes, the root-vs-subpath identity test, a packed tarball installed in
   a scratch app (Node `require` and `import`, Vite, webpack, esbuild, TypeScript with
   `moduleResolution` `node`, `node16` and `bundler`), packs byte-identical apart from the
   version string and checksum if the version changed.
7. Remove the old package folders, `release` / `prerelease`, and the per-package READMEs.

## Risks

- **Two copies of a module in CommonJS** if the entries are bundled one by one. Avoided by the
  single multi-entry rollup run; checked by the identity test.
- **Bundlers that don't read the `module` condition** fall back to CommonJS: everything works,
  but nothing is tree-shaken. Check each bundler in step 6.
- **API surface drift.** The move touches every import; the API Extractor reports change shape
  in the same step, so accidental additions or removals are easy to miss. Review them per entry.
- **Version coupling.** Packs, library and compiler must share `major.minor`. A single package
  makes the library and packs one unit; a published compiler would need its version pinned.
- **Install size.** Everyone downloads the packs (16 MB unpacked), as with `@phensley/cldr`
  today; someone who only wants decimal math used to install `@phensley/decimal` alone. Bundle
  size is unaffected.
- **Merging later fixes from cldr-engine** (anything from upstream) gets harder once paths
  move. (tzdb 2026f was brought over first, before the move.)
