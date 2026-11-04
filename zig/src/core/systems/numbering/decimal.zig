//! Decimal numbering systems (`systems/numbering/decimal.ts`).

const std = @import("std");
const Allocator = std.mem.Allocator;
const D = @import("../../../decimal/decimal.zig");
const Decimal = D.Decimal;
const private = @import("../../common/private.zig");
const NumberingSystem = private.NumberingSystem;
const NumberSymbols = private.NumberSymbols;
const autogen = @import("autogen.names.zig");

/// The ten digits of a decimal numbering system by name ('latn', 'arab', ...), or null.
pub fn digitsOf(name: []const u8) ?*const [10][]const u8 {
    const i = autogen.decimal_numbering_digits.getIndex(name) orelse return null;
    return &autogen.decimal_numbering_digits.kvs.values[i];
}

/// Build a numbering system (`decimalNumberingSystem`).
pub fn decimalNumberingSystem(
    name: []const u8,
    digits: *const [10][]const u8,
    symbols: NumberSymbols,
    minimum_grouping_digits: i64,
    primary_grouping_size: i64,
    secondary_grouping_size: i64,
) NumberingSystem {
    return .{
        .name = name,
        .digits = digits,
        .symbols = symbols,
        .minimum_grouping_digits = minimum_grouping_digits,
        .primary_grouping_size = primary_grouping_size,
        .secondary_grouping_size = secondary_grouping_size,
    };
}

/// Format a decimal directly to a string, without sign, e.g. for low-level calendar field
/// formatting. Owned by `gpa`. (`numberingFormatString` with a Decimal or string argument)
pub fn formatString(gpa: Allocator, system: NumberingSystem, n: Decimal, group_digits: bool, min_int: i64) Allocator.Error![]u8 {
    var f = D.StringFormatter.init(gpa);
    defer f.deinit();
    const dec = if (system.symbols.decimal.len > 0) system.symbols.decimal else ".";
    const group = if (group_digits) system.symbols.group else "";
    try D.format(
        gpa,
        n,
        &f,
        dec,
        group,
        min_int,
        system.minimum_grouping_digits,
        system.primary_grouping_size,
        system.secondary_grouping_size,
        true,
        system.digits,
    );
    return f.render(gpa);
}

/// Format an integer to a string, without sign (`numberingFormatString` with a number
/// argument): without grouping this takes the fast path. Owned by `gpa`.
pub fn formatInt(gpa: Allocator, system: NumberingSystem, n: i64, group_digits: bool, min_int: i64) Allocator.Error![]u8 {
    var buf: [24]u8 = undefined;
    const s = std.fmt.bufPrint(&buf, "{d}", .{n}) catch unreachable;
    if (!group_digits) return fastFormatDecimal(gpa, s, system.digits, min_int);
    var arena: std.heap.ArenaAllocator = .init(gpa);
    defer arena.deinit();
    const d = try D.fromInt(arena.allocator(), n);
    return formatString(gpa, system, d, group_digits, min_int);
}

/// Fast formatter for integers, no grouping, etc: maps the ASCII digits of `n` (dropping
/// anything else) and left-pads with zeros to `min_int` digits. (`fastFormatDecimal`)
pub fn fastFormatDecimal(gpa: Allocator, n: []const u8, digits: *const [10][]const u8, min_int: i64) Allocator.Error![]u8 {
    // The TypeScript compares the string length, in UTF-16 code units: a digit outside the
    // BMP counts twice.
    var count: i64 = 0;
    for (n) |c| {
        if (c >= '0' and c <= '9') count += utf16Len(digits[c - '0']);
    }
    var out: std.ArrayList(u8) = .empty;
    errdefer out.deinit(gpa);
    // Left pad zeros if minimum integer digits > formatted length
    var diff = min_int - count;
    if (diff > 0) {
        while (diff > 0) : (diff -= 1) try out.appendSlice(gpa, digits[0]);
    }
    for (n) |c| {
        if (c >= '0' and c <= '9') try out.appendSlice(gpa, digits[c - '0']);
    }
    return out.toOwnedSlice(gpa);
}

fn utf16Len(s: []const u8) i64 {
    var n: i64 = 0;
    for (s) |c| {
        if ((c & 0xc0) != 0x80) n += if (c >= 0xf0) 2 else 1;
    }
    return n;
}

const INTERNAL_SYMBOLS: NumberSymbols = .{
    .approximatelySign = "~",
    .currencyDecimal = ".",
    .currencyGroup = ",",
    .decimal = ".",
    .exponential = "E",
    .group = ",",
    .infinity = "∞",
    .list = ";",
    .minusSign = "-",
    .nan = "NaN",
    .perMille = "‰",
    .percentSign = "%",
    .plusSign = "+",
    .superscriptingExponent = "×",
    .timeSeparator = ":",
};

/// Latin digits with fixed English-style symbols.
pub const INTERNAL_NUMBERING: NumberingSystem = decimalNumberingSystem("internal", &D.DECIMAL_DIGITS, INTERNAL_SYMBOLS, 1, 3, 3);

test "fast format" {
    const gpa = std.testing.allocator;
    const s = try fastFormatDecimal(gpa, "-42", digitsOf("arab").?, 4);
    defer gpa.free(s);
    try std.testing.expectEqualStrings("٠٠٤٢", s);
}
