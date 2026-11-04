//! Currency fractions and region currencies (`internals/numbers/util.ts`).

const CurrencyFractions = @import("../../common/numbers.zig").CurrencyFractions;
const autogen = @import("autogen.currencies.zig");

const default_currency_fractions: CurrencyFractions = .{
    .digits = 2,
    .rounding = 0,
    .cash_digits = 2,
    .cash_rounding = 0,
};

/// Rounding and decimal digits for a currency code (`getCurrencyFractions`).
pub fn getCurrencyFractions(code: []const u8) CurrencyFractions {
    return autogen.currency_fractions.get(code) orelse default_currency_fractions;
}

/// The currency of a region, 'USD' for unknown regions and 'ZZ' (`getCurrencyForRegion`).
pub fn getCurrencyForRegion(region: []const u8) []const u8 {
    if (std.mem.eql(u8, region, "ZZ")) return "USD";
    return autogen.currency_regions.get(region) orelse "USD";
}

const std = @import("std");
