# Task: port core general formatting to Zig

A new area (no previous agent). Read `codex-handoff.md`, `porting-brief.md` and `core-brief.md`
first, then the foundation's handoff note `handoff-core-foundation.md`: it describes the
foundation API you build on (loading locales, reading schema fields, number formatting helpers).

## Scope

In `packages/hereabouts/src/core/`: `internals/general/` (list patterns, display names for
languages, scripts, regions and currencies, context transforms, measurement systems, character
order, layout), `common/general.ts`, `api/general.ts`, `api/api.ts`, and `cldr.ts` (the
convenience object: `framework.get('en').Numbers.formatDecimal(...)`; design an idiomatic Zig
equivalent, for example a struct wrapping the locale data with methods, and explain it in your
report). Also `api/private/` pieces not already ported.

- Zig: `zig/src/core/internals/general/` (the foundation agent created `internal.zig` there for
  what numbers needed; extend it rather than duplicating), `zig/src/core/api/`, and a file for
  the convenience object. Add your exports to `zig/src/core/core.zig` in one marked block.
- Suite `core-general`: `packages/hereabouts/scripts/conformance/core-general.ts`,
  `zig/test/core_general.zig`, `zig build test-core-general`. Tests to mine:
  `packages/hereabouts/__tests__/core/api/general/`, `__tests__/core/internals/general/`,
  `__tests__/core/cldr.test.ts`, `__tests__/core/custom/names.test.ts`.
- The convenience object also exposes calendar and date functions, which other workers are
  porting at the same time (`t5s m3-hereabouts-cal (M3)`: calendar systems; a date formatting
  worker). Port the parts that exist; for the rest, wire them in once those land, or list what's
  missing in your report.

Final report: `notes/zig-port/report-core-general.md`.
