//! Number symbols, numbering systems and number params (`common/private.ts`).

const std = @import("std");
const Bundle = @import("../resource/bundle.zig").Bundle;
const VectorArrow = @import("../schema/schema/arrows.zig").VectorArrow;

/// The locale's number symbols for a number system. Missing symbols are ''.
pub const NumberSymbols = struct {
    approximately_sign: []const u8 = "",
    currency_decimal: []const u8 = "",
    currency_group: []const u8 = "",
    decimal: []const u8 = "",
    exponential: []const u8 = "",
    group: []const u8 = "",
    infinity: []const u8 = "",
    list: []const u8 = "",
    minus_sign: []const u8 = "",
    nan: []const u8 = "",
    per_mille: []const u8 = "",
    percent_sign: []const u8 = "",
    plus_sign: []const u8 = "",
    superscripting_exponent: []const u8 = "",
    time_separator: []const u8 = "",

    /// Read the symbols vector ([number-symbol]) of a bundle.
    pub fn read(arrow: VectorArrow, bundle: *const Bundle) NumberSymbols {
        var s: NumberSymbols = .{};
        inline for (std.meta.fields(NumberSymbols), @import("../types/numbers.zig").number_symbol_names) |f, key| {
            @field(s, f.name) = arrow.get(bundle, &.{key});
        }
        return s;
    }
};

/// Currency spacing rules on one side of the symbol.
pub const CurrencySpacingPatterns = struct {
    currency_match: []const u8 = "",
    surrounding_match: []const u8 = "",
    insert_between: []const u8 = "",
};

/// Currency spacing rules before and after the symbol.
pub const CurrencySpacing = struct {
    before: CurrencySpacingPatterns = .{},
    after: CurrencySpacingPatterns = .{},

    /// Read the spacing vector ([currency-spacing-pos, currency-spacing-pattern]).
    pub fn read(arrow: VectorArrow, bundle: *const Bundle) CurrencySpacing {
        var s: CurrencySpacing = .{};
        inline for (.{ "before", "after" }) |pos| {
            inline for (std.meta.fields(CurrencySpacingPatterns), .{ "currencyMatch", "surroundingMatch", "insertBetween" }) |f, key| {
                @field(@field(s, pos), f.name) = arrow.get(bundle, &.{ pos, key });
            }
        }
        return s;
    }
};

/// A decimal numbering system: its digits, symbols and grouping sizes. Format numbers with it
/// using `numbering.formatString`.
pub const NumberingSystem = struct {
    name: []const u8,
    digits: *const [10][]const u8,
    symbols: NumberSymbols,
    minimum_grouping_digits: i64,
    primary_grouping_size: i64,
    secondary_grouping_size: i64,
};

/// Everything number formatting needs for one number system of a locale.
pub const NumberParams = struct {
    number_system_name: []const u8,
    system: NumberingSystem,
    latn_system: NumberingSystem,
    digits: *const [10][]const u8,
    latin_digits: *const [10][]const u8,
    symbols: NumberSymbols,
    minimum_grouping_digits: i64,
    primary_grouping_size: i64,
    secondary_grouping_size: i64,
    currency_spacing: CurrencySpacing,
};
