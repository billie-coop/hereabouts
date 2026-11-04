//! Arbitrary precision decimals.
//! Port of `packages/hereabouts/src/decimal/decimal.ts`.
//!
//! A `Decimal` is plain data: `value = sign * coefficient * 10^exp`, with the coefficient stored
//! little-endian in base 10^7 words. Functions that return a `Decimal` allocate a fresh one with
//! the allocator you pass; free it with `deinit` (or use an arena). The constants (`ONE`, `PI`,
//! ...) are static and must not be freed.

const std = @import("std");
const Allocator = std.mem.Allocator;
const ArenaAllocator = std.heap.ArenaAllocator;

const math = @import("math.zig");
const ops = @import("operations.zig");
const fmt = @import("format.zig");

const Words = math.Words;
const RADIX = math.RADIX;
const RDIGITS = math.RDIGITS;
const wv = math.wv;
const word = math.word;

pub const Part = fmt.Part;
pub const freeParts = fmt.freeParts;
pub const StringFormatter = fmt.StringFormatter;
pub const PartsFormatter = fmt.PartsFormatter;

/// Special values.
pub const Flag = enum(u8) {
    none = 0,
    nan = 1,
    infinity = 2,
};

/// Modes for controlling rounding.
pub const RoundingMode = enum {
    up,
    down,
    ceiling,
    floor,
    half_up,
    half_down,
    half_even,

    /// Parse the TypeScript names: 'up', 'half-even', ...
    pub fn fromString(s: []const u8) ?RoundingMode {
        const names = [_]struct { []const u8, RoundingMode }{
            .{ "up", .up },
            .{ "down", .down },
            .{ "ceiling", .ceiling },
            .{ "floor", .floor },
            .{ "half-up", .half_up },
            .{ "half-down", .half_down },
            .{ "half-even", .half_even },
        };
        for (names) |entry| {
            if (std.mem.eql(u8, s, entry[0])) return entry[1];
        }
        return null;
    }
};

/// Sets the scale or precision, and the rounding mode, for a math operation. Scale wins if
/// both are set. With neither, the precision is 28 digits.
pub const MathContext = struct {
    scale: ?i64 = null,
    precision: ?i64 = null,
    round: ?RoundingMode = null,
};

/// Errors from operations that change an exponent, scale or precision.
pub const Error = Allocator.Error || error{ExponentOutOfRange};

/// Supported exponent and scale magnitude. This includes every parsed TS exponent.
pub const MAX_EXPONENT: i64 = 999_999_999;

fn checkExponent(n: i128) error{ExponentOutOfRange}!i64 {
    if (n < -MAX_EXPONENT or n > MAX_EXPONENT) return error.ExponentOutOfRange;
    return @intCast(n);
}

fn checkContext(context: MathContext) error{ExponentOutOfRange}!void {
    if (context.scale) |n| _ = try checkExponent(n);
    if (context.precision) |n| _ = try checkExponent(n);
}

fn checkedClone(gpa: Allocator, d: Decimal) Error!Decimal {
    if (d.flag == .none) _ = try checkExponent(d.exp);
    return clone(gpa, d);
}

/// Arbitrary precision decimal value. Finite exponents must be in
/// -MAX_EXPONENT...MAX_EXPONENT. Constructors and exponent-changing operations enforce
/// this domain; hand-built values must satisfy it too. Coefficients remain allocator-limited.
pub const Decimal = struct {
    /// Coefficient words, least-significant first. Empty for NaN and infinities.
    data: []const u32,
    /// 1 or -1 (0 for NaN).
    sign: i8,
    /// Exponent.
    exp: i64,
    flag: Flag,

    /// Free a decimal returned by a function in this package.
    pub fn deinit(self: Decimal, gpa: Allocator) void {
        gpa.free(self.data);
    }
};

/// Latin decimal digits.
pub const DECIMAL_DIGITS = [10][]const u8{ "0", "1", "2", "3", "4", "5", "6", "7", "8", "9" };

const DEFAULT_PRECISION: i64 = 28;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/// Build a constant at compile time from "[-]digits[.digits]".
fn constant(comptime s: []const u8) Decimal {
    comptime {
        var digits: [s.len]u8 = undefined;
        var nd: usize = 0;
        var frac: i64 = 0;
        var seen_point = false;
        var sign: i8 = 1;
        for (s) |c| {
            switch (c) {
                '-' => sign = -1,
                '.' => seen_point = true,
                '0'...'9' => {
                    digits[nd] = c - '0';
                    nd += 1;
                    if (seen_point) frac += 1;
                },
                else => @compileError("bad constant"),
            }
        }
        const nw = (nd + 6) / 7;
        var words = [_]u32{0} ** nw;
        for (0..nd) |i| {
            words[i / 7] += @as(u32, digits[nd - 1 - i]) * @as(u32, @intCast(math.POWERS10[i % 7]));
        }
        const final = words;
        return .{ .data = &final, .sign = sign, .exp = -frac, .flag = .none };
    }
}

pub const ZERO = constant("0");
pub const ONE = constant("1");
pub const TWO = constant("2");
/// 105 digits of pi - https://oeis.org/A000796/constant
pub const PI = constant("3.141592653589793238462643383279502884197169399375105" ++
    "82097494459230781640628620899862803482534211706798214");
/// 105 digits of e - https://oeis.org/A001113/constant
pub const E = constant("2.718281828459045235360287471352662497757247093699959" ++
    "57496696762772407663035354759457138217852516642742746");
pub const NAN: Decimal = .{ .data = &.{}, .sign = 0, .exp = 0, .flag = .nan };
pub const POSITIVE_INFINITY: Decimal = .{ .data = &.{}, .sign = 1, .exp = 0, .flag = .infinity };
pub const NEGATIVE_INFINITY: Decimal = .{ .data = &.{}, .sign = -1, .exp = 0, .flag = .infinity };

const ZERO_WORD = [_]u32{0};

// ---------------------------------------------------------------------------
// Construction and ownership
// ---------------------------------------------------------------------------

