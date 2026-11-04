//! Runs the shared cases in `conformance/decimal.json` against the Zig port.
//!
//! Each case names a TypeScript function, its arguments and the TypeScript result. Decimal
//! arguments are strings, parsed here first.

const std = @import("std");
const h = @import("hereabouts");
const cases = @import("cases");

const D = h.decimal;
const R = h.rational;
const Decimal = D.Decimal;
const Value = std.json.Value;
const Allocator = std.mem.Allocator;

const Mismatch = error{Mismatch};

fn fail(comptime f: []const u8, args: anytype) Mismatch {
    std.debug.print("    " ++ f ++ "\n", args);
    return error.Mismatch;
}

// ---------------------------------------------------------------------------
// Reading arguments
// ---------------------------------------------------------------------------

fn argStr(v: Value) []const u8 {
    return v.string;
}

fn argInt(v: Value) i64 {
    return v.integer;
}

fn argDec(a: Allocator, v: Value) !Decimal {
    return D.parse(a, v.string);
}

fn argMode(v: Value) D.RoundingMode {
    return D.RoundingMode.fromString(v.string).?;
}

fn argContext(args: []const Value, i: usize) D.MathContext {
    if (i >= args.len) return .{};
    const o = args[i].object;
    var c: D.MathContext = .{};
    if (o.get("scale")) |s| c.scale = s.integer;
    if (o.get("precision")) |p| c.precision = p.integer;
    if (o.get("round")) |r| c.round = argMode(r);
    return c;
}

// ---------------------------------------------------------------------------
// Checking results
// ---------------------------------------------------------------------------

fn expectDecimal(want: Value, got: Decimal) !void {
    const o = want.object;
    const data = o.get("data").?.array.items;
    const sign = o.get("sign").?.integer;
    const exp = o.get("exp").?.integer;
    const flag = o.get("flag").?.integer;
    var same = data.len == got.data.len and sign == got.sign and exp == got.exp and
        flag == @intFromEnum(got.flag);
    if (same) {
        for (data, got.data) |x, y| {
            if (x.integer != y) same = false;
        }
    }
    if (!same) {
        return fail("decimal: want data={any} sign={d} exp={d} flag={d}; got data={any} sign={d} exp={d} flag={d}", .{
            jsonInts(data), sign, exp, flag, got.data, got.sign, got.exp, @intFromEnum(got.flag),
        });
    }
}

/// Up to 16 integers from a JSON array, for messages.
fn jsonInts(xs: []const Value) [16]i64 {
    var out = [_]i64{-1} ** 16;
    for (xs, 0..) |x, i| {
        if (i >= 16) break;
        out[i] = x.integer;
    }
    return out;
}

fn expectInt(want: Value, got: i64) !void {
    if (want.integer != got) return fail("int: want {d}, got {d}", .{ want.integer, got });
}

fn expectBool(want: Value, got: bool) !void {
    if (want.bool != got) return fail("bool: want {}, got {}", .{ want.bool, got });
}

fn expectString(want: Value, got: []const u8) !void {
    if (!std.mem.eql(u8, want.string, got)) {
        return fail("string: want \"{s}\", got \"{s}\"", .{ want.string, got });
    }
}

fn expectParts(want: Value, got: []const D.Part) !void {
    const items = want.array.items;
    var same = items.len == got.len;
    if (same) {
        for (items, got) |w, g| {
            const o = w.object;
            if (!std.mem.eql(u8, o.get("type").?.string, g.type) or
                !std.mem.eql(u8, o.get("value").?.string, g.value)) same = false;
        }
    }
    if (!same) {
        std.debug.print("    parts: want:", .{});
        for (items) |w| std.debug.print(" {s}:\"{s}\"", .{ w.object.get("type").?.string, w.object.get("value").?.string });
        std.debug.print("\n           got: ", .{});
        for (got) |g| std.debug.print(" {s}:\"{s}\"", .{ g.type, g.value });
        std.debug.print("\n", .{});
        return error.Mismatch;
    }
}

fn expectRational(want: Value, got: R.Rational) !void {
    try expectDecimal(want.object.get("numerator").?, got.numerator);
    try expectDecimal(want.object.get("denominator").?, got.denominator);
}

/// The TypeScript error message starts with this text for each parse error.
fn errorPrefix(err: anyerror) []const u8 {
    return switch (err) {
        error.ExtraExponent => "Extra exponent character",
        error.ExponentTooLarge => "Exponent too large",
        error.ExponentNotProvided => "Exponent not provided",
        error.BareSign => "Found a bare sign symbol",
        error.DuplicateSign => "Duplicate sign character",
        error.MisplacedSign => "Misplaced sign character",
        error.ExtraRadixPoint => "Extra radix point",
        error.UnexpectedCharacter => "Unexpected character",
        error.NoDigits => "Number must include at least 1 digit",
        else => "?",
    };
}

// ---------------------------------------------------------------------------
// Running a case
// ---------------------------------------------------------------------------

