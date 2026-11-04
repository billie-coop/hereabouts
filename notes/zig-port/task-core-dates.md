# Task: port core date formatting to Zig

A new area (no previous agent). Read `codex-handoff.md`, `porting-brief.md` and `core-brief.md`
first, then `handoff-core-foundation.md` (the foundation API: loading locales, schema access,
number formatting) and `handoff-core-calendars.md` (the calendar types and date math you format).

## Scope

In `packages/hereabouts/src/core/`: `internals/calendars/` except `zoneutil.ts` (the formatter,
manager, skeleton matching, pattern parsing, interval formatting, fields, rules), 
`internals/datefields/` (relative time), `common/calendars.ts`, `parsing/date.ts`,
`api/calendars.ts` and `api/days.ts`. About 4,500 lines; the biggest area left.

- Zig: `zig/src/core/internals/calendars/` (next to the existing `zoneutil.zig`, which belongs to
  the calendar worker), `zig/src/core/internals/datefields/`, `zig/src/core/api/`,
  `zig/src/core/common/`, `zig/src/core/parsing/`. Add your exports to `zig/src/core/core.zig` in
  one marked block.
- Suite `core-dates`: `packages/hereabouts/scripts/conformance/core-dates.ts`,
  `zig/test/core_dates.zig`, `zig build test-core-dates`. Tests to mine:
  `packages/hereabouts/__tests__/core/api/calendars/`, `__tests__/core/internals/calendars/`,
  `__tests__/core/parsing/date.test.ts`, `__tests__/core/custom/calendars.test.ts` and
  `timezones.test.ts`. Cover every calendar (gregory, buddhist, japanese, persian), date, time,
  datetime and skeleton formats, intervals, relative time, time zone names and formats, day
  periods, numbering systems in dates, parts output, across the 20 test-pack languages.
- The calendar systems (`zig/src/core/systems/calendars/`) are being finished right now by
  `t5s m3-hereabouts-cal (M3)`. Start with what doesn't need them: pattern and skeleton parsing,
  skeleton matching, date fields and relative time. Ask t5s with `hc send t5s "..."` if you need
  to know its API before it's done; don't edit its files.

Final report: `notes/zig-port/report-core-dates.md`.
