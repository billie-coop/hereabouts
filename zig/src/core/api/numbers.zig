//! Number and currency formatting (`api/numbers.ts`).
//!
//! ```zig
//! const n = try decimal.parse(a, "1234.5");
//! const s = try numbers.formatDecimal(gpa, data, n, .{ .style = .short }); // "1.2K"
//! defer gpa.free(s);
//! ```
//!
//! Strings and parts returned are owned by `gpa` (free parts with `decimal.freeParts`).
//! Temporary memory is freed before returning.

const std = @import("std");
const Allocator = std.mem.Allocator;
const D = @import("../../decimal/decimal.zig");
const Decimal = D.Decimal;
const Part = D.Part;
const plurals = @import("../../plurals/plurals.zig");
const LocaleData = @import("../locale_data.zig").LocaleData;
const NumberParams = @import("../common/private.zig").NumberParams;
const opts = @import("../common/numbers.zig");
const ContextType = @import("../types/general.zig").ContextType;
const internal = @import("../internals/numbers/internal.zig");
const NumberRenderer = @import("../internals/numbers/render.zig").NumberRenderer;
const general = @import("../internals/general/internal.zig");
const render = @import("../utils/render.zig");
const util = @import("../internals/numbers/util.zig");
const private_numbers = @import("private/numbers.zig");

pub const DecimalFormatOptions = opts.DecimalFormatOptions;
pub const CurrencyFormatOptions = opts.CurrencyFormatOptions;
pub const DecimalAdjustOptions = opts.DecimalAdjustOptions;
pub const CurrencyFractions = opts.CurrencyFractions;
pub const CurrencySymbolWidth = opts.CurrencySymbolWidth;
pub const getNumberParams = private_numbers.getNumberParams;
pub const getCurrencyFractions = util.getCurrencyFractions;
pub const getCurrencyForRegion = util.getCurrencyForRegion;

pub const Error = error{
    /// 'Invalid argument: NaN'
    InvalidNaN,
    /// 'Invalid argument: Infinity'
    InvalidInfinity,
} || Allocator.Error;

/// `CurrencyDisplayNameOptions`. Null context is 'begin-sentence'.
pub const CurrencyDisplayNameOptions = struct {
    context: ?ContextType = null,
};

/// Adjust a decimal number using the given options. Owned by `gpa`. (`adjustDecimal`)
pub fn adjustDecimal(gpa: Allocator, data: *const LocaleData, n: Decimal, options: DecimalAdjustOptions) Allocator.Error!Decimal {
    _ = data;
    var arena: std.heap.ArenaAllocator = .init(gpa);
    defer arena.deinit();
    return D.clone(gpa, try internal.adjustNumber(arena.allocator(), n, options));
}

/// The currency symbol for a code, e.g. '$' for 'USD' in 'en'. Borrowed from the locale data
/// (or `code` itself). (`getCurrencySymbol`)
pub fn getCurrencySymbol(data: *const LocaleData, code: []const u8, width: CurrencySymbolWidth) []const u8 {
    return internal.currencySymbol(data, code, if (width == .narrow) "narrow" else "none");
}

/// The display name of a currency. Owned by `gpa`. (`getCurrencyDisplayName`)
pub fn getCurrencyDisplayName(gpa: Allocator, data: *const LocaleData, code: []const u8, options: CurrencyDisplayNameOptions) Allocator.Error![]u8 {
    const name = internal.currencyDisplayName(data, code);
    return general.contextTransform(gpa, name, data, options.context orelse .begin_sentence, "currencyName");
}

/// The pluralized name of a currency for the given number. Owned by `gpa`.
/// (`getCurrencyPluralName`)
pub fn getCurrencyPluralName(gpa: Allocator, data: *const LocaleData, n: Decimal, code: []const u8, options: CurrencyDisplayNameOptions) Allocator.Error![]u8 {
    const plural = plurals.cardinal(data.bundle.plurals, n, 0).name();
    const name = internal.currencyPluralName(data, code, plural);
    return general.contextTransform(gpa, name, data, options.context orelse .begin_sentence, "currencyName");
}

