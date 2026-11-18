# Brief addendum: porting `core`

Read `porting-brief.md` first; everything there applies. This adds what is specific to
`packages/hereabouts/src/core` (about 14,500 lines), which several agents port in parts.

## Layout

- Zig code goes under `zig/src/core/`, mirroring the TypeScript directories
  (`zig/src/core/resource/`, `zig/src/core/systems/calendars/`, `zig/src/core/internals/numbers/`,
  ...). The root `zig/src/core/core.zig` is exported as `hereabouts.core`; it is shared, so each
  agent adds its own public exports to it in one clearly marked block for its area. Keep edits
  to `core.zig` minimal and re-read it right before editing, since another agent may have
  changed it.
- Ported modules you can import: `../decimal/`, `../timezone/`, `../datetime/`, `../plurals/`,
  `../messageformat/`, `../language_tag/`, `../locale/`, `../locale_matcher/`,
  `../unit_converter/` (check each module's root file for its API).
- The `src/types` TypeScript module (type definitions plus `autogen.*` enumerations of
  currencies, units, time zones and identifiers) has no Zig module of its own; port the parts
  your area needs under `zig/src/core/types/` (a file per topic, so agents don't collide).

## Areas and owners

- **Foundation + numbers + units**: `resource/`, `schema/`, `internals/schema.ts`,
  `framework.ts`, `locale-data.ts`, `locale/`, `utils/`, `common/private.ts`,
  `parsing/wrapper.ts`, `systems/numbering/`, then `internals/numbers/`, `parsing/number.ts`,
  `common/numbers.ts`, `api/numbers.ts`, `api/private/numbers.ts`, then `internals/units/`,
  `common/units.ts`, `api/units.ts`. Suites `core-numbers`, `core-units`.
- **Calendar systems**: `systems/calendars/` and `internals/calendars/zoneutil.ts`. Suite
  `core-calendars`.
- **Date formatting** (later): the rest of `internals/calendars/`, `internals/datefields/`,
  `common/calendars.ts`, `parsing/date.ts`, `api/calendars.ts`, `api/days.ts`. Suite
  `core-dates`.
- **General** (later): `internals/general/`, `common/general.ts`, `api/general.ts`, `api/api.ts`,
  `cldr.ts`. Suite `core-general`.

## Suites

Registered (each has `zig/test/<name>.zig`, `conformance/<name>.json` and a
`zig build test-<name>` step): `core-numbers`, `core-units`, `core-calendars`, `core-dates`,
`core-general`. Each suite can `@import("packs")`: `packs.get("de")` returns the bytes of
`packages/hereabouts/packs/de.json` for 20 languages (`packs.languages`: en de fr es pt ar fa he
hi bn ja zh ko th ru pl sr tr sw my). Use locales from those languages in the cases (region
variants such as `de-CH`, `en-IN`, `ar-EG`, `sr-Latn`, `zh-Hant-TW` load from the same packs).

On the TypeScript side, load locale data the way the TypeScript tests do (see
`packages/hereabouts/__tests__/core/_helpers/`): the shipped packs with the shipped `config`.

## Locale data

Resource packs keep their format (do not change it). Packs are JSON; fields are strings joined
by `_`, located through the schema: `schema/code/*.ts` declares the layout, and
`core/internals/schema.ts` walks it to assign each field an offset. The schema depends on the
schema config; the shipped packs use `packages/hereabouts/src/config.ts`. The Zig port needs to
support that shipped config (custom configs are optional; say in your report if you skip them).

Schema approach: a data generator (`scripts/zig/core-schema.ts`) runs the TypeScript
`buildOrigin(config)` and `buildSchema(...)` and emits the resulting accessor tree (offsets, key
indices and the checksum) as Zig constants, so field access in Zig is a constant index and the
TypeScript stays the single definition of the layout.
