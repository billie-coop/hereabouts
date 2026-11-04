//! Arithmetic on coefficients: little-endian arrays of base 10^7 words.
//! Port of `packages/hereabouts/src/decimal/math.ts`.

const std = @import("std");
const Allocator = std.mem.Allocator;

/// Word base. 10^7 squared fits comfortably in an i64.
pub const RADIX: i64 = 10_000_000;
/// Decimal digits per word.
pub const RDIGITS: i64 = 7;

pub const POWERS10 = [_]i64{ 1, 10, 100, 1000, 10000, 100000, 1000000, 10000000, 100000000 };

/// A growable coefficient.
pub const Words = std.ArrayList(u32);

pub inline fn wv(x: u32) i64 {
    return x;
}

pub inline fn word(x: i64) u32 {
    return @intCast(x);
}

pub inline fn pow10(i: i64) i64 {
    return POWERS10[@intCast(i)];
}

/// A coefficient of `n` zero words.
pub fn zeros(a: Allocator, n: usize) Allocator.Error!Words {
    var w = try Words.initCapacity(a, n + 1);
    w.appendNTimesAssumeCapacity(0, n);
    return w;
}

pub fn fromSlice(a: Allocator, s: []const u32) Allocator.Error!Words {
    var w = try Words.initCapacity(a, s.len + 1);
    w.appendSliceAssumeCapacity(s);
    return w;
}

/// Knuth TAoCP 4.3.1 Algorithm A: u + v, where u.len >= v.len.
pub fn add(a: Allocator, u: []const u32, v: []const u32) Allocator.Error!Words {
    var w = try Words.initCapacity(a, u.len + 1);
    var k: i64 = 0;
    for (u, 0..) |uj, j| {
        const vj: i64 = if (j < v.len) v[j] else 0;
        const z = wv(uj) + vj + k;
        w.appendAssumeCapacity(word(@mod(z, RADIX)));
        k = @divTrunc(z, RADIX);
    }
    if (k == 1) {
        w.appendAssumeCapacity(1);
    }
    return w;
}

/// Knuth TAoCP 4.3.1 Algorithm S: u - v, where u >= v and u.len >= v.len.
pub fn subtract(a: Allocator, u: []const u32, v: []const u32) Allocator.Error!Words {
    var w = try Words.initCapacity(a, u.len + 1);
    var j: usize = 0;
    var k: i64 = 0;
    while (j < v.len) : (j += 1) {
        const z = wv(u[j]) - wv(v[j]) - k;
        w.appendAssumeCapacity(word(if (z < 0) z + RADIX else z));
        k = if (z < 0) 1 else 0;
    }
    while (k != 0 and j < u.len) : (j += 1) {
        const z = wv(u[j]) - k;
        w.appendAssumeCapacity(word(if (z < 0) z + RADIX else z));
        k = if (z < 0) 1 else 0;
    }
    while (j < u.len) : (j += 1) {
        w.appendAssumeCapacity(u[j]);
    }
    return w;
}

/// Knuth TAoCP 4.3.1 Algorithm M: u * v.
pub fn multiply(a: Allocator, u: []const u32, v: []const u32) Allocator.Error!Words {
    const m = u.len;
    const n = v.len;
    const out = try zeros(a, n + m);
    const w = out.items;
    for (0..n) |j| {
        var k: i64 = 0;
        for (0..m) |i| {
            const p = k + wv(w[i + j]) + wv(u[i]) * wv(v[j]);
            k = @divTrunc(p, RADIX);
            w[i + j] = word(p - k * RADIX);
        }
        w[j + m] = word(k);
    }
    return out;
}

/// u * v for a single word v, written to w. See TAoCP 4.3.1 exercise 13.
fn multiplyword(w: []u32, u: []const u32, n: usize, v: i64) void {
    var k: i64 = 0;
    var i: usize = 0;
    while (i < n) : (i += 1) {
        const p = k + wv(u[i]) * v;
        k = @divTrunc(p, RADIX);
        w[i] = word(p - k * RADIX);
    }
    if (k > 0) {
        w[i] = word(k);
    }
}

pub const QuotRem = struct { q: Words, r: Words };

