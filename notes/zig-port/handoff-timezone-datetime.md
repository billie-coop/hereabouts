# Handoff: timezone and datetime Zig ports

Repo files are consistent. No edits are in progress. The mutation tests only changed throwaway copies in the scratchpad.

## Files
- Zig, timezone: `zig/src/timezone/` (`timezone.zig` is the root; also `database.zig`, `search.zig`, and the generated `autogen.zonedata.zig` and `autogen.rawdata.zig`).
- Zig, datetime: `zig/src/datetime/` (`datetime.zig` is the root; also `types.zig`, `day.zig`, `time_of_day.zig`, `instant.zig`, `zone.zig`, `scan.zig`).
- Suites: `zig/test/timezone.zig`, `zig/test/datetime.zig`.
- Data generator: `packages/hereabouts/scripts/zig/timezone.ts`. It writes the decoded data and the raw strings, and its output passes `zig fmt`.
- Case generators: `packages/hereabouts/scripts/conformance/timezone.ts` and `datetime.ts`.

## Zig API: timezone (`tz*` with the prefix dropped)
- Types: `RawData`, `ZoneInfo{zoneid, abbr, dst: u8, offset: i64}`, `ZoneMeta{zoneid, stdoffset, latitude: f64, longitude: f64, countries}`, `WallResult{utc, info}`, `Database`, `DecodeError`.
- `fromUTC(id, utc: i64) ?ZoneInfo` and `fromWall(id, wall: i64) ?WallResult`.
- `resolveId(id) ?[]const u8`, `utcZone() ZoneInfo`, `zoneMeta(id) ?ZoneMeta`, `zoneIds() []const []const u8`.
- `defaultTimeZoneData: RawData` holds the raw strings. `defaultDatabase: *const Database` is the same data already decoded at build time.
- `Database.decode(gpa, raw) !Database`, `db.deinit(gpa)` and `db.find(id) ?ZoneRef`.
- `setTimeZoneData(*const Database)` swaps the active data; it is not thread-safe. `activeDatabase()` returns the active one.

## Zig API: datetime (TypeScript names kept)
- Types: `Day{year, month, day: i32}`, `TimeOfDay{hour, minute, second, millis: i32}`, `Instant = i64`, `DayDuration{years, months, weeks, days: i64 = 0}`.
- Enums, each with `fromString`: `DayUnit`, `DayPeriod` (month or year), `Disambiguation`.
- One error set, `Error`: InvalidDay, DayOutOfRange, InvalidTimeOfDay, InvalidMillis, InvalidFirstDay, InvalidStep, UnknownTimeZone, InvalidInstant, InstantOutOfRange, RepeatedTime, SkippedTime.
- Building and checking days: `day`, `isDay`, `isLeapYear`, `daysInMonth`, `dayToEpochDay`, `dayFromEpochDay`.
- Parsing and formatting days: `dayParse` returns `?Day`, `dayFromString` returns `!Day`, `dayToString(gpa, d)` allocates, `formatDay(buf, d)` writes into a buffer.
- Day arithmetic: `dayAdd`, `daySubtract`, `dayCompare` (returns `i32`), `dayEquals`, `dayIsBefore`, `dayIsAfter`, `dayUntil(from, to, unit)`.
- Day fields: `dayOfWeek`, `dayOfYear`, `dayDaysInMonth`, `dayIsLeapYear`.
- Week, month and year bounds: `dayStartOfWeek` and `dayEndOfWeek` (with `firstDay`), `dayStartOf` and `dayEndOf` (with a `DayPeriod`).
- `dayRange(gpa, start, end, step)` returns `[]Day`. The step is always passed explicitly; `.{ .days = 1 }` is the TypeScript default.
- Times of day: `timeOfDay(h, m, s, ms)` (all four arguments required), `isTimeOfDay`, `timeOfDayToMillis`, `timeOfDayFromMillis`, `timeOfDayParse`, `timeOfDayFromString`, `timeOfDayToString(gpa, t)`, `formatTimeOfDay(buf, t)`, `timeOfDayCompare`.
- Instants: `instantParse(s, zone: ?[]const u8) Error!?Instant` and `instantToString(gpa, instant, zone: ?[]const u8)`.
- Zones: `timeZoneId`, `timeZoneOffset`, `dayFromInstant`, `timeOfDayFromInstant`, `dayToday(zone, now)`, `dayAtTime(d, t, zone, .{ .disambiguation })`, `dayStartInstant`, `DayAtTimeOptions`.
- Extras: `now(io)` stands in for `Date.now()`. `systemTimeZone(io, environ)` reads `TZ`, then the `/etc/localtime` link, and returns null on Windows and WASI.

