//! Coefficient comparison and digit counting.
//! Port of `packages/hereabouts/src/decimal/operations.ts`.

const math = @import("math.zig");
const RDIGITS = math.RDIGITS;
const wv = math.wv;

/// Word at index i, or null past either end. The TypeScript reads `undefined` there, which
/// compares as greater than anything; `cmp` keeps that behavior.
fn at(data: []const u32, i: i64) ?i64 {
    if (i < 0 or i >= @as(i64, @intCast(data.len))) {
        return null;
    }
    return wv(data[@intCast(i)]);
}

fn cmp(a: ?i64, b: ?i64) i32 {
    const x = a orelse return 1;
    const y = b orelse return 1;
    return if (x < y) -1 else if (x == y) 0 else 1;
}

/// Compare coefficient a with coefficient b shifted left by `shift` digits.
pub fn compare(a: []const u32, b: []const u32, shift: i64) i32 {
    var n: i64 = @intCast(a.len);
    var m: i64 = @intCast(b.len);

    const qr = math.divword(shift, RDIGITS);
    const q = qr.q;
    const r = qr.r;

    if (r == 0) {
        m -= 1;
        while (m >= 0) : (m -= 1) {
            const c = cmp(at(a, m + q), at(b, m));
            if (c != 0) {
                return c;
            }
        }
    } else {
        const ph = math.pow10(r);
        var c: i32 = 0;
        m -= 1;
        n -= 1;
        var dv = math.divpow10(at(b, m) orelse 0, RDIGITS - r);
        m -= 1;
        var loprev = dv.r;
        if (dv.q != 0) {
            c = cmp(at(a, n), dv.q);
            if (c != 0) {
                return c;
            }
            n -= 1;
        }
        var x: i64 = 0;
        while (m >= 0) : ({
            m -= 1;
            n -= 1;
        }) {
            dv = math.divpow10(at(b, m) orelse 0, RDIGITS - r);
            x = ph * loprev + dv.q;
            c = cmp(at(a, n), x);
            if (c != 0) {
                return c;
            }
            loprev = dv.r;
        }
        x = ph * loprev;
        c = cmp(at(a, q), x);
        if (c != 0) {
            return c;
        }
    }
    return if (allzero(a, q)) 0 else 1;
}

/// True if the first `len` words are all zero (or `len` is past the end).
pub fn allzero(data: []const u32, len: i64) bool {
    if (len <= @as(i64, @intCast(data.len))) {
        var i: i64 = len - 1;
        while (i >= 0) : (i -= 1) {
            if (data[@intCast(i)] != 0) {
                return false;
            }
        }
    }
    return true;
}

/// Number of digits in w, where w < RADIX.
pub fn digitCount(w: i64) i64 {
    if (w < 10000) {
        if (w < 100) {
            return if (w < 10) 1 else 2;
        }
        return if (w < 1000) 3 else 4;
    }
    if (w < 1000000) {
        return if (w < 100000) 5 else 6;
    }
    return if (w < 10000000) 7 else 8;
}