/// Knuth TAoCP 4.3.1 Algorithm D: quotient and remainder of u / v.
///
/// As in the TypeScript, D3 corrects the trial quotient in a loop for as long as needed, and D4
/// multiplies by the full trial quotient. Both guard against the known flaw in the printed
/// algorithm; see the comment on `divide` in math.ts before changing either.
pub fn divide(a: Allocator, uc: []const u32, vc: []const u32) Allocator.Error!QuotRem {
    const n = vc.len;
    if (n == 1) {
        return divideword(a, uc, vc[0]);
    }
    if (uc.len < n) {
        @panic("decimal divide: dividend is shorter than divisor");
    }
    const m = uc.len - n;
    const nplusm = n + m;

    // Copies of u and v, each with an extra word.
    const u = try a.alloc(u32, nplusm + 1);
    @memcpy(u[0..nplusm], uc);
    u[nplusm] = 0;
    const v = try a.alloc(u32, n + 1);
    @memcpy(v[0..n], vc);
    v[n] = 0;

    var q = try zeros(a, nplusm + 1);

    // D1. Normalize
    const d = @divTrunc(RADIX, wv(v[n - 1]) + 1);
    if (d != 1) {
        multiplyword(u, uc, nplusm, d);
        multiplyword(v, vc, n, d);
    }

    var k: i64 = 0;
    var p: i64 = 0;
    var hi: i64 = 0;
    var lo: i64 = 0;

    var jj: usize = m + 1;
    while (jj > 0) {
        jj -= 1;
        const j = jj;

        // D3. Calculate q̂ and r̂.
        p = wv(u[j + n - 1]) + wv(u[j + n]) * RADIX;
        var qhat = @divTrunc(p, wv(v[n - 1]));
        var rhat = p - qhat * wv(v[n - 1]);
        while (true) {
            if (qhat < RADIX) {
                const z = qhat * wv(v[n - 2]);
                hi = @divTrunc(z, RADIX);
                lo = z - hi * RADIX;
                if (hi <= rhat) {
                    if (hi != rhat or lo <= wv(u[j + n - 2])) {
                        break;
                    }
                }
            }
            qhat -= 1;
            rhat += wv(v[n - 1]);
            if (rhat >= RADIX) {
                break;
            }
        }

        // D4. Multiply and subtract.
        k = 0;
        var i: usize = 0;
        while (i <= n) : (i += 1) {
            p = qhat * wv(v[i]) + k;
            hi = @divTrunc(p, RADIX);
            lo = p - hi * RADIX;
            const x = wv(u[i + j]) - lo;
            k = if (x < 0) 1 else 0;
            u[i + j] = word(if (k != 0) x + RADIX else x);
            k += hi;
        }

        q.items[j] = word(qhat);

        // D5, D6. Add back if the quotient digit was too large by 1.
        if (k > 0) {
            q.items[j] -= 1;
            addhelper(u, j, v, n + 1, n);
        }
    }

    // D8. Unnormalize the remainder.
    k = 0;
    var r = try zeros(a, n);
    var i: usize = n;
    while (i > 0) {
        i -= 1;
        p = wv(u[i]) + k * RADIX;
        r.items[i] = word(@divTrunc(p, d));
        k = p - wv(r.items[i]) * d;
    }
    return .{ .q = q, .r = r };
}

/// Knuth TAoCP 4.3.1 exercise 16: u / v for a single word v.
fn divideword(a: Allocator, u: []const u32, v: u32) Allocator.Error!QuotRem {
    const n = u.len;
    var q = try zeros(a, n);
    var r: i64 = 0;
    var i: usize = n;
    while (i > 0) {
        i -= 1;
        const p = wv(u[i]) + r * RADIX;
        const qi = @divTrunc(p, wv(v));
        q.items[i] = word(qi);
        r = p - qi * wv(v);
    }
    var rem = try Words.initCapacity(a, 1);
    rem.appendAssumeCapacity(word(r));
    return .{ .q = q, .r = rem };
}

/// divide() "add back" helper: adds v to u, starting at word j.
fn addhelper(u: []u32, j: usize, v: []const u32, m: usize, n: usize) void {
    var i: usize = 0;
    var k: i64 = 0;
    while (i < n) : (i += 1) {
        const s = wv(u[i + j]) + (wv(v[i]) + k);
        k = if (s >= RADIX) 1 else 0;
        u[i + j] = word(if (k != 0) s - RADIX else s);
    }
    while (k != 0 and i < m) : (i += 1) {
        const s = wv(u[i + j]) + k;
        k = if (s == RADIX) 1 else 0;
        u[i + j] = word(if (k == 1) s - RADIX else s);
    }
    // Final carry is ignored.
}

/// Remove zero words from the top, keeping at least one word.
pub fn trimLeadingZeros(w: *Words) void {
    while (w.items.len > 1 and w.items[w.items.len - 1] == 0) {
        w.items.len -= 1;
    }
}

pub const DivRem = struct { q: i64, r: i64 };

/// Quotient and remainder of n / 10^exp.
pub fn divpow10(n: i64, exp: i64) DivRem {
    const p = pow10(exp);
    const q = @divTrunc(n, p);
    return .{ .q = q, .r = n - q * p };
}

/// Quotient and remainder of n / div.
pub fn divword(n: i64, div: i64) DivRem {
    const q = @divTrunc(n, div);
    return .{ .q = q, .r = n - q * div };
}
