//! Arbitrary precision rationals: a numerator and denominator decimal.
//! Port of `packages/hereabouts/src/decimal/rational.ts`.

const std = @import("std");
const Allocator = std.mem.Allocator;
const ArenaAllocator = std.heap.ArenaAllocator;

const dec = @import("decimal.zig");
const Decimal = dec.Decimal;
const MathContext = dec.MathContext;

pub const Rational = struct {
    numerator: Decimal,
    denominator: Decimal,

    /// Free a rational returned by a function in this package.
    pub fn deinit(self: Rational, gpa: Allocator) void {
        self.numerator.deinit(gpa);
        self.denominator.deinit(gpa);
    }
};

pub const Error = dec.ParseError || dec.Error;

/// A decimal, or the named constants 'e' and 'pi' (any case).
fn fromString(a: Allocator, s: []const u8) Error!Decimal {
    if (std.ascii.eqlIgnoreCase(s, "e")) return dec.E;
    if (std.ascii.eqlIgnoreCase(s, "pi")) return dec.PI;
    return dec.parse(a, s);
}

/// Whitespace removed by JavaScript's String.prototype.trim (the ASCII part).
const WHITESPACE = " \t\n\r\x0b\x0c";

fn parseImpl(a: Allocator, s: []const u8) Error!Rational {
    if (std.mem.indexOfScalar(u8, s, '/')) |i| {
        return .{
            .numerator = try fromString(a, std.mem.trim(u8, s[0..i], WHITESPACE)),
            .denominator = try fromString(a, std.mem.trim(u8, s[i + 1 ..], WHITESPACE)),
        };
    }
    return .{ .numerator = try fromString(a, s), .denominator = dec.ONE };
}

fn cloneRational(gpa: Allocator, r: Rational) Allocator.Error!Rational {
    const n = try dec.clone(gpa, r.numerator);
    errdefer n.deinit(gpa);
    return .{ .numerator = n, .denominator = try dec.clone(gpa, r.denominator) };
}

/// Parse "numerator / denominator" or a single value; either side may be 'e' or 'pi'.
pub fn parse(gpa: Allocator, s: []const u8) Error!Rational {
    var arena = ArenaAllocator.init(gpa);
    defer arena.deinit();
    return cloneRational(gpa, try parseImpl(arena.allocator(), s));
}

/// A rational from two decimals (copied).
pub fn init(gpa: Allocator, numerator: Decimal, denominator: Decimal) Allocator.Error!Rational {
    return cloneRational(gpa, .{ .numerator = numerator, .denominator = denominator });
}

/// Compare u to v, returning -1, 0 or 1.
pub fn compare(gpa: Allocator, u: Rational, v: Rational, context: MathContext) dec.Error!i32 {
    var arena = ArenaAllocator.init(gpa);
    defer arena.deinit();
    const a = arena.allocator();
    const x = try dec.multiply(a, u.numerator, v.denominator, context);
    const y = try dec.multiply(a, v.numerator, u.denominator, context);
    return dec.compare(a, x, y, false);
}

pub fn add(gpa: Allocator, u: Rational, v: Rational, context: MathContext) dec.Error!Rational {
    var arena = ArenaAllocator.init(gpa);
    defer arena.deinit();
    const a = arena.allocator();
    const x = try dec.multiply(a, u.numerator, v.denominator, context);
    const y = try dec.multiply(a, v.numerator, u.denominator, context);
    return cloneRational(gpa, .{
        .numerator = try dec.add(a, x, y),
        .denominator = try dec.multiply(a, u.denominator, v.denominator, context),
    });
}

pub fn subtract(gpa: Allocator, u: Rational, v: Rational, context: MathContext) dec.Error!Rational {
    var arena = ArenaAllocator.init(gpa);
    defer arena.deinit();
    const a = arena.allocator();
    const x = try dec.multiply(a, u.numerator, v.denominator, context);
    const y = try dec.multiply(a, v.numerator, u.denominator, context);
    return cloneRational(gpa, .{
        .numerator = try dec.subtract(a, x, y),
        .denominator = try dec.multiply(a, u.denominator, v.denominator, context),
    });
}

pub fn multiply(gpa: Allocator, u: Rational, v: Rational, context: MathContext) dec.Error!Rational {
    var arena = ArenaAllocator.init(gpa);
    defer arena.deinit();
    const a = arena.allocator();
    return cloneRational(gpa, .{
        .numerator = try dec.multiply(a, u.numerator, v.numerator, context),
        .denominator = try dec.multiply(a, u.denominator, v.denominator, context),
    });
}

pub fn divide(gpa: Allocator, u: Rational, v: Rational, context: MathContext) dec.Error!Rational {
    var arena = ArenaAllocator.init(gpa);
    defer arena.deinit();
    const a = arena.allocator();
    return cloneRational(gpa, .{
        .numerator = try dec.multiply(a, u.numerator, v.denominator, context),
        .denominator = try dec.multiply(a, u.denominator, v.numerator, context),
    });
}

/// Invert the sign.
pub fn negate(gpa: Allocator, u: Rational) Allocator.Error!Rational {
    const n = try dec.negate(gpa, u.numerator);
    errdefer n.deinit(gpa);
    return .{ .numerator = n, .denominator = try dec.clone(gpa, u.denominator) };
}

/// Swap numerator and denominator.
pub fn inverse(gpa: Allocator, u: Rational) Allocator.Error!Rational {
    return cloneRational(gpa, .{ .numerator = u.denominator, .denominator = u.numerator });
}

/// Divide the numerator by the denominator.
pub fn toDecimal(gpa: Allocator, u: Rational, context: MathContext) dec.Error!Decimal {
    return dec.divide(gpa, u.numerator, u.denominator, context);
}

/// "numerator / denominator", owned by gpa.
pub fn toString(gpa: Allocator, u: Rational) Allocator.Error![]u8 {
    const n = try dec.toString(gpa, u.numerator);
    defer gpa.free(n);
    const d = try dec.toString(gpa, u.denominator);
    defer gpa.free(d);
    return std.mem.concat(gpa, u8, &.{ n, " / ", d });
}

pub const ZERO: Rational = .{ .numerator = dec.ZERO, .denominator = dec.ONE };
pub const ONE: Rational = .{ .numerator = dec.ONE, .denominator = dec.ONE };
