# hereabouts for Zig

A port of [hereabouts](../README.md) to Zig, with no dependencies beyond the standard library.
It covers the whole TypeScript library: exact decimal math, number, currency, unit and date
formatting, calendars, time zones, plurals, ICU messages, language tags, locale matching and
unit conversion. Needs Zig 0.16. Not yet published as a package.

The TypeScript in `packages/hereabouts` is the reference. Both test suites run the shared cases
in [`conformance/`](../conformance) (about 107,000), so the two give the same answers.

## Example

Locale data comes from the same resource packs as the TypeScript (`packages/hereabouts/packs`,
built with `yarn build`). You supply a loader that returns a pack's JSON for a language.

```zig
const std = @import("std");
const hereabouts = @import("hereabouts");
const core = hereabouts.core;
const decimal = hereabouts.decimal;

fn loadPack(_: ?*anyopaque, language: []const u8) ?[]const u8 {
    if (std.mem.eql(u8, language, "de")) return @embedFile("packs/de.json");
    return null;
}

pub fn main() !void {
    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();
    const a = arena.allocator();

    var fw = core.CLDRFramework.init(a, .{ .loader = .{ .load = loadPack } });
    defer fw.deinit();
    const de = try fw.get(.{ .id = "de-DE" });
    defer de.deinit();

    const n = try decimal.parse(a, "1234.567");
    const s = try de.formatDecimal(a, n, .{ .maximum_fraction_digits = 2 });
    std.debug.print("{s}\n", .{s}); // 1.234,57
    const c = try de.numbers.formatCurrency(a, n, "EUR", .{});
    std.debug.print("{s}\n", .{c}); // 1.234,57 €

    const sum = try decimal.add(a, try decimal.parse(a, "0.1"), try decimal.parse(a, "0.2"));
    std.debug.print("{s}\n", .{try decimal.toString(a, sum)}); // 0.3
}
```

## Coming from TypeScript

Names follow a mechanical mapping. Operations on a value become methods and drop only the
receiver's type word: `dayAdd(d, period)` becomes `d.add(period)`, and `dateYear(d)` becomes
`d.year()`. Decimal and rational arithmetic remain namespace functions. Constructors use
`Type.init`; generic calendar constructors are `CalendarDate.fromFields/fromUnixEpoch`.
The five calendar-specific constructor functions keep their exact TypeScript names because
those calendars share a single CalendarDate value type.

Locale functions keep their exact TypeScript names as methods: `de.formatDecimal(gpa, n, opts)`.
The bound groups also remain: `de.numbers.formatDecimal(gpa, n, opts)`, `de.calendars.formatDate`,
`de.general.formatList`, and `de.units.formatQuantity`. Framework.loadLocale handles, owning
CLDR objects and borrowed CLDRView values expose the same direct methods.

| TypeScript | Zig |
| --- | --- |
| `decimalAdd(a, b)` | `decimal.add(gpa, a, b)` |
| `day(y, m, d)` / `dayAdd(d, period)` | `datetime.Day.init(y, m, d)` / `d.add(period)` |
| `timeOfDayToString(t)` | `t.toString(gpa)` |
| `dateYear(date)` / `dateFields(date)` | `date.year()` / `date.fields()` |
| `formatDecimal(locale, n, opts)` | `locale.formatDecimal(gpa, n, opts)` |
| `createMessageFormatter(opts)` | `messageformat.MessageFormatter.init(gpa, opts)` |
| `formatMessage(formatter, ...)` | `formatter.formatMessage(gpa, ...)` |
| `getPluralRules(language, region)` | `plurals.getPluralRules(language, region)` |
| `resolveLanguageTag(input)` | `locale.resolveLanguageTag(gpa, input)` |
| `parseLanguageTag(text)` | `language_tag.parseLanguageTag(gpa, text)` |
| `isMessageKey(translator, key)` | `translator.isMessageKey(key)` |
| `convertUnits(converter, ...)` | `converter.convertUnits(gpa, ...)` |

When dropping the type word would collide with a data field, a method keeps its exact
TypeScript name: `tag.tagLanguage()`, `tag.tagScript()`, `tag.tagRegion()` and `tag.tagVariant()`
coexist with the raw tag fields. CalendarDate instead names its Zig backing array `field_values`
so its operation can be `date.fields()`. Methods such as `Day.ofWeek/ofYear` are the literal
suffixes of `dayOfWeek/dayOfYear`. Other functions retain the exact TypeScript name; there are
no new synonyms such as rulesFor, hasKey or convert. The casing exceptions alignexp, shiftleft,
shiftright and divmod become alignExp, shiftLeft, shiftRight and divMod. Each moved declaration
names its TypeScript original in its doc comment.

Public option and data fields use snake_case (`maximum_fraction_digits`, `zone_id`,
`include_weeks`). Generated schema identifiers retain their TypeScript spelling because they
mirror pack data. Private wire records and test adapters also preserve serialized keys.
Methods put self first and the allocator next; allocating free functions and static constructors
put the allocator first. Managed owners use deinit(); unmanaged owned values use deinit(gpa);
strings use gpa.free and owned nested slices have freeParts/freeStrings/freeQuantities helpers.
Advanced date-formatting helpers live under core.internals.calendars; parsers under core.parsing.