/// A copy of d owned by gpa.
pub fn clone(gpa: Allocator, d: Decimal) Allocator.Error!Decimal {
    return .{ .data = try gpa.dupe(u32, d.data), .sign = d.sign, .exp = d.exp, .flag = d.flag };
}

pub const ParseError = error{
    ExtraExponent,
    ExponentTooLarge,
    ExponentNotProvided,
    BareSign,
    DuplicateSign,
    MisplacedSign,
    ExtraRadixPoint,
    UnexpectedCharacter,
    NoDigits,
};

/// Parse a string of the form "[-+][digits][.][digits][eE][-+][digits]", or "NaN", "nan",
/// "[-+]Infinity", "[-+]infinity".
pub fn parse(gpa: Allocator, str: []const u8) (ParseError || Allocator.Error)!Decimal {
    var arena = ArenaAllocator.init(gpa);
    defer arena.deinit();
    return clone(gpa, try parseImpl(arena.allocator(), str));
}

/// A decimal with the value of an integer.
pub fn fromInt(gpa: Allocator, n: i64) Allocator.Error!Decimal {
    var buf: [24]u8 = undefined;
    const s = std.fmt.bufPrint(&buf, "{d}", .{n}) catch unreachable;
    return parse(gpa, s) catch |err| switch (err) {
        error.OutOfMemory => error.OutOfMemory,
        else => unreachable,
    };
}

fn anyOf(s: []const u8, comptime xs: []const []const u8) bool {
    inline for (xs) |x| {
        if (std.mem.eql(u8, s, x)) return true;
    }
    return false;
}

fn parseImpl(a: Allocator, str: []const u8) (ParseError || Allocator.Error)!Decimal {
    if (anyOf(str, &.{ "nan", "NaN" })) return NAN;
    if (anyOf(str, &.{ "infinity", "+infinity", "Infinity", "+Infinity" })) return POSITIVE_INFINITY;
    if (anyOf(str, &.{ "-infinity", "-Infinity" })) return NEGATIVE_INFINITY;

    var data: Words = .empty;
    var sign: i64 = 1;
    var exp: i64 = 0;
    var has_sign = false;
    var has_point = false;
    var has_exp = false;
    var n: i64 = 0;
    var z: i64 = 0;
    var dig: i64 = 0;

    // Parse from the end, so a single pass sees the exponent first.
    var i: usize = str.len;
    while (i > 0) {
        i -= 1;
        const c = str[i];
        switch (c) {
            'e', 'E' => {
                if (has_exp) return error.ExtraExponent;
                if (dig > RDIGITS) return error.ExponentTooLarge;
                if (dig == 0) return error.ExponentNotProvided;
                has_exp = true;
                has_sign = false;
                // An exponent of exactly RDIGITS digits has already spilled into `data`.
                const exp_value = if (dig == RDIGITS) wv(data.items[0]) else n;
                dig = 0;
                exp = if (sign == -1) -exp_value else exp_value;
                sign = 1;
                n = 0;
                z = 0;
                data.clearRetainingCapacity();
            },
            '-', '+' => {
                if (dig == 0) return error.BareSign;
                if (has_sign) return error.DuplicateSign;
                // A sign belongs at the start of the number or of the exponent: "1-2" is invalid.
                if (i > 0 and str[i - 1] != 'e' and str[i - 1] != 'E') return error.MisplacedSign;
                sign = if (c == '-') -1 else 1;
                has_sign = true;
            },
            '.' => {
                if (has_point) return error.ExtraRadixPoint;
                has_point = true;
                exp -= dig;
            },
            '0'...'9' => {
                n += @as(i64, c - '0') * math.pow10(z);
                z += 1;
                dig += 1;
                if (z == RDIGITS) {
                    try data.append(a, word(n));
                    n = 0;
                    z = 0;
                }
            },
            else => return error.UnexpectedCharacter,
        }
    }

    if (dig == 0) return error.NoDigits;
    if (exp < -MAX_EXPONENT or exp > MAX_EXPONENT) return error.ExponentTooLarge;

    try data.append(a, word(n));
    math.trimLeadingZeros(&data);
    return .{ .data = data.items, .sign = if (sign == -1) -1 else 1, .exp = exp, .flag = .none };
}

// ---------------------------------------------------------------------------
// Drafts: working copies that the internals mutate in place
// ---------------------------------------------------------------------------

const Draft = struct {
    data: Words,
    sign: i8,
    exp: i64,
    flag: Flag,

    fn view(self: *const Draft) Decimal {
        return .{ .data = self.data.items, .sign = self.sign, .exp = self.exp, .flag = self.flag };
    }
};

fn copy(a: Allocator, d: Decimal) Allocator.Error!Draft {
    return .{ .data = try math.fromSlice(a, d.data), .sign = d.sign, .exp = d.exp, .flag = d.flag };
}

fn make(a: Allocator, data: []const u32, sign: i8, exp: i64, flag: Flag) Allocator.Error!Draft {
    return .{ .data = try math.fromSlice(a, data), .sign = sign, .exp = exp, .flag = flag };
}

fn trim(w: *Draft) void {
    math.trimLeadingZeros(&w.data);
}

// ---------------------------------------------------------------------------
// Predicates and properties
// ---------------------------------------------------------------------------

pub fn isNaN(d: Decimal) bool {
    return d.flag == .nan;
}

/// Not infinity or NaN.
pub fn isFinite(d: Decimal) bool {
    return d.flag == .none;
}

pub fn isInfinity(d: Decimal) bool {
    return d.flag == .infinity;
}

pub fn isNegative(d: Decimal) bool {
    return d.sign == -1;
}

/// Exactly zero, with any exponent: "0e-2" is "0.00".
pub fn isZero(d: Decimal) bool {
    return d.flag == .none and d.data.len == 1 and d.data[0] == 0;
}

pub fn signum(d: Decimal) i8 {
    return if (isZero(d)) 0 else d.sign;
}

/// The number can be represented as an integer without loss: '12.000' is the same as '12'.
pub fn isInteger(d: Decimal) bool {
    if (d.flag != .none) return false;
    return isZero(d) or d.exp + trailingZeros(d) >= 0;
}

