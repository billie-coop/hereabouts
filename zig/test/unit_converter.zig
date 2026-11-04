//! Runs the shared cases in `conformance/unit-converter.json` against the Zig port.
//!
//! Factor sets are a table name or a list of `[src, factor, dst, offset?]` definitions (see
//! `packages/hereabouts/scripts/conformance/unit-converter.ts`). Values are decimal strings.

const std = @import("std");
const h = @import("hereabouts");
const cases = @import("cases");

test {
    std.testing.refAllDecls(h.unit_converter);
}

const U = h.unit_converter;
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

fn eql(a: []const u8, b: []const u8) bool {
    return std.mem.eql(u8, a, b);
}

// ---------------------------------------------------------------------------
// Factor sets
// ---------------------------------------------------------------------------

const TABLES = .{
    "ACCELERATION",    "ANGLE",        "AREA",           "CONSUMPTION", "DIGITAL",
    "DIGITAL_DECIMAL", "DURATION",     "ELECTRIC",       "ENERGY",      "FORCE",
    "FREQUENCY",       "GRAPHICS_PER", "GRAPHICS_PIXEL", "ILLUMINANCE", "LENGTH",
    "MASS",            "POWER",        "PRESSURE",       "RADIATION",   "RADIOACTIVITY",
    "RATIO",           "SPEED",        "SUBSTANCE",      "TEMPERATURE", "TORQUE",
    "VOLUME",          "VOLUME_UK",
};

fn table(name: []const u8) ?[]const U.FactorDef {
    inline for (TABLES) |t| {
        if (eql(name, t)) return &@field(U, t);
    }
    return null;
}

/// Factor sets built once per table name and shared by every case, as an application would.
const Sets = struct {
    map: std.StringHashMapUnmanaged(*U.UnitFactors) = .empty,

    fn get(self: *Sets, gpa: Allocator, name: []const u8) !*U.UnitFactors {
        if (self.map.get(name)) |m| return m;
        const m = try gpa.create(U.UnitFactors);
        m.* = try U.UnitFactors.init(gpa, table(name) orelse return fail("unknown table {s}", .{name}));
        try self.map.put(gpa, name, m);
        return m;
    }

    fn deinit(self: *Sets, gpa: Allocator) void {
        var it = self.map.valueIterator();
        while (it.next()) |m| {
            m.*.deinit(gpa);
            gpa.destroy(m.*);
        }
        self.map.deinit(gpa);
    }
};

var sets: Sets = .{};

fn factorValue(a: Allocator, v: Value) !U.FactorValue {
    return switch (v) {
        .string => |s| .{ .string = s },
        else => .{ .rational = try R.parse(a, v.object.get("rational").?.string) },
    };
}

/// A factor set from a table name or a list of definitions, allocated in `a`.
fn factorSet(a: Allocator, v: Value) !*const U.UnitFactors {
    if (v == .string) return sets.get(std.testing.allocator, v.string);
    const items = v.array.items;
    const defs = try a.alloc(U.FactorDef, items.len);
    for (items, defs) |x, *d| {
        const f = x.array.items;
        d.* = .{ .src = f[0].string, .factor = try factorValue(a, f[1]), .dst = f[2].string };
        if (f.len > 3) d.offset = try factorValue(a, f[3]);
    }
    const m = try a.create(U.UnitFactors);
    m.* = try U.UnitFactors.init(a, defs);
    return m;
}

fn argContext(v: Value) D.MathContext {
    if (v != .object) return .{};
    const o = v.object;
    var c: D.MathContext = .{};
    if (o.get("scale")) |s| c.scale = s.integer;
    if (o.get("precision")) |p| c.precision = p.integer;
    if (o.get("round")) |r| c.round = D.RoundingMode.fromString(r.string).?;
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
        std.debug.print("    decimal: want data=", .{});
        for (data) |x| std.debug.print("{d},", .{x.integer});
        std.debug.print(" sign={d} exp={d} flag={d}\n             got data={any} sign={d} exp={d} flag={d}\n", .{
            sign, exp, flag, got.data, got.sign, got.exp, @intFromEnum(got.flag),
        });
        return error.Mismatch;
    }
}

fn expectOptDecimal(want: Value, got: ?Decimal) !void {
    if (got) |d| {
        if (want == .null) return fail("want null, got a decimal", .{});
        return expectDecimal(want, d);
    }
    if (want != .null) return fail("want a decimal, got null", .{});
}

fn expectRational(want: Value, got: R.Rational) !void {
    try expectDecimal(want.object.get("numerator").?, got.numerator);
    try expectDecimal(want.object.get("denominator").?, got.denominator);
}

fn expectStrings(want: Value, got: []const []const u8) !void {
    const items = want.array.items;
    var same = items.len == got.len;
    if (same) {
        for (items, got) |w, g| {
            if (!eql(w.string, g)) same = false;
        }
    }
    if (!same) {
        std.debug.print("    strings: want", .{});
        for (items) |w| std.debug.print(" \"{s}\"", .{w.string});
        std.debug.print("\n             got ", .{});
        for (got) |g| std.debug.print(" \"{s}\"", .{g});
        std.debug.print("\n", .{});
        return error.Mismatch;
    }
}

