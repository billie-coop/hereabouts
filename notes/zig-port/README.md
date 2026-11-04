# Zig port: working notes

The Zig port in `zig/` (branch `zig-port`, started 2026-11-04) covers the whole TypeScript
library. Each module was ported by an agent (Claude, then Codex workers in herdr panes for the
last parts of `core`), supervised and committed from one Claude Code session.

How it stays correct: for each module, a generator in `packages/hereabouts/scripts/conformance/`
runs the real TypeScript functions over fixed inputs (mostly taken from the unit tests and their
data files) plus seeded random ones and records the results in `conformance/<name>.json`; the Zig
suite runs every case. About 107,000 cases in 14 files. Data tables are generated from the
TypeScript (`packages/hereabouts/scripts/zig/`), never copied by hand. Each agent also broke its
own code on purpose to check that the cases catch real mistakes.

## Files here

- `porting-brief.md`, `core-brief.md`, `codex-handoff.md`, `task-*.md`: the instructions the
  agents worked from.
- `handoff-*.md`, `report-*.md`: what each agent did, its Zig API, deviations from the
  TypeScript, and the TypeScript quirks it reproduced. Read these before changing a module.

## TypeScript bugs and quirks found

The port reproduces all of these on purpose (except where noted), so fixing one means fixing it
in both languages and regenerating the cases. Fixed so far: `decimal('1-2')` parsed as -12.

Likely bugs, worth fixing:

- **Grandfathered tags with capitals never match** (`language-tag`): the lookup lowercases the
  input but not the keys, so `en-GB-oed`, `sgn-BE-FR`, `sgn-BE-NL`, `sgn-CH-DE` never match.
- **Undefined subtags only recognised in exact case** (`language-tag`): `UND`, `en-zz`,
  `en-zzzz` give a defined `und`/`ZZ`/`Zzzz`.
- **Extension keys aren't case-folded** (`language-tag`): `en-U-ca-gregory` stores key `U`.
- **Subdivision flags lost after another keyword** (`locale`): in `en-u-ca-gregory-sd-gbsct` the
  `sd` is folded into the `ca` value, so `localeFlag` misses the subdivision.
- **`subdivisionFlag` matches substrings** (`locale`): `'gbeng gbsct'` returns a broken flag.
- **Leading or trailing separators make an empty locale id** (`locale-matcher`):
  `createLocaleMatcher(' en')` adds an entry with id `''` that becomes the default.
- **Object.prototype names leak through plain-object lookups**:
  - `messageformat`: placeholders `{toString}`, `{constructor}`, ... are never missing (print
    `''`, plurals give NaN); `translate(t, 'constructor', ...)` returns "Object".
  - `plurals`: `getPluralRules('constructor')` returns a function, then throws. (Zig treats it
    as an unknown language; not mirrored.)
  - `unit-converter`: an empty converter "has" a `toString` category; a unit named
    `constructor` is unreachable; `__proto__` corrupts the graph. (Not mirrored.)
- **Argument regex `0[1..9]+`** (`messageformat`): means the characters `1 . 9`, so `{012}` is
  argument 1 and `{0abc}` is argument 0.
- **A unit named `""` breaks path finding** (`unit-converter`): conversions return the wrong
  path and factors.
- **`/` counts as a symbol for currency spacing** (`core` numbers): `RE_SYMBOL` interpolates
  regexps without `.source`.
- **An unterminated quote in a number pattern appends the text "undefined"** (`core` numbers);
  currency spacing next to a missing character tests the string "undefined".
- **Wrapper patterns read `Number(ch)`** (`core` general): whitespace inside braces becomes
  argument 0.

Odd but harmless, or debatable:

- `regionFlag` uses full Unicode upper-casing: `'ß'` gives 🇸🇸, `'ﬁ'` gives 🇫🇮.
- An extlang alias that canonicalizes to an undefined region drops the region (`en-zzz`).
- Same-unit conversions succeed even for units or categories that don't exist.
- Unknown plural languages get no rules (always `other`): there is no `root` entry.
- `formatDate` with no options uses `full`; with an empty options object, `long`.
- `messageArgNames`/`checkCatalogs` compare placeholder lists joined with commas.
- String padding and capitalization count UTF-16 units (astral digits count twice; `ß` -> `SS`).
- Pack JSON has duplicate keys in some `regions` objects (the last one wins, as with
  `JSON.parse`).

Each module's report has the full list, with case counts and examples.

## Not done

- Custom schema configs: Zig supports only the shipped config the packs are built with.
- The timezone/datetime agent left 12 of its deliberate-break checks unconfirmed (listed in
  `handoff-timezone-datetime.md`); the cases for them exist.
- Not published: no Zig package release yet.
