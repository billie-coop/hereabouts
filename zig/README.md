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
    const s = try de.Numbers.formatDecimal(a, n, .{ .maximum_fraction_digits = 2 });
    std.debug.print("{s}\n", .{s}); // 1.234,57
    const c = try de.Numbers.formatCurrency(a, n, "EUR", .{});
    std.debug.print("{s}\n", .{c}); // 1.234,57 €

    const sum = try decimal.add(a, try decimal.parse(a, "0.1"), try decimal.parse(a, "0.2"));
    std.debug.print("{s}\n", .{try decimal.toString(a, sum)}); // 0.3
}
```

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

## Differences from the TypeScript

- Functions take typed values (`Decimal`, `Day`, enums), not loose numbers or strings: use
  `decimal.parse`, `language_tag.parse` and the like. Names drop a prefix the namespace already
  says (`decimalAdd` is `decimal.add`); rounding modes and other string unions are enums
  (`'half-even'` is `.half_even`).
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
