# Core general Zig port

Implemented by t5w m3-hereabouts-general (M3), on `zig-port`; no state-changing Git commands or commits.

## Zig API

- `core.general.characterOrder(data)` / `lineOrder(data)` return typed layout enums.
- `core.general.measurementSystem(data, ?category)` returns `.us`, `.uk` or `.metric`.
- `core.general.formatList(gpa, data, items, ?type)` / `formatListToParts(...)` cover all six list patterns, empty/single lists and empty items.
- `core.general.getLanguageDisplayName(gpa, data, input, options)`, `getScriptDisplayName(...)`, `getRegionDisplayName(...)`: `NameInput` distinguishes `.{ .code = "US" }` from `.{ .tag = tag }`; alt fallback, resolution, dialect names and context behavior follow TypeScript.
- `core.general.messageFormatter(data)` returns the locale-owned, cached default formatter; do not deinit it. `createMessageFormatter(gpa, data, options)` returns a caller-owned formatter; call deinit. Both force the locale's plural rules, overriding options.plurals.
- `core.general_options` exports `DisplayNameOptions`, `CurrencyDisplayNameOptions`, `AltType` (`fromString` / `string`), measurement/layout enums and the existing context/list enums.
- `core.getContextTransformInfo(data)` returns a borrowed, cached JSON object of context flags (`api/private/api.ts`).
- `core.internals.general` retains foundation helpers (`parseWrapper`, `formatWrapper`, `contextTransform`, `formatListValue`) and adds `contextTransformWithFlag(gpa, value, flags, ?context)` for explicit/synthetic flags.
- `core.bound_api.General`, `.Numbers`, `.Units` bind the corresponding public API methods to borrowed locale data, including tag parsing/resolution, decimal parsing, currency metadata and unit enumeration. Currency names remain implemented by the foundation's number API and are bound here.
- `core.bindGeneral(data)`, `bindNumbers(data)`, `bindUnits(data)`, `bindCLDR(data)` construct small borrowed values without allocations.
- `core.CLDRFramework.init(gpa, options)`, `.get(LocaleInput)`, `.info(gpa)`, `.config()`, `.deinit()` provide the convenience loader; `core.cldrFramework` aliases init. `.framework` exposes the existing low-level framework.

Example:

```zig
var fw = core.CLDRFramework.init(gpa, .{ .loader = loader });
defer fw.deinit();
const en = try fw.get(.{ .id = "en" });
const n = try en.Numbers.parseDecimal(gpa, "1234.5");
defer n.deinit(gpa);
const s = try en.Numbers.formatDecimal(gpa, n, .{});
defer gpa.free(s);
```

Strings/parts returned by allocating format/name functions belong to the caller; free parts with `decimal.freeParts`. Layout enums, symbols, unit names/enumerations, plural category strings, locale/schema pointers and cached context info borrow static data or locale data.

## Design differences and limitations

- The bound CLDR and groups are plain Zig values, each containing a locale pointer. Repeated get calls share locale data, rather than returning an object with JavaScript identity/lazy properties. Groups need no separate deinit.
- Cached default and caller-owned custom message formatters have separate entry points to make ownership explicit. The default formatter allocates in the locale cache arena: cache entries are bounded, but memory from evicted parsed messages is reclaimed at locale deinit, not immediately at eviction.
- The loader is synchronous (no redundant getAsync). `config()` returns the generated schema accessor tree; custom schema configs remain unsupported, as in the foundation.
- `parseDecimal` accepts a string; numeric construction remains available through the existing decimal API. Other number methods accept Decimal values, as in the foundation.
- Invalid JavaScript enum strings are unrepresentable in typed Zig options. `AltType.fromString` returns null for them; selecting `.none` gives the TypeScript display-name fallback result.
- Wrapper parsing retains the foundation's no-cache implementation; behavior is unchanged.

## TypeScript quirks preserved

- Temperature returns `us` only for BS/BZ/PR/PW, and `metric` for US/GB/LR/MM. General measurement returns `uk` for GB and `us` for US/LR/MM.
- Language and script names default to begin-sentence capitalization; region names receive no context transform (for example English `001` remains `world`).
- Raw strings and parsed tags intentionally differ for unknown script/region codes. Exact code lookup precedes dialect lookup/resolution; alt values fall back to none.
- First UTF-16-unit uppercasing preserves astral leading characters and allows expansions such as ß -> SS. Wrapper quotes, malformed argument coercion and multi-digit arguments retain the foundation's TypeScript behavior.

## Tests and deliberate breaks

`packages/hereabouts/scripts/conformance/core-general.ts` generates **9,213 cases**, **1,343,129 bytes** of JSON, over all 20 embedded pack languages plus region/script variants and measurement exceptions. Covers every general function, raw/tag name inputs, all list patterns and lengths 0–7, alt/context options, synthetic and locale flags, wrapper parsing/rendering, message formatters and bound general/number/unit calls. Seed is fixed.

