# Handoff: core calendars (Zig port)

Scope: `packages/hereabouts/src/core/systems/calendars/` + `core/internals/calendars/zoneutil.ts`
→ `zig/src/core/systems/calendars/` + `zig/src/core/internals/calendars/zoneutil.zig`. Suite `core-calendars`.

Note: the two brief files (PORTING-BRIEF.md, CORE-BRIEF.md) named in my task did not exist in the
scratchpad; I inferred conventions from the repo (zig/README.md, existing generators/tests, git log).

## State: written, NOT yet compiled or tested

Every file below is complete (no half-written functions), but `zig build` has never been run on
them. Expect a round of compile fixes (Zig 0.16 API details, unused imports, type coercions).
`zig/src/core/core.zig` has NOT been touched yet (no export block added).

### Done and verified
- `packages/hereabouts/scripts/zig/core-calendars.ts` — Zig data generator. Ran `yarn zig-data core-calendars`;
  output passes `zig fmt --check`. Generates:
  - `zig/src/core/systems/calendars/autogen.zonedata.zig`: `metazoneids`, `metazones` (MetazoneRecord{offsets,untils(ms)}),
    `zone_metazone` (StaticStringMap u16; canonical ids + lowercase, as buildMetazones), `stable_ids`, `tz_aliases`
    (bundled tz links alias→canonical).
  - `zig/src/core/systems/calendars/autogen.aliases.zig`: `aliases` = TS `timeZoneAliases` (CLDR + 2 hand extras).
  The vitest `__tests__/conformance/zig-data.test.ts` will check staleness automatically.

### Written, unverified (file by file, in zig/src/core/systems/calendars/)
- `constants.zig`, `fields.zig` (DateField index consts, `Fields = [25]f64`), `util.zig` (JS semantics: floorDiv with
  JS `%` remainder, toInt32 (`|0`), JS Math.round, sign, truthy, orZero, clamp, toInt (saturating f64→i64), toInstant
  (floor+clamp f64→i64 for tz lookups); has unit tests).
- `types.zig`: CalendarType enum, CalendarDateFields (?i64 fields + ?zoneId, `merge`), WallFields (f64), Resolved,
  WeekRule, CalendarSystem (fn pointers: daysInMonth(i64,i64)i64 [0 for bad month], daysInYear, monthStart(f64,f64,bool)f64,
  computeFields(*Fields), resolveFields(WallFields, zoneId, offset f64) Resolved), DateZoneInfo, CalendarDate
  (calendar ptr, fields [25]f64, zoneInfo, firstDay i64, minDays i64), Error{InvalidFields, InvalidDate}.
- `interval.zig`: TimePeriodField enum, TIME_PERIOD_FIELDS, TimePeriod (f64 fields, get/set), TimePeriodFieldFlag, timePeriodFieldFlags.
- `timezone.zig`: zoneInfoFromUTC(zone, utc f64), utcFromWall(zone, wall f64) ?f64 (tzFromWall equivalent), currentMetazone,
  getStableTimeZoneId, substituteZoneAlias. Stable-id check uses the foundation agent's
  `schema/autogen.schema.zig` `indices.@"timezone-id"` via `instructions.keyIndexGet` — I verified in TS that config
  'timezone-id' === TimeZoneStableIds (420 ids), so this IS TimeZoneStableIdIndex. Has a unit test.
- `gregorianmath.zig` (MONTH_COUNT, monthIndex clamp helper, init/computeGregorian/JulianFields, daysInMonth(f64,usize),
  daysInMonthInt, monthStart, leapGregorian, ymdToJD), `math.zig` (toYMD, unixEpochFromJD, clampYMD, adjustYM,
  adjustTime, timeToMillis, wallTimeToMillis(h,m,s,ms), truncateFields, fieldsFromUnixEpoch, jdFromUnixEpoch,
  initBaseFromUnixEpoch, computeBaseFields, negatePeriod).
- `core.zig`: newDate(cal, epoch f64, ...), newDateChecked (error.InvalidDate if non-finite), newDateFromJD (fallible),
  dateFromUnixEpoch(i64), dateFromFields (fallible), wallFields (InvalidFields if month/day missing).