/// Number of digits in the unscaled value.
pub fn precision(d: Decimal) i64 {
    if (d.flag != .none) return 0;
    const len: i64 = @intCast(d.data.len);
    return (len - 1) * RDIGITS + ops.digitCount(wv(d.data[d.data.len - 1]));
}

/// Number of digits to the right of the decimal point.
pub fn scale(d: Decimal) i64 {
    return if (d.flag != .none) 0 else if (d.exp == 0) 0 else -d.exp;
}

/// Number of integer digits, 1 or higher.
pub fn integerDigits(d: Decimal) i64 {
    return if (d.flag != .none) 0 else @max(precision(d) + d.exp, 1);
}

/// Adjusted exponent for alignment. Two numbers with the same aligned exponent are aligned for
/// arithmetic; otherwise one must be shifted.
pub fn alignexp(d: Decimal) i64 {
    return if (d.flag != .none) 0 else d.exp + precision(d) - 1;
}

/// Number of trailing zeros in the coefficient.
pub fn trailingZeros(d: Decimal) i64 {
    if (d.flag != .none) return 0;
    var r: i64 = 0;
    for (d.data, 0..) |w, i| {
        if (w != 0) {
            var n = w;
            r = @as(i64, @intCast(i)) * RDIGITS;
            while (n % 10 == 0) {
                n /= 10;
                r += 1;
            }
            break;
        }
    }
    return r;
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

/// Compare u to v: -1 if u < v, 0 if equal, 1 if u > v. With `abs`, compare absolute values.
/// Any NaN argument returns -1.
pub fn compare(gpa: Allocator, u: Decimal, v: Decimal, abs_: bool) Allocator.Error!i32 {
    var arena = ArenaAllocator.init(gpa);
    defer arena.deinit();
    return compareImpl(arena.allocator(), u, v, abs_);
}

fn compareImpl(a: Allocator, un: Decimal, vn: Decimal, abs_: bool) Allocator.Error!i32 {
    if (un.flag != .none or vn.flag != .none) {
        // NaN is never equal to itself or any other value.
        if (un.flag == .nan or vn.flag == .nan) return -1;
        // Infinities are equal if their sign matches.
        if (un.flag == vn.flag) {
            return if (un.sign == vn.sign) 0 else if (un.sign == -1) -1 else 1;
        }
        // Negative infinity sorts before everything, positive infinity after.
        if (un.flag == .infinity) {
            return if (un.sign == -1) -1 else 1;
        }
        return if (vn.sign == -1) 1 else -1;
    }

    const u = try stripTrailingZerosImpl(a, un);
    const v = try stripTrailingZerosImpl(a, vn);

    const uz = isZero(u);
    const vz = isZero(v);
    if (uz and vz) return 0;

    const us: i32 = u.sign;
    const vs: i32 = v.sign;
    if (!abs_ and us != vs) {
        return if (us == -1) -1 else 1;
    }

    // Same sign: zero is never equal to a non-zero value, and sorts after negative values.
    if (uz or vz) {
        if (abs_) return if (uz) -1 else 1;
        return if (us == -1) (if (uz) 1 else -1) else (if (uz) -1 else 1);
    }

    const ue = alignexp(u);
    const ve = alignexp(v);
    if (ue != ve) {
        if (abs_) return if (ue < ve) -1 else 1;
        return if (ue < ve) -us else us;
    }

    if (u.exp != v.exp) {
        const shift = u.exp - v.exp;
        if (shift > 0) {
            return -ops.compare(v.data, u.data, shift);
        }
        return ops.compare(u.data, v.data, -shift);
    }

    // Same number of words.
    var i: usize = u.data.len;
    while (i > 0) {
        i -= 1;
        const x = u.data[i];
        const y = v.data[i];
        if (x != y) {
            const s: i32 = if (x < y) -1 else 1;
            return s * (if (abs_) 1 else us);
        }
    }
    return 0;
}

// ---------------------------------------------------------------------------
// Sign
// ---------------------------------------------------------------------------

/// Absolute value.
pub fn abs(gpa: Allocator, d: Decimal) Allocator.Error!Decimal {
    var r = try clone(gpa, d);
    if (r.sign == -1) r.sign = 1;
    return r;
}

/// Invert the sign.
pub fn negate(gpa: Allocator, d: Decimal) Allocator.Error!Decimal {
    return clone(gpa, negateImpl(d));
}

fn negateImpl(d: Decimal) Decimal {
    if (d.flag == .nan) return d;
    var r = d;
    r.sign = -d.sign;
    return r;
}

// ---------------------------------------------------------------------------
// Arithmetic
// ---------------------------------------------------------------------------

const Op = enum { addition, subtraction, multiplication, division, mod };

/// u + v.
pub fn add(gpa: Allocator, u: Decimal, v: Decimal) Allocator.Error!Decimal {
    var arena = ArenaAllocator.init(gpa);
    defer arena.deinit();
    return clone(gpa, try addImpl(arena.allocator(), u, v));
}

fn addImpl(a: Allocator, u: Decimal, v: Decimal) Allocator.Error!Decimal {
    if (try handleFlags(a, .addition, u, v)) |r| return r;
    if (isZero(u)) return v;
    if (isZero(v)) return u;
    return addsub(a, u, v, v.sign);
}

/// u - v.
pub fn subtract(gpa: Allocator, u: Decimal, v: Decimal) Allocator.Error!Decimal {
    var arena = ArenaAllocator.init(gpa);
    defer arena.deinit();
    return clone(gpa, try subtractImpl(arena.allocator(), u, v));
}

fn subtractImpl(a: Allocator, u: Decimal, v: Decimal) Allocator.Error!Decimal {
    if (try handleFlags(a, .subtraction, u, v)) |r| return r;
    if (isZero(u)) return negateImpl(v);
    if (isZero(v)) return u;
    return addsub(a, u, v, -v.sign);
}

const Ctx = struct { use_precision: bool, scaleprec: i64, rounding: RoundingMode };

fn parseContext(rounding: RoundingMode, context: MathContext) Ctx {
    var c: Ctx = .{ .use_precision = true, .scaleprec = DEFAULT_PRECISION, .rounding = rounding };
    if (context.scale) |s| {
        c.scaleprec = s;
        c.use_precision = false;
    } else if (context.precision) |p| {
        c.scaleprec = @max(p, 0);
    }
    if (context.round) |r| c.rounding = r;
    return c;
}

/// u * v, rounded to the context's precision or scale.
pub fn multiply(gpa: Allocator, u: Decimal, v: Decimal, context: MathContext) Error!Decimal {
    var arena = ArenaAllocator.init(gpa);
    defer arena.deinit();
    try checkContext(context);
    return checkedClone(gpa, try multiplyImpl(arena.allocator(), u, v, context));
}

fn multiplyImpl(a: Allocator, u: Decimal, v: Decimal, context: MathContext) Allocator.Error!Decimal {
    const c = parseContext(.half_even, context);
    if (try handleFlags(a, .multiplication, u, v)) |r| return r;

    var w = try make(a, &ZERO_WORD, if (u.sign == v.sign) 1 else -1, u.exp + v.exp, .none);

    if (isZero(u) or isZero(v)) {
        if (!c.use_precision) {
            try setScaleDraft(a, &w, c.scaleprec, .half_even);
        }
        return w.view();
    }

    w.data = try math.multiply(a, u.data, v.data);
    trim(&w);

    if (c.use_precision) {
        const delta = precision(w.view()) - c.scaleprec;
        if (delta > 0) {
            try shiftrightDraft(a, &w, delta, c.rounding);
        }
    } else {
        try setScaleDraft(a, &w, c.scaleprec, c.rounding);
    }
    return w.view();
}

/// u / v, rounded to the context's precision or scale.
pub fn divide(gpa: Allocator, u: Decimal, v: Decimal, context: MathContext) Error!Decimal {
    var arena = ArenaAllocator.init(gpa);
    defer arena.deinit();
    try checkContext(context);
    return checkedClone(gpa, try divideImpl(arena.allocator(), u, v, context));
}

fn divideImpl(a: Allocator, un: Decimal, vn: Decimal, context: MathContext) Allocator.Error!Decimal {
    var u = un;
    var v = vn;
    if (try handleFlags(a, .division, u, v)) |r| return r;

    const c = parseContext(.half_even, context);
    const sign: i8 = if (u.sign == v.sign) 1 else -1;

    const shift = if (c.use_precision)
        precision(v) - precision(u) + c.scaleprec + 2
    else
        precision(v) + precision(u) + @as(i64, @intCast(@abs(c.scaleprec))) + 2;

    const exp = u.exp - v.exp - shift;

    if (shift > 0) {
        u = try shiftleftImpl(a, u, shift);
    } else if (shift < 0) {
        v = try shiftleftImpl(a, v, -shift);
    }

    const qr = try math.divide(a, u.data, v.data);

    var w: Draft = .{ .data = qr.q, .sign = sign, .exp = exp, .flag = .none };
    trim(&w);

    const hasrem = qr.r.items.len > 0 and !ops.allzero(qr.r.items, @intCast(qr.r.items.len));
    if (hasrem) {
        const lsd = w.data.items[0] % 10;
        if (lsd == 0 or lsd == 5) {
            w.data.items[0] += 1;
        }
    }

    if (c.use_precision) {
        const delta = precision(w.view()) - c.scaleprec;
        if (delta > 0) {
            try shiftrightDraft(a, &w, delta, c.rounding);
        }
        try stripTrailingZerosDraft(a, &w);
    } else {
        try setScaleDraft(a, &w, c.scaleprec, c.rounding);
    }
    return w.view();
}

pub const DivMod = struct {
    q: Decimal,
    r: Decimal,

    pub fn deinit(self: DivMod, gpa: Allocator) void {
        self.q.deinit(gpa);
        self.r.deinit(gpa);
    }
};

/// Quotient and remainder of u / v.
pub fn divmod(gpa: Allocator, u: Decimal, v: Decimal) Allocator.Error!DivMod {
    var arena = ArenaAllocator.init(gpa);
    defer arena.deinit();
    const r = try divmodImpl(arena.allocator(), u, v);
    const q = try clone(gpa, r.q);
    errdefer q.deinit(gpa);
    return .{ .q = q, .r = try clone(gpa, r.r) };
}

fn divmodImpl(a: Allocator, orig: Decimal, vd: Decimal) Allocator.Error!DivMod {
    var v = vd;
    if (try handleFlags(a, .division, orig, v)) |rq| {
        const rm = (try handleFlags(a, .mod, orig, v)).?;
        return .{ .q = rq, .r = rm };
    }

    var u = orig;
    const exp = if (u.exp > v.exp) v.exp else u.exp;
    if (u.exp != v.exp) {
        const shift = u.exp - v.exp;
        if (shift > 0) {
            u = try shiftleftImpl(a, u, shift);
        } else {
            v = try shiftleftImpl(a, v, -shift);
        }
    }

    // Ensure u has at least as many words as v.
    if (v.data.len > u.data.len) {
        var ud = try copy(a, u);
        try ud.data.appendNTimes(a, 0, v.data.len - u.data.len);
        u = ud.view();
    }

    const qr = try math.divide(a, u.data, v.data);
    var q: Draft = .{ .data = qr.q, .sign = if (u.sign == v.sign) 1 else -1, .exp = 0, .flag = .none };
    var r: Draft = .{ .data = qr.r, .sign = u.sign, .exp = exp, .flag = .none };
    trim(&q);
    trim(&r);
    return .{ .q = q.view(), .r = r.view() };
}

/// Remainder of u / v.
pub fn mod(gpa: Allocator, u: Decimal, v: Decimal) Allocator.Error!Decimal {
    var arena = ArenaAllocator.init(gpa);
    defer arena.deinit();
    const a = arena.allocator();
    const r = (try handleFlags(a, .mod, u, v)) orelse (try divmodImpl(a, u, v)).r;
    return clone(gpa, r);
}

/// The integer part.
pub fn toInteger(gpa: Allocator, d: Decimal) Allocator.Error!Decimal {
    if (d.flag != .none) return clone(gpa, d);
    return setScale(gpa, d, 0, .down) catch |err| switch (err) {
        error.ExponentOutOfRange => unreachable, // Zero scale is always in the supported domain.
        error.OutOfMemory => return error.OutOfMemory,
    };
}

/// Add one.
pub fn increment(gpa: Allocator, d: Decimal) Allocator.Error!Decimal {
    if (d.flag != .none) return clone(gpa, d);
    var arena = ArenaAllocator.init(gpa);
    defer arena.deinit();
    const a = arena.allocator();
    var r = try copy(a, d);
    if (r.sign == -1 or r.exp != 0) {
        return clone(gpa, try addImpl(a, r.view(), ONE));
    }
    try incrementDraft(a, &r);
    return clone(gpa, r.view());
}

/// Subtract one.
pub fn decrement(gpa: Allocator, d: Decimal) Allocator.Error!Decimal {
    if (d.flag != .none) return clone(gpa, d);
    return subtract(gpa, d, ONE);
}

// ---------------------------------------------------------------------------
// Scale, precision and shifting
// ---------------------------------------------------------------------------

/// Remove all trailing zeros.
pub fn stripTrailingZeros(gpa: Allocator, d: Decimal) Error!Decimal {
    var arena = ArenaAllocator.init(gpa);
    defer arena.deinit();
    return checkedClone(gpa, try stripTrailingZerosImpl(arena.allocator(), d));
}

fn stripTrailingZerosImpl(a: Allocator, d: Decimal) Allocator.Error!Decimal {
    if (d.flag != .none) return d;
    var r = try copy(a, d);
    try stripTrailingZerosDraft(a, &r);
    return r.view();
}

pub const Scientific = struct {
    coefficient: Decimal,
    exponent: i64,

    pub fn deinit(self: Scientific, gpa: Allocator) void {
        self.coefficient.deinit(gpa);
    }
};

/// Scientific representation: coefficient and exponent, with value = coefficient * 10^exponent.
/// `min_int_digits` is the minimum number of integer digits in the coefficient (at least 1).
pub fn scientific(gpa: Allocator, d: Decimal, min_int_digits: i64) Error!Scientific {
    const s = try scientificImpl(d, min_int_digits);
    return .{ .coefficient = try clone(gpa, s.coefficient), .exponent = s.exponent };
}

fn scientificImpl(d: Decimal, min_int_digits: i64) error{ExponentOutOfRange}!Scientific {
    if (d.flag != .none) return .{ .coefficient = d, .exponent = 0 };
    const mi = if (min_int_digits <= 1) 1 else min_int_digits;
    const exp = try checkExponent(-@as(i128, precision(d) - 1) + (mi - 1));
    var coeff = d;
    coeff.exp = exp;
    return .{ .coefficient = coeff, .exponent = d.exp - exp };
}

/// A new number with the given scale, shifting the coefficient as needed.
pub fn setScale(gpa: Allocator, d: Decimal, new_scale: i64, mode: RoundingMode) Error!Decimal {
    _ = try checkExponent(new_scale);
    if (d.flag != .none) return clone(gpa, d);
    var arena = ArenaAllocator.init(gpa);
    defer arena.deinit();
    const a = arena.allocator();
    var r = try copy(a, d);
    try setScaleDraft(a, &r, new_scale, mode);
    return clone(gpa, r.view());
}

/// Move the decimal point -n (left) or +n (right) places. Changes only the exponent.
pub fn movePoint(gpa: Allocator, d: Decimal, places: i64) Error!Decimal {
    const exp = if (d.flag == .none) try checkExponent(@as(i128, d.exp) + places) else d.exp;
    var r = try clone(gpa, d);
    r.exp = exp;
    return r;
}

/// Shift all digits left, increasing the precision.
pub fn shiftleft(gpa: Allocator, d: Decimal, shift: i64) Error!Decimal {
    _ = try checkExponent(shift);
    var arena = ArenaAllocator.init(gpa);
    defer arena.deinit();
    return clone(gpa, try shiftleftImpl(arena.allocator(), d, shift));
}

fn shiftleftImpl(a: Allocator, d: Decimal, shift: i64) Allocator.Error!Decimal {
    if (d.flag != .none) return d;
    var w = try copy(a, d);
    try shiftleftDraft(a, &w, shift);
    return w.view();
}

/// Shift all digits right, reducing the precision, rounding with `mode`.
pub fn shiftright(gpa: Allocator, d: Decimal, shift: i64, mode: RoundingMode) Error!Decimal {
    if (d.flag == .none) _ = try checkExponent(@as(i128, d.exp) + @max(shift, 0));
    if (d.flag != .none) return clone(gpa, d);
    var arena = ArenaAllocator.init(gpa);
    defer arena.deinit();
    const a = arena.allocator();
    var w = try copy(a, d);
    try shiftrightDraft(a, &w, shift, mode);
    return clone(gpa, w.view());
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/// Fixed-point string, owned by gpa.
pub fn toString(gpa: Allocator, d: Decimal) Allocator.Error![]u8 {
    if (d.flag != .none) return gpa.dupe(u8, flagString(d));
    return formatString(gpa, d, 1);
}

/// Scientific notation string, owned by gpa. `min_integers` is the minimum number of integer
/// digits in the coefficient (at least 1).
pub fn toScientificString(gpa: Allocator, d: Decimal, min_integers: i64) Error![]u8 {
    if (d.flag != .none) return gpa.dupe(u8, flagString(d));
    const s = try scientificImpl(d, min_integers);
    const r = try formatString(gpa, s.coefficient, min_integers);
    if (isZero(s.coefficient) or s.exponent == 0) return r;
    defer gpa.free(r);
    const plus = if (s.exponent > 0) "+" else "";
    return std.fmt.allocPrint(gpa, "{s}E{s}{d}", .{ r, plus, s.exponent });
}

/// Fixed-point parts, owned by gpa; free with `freeParts`.
pub fn toParts(gpa: Allocator, d: Decimal) Allocator.Error![]Part {
    if (d.flag != .none) return flagParts(gpa, d);
    return formatParts(gpa, d, 1, &.{});
}

/// Scientific notation parts, owned by gpa; free with `freeParts`.
pub fn toScientificParts(gpa: Allocator, d: Decimal, min_integers: i64) Error![]Part {
    if (d.flag != .none) return flagParts(gpa, d);
    const s = try scientificImpl(d, min_integers);
    if (isZero(s.coefficient) or s.exponent == 0) {
        return formatParts(gpa, s.coefficient, min_integers, &.{});
    }
    var buf: [24]u8 = undefined;
    const digits = std.fmt.bufPrint(&buf, "{d}", .{@abs(s.exponent)}) catch unreachable;
    const extra = [_]Part{
        .{ .type = "exp", .value = "E" },
        if (s.exponent < 0) .{ .type = "minus", .value = "-" } else .{ .type = "plus", .value = "+" },
        .{ .type = "integer", .value = digits },
    };
    return formatParts(gpa, s.coefficient, min_integers, &extra);
}

/// Low-level formatting for the string and parts forms. Digits are passed to `formatter` (any
/// value with `add([]const u8) !void`, see format.zig) from least- to most-significant.
pub fn format(
    gpa: Allocator,
    d: Decimal,
    formatter: anytype,
    decimal_sep: []const u8,
    group: []const u8,
    min_int: i64,
    min_group: i64,
    pri_group: i64,
    sec_group_in: i64,
    zero_scale: bool,
    digits: *const [10][]const u8,
) !void {
    const data = d.data;
    const len = data.len;
    const is_zero_data = len == 1 and data[0] == 0;

    // Grouping is enabled when there is a group separator.
    const grouping = group.len > 0;
    const sec_group = if (sec_group_in <= 0) pri_group else sec_group_in;

    var exp = d.exp;

    // Integer digits to emit; more than the coefficient has means leading zeros.
    var int: i64 = if (is_zero_data) 1 else precision(d) + exp;

    // Between 0 and 1 with no minimum integer digits: no leading zero.
    if (min_int <= 0 and (try compare(gpa, d, ONE, true)) == -1) {
        int = 0;
    } else {
        int = @max(int, min_int);
    }

    var group_size = pri_group;
    var emitted: i64 = 0;
    const group_active = grouping and pri_group > 0 and int >= min_group + pri_group;

    const G = struct {
        fn maybeGroup(f: anytype, active: bool, e: *i64, gsize: *i64, g: []const u8, sec: i64) !void {
            if (active and e.* > 0 and @mod(e.*, gsize.*) == 0) {
                // Group separator, then switch to the secondary group size.
                try f.add(g);
                e.* = 0;
                gsize.* = sec;
            }
        }
    };

    // Trailing zeros for a positive exponent, only if the number is non-zero.
    var zs = exp;
    if (!is_zero_data) {
        while (zs > 0) : (zs -= 1) {
            try formatter.add(digits[0]);
            emitted += 1;
            try G.maybeGroup(formatter, group_active, &emitted, &group_size, group, sec_group);
            int -= 1;
        }
    } else if (zero_scale and exp < 0) {
        // Zero with a negative exponent: emit zeros after the decimal point.
        while (exp < 0) {
            exp += 1;
            try formatter.add(digits[0]);
        }
        try formatter.add(decimal_sep);
    }

    // Coefficient digits from least- to most-significant.
    for (data, 0..) |wd, i| {
        var w = wv(wd);
        const c = if (i == len - 1) ops.digitCount(w) else RDIGITS;
        var j: i64 = 0;
        while (j < c) : (j += 1) {
            try formatter.add(digits[@intCast(@mod(w, 10))]);
            w = @divTrunc(w, 10);

            exp += 1;
            if (exp == 0) {
                try formatter.add(decimal_sep);
            }

            // Count integer digits for grouping once past the decimal point.
            if (exp > 0) {
                emitted += 1;
                int -= 1;
                if (int > 0) {
                    try G.maybeGroup(formatter, group_active, &emitted, &group_size, group, sec_group);
                }
            }
        }
    }

    // Exponent still negative: leading fraction zeros.
    while (exp < 0) {
        try formatter.add(digits[0]);
        exp += 1;
        if (exp == 0) {
            try formatter.add(decimal_sep);
        }
    }

    // Leading integer zeros.
    while (int > 0) {
        try formatter.add(digits[0]);
        emitted += 1;
        int -= 1;
        if (int > 0) {
            try G.maybeGroup(formatter, group_active, &emitted, &group_size, group, sec_group);
        }
    }
}

fn flagString(d: Decimal) []const u8 {
    return switch (d.flag) {
        .nan => "NaN",
        else => if (d.sign == 1) "Infinity" else "-Infinity",
    };
}

fn flagParts(gpa: Allocator, d: Decimal) Allocator.Error![]Part {
    const t = if (d.flag == .nan) "nan" else "infinity";
    const out = try gpa.alloc(Part, 1);
    errdefer gpa.free(out);
    out[0] = .{ .type = t, .value = try gpa.dupe(u8, flagString(d)) };
    return out;
}

fn formatString(gpa: Allocator, d: Decimal, min_int: i64) Allocator.Error![]u8 {
    var arena = ArenaAllocator.init(gpa);
    defer arena.deinit();
    const a = arena.allocator();
    var f = StringFormatter.init(a);
    try format(a, d, &f, ".", "", min_int, 1, 3, 3, true, &DECIMAL_DIGITS);
    const r = try f.render(a);
    if (d.sign == -1) {
        return std.mem.concat(gpa, u8, &.{ "-", r });
    }
    return gpa.dupe(u8, r);
}

/// Parts for d, with a leading minus for negatives and `extra` appended. Owned by gpa.
fn formatParts(gpa: Allocator, d: Decimal, min_int: i64, extra: []const Part) Allocator.Error![]Part {
    var arena = ArenaAllocator.init(gpa);
    defer arena.deinit();
    const a = arena.allocator();
    var f = PartsFormatter.init(a, ".", "");
    try format(a, d, &f, ".", "", min_int, 1, 3, 3, true, &DECIMAL_DIGITS);
    const body = try f.render(a);

    var all: std.ArrayList(Part) = .empty;
    if (d.sign == -1) try all.append(a, .{ .type = "minus", .value = "-" });
    try all.appendSlice(a, body);
    try all.appendSlice(a, extra);

    const out = try gpa.alloc(Part, all.items.len);
    var done: usize = 0;
    errdefer {
        for (out[0..done]) |p| gpa.free(p.value);
        gpa.free(out);
    }
    for (all.items, 0..) |p, i| {
        out[i] = .{ .type = p.type, .value = try gpa.dupe(u8, p.value) };
        done += 1;
    }
    return out;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

fn zeroWithSign(a: Allocator, sign: i8) Allocator.Error!Decimal {
    return (try make(a, &ZERO_WORD, sign, 0, .none)).view();
}

/// Special values for operations, per IEEE 754-2008 as referenced by ECMAScript (12.7.3.1-3
/// for mul, div, mod; 12.8.5 for the additive operators). Null when no special value applies.
fn handleFlags(a: Allocator, op: Op, u: Decimal, v: Decimal) Allocator.Error!?Decimal {
    // Any operation involving a NaN returns a NaN.
    if (u.flag == .nan or v.flag == .nan) return NAN;

    const uinf = u.flag == .infinity;
    const vinf = v.flag == .infinity;
    const uzero = isZero(u);
    const vzero = isZero(v);
    const pinf = POSITIVE_INFINITY;
    const ninf = NEGATIVE_INFINITY;

    switch (op) {
        .addition => {
            if (uinf and vinf) {
                return if (u.sign == v.sign) (if (u.sign == 1) pinf else ninf) else NAN;
            } else if (uinf or vinf) {
                return if (uinf) u else v;
            }
        },
        .subtraction => {
            if (uinf and vinf) {
                return if (u.sign == v.sign) NAN else if (u.sign == 1) pinf else ninf;
            } else if (uinf or vinf) {
                if (uinf) return if (u.sign == 1) pinf else ninf;
                return if (v.sign == 1) ninf else pinf;
            }
        },
        .multiplication => {
            if (uinf) return if (vzero) NAN else if (u.sign == v.sign) pinf else ninf;
            if (vinf) return if (uzero) NAN else if (u.sign == v.sign) pinf else ninf;
        },
        .division => {
            if (uinf and vinf) return NAN;
            if (uinf) {
                if (vzero) return if (u.sign == 1) pinf else ninf;
                return if (u.sign == v.sign) pinf else ninf;
            }
            // x / ±Infinity is zero with the sign of the quotient.
            if (vinf) return try zeroWithSign(a, if (u.sign == v.sign) 1 else -1);
            if (vzero) return if (uzero) NAN else if (u.sign == 1) pinf else ninf;
        },
        .mod => {
            if (uinf or vzero) return NAN;
            if (!uinf and vinf) return u;
            if (uzero and !vzero and !vinf) return u;
        },
    }
    return null;
}

/// Size in words needed for n digits.
fn size(n: i64) i64 {
    const q = @divTrunc(n, RDIGITS);
    const r = n - q * RDIGITS;
    return if (r == 0) q else q + 1;
}

inline fn idx(i: i64) usize {
    return @intCast(i);
}

fn shiftleftDraft(a: Allocator, w: *Draft, shift: i64) Allocator.Error!void {
    if (shift <= 0) return;
    const prec = precision(w.view());
    const data = try a.dupe(u32, w.data.items);

    var m: i64 = @intCast(data.len);
    const q = @divTrunc(shift, RDIGITS);
    const r = shift - q * RDIGITS;

    var n = size(prec + shift);
    w.data = try math.zeros(a, idx(n));
    const out = w.data.items;

    // Shift is a multiple of the word size.
    if (r == 0) {
        m -= 1;
        while (m >= 0) : (m -= 1) {
            out[idx(m + q)] = data[idx(m)];
        }
        return;
    }

    const powlo = math.pow10(r);
    const powhi = math.pow10(RDIGITS - r);

    n -= 1;
    m -= 1;
    var hi = @divTrunc(wv(data[idx(m)]), powhi);
    var loprev = wv(data[idx(m)]) - hi * powhi;
    if (hi != 0) {
        out[idx(n)] = word(hi);
        n -= 1;
    }
    m -= 1;

    while (m >= 0) : ({
        m -= 1;
        n -= 1;
    }) {
        hi = @divTrunc(wv(data[idx(m)]), powhi);
        const lo = wv(data[idx(m)]) - hi * powhi;
        out[idx(n)] = word(powlo * loprev + hi);
        loprev = lo;
    }

    out[idx(q)] = word(powlo * loprev);
}

fn shiftrightDraft(a: Allocator, w: *Draft, shift: i64, mode: RoundingMode) Allocator.Error!void {
    if (shift <= 0) return;
    if (isZero(w.view())) {
        w.exp += shift;
        return;
    }

    const prec = precision(w.view());

    // Every digit shifts out, so no rounding is possible.
    if (prec < shift) {
        w.data = try math.fromSlice(a, &ZERO_WORD);
        w.exp += shift;
        return;
    }

    // Round only with a free zero integer digit to the left: the number is < 0 or not every
    // digit shifts out.
    const round = alignexp(w.view()) < 0 or prec != shift;
    const qr = math.divword(shift, RDIGITS);
    const q = qr.q;
    const r = qr.r;

    const data = try a.dupe(u32, w.data.items);
    const out = w.data.items;
    @memset(out, 0);

    var rnd: i64 = 0;
    var rest: i64 = 0;

    if (r == 0) {
        // q is non-zero here, else there would be no shift.
        const dv = math.divpow10(wv(data[idx(q - 1)]), RDIGITS - 1);
        rnd = dv.q;
        rest = dv.r;
        if (rest == 0) {
            rest = if (ops.allzero(data, q - 1)) 0 else 1;
        }
        var j: usize = 0;
        while (j < data.len - idx(q)) : (j += 1) {
            out[j] = data[idx(q) + j];
        }
    } else {
        const ph = math.pow10(RDIGITS - r);
        // q < data.len here; otherwise r would be 0.
        var dv = math.divpow10(wv(data[idx(q)]), r);
        var hiprev = dv.q;
        dv = math.divpow10(dv.r, r - 1);
        rnd = dv.q;
        rest = dv.r;
        if (rest == 0 and q > 0) {
            rest = if (ops.allzero(data, q)) 0 else 1;
        }

        var j: usize = 0;
        var i: usize = idx(q) + 1;
        while (i < data.len) : ({
            i += 1;
            j += 1;
        }) {
            const hl = math.divpow10(wv(data[i]), r);
            out[j] = word(ph * hl.r + hiprev);
            hiprev = hl.q;
        }
        if (hiprev != 0) {
            out[j] = word(hiprev);
        }
    }

    trim(w);
    w.exp += shift;

    if (round and roundIndicator(w.view(), rnd, rest, mode)) {
        try incrementDraft(a, w);
    }
}

fn setScaleDraft(a: Allocator, w: *Draft, new_scale: i64, mode: RoundingMode) Allocator.Error!void {
    const diff = new_scale - scale(w.view());
    if (diff > 0) {
        try shiftleftDraft(a, w, diff);
    } else {
        try shiftrightDraft(a, w, -diff, mode);
    }
    w.exp = if (new_scale == 0) 0 else -new_scale;
    trim(w);
}

fn stripTrailingZerosDraft(a: Allocator, w: *Draft) Allocator.Error!void {
    const items = w.data.items;
    // Zero with a negative exponent strips to plain zero.
    const n = if (items.len == 1 and items[0] == 0 and w.exp < 0) -w.exp else trailingZeros(w.view());
    if (n > 0) {
        try shiftrightDraft(a, w, n, .down);
    }
}

/// Add one to the least-significant word, carrying.
fn incrementDraft(a: Allocator, w: *Draft) Allocator.Error!void {
    const d = w.data.items;
    var k: i64 = 1;
    var i: usize = 0;
    while (k == 1 and i < d.len) : (i += 1) {
        const s = wv(d[i]) + k;
        k = if (s == RADIX) 1 else 0;
        d[i] = if (k != 0) 0 else word(s);
    }
    if (k == 1) {
        try w.data.append(a, 1);
    }
}

/// Whether to round up, given the first dropped digit and whether anything after it is non-zero.
fn roundIndicator(w: Decimal, rnd_in: i64, rest: i64, mode: RoundingMode) bool {
    var rnd = rnd_in;
    if (rest != 0 and (rnd == 0 or rnd == 5)) {
        rnd += 1;
    }
    return switch (mode) {
        // away from zero
        .up => rnd != 0,
        // towards zero
        .down => false,
        // towards positive infinity
        .ceiling => !(rnd == 0 or w.sign == -1),
        // towards negative infinity
        .floor => !(rnd == 0 or w.sign >= 0),
        .half_up => rnd >= 5,
        .half_down => rnd > 5,
        // at exactly 5, round to the even neighbor
        .half_even => rnd > 5 or (rnd == 5 and w.data.len > 0 and w.data[0] % 2 == 1),
    };
}

/// Addition and subtraction of finite, non-zero values.
fn addsub(a: Allocator, u: Decimal, v: Decimal, vsign: i8) Allocator.Error!Decimal {
    var m = u; // bigger
    var n = v; // smaller
    var swap: u32 = 0;
    if (m.exp < n.exp) {
        std.mem.swap(Decimal, &m, &n);
        swap += 1;
    }

    const shift = m.exp - n.exp;
    m = try shiftleftImpl(a, m, shift);

    var w = try make(a, &ZERO_WORD, 0, n.exp, .none);

    if (m.data.len < n.data.len) {
        std.mem.swap(Decimal, &m, &n);
        swap += 1;
    }

    if (u.sign == vsign) {
        w.data = try math.add(a, m.data, n.data);
        w.sign = vsign;
    } else {
        if (m.data.len == n.data.len) {
            var i: usize = m.data.len;
            while (i > 0) {
                i -= 1;
                if (m.data[i] != n.data[i]) {
                    if (m.data[i] < n.data[i]) {
                        std.mem.swap(Decimal, &m, &n);
                        swap += 1;
                    }
                    break;
                }
            }
        }
        w.data = try math.subtract(a, m.data, n.data);
        w.sign = if ((swap & 1) == 1) vsign else m.sign;
    }
    trim(&w);
    return w.view();
}

test "constants match parsed values" {
    const gpa = std.testing.allocator;
    const cases = [_]struct { Decimal, []const u8 }{
        .{ ZERO, "0" },
        .{ ONE, "1" },
        .{ TWO, "2" },
        .{ PI, "3.14159265358979323846264338327950288419716939937510582097494459230781640628620899862803482534211706798214" },
        .{ E, "2.71828182845904523536028747135266249775724709369995957496696762772407663035354759457138217852516642742746" },
    };
    for (cases) |c| {
        const d = try parse(gpa, c[1]);
        defer d.deinit(gpa);
        try std.testing.expectEqualSlices(u32, d.data, c[0].data);
        try std.testing.expectEqual(d.exp, c[0].exp);
        try std.testing.expectEqual(d.sign, c[0].sign);
    }
}

test "example" {
    const gpa = std.testing.allocator;
    const a = try parse(gpa, "0.1");
    defer a.deinit(gpa);
    const b = try parse(gpa, "0.2");
    defer b.deinit(gpa);
    const sum = try add(gpa, a, b);
    defer sum.deinit(gpa);
    const s = try toString(gpa, sum);
    defer gpa.free(s);
    try std.testing.expectEqualStrings("0.3", s);
}