## Deviations from the TypeScript
- Instants and durations are integers (`i64`), so the TypeScript's fractional, NaN and Infinity inputs cannot be expressed in Zig. That includes the TypeScript's flooring of fractional instants.
- Sums of durations are computed exactly in `i128`. The TypeScript works in doubles, which are only exact up to 2^53. The cases stay inside the exact range.
- `fromWall` uses saturating arithmetic at the ends of `i64`. Near ±2^53, JavaScript rounds `wall - offset`, so those inputs are left out of the cases.
- The TypeScript decodes the zone data lazily; Zig decodes it all at once. The bundled data is decoded at build time, with the transition times summed at comptime from the TypeScript's packed indexes.
- Malformed raw data is `error.InvalidTimeZoneData` in Zig. The TypeScript silently decodes it into garbage records.
- Id lower-casing is ASCII only, plus the Kelvin sign (U+212A), which JavaScript's `toLowerCase` turns into `k`; this mirrors `timeZoneId`. Non-ASCII zone ids in custom data are lower-cased differently from JavaScript.
- `setTimeZoneData` takes an already decoded `*const Database` rather than raw data.
- `dayToday` needs `now` passed in, and `systemTimeZone` uses `TZ` or `/etc/localtime` where the TypeScript asks `Intl`.

## TypeScript bugs or quirks found
No real bugs. Quirks mirrored in Zig:
- In the zone data, if a key is set more than once, the last link set wins, and repeated zone ids map to the last index.
- `timeZoneId` accepts the Kelvin sign as `k`.
- `instantToString` with a negative offset at -8.64e15 throws "Day out of range".
- `dayStartOf` and `dayEndOf` (unit `'year'`) throw "Invalid day" near the ends of the supported range.
- A NaN instant passed straight to `tzFromUTC` makes the binary search report a "found" index. Zig cannot reach this.

## Case counts
- `conformance/timezone.json`: 10,965 cases, about 1.52 MB. It includes 345 `tzSweep` cases, which hash every transition of every zone through `fromUTC` and `fromWall`, and 416 `tzCustom` cases, which run calls with replacement data active.
- `conformance/datetime.json`: 12,605 cases, about 1.5 MB. It includes 345 `dtSweep` cases, which hash `dayAtTime` in all four modes, `dayStartInstant` and `instantToString` around every transition of every zone.

## Checks from the brief
- `zig build test-timezone test-datetime`: both pass, 5 of 5 tests each. The suites also include a leak test, a test that the runtime decoder reproduces the generated tables exactly, and malformed-data tests.
- `npx biome check` on my three TypeScript files: clean.
- `yarn ts-check`: fails only in other agents' files (`scripts/zig/core-schema.ts`, earlier `scripts/zig/locale.ts`).
- vitest conformance: `datetime.json` and `timezone.json` are up to date. `zig-data.test` fails only on another agent's `core/schema/autogen.schema.zig`; my generated files are current. I reran `yarn zig-data timezone` after the shutdown.
- `zig fmt --check`: clean on all my Zig files, generated ones included.
- Deliberate breaks: each break was checked by running the suite on a scratch copy of the modules.
  - Caught, timezone: wall gap and overlap edges, the condition for being before the gap, the one-day lookback, the type used before the first transition, last-wins link indexing, lowercase ids and aliases, latitude scaling, binary search comparison and return.
  - Caught, datetime: the `dayUntil` months loop, month-end clamping, the leap-year 400 rule, the range limit, weeks truncation, `dayOfWeek` modulo (crashes), `.later` disambiguation (449 cases), and fraction digits allowed past 9 (1 case).
  - I added cases for lowercase lookups in custom data after the lowercase-id break was caught only by the decode test.
  - Equivalent breaks, so no gap: `@rem` → `@mod` in `dayUntil` years (the loop corrects it), and `lo - 1` → `hi` in `binarySearch`.

## Not finished
- Twelve datetime breaks have no reliable result. Running them in parallel was unreliable (every one reported the same 2–3 failures, while a no-op run passed), and the serial rerun was stopped when we wrapped up:
  - `dayRange` drift, the `dayRange` negative-days step check, `dayEndOf` year, the `-000000` year
  - `resolveWall` dedupe, `.earlier` skipped time, the `dayStartInstant` binary-search bound
  - offset sign in `instantParse`, seconds in the `instantToString` offset, the Kelvin sign
  - the `checkInstant` boundary, the `timeOfDayToString` seconds form
  - Each targeted case exists, but they should be re-run one at a time.
- Shared-file note for the owner: inline `test` blocks in `zig/src/**` do not run under `zig build test-<name>`, because `hereabouts` is a dependency module. I moved my important tests into the suites. A module test step in `build.zig` would fix this for every module. `zig test zig/src/timezone/timezone.zig` runs the timezone inline tests directly.
- `zig/README.md` does not yet mention timezone and datetime; that is a shared file.