- `gregorian.zig`, `iso8601.zig`, `buddhist.zig`, `japanese.zig` (ERAS table extracted mechanically from TS, 236 eras),
  `persian.zig`.
- `calendar.zig`: all accessors (return i64/bool/[]const u8; dateJulianDay f64), dateFieldOfVisualDifference → ?u8 char,
  dateCompare i32, dateFields, write*(std.Io.Writer) + allocating date*String/ISO functions, dateSet, dateWithZone,
  dateStartOf/EndOf (CalendarDateModField enum), weekOfYear/weekNumber/yearLength, zeropad (local; equivalent to
  numberingFormatString(INTERNAL_NUMBERING, int, false, w): digits of |n| zero-padded). Also DateDiffOptions, TimeStringOptions.
- `add.zig`: dateAdd/dateSubtract (Error!CalendarDate), add, addYMD, millisToTimePeriod.
- `difference.zig`: full port (state, timeDifference, differenceOfDates, roundResult, adjustDays, rollTime,
  roll*Fractions, dateRelativeTime → RelativeTime{field,value}, dateSince/Until/Difference/DifferenceSigned).
- `calendars.zig`: module root re-exporting everything (index.ts equivalent) + `calendarSystem(type)`; its `test {}` block
  pulls in util/timezone/zoneutil tests.
- `zig/src/core/internals/calendars/zoneutil.zig`: getTZC(i64 ms) → TZC{offset f64 minutes, negative, hours i64, minutes i64}.

## Left to do, in order
1. Compile: add `pub const calendars = @import("systems/calendars/calendars.zig");` (and maybe
   `zoneutil`) to `zig/src/core/core.zig` in ONE clearly marked block (re-read the file first; the foundation agent
   edits it concurrently). Add `_ = @import("systems/calendars/calendars.zig");` to its test block. Then
   `cd zig && zig build test-core-calendars` and fix compile errors.
2. Conformance generator `packages/hereabouts/scripts/conformance/core-calendars.ts` (not started). Planned format:
   - date spec arg: `{cal, epoch, zone, fd?, md?}` or `{cal, fields:{...}, fd?, md?}`.
   - date snapshot result: `{f:[25 fields], z:[zoneid,stableid,abbr,dst,offset,metazoneid], fd, md, e:epoch,
     w:[woy,ywoy,woyISO,ywoyISO,wom,ordinalDow,dowInMonth,relatedYear], jd:julianDay, s:[toString, ISO, localISO,
     dateTimeString{includeZoneOffset,optionalMilliseconds}]}`.
   - ops: date, dateAdd, dateSubtract, dateSet, dateWithZone, dateStartOf, dateEndOf (→ snapshot);
     dateUntil/Since/Difference/DifferenceSigned [s1,s2,options] → period; dateRelativeTime; dateCompare;
     dateFieldOfVisualDifference; dateToTimeString [spec, opts]; zoneInfoFromUTC; getStableTimeZoneId;
     currentMetazone; substituteZoneAlias; getTZC; daysInMonth/daysInYear/monthStart per calendar; errors as {error}.
   - Inputs: mined TS-test calls (see below; sample high-volume ones to ~300 each), plus: DST scans around
     Vancouver/NY 2025 spring/fall (until-edge-case-scan-1/2 grids, sampled; scan-2 heaps permutations of add periods),
     Japanese era starts ±1 day, Persian Nowruz / Esfand 30 in leap & non-leap years (incl. years < 1), far past/future
     epochs (±8.64e15, near JD_MIN/JD_MAX), fractional/negative periods (0.5 day, -0.5 hour, 0.7 ms), large periods
     (year 1e4, day 1e7, hour 1e9), out-of-range fields (month 0/13, day 0/32, hour 25, year 1e10 → int32 wrap),
     week rules fd 1..7 × md 1..7, all diff option combos (fields subsets, rollupFractional, includeWeeks), metazone
     until boundaries ±1 ms for every zone, stable ids for all zone ids/aliases. Target ~1.5 MB like other files.
   - `yarn conformance core-calendars` writes `conformance/core-calendars.json`.
