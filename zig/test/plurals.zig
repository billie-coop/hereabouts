//! Runs the shared cases in `conformance/plurals.json` against the Zig port.
//!
//! Each case names a TypeScript function, its arguments and the TypeScript result. Decimal
//! arguments are strings, parsed here first; languages come with an optional region.

const std = @import("std");
const h = @import("hereabouts");
const cases = @import("cases");

test {
    std.testing.refAllDecls(h.plurals);
}

const P = h.plurals;
const D = h.decimal;
const Value = std.json.Value;
const Allocator = std.mem.Allocator;

const Mismatch = error{Mismatch};

fn fail(comptime f: []const u8, args: anytype) Mismatch {
    std.debug.print("    " ++ f ++ "\n", args);
    return error.Mismatch;
}

fn eql(a: []const u8, b: []const u8) bool {
    return std.mem.eql(u8, a, b);
}

fn optStr(v: Value) ?[]const u8 {
    return if (v == .null) null else v.string;
}

fn rulesArg(args: []const Value) P.PluralRules {
    return P.getPluralRules(args[0].string, optStr(args[1]));
}

fn expectCategory(want: Value, got: P.Category) !void {
    if (!eql(want.string, got.name())) return fail("category: want {s}, got {s}", .{ want.string, got.name() });
}

fn expectOperands(want: Value, got: P.NumberOperands) !void {
    const o = want.object;
    inline for (.{ "n", "i", "v", "w", "f", "t", "c" }) |field| {
        const w = o.get(field).?.integer;
        const g = @field(got, field);
        if (w != g) return fail("operand {s}: want {d}, got {d}", .{ field, w, g });
    }
}

fn expectRules(want: ?Value, got: []const P.Rule) !void {
    const items = if (want) |w| w.array.items else &[_]Value{};
    if (items.len != got.len) return fail("rules: want {d}, got {d}", .{ items.len, got.len });
    for (items, got) |w, g| {
        const pair = w.array.items;
        if (pair[0].integer != g.category) return fail("rule category: want {d}, got {d}", .{ pair[0].integer, g.category });
        const conds = pair[1].array.items;
        if (conds.len != g.conditions.len) return fail("rule conditions differ", .{});
        for (conds, g.conditions) |wc, gc| {
            if (wc.array.items.len != gc.len) return fail("rule condition length differs", .{});
            for (wc.array.items, gc) |x, y| {
                if (x.integer != y) return fail("rule expression index: want {d}, got {d}", .{ x.integer, y });
            }
        }
    }
}

fn expectRanges(want: Value, got: P.RangeMap) !void {
    switch (got) {
        .all => |c| {
            if (want != .integer or want.integer != c) return fail("ranges: want other, got all={d}", .{c});
        },
        .map => |entries| {
            if (want != .object) return fail("ranges: want a number, got a map", .{});
            if (want.object.count() != entries.len) return fail("ranges: size differs", .{});
            for (entries) |e| {
                var buf: [8]u8 = undefined;
                const key = std.fmt.bufPrint(&buf, "{d}", .{e[0]}) catch unreachable;
                const w = want.object.get(key) orelse return fail("ranges: extra key {s}", .{key});
                if (w.integer != e[1]) return fail("ranges[{s}]: want {d}, got {d}", .{ key, w.integer, e[1] });
            }
        },
    }
}

/// Run one case. Everything is allocated in the arena `a`.
fn run(a: Allocator, fname: []const u8, args: []const Value, want: Value) !void {
    if (eql(fname, "getPluralRules")) {
        const rules = rulesArg(args);
        const o = want.object;
        try expectRules(o.get("cardinals"), rules.cardinals);
        try expectRules(o.get("ordinals"), rules.ordinals);
        return expectRanges(o.get("ranges").?, rules.ranges);
    }
    if (eql(fname, "pluralCardinal")) {
        const d = try D.parse(a, args[2].string);
        return expectCategory(want, P.cardinal(rulesArg(args), d, args[3].integer));
    }
    if (eql(fname, "pluralOrdinal")) {
        const d = try D.parse(a, args[2].string);
        return expectCategory(want, P.ordinal(rulesArg(args), d));
    }
    if (eql(fname, "pluralRange")) {
        const s = try D.parse(a, args[2].string);
        const e = try D.parse(a, args[3].string);
        return expectCategory(want, P.range(rulesArg(args), s, e));
    }
    if (eql(fname, "numberOperands")) {
        const d = try D.parse(a, args[0].string);
        return expectOperands(want, P.numberOperands(d, args[1].integer));
    }
    if (eql(fname, "numberOperandsToString")) {
        const d = try D.parse(a, args[0].string);
        const s = try P.numberOperandsToString(a, P.numberOperands(d, args[1].integer));
        if (!eql(want.string, s)) return fail("want \"{s}\", got \"{s}\"", .{ want.string, s });
        return;
    }
    if (eql(fname, "pluralOperands")) {
        const d = try D.parse(a, args[1].string);
        return expectOperands(want, P.operands(P.getPluralRules(args[0].string, null), d));
    }
    if (eql(fname, "digitCount")) {
        const n = P.digitCount(@intCast(args[0].integer));
        if (want.integer != n) return fail("want {d}, got {d}", .{ want.integer, n });
        return;
    }
    return fail("unknown function {s}", .{fname});
}

test "plurals conformance" {
    const gpa = std.testing.allocator;
    const parsed = try std.json.parseFromSlice(Value, gpa, cases.json, .{});
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
    const gpa = std.testing.allocator;
    const d = try D.parse(gpa, "1.50");
    defer d.deinit(gpa);
    const rules = P.getPluralRules("fr", null);
    try std.testing.expectEqual(P.Category.one, P.cardinal(rules, d, 0));
    _ = P.ordinal(rules, d);
    _ = P.range(rules, d, d);
    const s = try P.numberOperandsToString(gpa, P.operands(rules, d));
    defer gpa.free(s);
    try std.testing.expectEqualStrings("n: 1, i: 1, v: 2, w: 1, f: 50, t: 5, c: 0", s);
}
