//! Plural operands of a decimal. Port of `packages/hereabouts/src/plurals/operands.ts`.

const std = @import("std");
const Allocator = std.mem.Allocator;
const Decimal = @import("../decimal/decimal.zig").Decimal;

const RDIGITS = 7;
const POWERS10 = [_]u32{ 1, 10, 100, 1000, 10000, 100000, 1000000, 10000000, 100000000 };

// When a number crosses this limit we reduce it to avoid overflow. (The TypeScript keeps
// operands in doubles; the limit keeps them exact there, and the Zig keeps the same values.)
const LIMIT: i64 = 10000000000000;

/// Returns the number of digits in w, where w < 10^8.
pub fn digitCount(w: u32) u8 {
    if (w < 10000) {
        if (w < 100) return if (w < 10) 1 else 2;
        return if (w < 1000) 3 else 4;
    }
    if (w < 1000000) return if (w < 100000) 5 else 6;
    return if (w < 10000000) 7 else 8;
}

/// Operands for use in evaluating localized plural rules:
/// See: http://www.unicode.org/reports/tr35/tr35-numbers.html#Plural_Operand_Meanings
///
///   n  absolute value of the source number (here: its integer digits, as in the TypeScript;
///      rules on `n` only match when w is 0)
///   i  integer digits of n
///   v  number of visible fraction digits in n, with trailing zeros
///   w  number of visible fraction digits in n, without trailing zeros
///   f  visible fractional digits in n, with trailing zeros
///   t  visible fractional digits in n, without trailing zeros
///   c  compact decimal exponent value
///
/// Very large values are reduced to stay below about 2 * 10^13 while keeping their magnitude
/// and least-significant digits.
pub const NumberOperands = struct {
    n: i64 = 0,
    i: i64 = 0,
    v: i64 = 0,
    w: i64 = 0,
    f: i64 = 0,
    t: i64 = 0,
    c: i64 = 0,

    /// TypeScript `numberOperands` (plurals/operands.ts).
    pub fn init(d: Decimal, c_: i64) NumberOperands {
        return @import("operands.zig").numberOperands(d, c_);
    }

    /// TypeScript `numberOperandsToString` (plurals/operands.ts).
    pub fn toString(o: NumberOperands, gpa: Allocator) Allocator.Error![]u8 {
        return @import("operands.zig").numberOperandsToString(gpa, o);
    }
};

/// Compute the plural operands for the Decimal `d` with compact exponent `c` (0 for none).
pub fn numberOperands(d: Decimal, c_: i64) NumberOperands {
    if (d.flag != .none) return .{};

    const data = d.data;
    var exp = d.exp;

    const len = data.len;
    const last = len - 1;
    const precision: i64 = @as(i64, @intCast(last)) * RDIGITS + digitCount(data[last]);

    var n: i64 = 0;
    const v: i64 = if (exp < 0) -exp else 0;
    var w: i64 = 0;
    var f: i64 = 0;
    var t: i64 = 0;

    // Compact decimal exponent value
    // See https://www.unicode.org/reports/tr35/tr35-numbers.html#Operands
    const c: i64 = if (c_ < 0) 0 else c_;

    // Count trailing zeros
    var trail: i64 = 0;

    var intdigits = precision + exp;

    // Leading decimal zeros aren't part of the operands.
    if (intdigits < 0) intdigits = 0;

    // Start at most-significant digit to least
    var x: usize = len;
    outer: while (x > 0) {
        x -= 1;
        var r = data[x];
        const count: u8 = if (x != last) RDIGITS else digitCount(r);
        var y: usize = count;

        // Scan each decimal digit of the radix number from most- to least- significant.
        while (y > 0) {
            y -= 1;
            const p = POWERS10[y];
            const q: i64 = r / p;

            if (intdigits > 0) {
                // Integer part
                n = n * 10 + q;

                // If the integer digits exceed the limit we apply modulus.
                if (n > LIMIT) {
                    // Stay below the limit but preserve (a) the magnitude and (b) as
                    // many of the least-significant digits as possible
                    n = @rem(n, LIMIT) + LIMIT;
                }
                intdigits -= 1;
            } else {
                // Decimal part
                if (q == 0) {
                    trail += 1;
                } else {
                    trail = 0;
                }
                f = f * 10 + q;
            }

            // If the decimal digits exceed our limit we bail out early.
            if (f > LIMIT) break :outer;

            r %= p;
        }
    }

    // Trailing integer zeros
    while (exp > 0) {
        n *= 10;
        if (n > LIMIT) {
            n = @rem(n, LIMIT) + LIMIT;
        }
        exp -= 1;
    }

    // Special case for zero with exponent, e.g. '0.00'.
    if (len == 1 and data[0] == 0 and exp < 0) {
        w = 0;
    } else {
        w = v - trail;
        t = f;
        while (trail > 0) {
            t = @divTrunc(t, 10);
            trail -= 1;
        }
    }

    return .{ .n = n, .i = n, .v = v, .w = w, .f = f, .t = t, .c = c };
}

/// String representation of the operands, e.g. `"n: 1, i: 1, v: 1, w: 1, f: 3, t: 3, c: 0"`.
pub fn numberOperandsToString(gpa: Allocator, o: NumberOperands) Allocator.Error![]u8 {
    return std.fmt.allocPrint(gpa, "n: {d}, i: {d}, v: {d}, w: {d}, f: {d}, t: {d}, c: {d}", .{
        o.n, o.i, o.v, o.w, o.f, o.t, o.c,
    });
}

test "digit count" {
    try std.testing.expectEqual(@as(u8, 1), digitCount(0));
    try std.testing.expectEqual(@as(u8, 7), digitCount(9999999));
    try std.testing.expectEqual(@as(u8, 8), digitCount(99999999));
}