3. `zig/test/core_calendars.zig` (currently the placeholder): parse cases, rebuild date from spec, compare snapshot
   exactly (f64 equality; JSON -0 prints as 0). Model on `zig/test/unit_converter.zig`.
4. Update zig/README if appropriate; report incl. "Calendar API for the date formatting agent".

## Mined test inputs (scratchpad, not in repo)
- `scratchpad/rec/setup.ts` + `vitest.rec.config.mjs`: vitest setup that wraps the `src/core` exports and records each
  call (dates serialized as `{$date:{cal,epoch,zone,fd,md}}`). Run:
  `cd packages/hereabouts && npx vitest --run --config <scratchpad>/rec/vitest.rec.config.mjs`
- `scratchpad/rec/uniq.jsonl`: 904,741 unique calls (dateSet/dateCompare/dateFields ~160k each from fieldset random
  test, zoneInfoFromUTC 133k, gregorianDateFromUnixEpoch 112k, persian 80k, dateAdd 64k; the rest are few hundred).
  Plan was to sample these into a helper `scripts/conformance/_core-calendars-inputs.ts`.
  (tzdata.test.ts fails under the mock because of setTimeZoneData module identity — ignore it.)

## Design decisions
- Internals in f64 mirroring JS exactly (fields `[25]f64`); i64 only at the API (epoch in, accessors out). Reason:
  JS floor/trunc/`|0` wrap/`%` sign and far-out values reproduce for free.
- tz lookups take i64: `util.toInstant` floors+clamps; equivalent because tz/metazone only compare with integer untils.
  `utcFromWall` returns `wall - offset` in f64 (keeps fractional/huge wall like JS).
- Non-finite epochs → `error.InvalidDate` (TS: NaN date or TypeError). Missing month/day in dateFromFields →
  `error.InvalidFields` (TS: TypeError / NaN date). Only iso8601 & japanese can hit it (no defaults).
- `dateFromFields` uses `zoneInfoFromUTC("UTC",0).zoneid` as default zone, like TS.
- Strings returned in DateZoneInfo are static (stable id taken from the schema key, not the caller's slice).
- No isCalendarDate / dateAsJSDate.

## Needs from core foundation
- Used: `core/schema/instructions.zig` (keyIndexGet) and `core/schema/autogen.schema.zig` `indices.@"timezone-id"`.
  If they later add `schema/schema/timezones.zig` with `TimeZoneStableIdIndex`, switch to it.
- Not used: numbarray/stringToObject (data decoded at generation time instead); numberingFormatString (local
  integer zeropad in calendar.zig, documented). Foundation now has `systems/numbering/decimal.zig` if preferred.

## Traps found
- `metazoneData.metazoneids` is already an array (`.split(' ')` in the TS source), unlike the other fields.
- JS `floorDiv` remainder keeps the dividend's sign → Persian leap test is "leap" for negative remainders (years < 1).
- `ymdToJD`/`persianYmdToJD` do `y |= 0` (int32 wrap for huge years); `monthStart` does `(eyear|0) % 4`.
- difference/add use Gregorian ymdToJD/daysInMonth/clampYMD even for Persian dates (faithfully ported).
- `millisToTimePeriod` never sets `day` (always 0). `timePeriodFieldFlags` "smallest" is the LAST field listed.
- add(): `hasTime/hasDate` use truthiness of untruncated values (0.5 day takes the date path with 0 days).
- Persian resolveFields ignores zoneId and uses the date's offset; so `dateSet(d,{zoneId:'UTC'})` in add() keeps the zone.
- TS `timeZoneAliases[id]` is a plain object lookup (prototype keys like "toString" would misbehave in TS) — ignored.

## Commands
- `yarn zig-data core-calendars` (repo root) — regenerate Zig data.
- `yarn conformance core-calendars` — regenerate cases (after writing the generator).
- `cd zig && zig build test-core-calendars` — run the suite.
- `yarn test` checks conformance + zig-data staleness.
