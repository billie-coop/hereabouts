# Handoff: core foundation + numbers/currencies + units (Zig port)

Briefs: `PORTING-BRIEF.md` and `CORE-BRIEF.md` in this scratchpad dir. Repo:
`/Users/steve/Dev/github.com/billie-coop/hereabouts`, branch `zig-port`. Nothing committed by me.

## State at handoff (verified)

- `cd zig && zig build test-core-numbers` -> 3/3 tests pass; **8998 cases, 0 failures, 28 skipped**
  (skipped = cases with `style: 'bogus'`, which the Zig enum can't express; TS returns '').
- `cd zig && zig build test-core-units` -> 3/3 pass; **3581 cases, 0 failures**.
- Both suites have a "no leaks" test using `std.testing.allocator`.
- Generated files are fresh: `yarn zig-data core-schema`, `yarn zig-data core-data`,
  `yarn conformance core-numbers`, `yarn conformance core-units` (run from repo root).
- A deliberate-break run was interrupted (script:
  `scratchpad/mutate.py`, 13 mutations). I stopped it and **verified every file is restored**
  (one file, context.zig, had to be restored by hand; suites pass again). Known from partial
  runs: breaking trim-zero-fractions is caught. The rest of the mutation results were lost
  (python stdout was buffered) — rerun `python3 -u scratchpad/mutate.py` from `zig/` (takes a
  few minutes; it restores each file in `finally`, so don't kill it mid-run).

## Files (all mine, all complete — no half-written functions)

Generators (TS):
- `packages/hereabouts/scripts/zig/core-schema.ts` -> `zig/src/core/schema/autogen.schema.zig`
  (runs TS `buildOrigin(config)` + `buildSchema`; emits key indices with a byte-sorted
  permutation, the whole accessor tree as a `Schema` literal, `checksum` ("587ba535"),
  `version` ("0.1.1"), `index_names`, `index(name)`). Output is zig-fmt clean.
- `packages/hereabouts/scripts/zig/core-data.ts` -> `core/locale/autogen.locales.zig`,
  `core/systems/numbering/autogen.names.zig` (10 digits per system, expanded like `makeDigits`),
  `core/internals/numbers/autogen.currencies.zig` (fractions + region currencies),
  `core/internals/numbers/autogen.spacing.zig` (BMP code-unit ranges matched by `RE_DIGIT` /
  `RE_SYMBOL`), `core/utils/autogen.upper.zig` (JS `toUpperCase` per BMP code point).
- `packages/hereabouts/scripts/conformance/_core.ts` (shared: TS framework over shipped packs +
  config, `load(id)`, `LOCALES` list, `PACK_LANGUAGES`) — other core agents can reuse it.
- `packages/hereabouts/scripts/conformance/core-numbers.ts` (foundation + numbers cases; JSON
  is ~1.59 MB, slightly over the ~1.5 MB guideline — trim random counts (1300 -> 1200) if needed).
- `packages/hereabouts/scripts/conformance/core-units.ts` (~0.69 MB).

Zig (`zig/src/core/`):
- `core.zig` — my block (foundation, numbers, units, internals) + a `test {}` block importing
  files with inline tests. Other agents add their own blocks.
- `schema/instructions.zig` (KeyIndex), `schema/schema/arrows.zig` (FieldArrow, VectorArrow,
  DigitsArrow, ScopeArrow + TS-named free functions), `types/schema.zig` (hand-written
  Schema types mirroring `src/types/schema.ts`, TS field names), `schema/autogen.schema.zig`.
- `resource/bundle.zig`, `resource/pack.zig`, `resource/checksum.zig`.
- `framework.zig`, `locale_data.zig`, `locale/locale.zig` (+autogen).
- `types/general.zig` (ContextType, ListPatternType), `types/numbers.zig`.
- `common/private.zig` (NumberSymbols, CurrencySpacing, NumberingSystem, NumberParams),
  `common/numbers.zig` (option structs, enums, CurrencyFractions), `common/units.zig`.
- `parsing/number.zig`, `parsing/wrapper.zig`.
- `systems/numbering/decimal.zig` (digitsOf, formatString, formatInt, fastFormatDecimal,
  INTERNAL_NUMBERING).
- `utils/render.zig` (Value builder, joinParts, copyParts), `utils/case.zig` (titleFirst).
- `internals/numbers/{context,util,render,internal}.zig`, `internals/general/internal.zig`
  (parseWrapper, contextTransform, formatListValue, formatWrapper), `internals/units/internal.zig`.
- `api/private/numbers.zig` (getNumberParams), `api/numbers.zig`, `api/units.zig`.
- Tests: `zig/test/core_numbers.zig`, `zig/test/core_units.zig`.

## What's left in scope (in order)

1. Rerun the deliberate-break script (`python3 -u`) and record results; add targeted cases for
   any mutation not caught.
2. `npx biome check --write` on my 5 TS files (core-schema.ts, core-data.ts, _core.ts,
   core-numbers.ts, core-units.ts) — not run yet; core-data.ts has long import lines and
   `_core.ts` has a hand-formatted array biome will reflow. Re-run `yarn zig-data core-data` /
   `yarn conformance ...` after formatting only if output changes (it shouldn't).
3. `yarn ts-check` and `npx vitest --run packages/hereabouts/__tests__/conformance` — not run yet.
4. Optional: trim core-numbers.json under 1.5 MB.
5. Final report (brief format) incl. "Foundation API for other core agents".
Not ported (by decision): `cldr.ts` convenience binding layer (bindNumbers etc.) — out of my
listed scope; custom schema configs (only the shipped config); pack `spellout` (unused by TS).

## Design decisions

- **Schema**: generated, not built at runtime. `core.schema.schema` is a comptime `Schema`
  value; field access is constant offsets. Key lookups by string use binary search over a
  generated sorted permutation (repeated keys keep the last index, like TS objects).
  `LocaleData.schema` points at it; `LocaleData.indices` is `schema.index` (name -> KeyIndex).
- **Arrows**: `field.get(&bundle)`, `vector.get(&bundle, &.{k1, k2})` (plain keys),
  `vector.getAlt(&bundle, &.{ &.{alt, "none"}, &.{code} })` (TS fallback-array semantics,
  including its quirk: an unknown *last* alternative aborts), `vector.getIndex(&bundle, &.{i,j})`,
  `vector.exists`, `vector.valid`, `vector.mapping(arena, &bundle)` -> `std.json.Value`
  (omits empty strings, like vectorMapping), `digits.get(&bundle, key, digits_f64)`,
  `scope.get(name) ?*const T`.
- **Framework/loader**: `var fw = core.Framework.init(gpa, .{ .loader = .{ .load = fn } })`;
  `load(ctx, language) ?[]const u8` returns borrowed JSON bytes (optional `free` callback);
  pack text is copied. `fw.loadLocale(.{ .id = "de-CH" })` -> `*const LocaleData`;
  `.{ .locale = l }` also accepted. Errors: NoLoader, PackNotFound, ChecksumMismatch,
  InvalidPack, OutOfMemory. **Deviation**: no LRU — packs (by language) and locale data (by
  "id\0compactTag") are kept until `fw.deinit()`, because locale data borrows pack strings and
  callers hold pointers; same locale -> same pointer. (An earlier LRU+retire design churned
  memory: 545 MB in tests; now 121 MB.) `fw.info(gpa)` -> "packs loaded: N".
- **LocaleData**: `{ gpa, bundle: Bundle, locale: Locale, schema, indices, caches }`. Functions
  take `*const LocaleData`. Per-locale derived values via
  `data.cached(T, "area.key", ctx, buildFn)` (arena-owned, lives until deinit) — this is the
  extension point for calendar/date agents. Standalone use: `LocaleData.initDefault(gpa,
  locale, bundle)` (takes ownership), `deinit()`.
- **Bundle**: `bundle.get(offset)` honours the region exception index; fields snake_case
  (`language_region`, `number_system`, `calendar_system`, ...), `plurals` = PluralRules.
- **Memory**: public format functions take `gpa` first, return owned `[]u8` / `[]Part` (free
  parts with `decimal.freeParts`); internally everything goes in an arena. Internal helpers
  (`decimalParts`, `currencyParts`, `quantityParts`, `renderDecimal`, `formatListValue`, the
  `NumberRenderer`) allocate in a caller arena and never free.
- **Rendering**: always builds parts; string = parts joined (`utils/render.zig`). Equivalent
  for number rendering (checked by cases); note TS string builder's `get/insert/length` count
  characters — date agents should keep that in mind.
- **Options**: snake_case structs, `?T` for "undefined"; enums for styles
  (`DecimalFormatStyle`, `CurrencyFormatStyle`, `CurrencySymbolWidth`, `UnitLength`,
  `ContextType`). Currency codes, unit ids, number system names stay `[]const u8`.
- **Number params**: `core.getNumberParams(data, ?nu, ?default)` -> `*const NumberParams`
  (symbols, digits, grouping, currency spacing, `system: NumberingSystem`). For date
  formatting: `core.numbering.formatInt(gpa, params.system, n, group, minInt)` /
  `formatString` (Decimal) mirror `numberingFormatString`.

## TypeScript quirks found (mirrored)

- `RE_SYMBOL` interpolates `SPACE_SEPARATOR` etc. without `.source`, so `/` counts as a symbol
  for currency spacing (generated table includes 0x2f).
- `parseNumberPattern`: an unterminated quote appends the literal text "undefined".
- `parseWrapperPattern`: `Number(ch)` inside braces — whitespace becomes arg 0, other chars NaN
  (fill nothing); quotes are dropped entirely.
- `digitsGet` with a fractional digit count: the offset `(digits-1)*2` can still be whole
  (2.5 reads divisor of 2 + pattern of 3). Zig computes the offset in f64 like TS.
- `fastFormatDecimal` pads using JS string length (UTF-16 units): astral digits (mathbold)
  count twice.
- `contextTransform` upper-cases only the first UTF-16 unit (astral first chars unchanged;
  ß -> SS).
- Currency spacing on a missing character tests the string "undefined" (non-symbol letter).
- Pack JSON has duplicate keys in some `regions` objects: parse with `use_last` like JSON.parse.
- `loadLocale` ids like 'und' resolve to en-Latn-US via `resolveLanguageTag` (framework uses
  resolveLanguageTag, not locale.resolveLocaleId).

## Traps

- Zig 0.16 `std.json.ObjectMap` is unmanaged: `.empty`, `put(gpa, k, v)`.
- `std.debug.print` in a passing test makes `zig build test-*` report failure (stderr in
  --listen mode) — don't leave prints in tests.
- Inline `test {}` blocks in `hereabouts` module files don't run from the suites (separate
  module); `refAllDecls` is there per the brief.
- `data.cached(...)` context type must match the build fn's first param exactly (cast string
  literals with `@as([]const u8, "latn")`).
- Background mutation script: don't kill mid-run (leaves a file mutated); use `python3 -u`.

## Commands

```sh
# from repo root
yarn zig-data core-schema && yarn zig-data core-data
yarn conformance core-numbers && yarn conformance core-units
cd zig && zig build test-core-numbers test-core-units --summary all
npx biome check --write packages/hereabouts/scripts/zig/core-*.ts packages/hereabouts/scripts/conformance/_core.ts packages/hereabouts/scripts/conformance/core-*.ts
yarn ts-check
npx vitest --run packages/hereabouts/__tests__/conformance
```

Shared-file changes needed: none.
