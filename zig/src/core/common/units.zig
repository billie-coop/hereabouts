//! Unit formatting options (`common/units.ts`).

const std = @import("std");
const Decimal = @import("../../decimal/decimal.zig").Decimal;
const RoundingMode = @import("../../decimal/decimal.zig").RoundingMode;
const DecimalFormatStyle = @import("numbers.zig").DecimalFormatStyle;

/// A value with optional units, e.g. 3 meters per second. Unit ids are strings ('meter').
pub const Quantity = struct {
    value: Decimal,
    unit: ?[]const u8 = null,
    per: ?[]const u8 = null,
    times: ?[]const u8 = null,
};

/// `UnitLength`
pub const UnitLength = enum {
    short,
    narrow,
    long,

    pub fn fromString(s: []const u8) ?UnitLength {
        return std.meta.stringToEnum(UnitLength, s);
    }
};

/// `UnitFormatOptions`. The style is one of the number styles ('decimal', 'short', 'long',
/// 'scientific'); others format nothing, as in the TypeScript.
pub const UnitFormatOptions = struct {
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
    style: DecimalFormatStyle = .decimal,
    /// Null: 'long' for the patterns, and the 'unit-long' list.
    length: ?UnitLength = null,
};