fn expectPath(want: Value, got: ?U.UnitConversion) !void {
    if (got) |c| {
        if (want == .null) return fail("want no conversion, got one", .{});
        return expectStrings(want, c.path);
    }
    if (want != .null) return fail("want a conversion, got null", .{});
}

fn expectConversion(want: Value, got: ?U.UnitConversion) !void {
    try expectPath(if (want == .null) want else want.object.get("path").?, got);
    const c = got orelse return;
    const o = want.object;
    const fs = o.get("factors").?.array.items;
    if (fs.len != c.factors.len) return fail("factors: want {d}, got {d}", .{ fs.len, c.factors.len });
    for (fs, c.factors) |w, g| try expectRational(w, g);
    if (o.get("offset")) |off| {
        try expectRational(off, c.offset orelse return fail("want an offset, got none", .{}));
    } else if (c.offset != null) {
        return fail("want no offset, got one", .{});
    }
}

/// The TypeScript error message starts with this text for each error.
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
        error.CategoryExists => "this converter has registered factors for category",
        else => "?",
    };
}

fn isError(want: Value) bool {
    return want == .object and want.object.get("error") != null;
}

/// Check a result that may be an error: `check(want, value)` when there is no error.
fn expectResult(want: Value, got: anytype, comptime check: anytype) !void {
    if (isError(want)) {
        const msg = want.object.get("error").?.string;
        if (got) |_| {
            return fail("want error \"{s}\", got a result", .{msg});
        } else |err| {
            if (!std.mem.startsWith(u8, msg, errorPrefix(err))) {
                return fail("want error \"{s}\", got {s}", .{ msg, @errorName(err) });
            }
            return;
        }
    }
    const v = got catch |err| return fail("want a result, got {s}", .{@errorName(err)});
    return check(want, v);
}

// ---------------------------------------------------------------------------
// Running a case
// ---------------------------------------------------------------------------

fn convertWith(a: Allocator, m: *const U.UnitFactors, n: []const u8, src: []const u8, dst: []const u8, ctx: D.MathContext) !?Decimal {
    const c = try U.UnitConverter.init(a, &.{.{ .category = "x", .factors = m }});
    return U.UnitConverter.convertUnits(c, a, "x", try D.parse(a, n), src, dst, ctx);
}

fn checkNull(want: Value, _: U.UnitConverter) !void {
    if (want != .null) return fail("want a result, got null", .{});
}

fn runScript(a: Allocator, ops: []const Value, want: []const Value) !void {
    if (ops.len != want.len) return fail("script: {d} ops, {d} results", .{ ops.len, want.len });
    var c: U.UnitConverter = .{};
    for (ops, want, 0..) |opv, w, i| {
        errdefer std.debug.print("    in op {d}: {f}\n", .{ i, std.json.fmt(opv, .{}) });
        const op = opv.array.items;
        const name = op[0].string;
        if (eql(name, "create")) {
            const items = op[1].array.items;
            const entries = try a.alloc(U.UnitConverter.Entry, items.len);
            for (items, entries) |x, *e| {
                e.* = .{ .category = x.array.items[0].string, .factors = try factorSet(a, x.array.items[1]) };
            }
            const r = U.UnitConverter.init(a, entries);
            try expectResult(w, r, checkNull);
            c = r catch c;
        } else if (eql(name, "add")) {
            const r = U.UnitConverter.add(c, a, op[1].string, try factorSet(a, op[2]));
            try expectResult(w, r, checkNull);
            const keep = op.len <= 3 or op[3] != .bool or op[3].bool;
            if (keep) c = r catch c;
        } else if (eql(name, "has")) {
            if (w.bool != U.UnitConverter.has(c, op[1].string)) return fail("has: want {}", .{w.bool});
        } else if (eql(name, "factors")) {
            if (U.UnitConverter.factors(c, op[1].string)) |m| {
                if (w == .null) return fail("factors: want null", .{});
                try expectStrings(w, m.units);
            } else if (w != .null) return fail("factors: want a set, got null", .{});
        } else if (eql(name, "categories")) {
            try expectStrings(w, try U.UnitConverter.categories(c, a));
        } else if (eql(name, "get")) {
            try expectResult(w, U.UnitConverter.get(c, a, op[1].string, op[2].string, op[3].string), expectConversion);
        } else if (eql(name, "convert")) {
            const r = U.UnitConverter.convertUnits(c, a, op[1].string, try D.parse(a, op[2].string), op[3].string, op[4].string, argContext(op[5]));
            try expectResult(w, r, expectOptDecimal);
        } else return fail("unknown op {s}", .{name});
    }
}