/// The cardinal plural category of the number ('one', 'other', ...), optionally adjusted
/// first. (`getPluralCardinal`)
pub fn getPluralCardinal(gpa: Allocator, data: *const LocaleData, n: Decimal, options: ?DecimalAdjustOptions) Allocator.Error![]const u8 {
    var arena: std.heap.ArenaAllocator = .init(gpa);
    defer arena.deinit();
    const d = if (options) |o| try internal.adjustNumber(arena.allocator(), n, o) else n;
    return plurals.cardinal(data.bundle.plurals, d, 0).name();
}

/// The ordinal plural category of the number, optionally adjusted first. (`getPluralOrdinal`)
pub fn getPluralOrdinal(gpa: Allocator, data: *const LocaleData, n: Decimal, options: ?DecimalAdjustOptions) Allocator.Error![]const u8 {
    var arena: std.heap.ArenaAllocator = .init(gpa);
    defer arena.deinit();
    const d = if (options) |o| try internal.adjustNumber(arena.allocator(), n, o) else n;
    return plurals.ordinal(data.bundle.plurals, d).name();
}

/// Format a number to a string (`formatDecimal`).
pub fn formatDecimal(gpa: Allocator, data: *const LocaleData, n: Decimal, options: DecimalFormatOptions) Error![]u8 {
    var arena: std.heap.ArenaAllocator = .init(gpa);
    defer arena.deinit();
    return render.joinParts(gpa, try decimalParts(arena.allocator(), data, n, options));
}

/// Format a number to parts (`formatDecimalToParts`).
pub fn formatDecimalToParts(gpa: Allocator, data: *const LocaleData, n: Decimal, options: DecimalFormatOptions) Error![]Part {
    var arena: std.heap.ArenaAllocator = .init(gpa);
    defer arena.deinit();
    return render.copyParts(gpa, try decimalParts(arena.allocator(), data, n, options));
}

/// Format a currency value to a string (`formatCurrency`).
pub fn formatCurrency(gpa: Allocator, data: *const LocaleData, n: Decimal, code: []const u8, options: CurrencyFormatOptions) Error![]u8 {
    var arena: std.heap.ArenaAllocator = .init(gpa);
    defer arena.deinit();
    return render.joinParts(gpa, try currencyParts(arena.allocator(), data, n, code, options));
}

/// Format a currency value to parts (`formatCurrencyToParts`).
pub fn formatCurrencyToParts(gpa: Allocator, data: *const LocaleData, n: Decimal, code: []const u8, options: CurrencyFormatOptions) Error![]Part {
    var arena: std.heap.ArenaAllocator = .init(gpa);
    defer arena.deinit();
    return render.copyParts(gpa, try currencyParts(arena.allocator(), data, n, code, options));
}

/// Decimal formatting into parts allocated in `a` (an arena), for other formatters.
pub fn decimalParts(a: Allocator, data: *const LocaleData, n: Decimal, options: DecimalFormatOptions) Error![]Part {
    const params = try getNumberParams(data, options.nu, null);
    const renderer: NumberRenderer = .{ .a = a, .params = params };
    // A NaN or Infinity value will just return the locale's representation
    if (try validate(n, options.errors, renderer, params)) |v| return v;
    return (try internal.renderDecimal(a, data, renderer, n, options, params)).parts;
}

/// Currency formatting into parts allocated in `a` (an arena), for other formatters.
pub fn currencyParts(a: Allocator, data: *const LocaleData, n: Decimal, code: []const u8, options: CurrencyFormatOptions) Error![]Part {
    const params = try getNumberParams(data, options.nu, "finance");
    const renderer: NumberRenderer = .{ .a = a, .params = params };
    // Not much to be done with NaN and Infinity with currencies, so we always throw an error.
    _ = try validate(n, .{ .nan = true, .infinity = true }, renderer, params);
    return internal.renderCurrency(a, data, renderer, n, code, options, params);
}

/// Check if the number is a NaN or Infinity and whether this should be an error, or return
/// the locale's string representation.
fn validate(n: Decimal, errors: opts.NumberFormatErrors, renderer: NumberRenderer, params: *const NumberParams) Error!?[]Part {
    const isnan = D.isNaN(n);
    const isinfinity = D.isInfinity(n);
    if (isnan and errors.nan) return error.InvalidNaN;
    if (isinfinity and errors.infinity) return error.InvalidInfinity;
    if (isnan) return try renderer.make("nan", params.symbols.nan);
    if (isinfinity) return try renderer.make("infinity", params.symbols.infinity);
    return null;
}
