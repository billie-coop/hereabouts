//! Number params of a locale: symbols, digits and grouping per number system
//! (`api/private/numbers.ts`).

const std = @import("std");
const Allocator = std.mem.Allocator;
const LocaleData = @import("../../locale_data.zig").LocaleData;
const private = @import("../../common/private.zig");
const NumberParams = private.NumberParams;
const NumberingSystem = private.NumberingSystem;
const NumberSymbols = private.NumberSymbols;
const CurrencySpacing = private.CurrencySpacing;
const NumberSystemInfo = @import("../../types/schema.zig").NumberSystemInfo;
const numbering = @import("../../systems/numbering/decimal.zig");
const number_parsing = @import("../../parsing/number.zig");

/// Symbols, digits and grouping for a number system of the locale. The requested system may
/// be a name ('arab') or a category ('native', 'finance', ...); invalid systems fall back to
/// the given default, then the locale's default. Null (or '') `number_system` uses the
/// locale's 'u-nu' extension; null `default_system` is 'default'. Cached in the locale data.
/// (`getNumberParams`)
pub fn getNumberParams(data: *const LocaleData, number_system: ?[]const u8, default_system: ?[]const u8) Allocator.Error!*const NumberParams {
    // Default numbering system for a locale unless explicitly overridden
    // https://www.unicode.org/reports/tr35/tr35-33/tr35-numbers.html#defaultNumberingSystem
    const def = nonEmpty(default_system) orelse "default";
    const sys = nonEmpty(number_system) orelse data.bundle.number_system;

    var real = select(data, sys);
    // Handle invalid number systems by returning the specified default
    if (numbering.digitsOf(real) == null) {
        real = select(data, def);
        // TODO: temporary double-check to default for zh finance until we have rbnf
        // implemented.
        if (numbering.digitsOf(real) == null) real = select(data, "default");
    }
    // The TypeScript fails here; packs always name a known default system.
    const name = staticName(real) orelse "latn";

    var key_buf: [64]u8 = undefined;
    const key = std.fmt.bufPrint(&key_buf, "numbers.params.{s}", .{name}) catch unreachable;
    return data.cached(NumberParams, key, name, build);
}

fn nonEmpty(s: ?[]const u8) ?[]const u8 {
    const v = s orelse return null;
    return if (v.len == 0) null else v;
}

/// The name as a static string from the digits table.
fn staticName(name: []const u8) ?[]const u8 {
    const map = @import("../../systems/numbering/autogen.names.zig").decimal_numbering_digits;
    const i = map.getIndex(name) orelse return null;
    return map.kvs.keys[i];
}

fn select(data: *const LocaleData, number_system: []const u8) []const u8 {
    for ([_][]const u8{ "default", "native", "finance", "traditional" }) |c| {
        if (std.mem.eql(u8, number_system, c)) {
            // Dereference to find real name of number system
            return data.schema.Numbers.numberSystems.get(&data.bundle, &.{c});
        }
    }
    return number_system;
}

fn latnInfo(data: *const LocaleData) *const NumberSystemInfo {
    return data.schema.Numbers.numberSystem.get("latn").?;
}

fn build(name: []const u8, data: *const LocaleData, a: Allocator) Allocator.Error!NumberParams {
    const latn_system = (try data.cached(NumberingSystem, "numbers.system.latn", @as([]const u8, "latn"), buildSystem)).*;
    const system = if (std.mem.eql(u8, name, "latn")) latn_system else try buildSystem(name, data, a);
    const li = latnInfo(data);
    const info = data.schema.Numbers.numberSystem.get(name) orelse li;
    const b = &data.bundle;
    const currency_spacing = if (info.currencyFormats.spacing.exists(b))
        CurrencySpacing.read(info.currencyFormats.spacing, b)
    else
        CurrencySpacing.read(li.currencyFormats.spacing, b);
    return .{
        .number_system_name = name,
        .system = system,
        .latn_system = latn_system,
        .digits = numbering.digitsOf(name).?,
        .latin_digits = numbering.digitsOf("latn").?,
        .symbols = system.symbols,
        .minimum_grouping_digits = system.minimum_grouping_digits,
        .primary_grouping_size = system.primary_grouping_size,
        .secondary_grouping_size = system.secondary_grouping_size,
        .currency_spacing = currency_spacing,
    };
}

fn buildSystem(name: []const u8, data: *const LocaleData, a: Allocator) Allocator.Error!NumberingSystem {
    const numbers = data.schema.Numbers;
    const li = latnInfo(data);
    const info = numbers.numberSystem.get(name) orelse li;
    const b = &data.bundle;
    const symbols = if (info.symbols.exists(b)) NumberSymbols.read(info.symbols, b) else NumberSymbols.read(li.symbols, b);

    var standard_raw = info.decimalFormats.standard.get(b);
    if (standard_raw.len == 0) standard_raw = li.decimalFormats.standard.get(b);

    // Fetch standard pattern to determine grouping digits
    const standard = (try number_parsing.parseNumberPatternAlloc(a, standard_raw))[0];
    const mgd = std.fmt.parseInt(i64, numbers.minimumGroupingDigits.get(b), 10) catch 0;
    return numbering.decimalNumberingSystem(name, numbering.digitsOf(name).?, symbols, mgd, standard.pri_group, standard.sec_group);
}
