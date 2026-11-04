//! Cardinal, ordinal and range plural rules for every CLDR language, evaluated on exact decimals.
//! Port of `packages/hereabouts/src/plurals`.
//!
//! ```zig
//! const rules = plurals.getPluralRules("fr", null);
//! const d = try decimal.parse(a, "1.5");
//! plurals.cardinal(rules, d, 0); // .one
//! ```
//!
//! Nothing here allocates except `numberOperandsToString`: the rule tables are static.

const std = @import("std");
const Decimal = @import("../decimal/decimal.zig").Decimal;
const types = @import("types.zig");
const ops = @import("operands.zig");
const autogen_rules = @import("autogen.rules.zig");
const autogen_ranges = @import("autogen.ranges.zig");

pub const Rule = types.Rule;
pub const Expr = types.Expr;
pub const Operand = types.Operand;
pub const RangeMap = types.RangeMap;
pub const NumberOperands = ops.NumberOperands;
pub const numberOperands = ops.numberOperands;
pub const numberOperandsToString = ops.numberOperandsToString;
pub const digitCount = ops.digitCount;

/// A plural category. The TypeScript returns these as strings ('zero', ..., 'other'); `name`
/// gives the same string.
pub const Category = enum(u8) {
    zero = 0,
    one = 1,
    two = 2,
    few = 3,
    many = 4,
    other = 5,

    pub fn name(self: Category) []const u8 {
        return @tagName(self);
    }

    /// Parse 'zero', 'one', ..., 'other'.
    pub fn fromString(s: []const u8) ?Category {
        return std.meta.stringToEnum(Category, s);
    }
};

/// Cardinal, ordinal and range plural rules for a language, as returned by `getPluralRules`.
/// They point into the static rule tables.
pub const PluralRules = struct {
    cardinals: []const Rule,
    ordinals: []const Rule,
    ranges: RangeMap,
};

const RuleMap = @TypeOf(autogen_rules.cardinal_rules);

fn resolve(r: RuleMap, language: []const u8, region: ?[]const u8) []const Rule {
    if (region) |reg| {
        if (reg.len > 0) {
            // Locale ids in the tables are short ('pt-PT'); longer ones can't match.
            var buf: [64]u8 = undefined;
            if (std.fmt.bufPrint(&buf, "{s}-{s}", .{ language, reg })) |id| {
                if (r.get(id)) |rules| return rules;
            } else |_| {}
        }
    }
    // No language has rules under 'root', so unknown languages get none (always 'other').
    return r.get(language) orelse r.get("root") orelse &.{};
}

/// Get the plural rules for a language and optional region ('pt', 'PT').
pub fn getPluralRules(language: []const u8, region: ?[]const u8) PluralRules {
    return .{
        .cardinals = resolve(autogen_rules.cardinal_rules, language, region),
        .ordinals = resolve(autogen_rules.ordinal_rules, language, region),
        .ranges = autogen_ranges.plural_ranges.get(language) orelse autogen_ranges.plural_ranges.get("en").?,
    };
}

/// Compute the plural operands for the Decimal `d`. (pluralOperands)
pub fn operands(rules: PluralRules, d: Decimal) NumberOperands {
    _ = rules;
    return ops.numberOperands(d, 0);
}

/// Cardinal plural category of `d`, with compact exponent `c` (0 for none). (pluralCardinal)
pub fn cardinal(rules: PluralRules, d: Decimal, c: i64) Category {
    return evaluate(ops.numberOperands(d, c), rules.cardinals);
}

/// Ordinal plural category of `d`. (pluralOrdinal)
pub fn ordinal(rules: PluralRules, d: Decimal) Category {
    return evaluate(ops.numberOperands(d, 0), rules.ordinals);
}

/// Plural category of the range `start` to `end`. (pluralRange)
pub fn range(rules: PluralRules, start: Decimal, end: Decimal) Category {
    switch (rules.ranges) {
        .all => |cat| return @enumFromInt(cat),
        .map => |entries| {
            const s = @intFromEnum(evaluate(ops.numberOperands(start, 0), rules.cardinals));
            const e = @intFromEnum(evaluate(ops.numberOperands(end, 0), rules.cardinals));
            const key = (@as(u16, 1) << @intCast(s) << 5) + (@as(u16, 1) << @intCast(e));
            for (entries) |entry| {
                if (entry[0] == key) return @enumFromInt(entry[1]);
            }
            return .other;
        },
    }
}

fn evaluate(o: NumberOperands, rules: []const Rule) Category {
    for (rules) |rule| {
        if (execute(o, rule.conditions)) return @enumFromInt(rule.category);
    }
    return .other;
}

fn execute(o: NumberOperands, conditions: []const []const u16) bool {
    // Evaluate each condition and OR them together.
    for (conditions) |cond| {
        // Evaluate the inner expressions and AND them together.
        var res = true;
        for (cond) |j| {
            if (!evaluateExpr(o, autogen_rules.expressions[j])) {
                res = false;
                break;
            }
        }
        if (res) return true;
    }
    return false;
}

/// True if the operands satisfy one relation of a rule.
pub fn evaluateExpr(o: NumberOperands, expr: Expr) bool {
    var n: i64 = switch (expr.operand) {
        .n => o.n,
        .i => o.i,
        .v => o.v,
        .w => o.w,
        .f => o.f,
        .t => o.t,
        .c => o.c,
    };

    // The N = X..Y syntax means N matches an integer from X to Y inclusive
    // Operand 'n' must always be compared as an integer, so if it has any non-zero decimal
    // parts we must set integer = false.
    const integer = if (expr.operand == .n) o.w == 0 else true;

    if (expr.mod != 0) n = @rem(n, expr.mod);

    var res = false;
    for (expr.ranges) |r| {
        res = res or (integer and r[0] <= n and n <= r[1]);
    }
    return if (expr.eq) res else !res;
}

test "basic" {
    const D = @import("../decimal/decimal.zig");
    const rules = getPluralRules("en", null);
    try std.testing.expectEqual(Category.one, cardinal(rules, D.ONE, 0));
    try std.testing.expectEqual(Category.other, cardinal(rules, D.TWO, 0));
    try std.testing.expectEqual(Category.other, cardinal(getPluralRules("xyz", null), D.ONE, 0));
    try std.testing.expectEqual(Category.one, cardinal(getPluralRules("pt", "PT"), D.ONE, 0));
}

test {
    _ = ops;
}