/// Run one case. Everything is allocated in the arena `a`.
fn run(a: Allocator, fname: []const u8, args: []const Value, want: Value) !void {
    if (eql(fname, "converter")) return runScript(a, args[0].array.items, want.array.items);

    const m = try factorSet(a, args[0]);

    if (eql(fname, "unitFactors")) return expectStrings(want, m.units);

    if (eql(fname, "unitFactorsGet")) {
        return expectResult(want, U.UnitFactors.get(m, a, args[1].string, args[2].string), expectConversion);
    }

    if (eql(fname, "convertUnits")) {
        const r = convertWith(a, m, args[1].string, args[2].string, args[3].string, argContext(args[4]));
        return expectResult(want, r, expectOptDecimal);
    }

    // Batch cases over every pair of units.
    const pairs = want.array.items;
    if (pairs.len != m.units.len * m.units.len) return fail("{d} pairs, {d} units", .{ pairs.len, m.units.len });
    for (m.units, 0..) |u, i| {
        for (m.units, 0..) |v, j| {
            const w = pairs[i * m.units.len + j];
            errdefer std.debug.print("    pair {s} -> {s}\n", .{ u, v });
            if (eql(fname, "unitFactorsGetPaths")) {
                try expectPath(w, try U.UnitFactors.get(m, a, u, v));
            } else if (eql(fname, "convertUnitsAll")) {
                try expectOptDecimal(w, try convertWith(a, m, args[1].string, u, v, .{}));
            } else return fail("unknown function {s}", .{fname});
        }
    }
}

test "unit-converter conformance" {
    const gpa = std.testing.allocator;
    defer sets.deinit(gpa);
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
                var buf: [600]u8 = undefined;
                const line = std.fmt.bufPrint(&buf, "{f}", .{std.json.fmt(Value{ .array = o.get("args").?.array }, .{})}) catch "(args too long to show)";
                std.debug.print("case {d} failed ({s}): {s} {s}\n", .{ i, @errorName(err), fname, line });
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

    var length = try U.UnitFactors.init(gpa, &U.LENGTH);
    defer length.deinit(gpa);
    var temp = try U.UnitFactors.init(gpa, &U.TEMPERATURE);
    defer temp.deinit(gpa);
    const bad_defs = [_]U.FactorDef{.{ .src = "a", .factor = .{ .string = "x" }, .dst = "b" }};
    var bad = try U.UnitFactors.init(gpa, &bad_defs);
    defer bad.deinit(gpa);

    const empty: U.UnitConverter = .{};
    const c1 = try U.UnitConverter.add(empty, gpa, "length", &length);
    defer c1.deinit(gpa);
    try std.testing.expectError(error.CategoryExists, U.UnitConverter.add(c1, gpa, "length", &length));
    const c = try U.UnitConverter.init(gpa, &.{
        .{ .category = "temperature", .factors = &temp },
        .{ .category = "length", .factors = &length },
        .{ .category = "bad", .factors = &bad },
    });
    defer c.deinit(gpa);
    try std.testing.expectError(error.CategoryExists, U.UnitConverter.init(gpa, &.{
        .{ .category = "length", .factors = &length },
        .{ .category = "length", .factors = &length },
    }));

    const cats = try U.UnitConverter.categories(c, gpa);
    defer gpa.free(cats);
    try std.testing.expectEqualStrings("bad", cats[0]);
    try std.testing.expect(U.UnitConverter.has(c, "length"));
    try std.testing.expect(U.UnitConverter.factors(c, "temperature") == &temp);

    const conv = (try U.UnitConverter.get(c, gpa, "temperature", "celsius", "fahrenheit")).?;
    defer conv.deinit(gpa);
    try std.testing.expect(conv.offset != null);
    const same = (try U.UnitFactors.get(&length, gpa, "nope", "nope")).?;
    same.deinit(gpa);
    try std.testing.expectError(error.UnexpectedCharacter, U.UnitConverter.get(c, gpa, "bad", "a", "b"));

    const n = try D.parse(gpa, "1.5");
    defer n.deinit(gpa);
    const yards = (try U.UnitConverter.convertUnits(c, gpa, "length", n, "mile", "yard", .{})).?;
    defer yards.deinit(gpa);
    const s = try D.toString(gpa, yards);
    defer gpa.free(s);
    try std.testing.expectEqualStrings("2640", s);
    const f = (try U.UnitConverter.convertUnits(c, gpa, "temperature", n, "celsius", "fahrenheit", .{ .precision = 10 })).?;
    f.deinit(gpa);
    try std.testing.expect((try U.UnitConverter.convertUnits(c, gpa, "length", n, "mile", "kelvin", .{})) == null);

    // Every pair of the largest table, for leaks on the path search.
    var volume = try U.UnitFactors.init(gpa, &U.VOLUME);
    defer volume.deinit(gpa);
    for (volume.units) |u| {
        for (volume.units) |v| {
            if (try U.UnitFactors.get(&volume, gpa, u, v)) |x| x.deinit(gpa);
        }
    }
}
