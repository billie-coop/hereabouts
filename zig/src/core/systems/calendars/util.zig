//! JavaScript number semantics for the date math, which is written with doubles as the
//! TypeScript is (`util.ts` plus the operators the TypeScript relies on).

const std = @import("std");

/// `Math.floor(n / d)`, with the remainder in `r`. The remainder is JavaScript's `n % d`, which
/// keeps the sign of `n` (so for negative `n` it does not pair with the floored quotient).
pub fn floorDiv(n: f64, d: f64, r: *f64) f64 {
    const q = @floor(n / d);
    r.* = @rem(n, d);
    return q;
}

/// JavaScript `x | 0`: truncate to a signed 32-bit integer, wrapping. NaN and infinities are 0.
pub fn toInt32(x: f64) f64 {
    if (!std.math.isFinite(x)) return 0;
    const t = @trunc(x);
    var m = @rem(t, 4294967296.0);
    if (m < 0) m += 4294967296.0;
    return if (m >= 2147483648.0) m - 4294967296.0 else m;
}

/// JavaScript `Math.round`: halves round towards +Infinity.
pub fn round(x: f64) f64 {
    if (!std.math.isFinite(x)) return x;
    const f = @floor(x);
    return if (x - f >= 0.5) f + 1 else f;
}

/// JavaScript `Math.sign` (NaN for NaN).
pub fn sign(x: f64) f64 {
    if (x > 0) return 1;
    if (x < 0) return -1;
    return x;
}

/// JavaScript truthiness of a number: not 0 and not NaN.
pub fn truthy(x: f64) bool {
    return x != 0 and !std.math.isNan(x);
}

/// `x || 0`.
pub fn orZero(x: f64) f64 {
    return if (truthy(x)) x else 0;
}

/// `Math.min(max, Math.max(min, n))`, with NaN passing through as in JavaScript.
pub fn clamp(n: f64, min: f64, max: f64) f64 {
    if (std.math.isNan(n)) return n;
    return @min(max, @max(min, n));
}

/// A field value as an integer: fields hold integers, so this only saturates the absurd ones
/// (and maps NaN to 0).
pub fn toInt(x: f64) i64 {
    if (std.math.isNan(x)) return 0;
    if (x >= 9.2e18) return std.math.maxInt(i64);
    if (x <= -9.2e18) return std.math.minInt(i64);
    return @intFromFloat(@trunc(x));
}

/// An instant for the time zone lookups, which take integer milliseconds. They only compare it
/// with integer transition times, so flooring gives the same answer as the fractional value,
/// and clamping far outside every transition does too. NaN is 0.
pub fn toInstant(x: f64) i64 {
    if (std.math.isNan(x)) return 0;
    const lim: f64 = 4.0e18;
    if (x >= lim) return @intFromFloat(lim);
    if (x <= -lim) return -@as(i64, @intFromFloat(lim));
    return @intFromFloat(@floor(x));
}

test "toInt32" {
    try std.testing.expectEqual(@as(f64, 0), toInt32(std.math.nan(f64)));
    try std.testing.expectEqual(@as(f64, -1), toInt32(-1.7));
    try std.testing.expectEqual(@as(f64, 1410065408), toInt32(1e10));
    try std.testing.expectEqual(@as(f64, -2147483648), toInt32(2147483648));
    try std.testing.expectEqual(@as(f64, 2147483647), toInt32(-2147483649));
}

test "round" {
    try std.testing.expectEqual(@as(f64, 3), round(2.5));
    try std.testing.expectEqual(@as(f64, -2), round(-2.5));
    try std.testing.expectEqual(@as(f64, 0), round(0.49999999999999994));
}