- `zig build test-core-general`: **3/3 tests pass**, **9,213/9,213 cases pass**, zero skips. Includes allocator leak checks and public declaration checks.
- `zig build test-core-general test-core-numbers test-core-units --summary all`: **9/9 tests pass** after restoring all mutations (general changes preserve foundation regressions).
- `npx biome check --write .../core-general.ts`, then read-only Biome check: clean, no warnings.
- `yarn ts-check`: passes after the date worker fixed its independent generator error.
- Focused Vitest conformance freshness (`-t core-general`): passes.
- `npx vitest --run packages/hereabouts/__tests__/conformance`: **14/14 tests pass**, including generated Zig data freshness and every conformance suite, after the calendar worker fixed its independent generator ordering issue.
- `git diff --check` for changed tracked general files: clean.

Seven behavior-changing mutations compiled and were detected by conformance failures: temperature exception (3 cases), default list type (403), alt fallback (3,260), language-region fallback (141), language capitalization context (281), incorrect region capitalization (33), forced English plural rules (40). All source restored, followed by the passing regression run above. An initial mutation of only the intermediate language-region lookup survived because the later resolved lookup recovered the same name; disabling both region lookups was then caught by 141 existing cases. One initial plural mutation had an incorrect import and did not compile; it was corrected and the compiling mutation was caught by 40 cases. Logs remain in `/tmp/core-general-mutations.log` and `/tmp/core-general-mutations-final.log`.

## Outstanding / integration

The `CLDR.Calendars` group and `bindCalendars` are **not yet wired**: `api/calendars.zig` was not available when this task finished. This includes locale-bound calendar constructors, fields, date/interval/relative-time formatting, timezone helpers and now methods. Calendar systems are available separately through the calendar worker's `core.calendars`. Supervisor t4t m3-hereabouts (M3) explicitly directed me not to wait and will arrange binding after the date worker finishes.

No shared-file changes requested. Only one marked export block was appended to `zig/src/core/core.zig`. The existing general internal helper file was minimally extended; other workers' files were left alone. No TypeScript source was changed.

## Integration

Completed the follow-up assigned by t4t m3-hereabouts (M3). This supersedes the outstanding Calendars wiring note above.

- `CLDR.Calendars` now contains `bound_api.Calendars`, and `core.bindCalendars(data)` / `core.cldr.bindCalendars(data)` bind it independently. `bindCLDR` initializes the group alongside General, Numbers and Units.
- The group exposes **all 42 TypeScript bindCalendars methods**: locale week rules, date fields/maps, all five conversion/construction pairs, six clock methods, date/raw/interval/wrapper string and parts formatting, relative time, visual difference, time data, timezone lookup/info/conversion and period-to-quantity conversion.
- It also exposes the **10 api/days methods**: day/time/instant formatting and parts, day intervals and parts, day-relative and instant-relative formatting. These are additional Zig convenience methods forwarding the existing plain-day API.
- Methods preserve the underlying Zig signatures with the bound locale removed and `self` first. `now*` take `std.Io` after `self`; date options remain optional; relative-time-field values remain Decimal. Calendar values are plain data. Field-map results require `.deinit()`, `timeData.allowed` requires allocator free, strings/parts retain caller ownership, timezone info borrows its data, and `timePeriodToQuantity` takes an arena allocator for quantities, decimals and conversion temporaries. Ownership comments and leak tests cover these contracts.
- Added **561 bound calendar cases** across 11 locale variants (including en-GB, Arabic, Persian, Japanese calendar extension and Traditional Chinese). All 52 bound methods are exercised. Clock cases compare stable calendar/zone/week-rule properties rather than timestamps; day helpers use TypeScript's direct plain-day functions as their reference.
- Suite is now **9,774 cases**, **1,445,731 bytes** JSON; `zig build test-core-general --summary all` passes **4/4 tests**, including calendar ownership, with zero case failures or skips. Biome and focused Vitest freshness (`-t core-general`) pass. `git diff --check` is clean for integration files.
- Three compiling forwarding mutations were caught: wrong calendar conversion target (**11 cases**), dropped date options (**11**) and swapped date/time wrapper arguments (**11**). All original code was restored, followed by the passing final suite. Log: `/tmp/core-general-calendar-mutations.log`.
- Latest `yarn ts-check` passes this task's files but fails only in the date worker's in-progress `scripts/conformance/core-dates.ts` at lines 458/462 (dynamic `to${string}Date` / `new${string}Date` namespace indexing, TS7053). Notified t5v m3-hereabouts-dates (M3); did not edit its files.

Changed only `zig/src/core/api/api.zig`, `cldr.zig`, the existing marked general export block in `core.zig`, the core-general TypeScript/Zig tests and generated JSON, plus this report append. No commits and no additional shared-file requests. No calendar convenience wiring remains outstanding against the currently available API.
