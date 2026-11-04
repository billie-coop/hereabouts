//! Number and currency formatting options (`common/numbers.ts`).

const std = @import("std");
const RoundingMode = @import("../../decimal/decimal.zig").RoundingMode;

/// `DecimalFormatStyleType`
pub const DecimalFormatStyle = enum {
    decimal,
    short,
    long,
    scientific,
    percent,
    percent_scaled,
    permille,
    permille_scaled,

    /// Parse 'decimal', 'short', 'long', 'scientific', 'percent', 'percent-scaled', 'permille'
    /// or 'permille-scaled'.
    pub fn fromString(s: []const u8) ?DecimalFormatStyle {
        const map = std.StaticStringMap(DecimalFormatStyle).initComptime(.{
            .{ "decimal", .decimal },               .{ "short", .short },
            .{ "long", .long },                     .{ "scientific", .scientific },
            .{ "percent", .percent },               .{ "percent-scaled", .percent_scaled },
            .{ "permille", .permille },             .{ "permille-scaled", .permille_scaled },
        });
        return map.get(s);
    }
};

/// `CurrencyFormatStyleType`
pub const CurrencyFormatStyle = enum {
    symbol,
    accounting,
    code,
    name,
    short,

    pub fn fromString(s: []const u8) ?CurrencyFormatStyle {
        return std.meta.stringToEnum(CurrencyFormatStyle, s);
    }
};

/// `CurrencySymbolWidthType`
pub const CurrencySymbolWidth = enum {
    default,
    narrow,

    pub fn fromString(s: []const u8) ?CurrencySymbolWidth {
        return std.meta.stringToEnum(CurrencySymbolWidth, s);
    }
};

/// Which non-finite values are errors instead of the locale's NaN or infinity symbol
/// (`NumberFormatErrorType[]`).
pub const NumberFormatErrors = struct {
    nan: bool = false,
    infinity: bool = false,
};

/// Options shared by decimal, currency and unit formatting (`NumberFormatOptions`). Null
/// means not set (undefined).
pub const NumberFormatOptions = struct {
    /// Number system name ('arab') or category ('native', 'finance', ...).
    nu: ?[]const u8 = null,
    round: ?RoundingMode = null,
    /// Default (null) true.
    group: ?bool = null,
    minimum_integer_digits: ?i64 = null,
    maximum_fraction_digits: ?i64 = null,
    minimum_fraction_digits: ?i64 = null,
    maximum_significant_digits: ?i64 = null,
    minimum_significant_digits: ?i64 = null,
    /// Values whose fraction part is all zeros will format as a whole number,
    /// e.g. '10.00' formats as '$10'
    trim_zero_fractions: bool = false,
};

/// `DecimalFormatOptions`
pub const DecimalFormatOptions = struct {
    nu: ?[]const u8 = null,
    round: ?RoundingMode = null,
    group: ?bool = null,
    minimum_integer_digits: ?i64 = null,
    maximum_fraction_digits: ?i64 = null,
    minimum_fraction_digits: ?i64 = null,
    maximum_significant_digits: ?i64 = null,
    minimum_significant_digits: ?i64 = null,
    trim_zero_fractions: bool = false,
    /// Fixed divisor for compact styles, e.g. 1000. Null or 0: none.
    divisor: ?f64 = null,
    negative_zero: ?bool = null,
    style: DecimalFormatStyle = .decimal,
    errors: NumberFormatErrors = .{},
};

/// `DecimalAdjustOptions`
pub const DecimalAdjustOptions = struct {
    round: ?RoundingMode = null,
    minimum_integer_digits: ?i64 = null,
    maximum_fraction_digits: ?i64 = null,
    minimum_fraction_digits: ?i64 = null,
    maximum_significant_digits: ?i64 = null,
    minimum_significant_digits: ?i64 = null,
};

/// `CurrencyFormatOptions`
pub const CurrencyFormatOptions = struct {
    nu: ?[]const u8 = null,
    round: ?RoundingMode = null,
    group: ?bool = null,
    minimum_integer_digits: ?i64 = null,
    maximum_fraction_digits: ?i64 = null,
    minimum_fraction_digits: ?i64 = null,
    maximum_significant_digits: ?i64 = null,
    minimum_significant_digits: ?i64 = null,
    trim_zero_fractions: bool = false,
    divisor: ?f64 = null,
    cash: bool = false,
    style: CurrencyFormatStyle = .symbol,
    symbol_width: CurrencySymbolWidth = .default,
};

/// Information on rounding and number of decimal digits for a given currency.
pub const CurrencyFractions = struct {
    digits: u16,
    rounding: u16,
    cash_digits: u16,
    cash_rounding: u16,
};

/// The number options of any options struct above, for the number context.
pub fn numberOptions(o: anytype) NumberFormatOptions {
    var r: NumberFormatOptions = .{};
    inline for (std.meta.fields(NumberFormatOptions)) |f| {
        if (@hasField(@TypeOf(o), f.name)) @field(r, f.name) = @field(o, f.name);
    }
    return r;
}