## Namespaces

`hereabouts.<name>` matches a TypeScript entry point:

| Zig | TypeScript | |
|---|---|---|
| `core` | `@billie-coop/hereabouts` | locale data, number/currency/unit/date/list formatting, display names, calendars, the convenience object (`core.CLDRFramework`) |
| `decimal`, `rational` | `/decimal` | arbitrary precision decimals and rationals |
| `datetime` | `/datetime` | `Day`, `TimeOfDay`, instants, zones |
| `timezone` | `/timezone` | the IANA time zone database |
| `plurals` | `/plurals` | CLDR plural rules |
| `messageformat` | `/messageformat` | ICU messages and the translator |
| `language_tag` | `/language-tag` | language tags |
| `locale` | `/locale` | locales, likely subtags, flags |
| `locale_matcher` | `/locale-matcher` | CLDR locale matching |
| `unit_converter` | `/unit-converter` | exact unit conversion |

## Memory

Functions that return a value, string or parts take an allocator, and the caller owns the result
(`deinit`, `gpa.free`, `decimal.freeParts`). An arena is the easy way to skip that. Temporary
memory inside an operation is freed before it returns. Constants and generated tables are
static: don't free them. Frameworks retain at most 2 packs and 64 locales by default
(`pack_cache_size` and `locale_cache_size`; zero disables retention). `loadLocale` returns an
owning LocaleHandle; `CLDRFramework.get` returns an owning CLDR. Deinit each returned owner.
Use clone for another owner; ordinary copies do not retain. Handles remain valid after
cache eviction and framework destruction. Bound groups and data pointers borrow their handle;
the allocator must outlive every owner. bindCLDR returns a borrowed CLDRView with no deinit.

Cache limits bound retained cache entries, plus data pinned by live handles. Message formatters
and translators retain at most 100 parsed messages by default; `cache_size = 0` disables
retention and null selects the default. Patterns over `max_cached_message_bytes` (64 KiB by
default) format normally without entering the cache. Translators also bound plural-rule entries
with `plural_cache_size` (default 64). Use a reclaiming allocator for long-lived caches: arena
allocators intentionally retain their allocations until arena destruction.

Frameworks, lazy locale caches, handles, formatters and translators are single-threaded. Use
one per thread or add caller-side synchronization; reference counts are non-atomic. Immutable
tables, loaded packs and plain values can be shared while their backing storage stays alive.
Same-thread formatter and translator callbacks may reenter formatting safely. Destruction
requires no active operations on that object.

## Timezone data

Timezone namespace functions use the bundled immutable database. Decode a custom Database
and call its fromUTC/fromWall/resolveId/zoneMeta/zoneIds methods directly. For datetime
operations, use `const ctx: datetime.ZoneContext = .{ .database = &db };` and the same
TypeScript function names, for example `ctx.dayAtTime(day, time, zone, options)`.
There is no mutable global database setter.

FrameworkOptions.timezone_database selects a database for dates created from that locale.
Calendar constructors take the database explicitly, and CalendarDate retains its pointer:
set, add, withZone, string conversion and differences use its original rules. Converting a
CalendarDate to another calendar preserves its database; a zoned epoch input uses the locale's
database. For differences between databases, each date retains its instant and the receiver's
database supplies wall arithmetic. The database owner must outlive all dates, contexts,
locale handles and borrowed metadata using it.

## Differences from the TypeScript

- Functions take typed values (`Decimal`, `Day`, enums), not loose numbers or strings: use
  `decimal.parse`, `language_tag.parseLanguageTag` and the like. Names follow the mapping above;
  rounding modes and other string unions are enums
  (`'half-even'` is `.half_even`).
- Decimal exponents and scales are bounded by +/-decimal.MAX_EXPONENT (999,999,999).
  Exponent-changing operations return error.ExponentOutOfRange when the result or
  requested context is outside that domain; allocator failures remain OutOfMemory.
- Thrown errors are Zig errors. Optional arguments are explicit or an options struct with
  defaults (`.{}`).
- Only the shipped schema config is supported (the one the packs are built with); custom
  configs are not.
- Instants are `i64` epoch milliseconds, so the TypeScript's fractional or NaN inputs can't be
  expressed.
- Each module's notes in `notes/zig-port/` list the rest, including the TypeScript quirks the
  port reproduces on purpose.

## Generated data and tests

Tables (time zones, plural rules, subtags, the pack schema, ...) are generated from the
TypeScript's data by `yarn zig-data` into `src/**/autogen.*.zig`; `yarn test` fails if they go
stale. Shared cases are regenerated with `yarn conformance`.

```sh
cd zig
zig build test               # everything (the core suites need the built packs)
zig build test-unit          # inline tests in src/
zig build test-core-dates    # one suite: test-<name> for each conformance/<name>.json
```
