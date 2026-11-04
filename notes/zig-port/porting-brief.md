# Brief: porting a hereabouts module to Zig

Instructions for the agents (Claude or Codex) porting hereabouts to Zig on the `zig-port`
branch.

## Context

hereabouts (`/Users/steve/Dev/github.com/billie-coop/hereabouts`, branch `zig-port`) is a
TypeScript i18n library built on Unicode CLDR data: exact decimals, number/currency/date
formatting, time zones, plurals, ICU messages, locale matching, unit conversion. The owner wants
the whole library usable from Zig, as a full port with no dependencies beyond Zig's standard
library (Zig 0.16.0 is installed). The port lives in `zig/`.

The TypeScript in `packages/hereabouts/src` is the reference. Port behavior exactly, quirks
included. Do not change the TypeScript source. If you find what looks like a TypeScript bug,
mirror it in Zig and report it in your final message; the owner decides on fixes.

Shared test cases keep the two in sync: a TypeScript generator runs the real TypeScript functions
over many inputs and records the results as JSON in `conformance/<name>.json`; the Zig tests run
every case. `yarn test` fails if a JSON file goes stale.

## Read first: finished ports are the style guide

- `zig/src/decimal/` (`decimal.zig`, `math.zig`, `format.zig`, `rational.zig`) and
  `zig/test/decimal.zig` (how a suite reads cases and reports failures)
- `packages/hereabouts/scripts/conformance/decimal.ts` and `_shared.ts` (case generator)
- Also finished: `plurals`, `messageformat`, `language_tag`, `locale`, `locale_matcher`,
  `unit_converter`, `timezone`, `datetime` (see their root files for APIs)
- `zig/README.md`

Conventions:

- Functions that allocate take `gpa: std.mem.Allocator` first; the caller owns results (provide
  `deinit`/free helpers). Temporaries inside a function go in an `ArenaAllocator` freed before
  returning. Static constants are never freed.
- Names drop a prefix the namespace already says: `decimalAdd` -> `decimal.add`. Otherwise keep
  TypeScript names (camelCase functions) so the mapping stays obvious.
- TypeScript string-union types become Zig enums (with `fromString` where the cases need it).
  Optional arguments become explicit parameters or an options struct with defaults. Thrown
  errors become Zig error sets.
- Keep comments short and plain. Port the TypeScript comments that explain why.
- Put helper code your module needs (e.g. bits of `src/utils`) inside your own module directory.

Zig 0.16 notes: `std.ArrayList(T)` is unmanaged (`var l: std.ArrayList(T) = .empty;
try l.append(gpa, x); l.deinit(gpa);`). `@import` paths must stay inside `zig/src/` (use
`@import("../decimal/decimal.zig")` for another module). Unused parameters and locals are compile
errors. When unsure of an API, read the std source in
`/Users/steve/.local/share/mise/installs/zig/0.16.0/lib/std`. Inline `test` blocks in `zig/src`
don't run under the suites (the suite's root module is `zig/test/<m>.zig`); put the tests that
matter in the suite.

## What already exists

- `zig/src/<m>/<m>.zig`: module root. `zig/src/hereabouts.zig` exports it, e.g.
  `hereabouts.language_tag`, `hereabouts.core`.
- `zig/test/<m>.zig`: the suite. It gets `@import("hereabouts")`, `@import("cases").json` (the
  bytes of `conformance/<name>.json`) and `@import("packs")` (see `core-brief.md`).
- `conformance/<name>.json`: written by your generator.
- `zig build test-<name>` (run in `zig/`) builds and runs a suite. Names use dashes
  (`test-core-numbers`); Zig files use underscores (`core_numbers`).

## What you write

1. **Zig source** in `zig/src/<m>/`.
2. **Generated data**, if your area has `autogen.*.ts` / `*.generated.ts` tables: a generator
   `packages/hereabouts/scripts/zig/<name>.ts` exporting `files(): ZigFile[]` (helpers in
   `scripts/zig/_emit.ts`) that imports the TypeScript tables and writes Zig source under
   `zig/src/`. Run `yarn zig-data <name>`. Never hand-copy data: the TypeScript tables stay the
   single source.
3. **Case generator** `packages/hereabouts/scripts/conformance/<name>.ts` exporting
   `cases(): ConformanceCase[]` (use `collector()` and `random()` from `_shared.ts`). Run
   `yarn conformance <name>`. Cover every public function: fixed edge cases (take inputs from the
   TypeScript unit tests in `packages/hereabouts/__tests__/`, including data files there) plus
   seeded random inputs. Results must be plain JSON. Keep each JSON file under about 1.5 MB.
4. **Zig suite** `zig/test/<m>.zig`: a test running every case (print the first ~25 failures with
   enough detail to debug), and a test calling the main public functions with
   `std.testing.allocator` to catch leaks.

Then check the tests themselves: deliberately break a few important branches in your Zig code,
confirm cases fail, add targeted cases where they don't, and restore the code.

## Rules (other agents work in this checkout at the same time)

- Only create or edit files for your own area. Do not edit shared files: `zig/build.zig`,
  `zig/src/hereabouts.zig`, `package.json`, `biome.json`, `.gitignore`, `CHANGELOG.md`, READMEs,
  `notes/`, or other areas' files (`zig/src/core/core.zig` has its own rule in `core-brief.md`).
  If you need a shared change, ask the supervisor.
- No state-changing git commands (no commit, add, stash, checkout, reset, restore, pull). `git
  status`, `git diff` and `git log` are fine. The supervisor commits.
- Always pass your name to `yarn conformance <name>` and `yarn zig-data <name>`; without it they
  rewrite other agents' files.
- Repo-wide checks can fail because of another agent's unfinished files; tell those apart from
  your own failures.

## Done means

- Every public function in your scope is ported, and all cases pass (`zig build test-<name>`).
- `npx biome check --write` on your TypeScript files is clean, `yarn ts-check` passes (or fails
  only in other agents' files), and `npx vitest --run packages/hereabouts/__tests__/conformance`
  passes for your files.

## Final report

Compact: the Zig API (one line per public function or group), deviations from the TypeScript and
why, TypeScript bugs or quirks found, case counts, results of the deliberate-break checks,
anything left undone, and any shared-file changes you need.