fn eql(a: []const u8, b: []const u8) bool {
    return std.mem.eql(u8, a, b);
}

/// Run one case. Everything is allocated in the arena `a`.
fn run(a: Allocator, fname: []const u8, args: []const Value, want: Value) !void {
    // Parsing, including the error cases.
    if (eql(fname, "decimal")) {
        const r = D.parse(a, argStr(args[0]));
        if (want == .object and want.object.get("error") != null) {
            const msg = want.object.get("error").?.string;
            if (r) |d| {
                return fail("want error \"{s}\", got {any}", .{ msg, d.data });
            } else |err| {
                if (!std.mem.startsWith(u8, msg, errorPrefix(err))) {
                    return fail("want error \"{s}\", got {s}", .{ msg, @errorName(err) });
                }
                return;
            }
        }
        return expectDecimal(want, try r);
    }

    // Rationals: arguments are rational strings.
    if (std.mem.startsWith(u8, fname, "rational") or eql(fname, "coerceRational")) {
        const u = try R.parse(a, argStr(args[0]));
        if (eql(fname, "coerceRational")) return expectRational(want, u);
        if (eql(fname, "rationalNegate")) return expectRational(want, try R.negate(a, u));
        if (eql(fname, "rationalInverse")) return expectRational(want, try R.inverse(a, u));
        if (eql(fname, "rationalToString")) return expectString(want, try R.toString(a, u));
        if (eql(fname, "rationalToDecimal")) return expectDecimal(want, try R.toDecimal(a, u, argContext(args, 1)));
        const v = try R.parse(a, argStr(args[1]));
        const ctx = argContext(args, 2);
        if (eql(fname, "rationalAdd")) return expectRational(want, try R.add(a, u, v, ctx));
        if (eql(fname, "rationalSubtract")) return expectRational(want, try R.subtract(a, u, v, ctx));
        if (eql(fname, "rationalMultiply")) return expectRational(want, try R.multiply(a, u, v, ctx));
        if (eql(fname, "rationalDivide")) return expectRational(want, try R.divide(a, u, v, ctx));
        if (eql(fname, "rationalCompare")) return expectInt(want, try R.compare(a, u, v, ctx));
        return fail("unknown function {s}", .{fname});
    }

    const d = try argDec(a, args[0]);

    // One decimal argument
    if (eql(fname, "decimalToString")) return expectString(want, try D.toString(a, d));
    if (eql(fname, "decimalToParts")) return expectParts(want, try D.toParts(a, d));
    if (eql(fname, "decimalToScientificString")) return expectString(want, try D.toScientificString(a, d, argInt(args[1])));
    if (eql(fname, "decimalToScientificParts")) return expectParts(want, try D.toScientificParts(a, d, argInt(args[1])));
    if (eql(fname, "decimalScientific")) {
        const s = try D.scientific(a, d, argInt(args[1]));
        try expectDecimal(want.array.items[0], s.coefficient);
        return expectInt(want.array.items[1], s.exponent);
    }
    if (eql(fname, "decimalPrecision")) return expectInt(want, D.precision(d));
    if (eql(fname, "decimalScale")) return expectInt(want, D.scale(d));
    if (eql(fname, "decimalIntegerDigits")) return expectInt(want, D.integerDigits(d));
    if (eql(fname, "decimalAlignexp")) return expectInt(want, D.alignexp(d));
    if (eql(fname, "decimalTrailingZeros")) return expectInt(want, D.trailingZeros(d));
    if (eql(fname, "decimalIsInteger")) return expectBool(want, D.isInteger(d));
    if (eql(fname, "decimalIsZero")) return expectBool(want, D.isZero(d));
    if (eql(fname, "decimalIsNegative")) return expectBool(want, D.isNegative(d));
    if (eql(fname, "decimalIsNaN")) return expectBool(want, D.isNaN(d));
    if (eql(fname, "decimalIsFinite")) return expectBool(want, D.isFinite(d));
    if (eql(fname, "decimalIsInfinity")) return expectBool(want, D.isInfinity(d));
    if (eql(fname, "decimalSignum")) return expectInt(want, D.signum(d));
    if (eql(fname, "decimalAbs")) return expectDecimal(want, try D.abs(a, d));
    if (eql(fname, "decimalNegate")) return expectDecimal(want, try D.negate(a, d));
    if (eql(fname, "decimalStripTrailingZeros")) return expectDecimal(want, try D.stripTrailingZeros(a, d));
    if (eql(fname, "decimalToInteger")) return expectDecimal(want, try D.toInteger(a, d));
    if (eql(fname, "decimalIncrement")) return expectDecimal(want, try D.increment(a, d));
    if (eql(fname, "decimalDecrement")) return expectDecimal(want, try D.decrement(a, d));
    if (eql(fname, "decimalSetScale")) return expectDecimal(want, try D.setScale(a, d, argInt(args[1]), argMode(args[2])));
    if (eql(fname, "decimalShiftright")) return expectDecimal(want, try D.shiftright(a, d, argInt(args[1]), argMode(args[2])));
    if (eql(fname, "decimalShiftleft")) return expectDecimal(want, try D.shiftleft(a, d, argInt(args[1])));
    if (eql(fname, "decimalMovePoint")) return expectDecimal(want, try D.movePoint(a, d, argInt(args[1])));

    if (eql(fname, "decimalFormatString") or eql(fname, "decimalFormatParts")) {
        const sep = argStr(args[1]);
        const group = argStr(args[2]);
        var digits = D.DECIMAL_DIGITS;
        if (args[8] == .array) {
            for (args[8].array.items, 0..) |x, i| digits[i] = x.string;
        }
        const fmt_args = .{ sep, group, argInt(args[3]), argInt(args[4]), argInt(args[5]), argInt(args[6]), args[7].bool, &digits };
        if (eql(fname, "decimalFormatString")) {
            var f = D.StringFormatter.init(a);
            try @call(.auto, D.format, .{ a, d, &f } ++ fmt_args);
            return expectString(want, try f.render(a));
        }
        var f = D.PartsFormatter.init(a, sep, group);
        try @call(.auto, D.format, .{ a, d, &f } ++ fmt_args);
        return expectParts(want, try f.render(a));
    }

    // Two decimal arguments
    const v = try argDec(a, args[1]);
    if (eql(fname, "decimalAdd")) return expectDecimal(want, try D.add(a, d, v));
    if (eql(fname, "decimalSubtract")) return expectDecimal(want, try D.subtract(a, d, v));
    if (eql(fname, "decimalMultiply")) return expectDecimal(want, try D.multiply(a, d, v, argContext(args, 2)));
    if (eql(fname, "decimalDivide")) return expectDecimal(want, try D.divide(a, d, v, argContext(args, 2)));
    if (eql(fname, "decimalMod")) return expectDecimal(want, try D.mod(a, d, v));
    if (eql(fname, "decimalCompare")) return expectInt(want, try D.compare(a, d, v, args[2].bool));
    if (eql(fname, "decimalDivmod")) {
        const qr = try D.divmod(a, d, v);
        try expectDecimal(want.array.items[0], qr.q);
        return expectDecimal(want.array.items[1], qr.r);
    }

    return fail("unknown function {s}", .{fname});
}

