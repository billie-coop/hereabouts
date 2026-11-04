# Core dates Zig port

Implemented in this clone on `zig-port`; no branch changes, dependency installation, commits,
or TypeScript source changes. The new date area is exported in one marked block in
`zig/src/core/core.zig`.

## API

- `core.dates.formatDate(gpa, data, DateInput, ?DateFormatOptions)` and `formatDateToParts`:
  named date/time/datetime widths, skeleton matching, wrappers, calendar and numbering overrides.
- `core.dates.formatDateRaw` / `formatDateRawToParts`: raw pattern rendering, including every
  implemented TypeScript field, flexible day periods, alternate eras/day periods and zones.
- `core.dates.formatDateInterval` / `formatDateIntervalToParts`: interval matching, masked field
  differences, strict mode, compound fallback and shared-date/time-range wrappers.
- `core.dates.formatDateWrapper` / `formatDateWrapperToParts`: separately formatted dates/times.
- `core.dates.formatRelativeTimeField(gpa, data, Decimal, field, ?options)` and
  `formatRelativeTime(gpa, data, start, end, ?options)`: pluralized fields, lexical relatives,
  rounding, numbering systems, optional weekdays and weeks.
- `core.dates.firstDayOfWeek`, `minDaysInFirstWeek`, `dateField`: locale week rules and field names.
- `core.dates.months`, `weekdays`, `quarters`, `dayPeriods`, `eras`: owned JSON maps with context
  transforms; results are `std.json.Parsed(std.json.Value)`, freed with `.deinit()`.
- `core.dates.toBuddhistDate` / `toGregorianDate` / `toISO8601Date` / `toJapaneseDate` /
  `toPersianDate`, the corresponding `new*Date`, and `now*` (plus `now`): locale week settings
  applied to calendar construction/conversion. `now*` take `std.Io` first.
- `core.dates.fieldOfVisualDifference`: calendar/zone normalization and the visual field character.
- `core.dates.timeData(gpa, data)`: preferred and allowed clock patterns; free the `allowed`
  slice only (strings are static). `timeZoneIds`, `resolveTimeZoneId`, `timeZoneInfo`,
  `timeZoneFromUTC`, `timeZoneFromWall`: timezone wrappers and localized metadata; returned
  timezone metadata borrows locale/static storage.
- `core.dates.timePeriodToQuantity(arena, period)`: unit quantities, with Decimal values;
  use an arena for the returned quantity array and decimals.
- `core.days.formatDay` / `formatDayToParts`, `formatDayInterval` / `formatDayIntervalToParts`,
  `formatTimeOfDay` / `formatTimeOfDayToParts`, `formatDayRelative`, `formatInstant` /
  `formatInstantToParts`, `formatInstantRelative`: checked plain-day/time/instant formatting.
- `core.date_options`: snake_case option structs. `DateInput` is a tagged union of
  `.calendar = CalendarDate` and `.zoned = .{ .date = f64, .zone_id = "UTC" }`.
- `core.date_parsing`: `parseDatePattern`, `freePattern`, `intervalPatternBoundary` (optional
  index rather than -1).
- `core.date_skeletons`: skeleton parsing/canonicalization/splitting, field lookup, matching,
  tie-breaking and adjustment. `core.date_patterns`: locale calendar pattern construction and
  accessors, cached per locale/calendar. `core.date_manager`, `core.date_formatter`,
  `core.date_internal`, `core.date_fields`, `core.relative_time`: formatting internals.

Allocated strings are freed with `gpa.free`, parts with `decimal.freeParts`. Internal pattern,
skeleton and rendering helpers allocate into a caller-provided arena.

## Deliberate differences

- Shipped schema config supported; custom schema configuration is not implemented, as allowed
  by the brief. Gregorian/Buddhist/Japanese/Persian formatting follows the shipped config;
  ISO-8601 construction/conversion is exposed, while format selection falls back as TypeScript does.
- The TypeScript's global parsed-pattern/hour caches and request LRU are replaced by per-call
  arena allocations and per-locale/calendar cached matchers. Cache-only get/set helpers are not
  exposed. This avoids global ownership and preserves formatting results, including the skeleton
  cache regression cases. Matchers store skeletons; interval data is read by schema key instead
  of carrying TypeScript's generic arbitrary `data` payload.
- Enum types represent calendar/context/rounding choices. Invalid calendar enum strings are not
  expressible. Unknown format widths and skeleton fields remain lenient as in TypeScript.
- No JavaScript Date wrapper; use `.zoned` for an epoch. Day API validation errors are typed Zig
  errors rather than JavaScript RangeError messages. The five validation-error cases verify an
  error is returned, not the original message.

## Reference quirks preserved

- No-options `formatDate` chooses full; an explicitly empty options object chooses long.
- Skeleton parsing skips non-fields without terminating a run, uses CLDR-authoritative standard
  skeleton keys, applies date-width tie-breaking and preserves matched pattern widths.
- Apostrophe escaping and dangling-quote behavior are lenient; interval boundaries use the first
  repeated field. Unsupported raw fields (including unimplemented cyclic year) retain TS output.
- Non-strict time intervals add date context when needed; seconds-only differences can collapse.
  Masked seconds compare minute values, as in the reference.
- `fieldOfVisualDifference` preserves the reference's ineffective zone override when converting
  a differing zone. `patternsIntervalPattern` retains the reference's argument/schema-order quirk.
- Related years always use Latin digits; timezone offsets use the date numbering system.
  Fractional-second fields retain JS number string conversion, UTF-16 digit padding, exponent
  stripping by the integer fast formatter and JS power rounding for extreme raw widths. Powers
  are generated from TypeScript rather than computed with Zig's differing `pow` rounding.
- Day/instant formatter limits (1582-10-15 through 8652-12-31) and skeleton validation are retained.

## Validation

- `conformance/core-dates.json`: **7,028 cases**, about 1.52 MiB. Every case runs in Zig;
  no cases skipped. All 20 test-pack languages, region/script/calendar/numbering extensions,
  all four formatting calendars plus ISO conversion, strings and parts, date/time/datetime
  patterns, mined skeleton/quote regressions, intervals, relative time, locale fields, zones,
  day/time/instant APIs, fractional/negative/extreme epochs and wide fractional-second fields.
- `zig build test-core-dates`: all 3 tests pass, including the shared cases and ownership checks
  using `std.testing.allocator`.
- All eight deliberately broken branches were caught: quoted apostrophe escaping; field-width
  fallback; authoritative skeleton widths; date-field tie-breaking; interval date context;
  zero-relative lexical output; uppercase-X UTC zone behavior; day-period boundary comparisons.
  Sources were restored after each mutation and the final baseline passed. Details are in
  `/tmp/core-dates-mutations.log`; runner `/tmp/core-dates-mutations.py` (not repository files).
- `yarn ts-check`, Biome checks on both owned TS generators, Zig formatting checks (including
  generated source), and all 15 conformance/generated-data freshness checks pass.
- `yarn zig-data core-dates` produces `autogen.dates.zig` from the TS field/dayperiod/time/week/
  calendar tables. `yarn conformance core-dates` regenerates the cases and mines the existing
  calendar tests for literal patterns/skeletons.

No shared-file changes needed beyond the authorized `core.zig` export block. Bound `Calendars`
integration belongs to t5w m3-hereabouts-general (M3), which independently verified 561 bound
calendar/day cases against this API. Nothing remains undone for shipped-config formatting.