test "decimal conformance" {
    const gpa = std.testing.allocator;
    const parsed = try std.json.parseFromSlice(Value, gpa, cases.decimal, .{});
    defer parsed.deinit();

    var failures: usize = 0;
    const all = parsed.value.array.items;
    for (all, 0..) |c, i| {
        var arena = std.heap.ArenaAllocator.init(gpa);
        defer arena.deinit();
        const o = c.object;
        const fname = o.get("fn").?.string;
        const args = o.get("args").?.array.items;
        run(arena.allocator(), fname, args, o.get("result").?) catch |err| {
            failures += 1;
            if (failures <= 25) {
                var buf: [512]u8 = undefined;
                const line = std.fmt.bufPrint(&buf, "{f}", .{std.json.fmt(c, .{})}) catch "(case too long to show)";
                std.debug.print("case {d} failed ({s}): {s}\n", .{ i, @errorName(err), line });
            }
        };
    }
    if (failures > 0) {
        std.debug.print("{d} of {d} cases failed\n", .{ failures, all.len });
        return error.TestFailed;
    }
}

test "no leaks" {
    // The conformance run uses an arena; this checks the public functions free what they
    // allocate when used directly with a leak-checking allocator.
    const gpa = std.testing.allocator;
    const u = try D.parse(gpa, "-12345678901234567890.125");
    defer u.deinit(gpa);
    const v = try D.parse(gpa, "3.3");
    defer v.deinit(gpa);

    const results = [_]Decimal{
        try D.add(gpa, u, v),
        try D.subtract(gpa, u, v),
        try D.multiply(gpa, u, v, .{ .scale = 3 }),
        try D.divide(gpa, u, v, .{}),
        try D.mod(gpa, u, v),
        try D.setScale(gpa, u, 1, .half_even),
        try D.stripTrailingZeros(gpa, u),
        try D.increment(gpa, u),
        try D.toInteger(gpa, u),
    };
    for (results) |r| r.deinit(gpa);

    const qr = try D.divmod(gpa, u, v);
    qr.deinit(gpa);
    _ = try D.compare(gpa, u, v, false);

    const s = try D.toScientificString(gpa, u, 2);
    gpa.free(s);
    const parts = try D.toScientificParts(gpa, u, 2);
    D.freeParts(gpa, parts);

    const r = try R.parse(gpa, "pi / 7");
    defer r.deinit(gpa);
    const r2 = try R.add(gpa, r, r, .{});
    r2.deinit(gpa);
    const rs = try R.toString(gpa, r);
    gpa.free(rs);
}
