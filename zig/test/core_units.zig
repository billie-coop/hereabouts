//! Runs the shared cases in `conformance/core-units.json`: unit quantity formatting.
//!
//! Locales load through a framework whose loader returns the embedded test packs.

const std = @import("std");
const h = @import("hereabouts");
const cases = @import("cases");
const packs = @import("packs");

const core = h.core;
const D = h.decimal;
const Value = std.json.Value;
const Allocator = std.mem.Allocator;
const LocaleData = core.LocaleData;
const Part = D.Part;

test {
    std.testing.refAllDecls(core);
}

const Mismatch = error{Mismatch};

fn fail(comptime f: []const u8, args: anytype) Mismatch {
    std.debug.print("    " ++ f ++ "\n", args);
    return error.Mismatch;
}

fn eql(a: []const u8, b: []const u8) bool {
    return std.mem.eql(u8, a, b);
}

fn loadPack(_: ?*anyopaque, language: []const u8) ?[]const u8 {
    return packs.get(language);
}

// ---------------------------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------------------------

fn str(v: Value) []const u8 {
    return v.string;
}

fn optStr(v: Value) ?[]const u8 {
    return if (v == .null) null else v.string;
}

fn int(v: Value) i64 {
    return switch (v) {
        .integer => |i| i,
        .float => |f| @intFromFloat(f),
        else => unreachable,
    };
}

fn float(v: Value) f64 {
    return switch (v) {
        .integer => |i| @floatFromInt(i),
        .float => |f| f,
        .number_string => |s| std.fmt.parseFloat(f64, s) catch unreachable,
        else => unreachable,
    };
}

/// A case whose input the Zig API cannot express (e.g. an unknown enum string).
const Skip = error{Skip};

fn enumArg(comptime E: type, v: Value) Skip!E {
    return E.fromString(v.string) orelse error.Skip;
}

/// Set a field if the options struct has it.
fn set(o: anytype, comptime name: []const u8, v: anytype) void {
    if (@hasField(@TypeOf(o.*), name)) @field(o.*, name) = v;
}

fn fieldType(comptime T: type, comptime name: []const u8) type {
    if (!@hasField(T, name)) return void;
    const F = @FieldType(T, name);
    return switch (@typeInfo(F)) {
        .optional => |opt| opt.child,
        else => F,
    };
}

fn setEnum(o: anytype, comptime name: []const u8, x: Value) Skip!void {
    const E = fieldType(@TypeOf(o.*), name);
    if (E == void) return;
    @field(o.*, name) = try enumArg(E, x);
}

/// Fill the fields of a Zig options struct from the TypeScript options object.
fn options(comptime T: type, v: Value) Skip!T {
    var o: T = .{};
    if (v == .null) return o;
    var it = v.object.iterator();
    while (it.next()) |e| {
        const k = e.key_ptr.*;
        const x = e.value_ptr.*;
        if (eql(k, "nu")) {
            set(&o, "nu", @as(?[]const u8, x.string));
        } else if (eql(k, "round")) {
            try setEnum(&o, "round", x);
        } else if (eql(k, "group")) {
            set(&o, "group", @as(?bool, x.bool));
        } else if (eql(k, "minimumIntegerDigits")) {
            set(&o, "minimum_integer_digits", @as(?i64, int(x)));
        } else if (eql(k, "maximumFractionDigits")) {
            set(&o, "maximum_fraction_digits", @as(?i64, int(x)));
        } else if (eql(k, "minimumFractionDigits")) {
            set(&o, "minimum_fraction_digits", @as(?i64, int(x)));
        } else if (eql(k, "maximumSignificantDigits")) {
            set(&o, "maximum_significant_digits", @as(?i64, int(x)));
        } else if (eql(k, "minimumSignificantDigits")) {
            set(&o, "minimum_significant_digits", @as(?i64, int(x)));
        } else if (eql(k, "trimZeroFractions")) {
            set(&o, "trim_zero_fractions", x.bool);
        } else if (eql(k, "divisor")) {
            set(&o, "divisor", @as(?f64, float(x)));
        } else if (eql(k, "negativeZero")) {
            set(&o, "negative_zero", @as(?bool, x.bool));
        } else if (eql(k, "cash")) {
            set(&o, "cash", x.bool);
        } else if (eql(k, "symbolWidth")) {
            try setEnum(&o, "symbol_width", x);
        } else if (eql(k, "style")) {
            try setEnum(&o, "style", x);
        } else if (eql(k, "length")) {
            try setEnum(&o, "length", x);
        } else if (eql(k, "context")) {
            try setEnum(&o, "context", x);
        } else if (eql(k, "errors")) {
            if (@hasField(T, "errors")) {
                for (x.array.items) |s| {
                    if (eql(s.string, "nan")) o.errors.nan = true;
                    if (eql(s.string, "infinity")) o.errors.infinity = true;
                }
            }
        } else {
            std.debug.print("    unknown option {s}\n", .{k});
            return error.Skip;
        }
    }
    return o;
}

fn expectString(want: Value, got: []const u8) !void {
    if (want != .string) return fail("want {any}, got string \"{s}\"", .{ want, got });
    if (!eql(want.string, got)) return fail("string: want \"{s}\", got \"{s}\"", .{ want.string, got });
}

fn expectBool(want: Value, got: bool) !void {
    if (want.bool != got) return fail("bool: want {}, got {}", .{ want.bool, got });
}

fn expectInt(want: Value, got: i64) !void {
    if (int(want) != got) return fail("int: want {d}, got {d}", .{ int(want), got });
}

fn expectParts(want: Value, got: []const Part) !void {
    if (want != .array) return fail("want {any}, got parts", .{want});
    const items = want.array.items;
    var same = items.len == got.len;
    if (same) {
        for (items, got) |w, g| {
            const o = w.object;
            if (!eql(o.get("type").?.string, g.type) or !eql(o.get("value").?.string, g.value)) same = false;
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

/// Structural equality of JSON values; object key order does not matter.
fn jsonEql(a: Value, b: Value) bool {
    switch (a) {
        .object => |ao| {
            if (b != .object or ao.count() != b.object.count()) return false;
            var it = ao.iterator();
            while (it.next()) |e| {
                const bv = b.object.get(e.key_ptr.*) orelse return false;
                if (!jsonEql(e.value_ptr.*, bv)) return false;
            }
            return true;
        },
        .array => |aa| {
            if (b != .array or aa.items.len != b.array.items.len) return false;
            for (aa.items, b.array.items) |x, y| if (!jsonEql(x, y)) return false;
            return true;
        },
        .string => |s| return b == .string and eql(s, b.string),
        .bool => |x| return b == .bool and x == b.bool,
        .null => return b == .null,
        .integer, .float, .number_string => return (b == .integer or b == .float or b == .number_string) and float(a) == float(b),
    }
}

fn expectJson(a: Allocator, want: Value, got: Value) !void {
    if (!jsonEql(want, got)) {
        const ws = try std.json.Stringify.valueAlloc(a, want, .{});
        const gs = try std.json.Stringify.valueAlloc(a, got, .{});
        return fail("json: want {s}\n           got  {s}", .{ ws, gs });
    }
}

fn errorMessage(err: anyerror) []const u8 {
    return switch (err) {
        error.InvalidNaN => "Invalid argument: NaN",
        error.InvalidInfinity => "Invalid argument: Infinity",
        else => @errorName(err),
    };
}

fn wantsError(want: Value) ?[]const u8 {
    if (want == .object) {
        if (want.object.get("error")) |e| return e.string;
    }
    return null;
}

/// Compare a result that may be an error with the expected value.
fn expectResult(want: Value, got: anytype, comptime check: anytype) !void {
    if (got) |v| {
        if (wantsError(want)) |msg| return fail("want error \"{s}\", got a value", .{msg});
        return check(want, v);
    } else |err| {
        if (err == error.OutOfMemory) return err;
        const msg = wantsError(want) orelse return fail("want a value, got error {s}", .{@errorName(err)});
        if (!eql(msg, errorMessage(err))) return fail("want error \"{s}\", got \"{s}\"", .{ msg, errorMessage(err) });
    }
}

fn strCheck(want: Value, got: []u8) !void {
    return expectString(want, got);
}

fn partsCheck(want: Value, got: []Part) !void {
    return expectParts(want, got);
}

fn quantity(a: Allocator, v: Value) !core.units.Quantity {
    const o = v.object;
    return .{
        .value = try D.parse(a, o.get("value").?.string),
        .unit = if (o.get("unit")) |u| u.string else null,
        .per = if (o.get("per")) |u| u.string else null,
        .times = if (o.get("times")) |u| u.string else null,
    };
}

fn run(fw: *core.Framework, a: Allocator, fname: []const u8, args: []const Value, want: Value) !void {
    const U = core.units;
    const d = try fw.loadLocale(.{ .id = str(args[0]) });
    if (eql(fname, "availableUnits")) {
        const got = U.availableUnits(d);
        if (got.len != want.array.items.len) return fail("count: want {d}, got {d}", .{ want.array.items.len, got.len });
        for (want.array.items, got) |w, g| try expectString(w, g);
        return;
    }
    if (eql(fname, "getUnitDisplayName")) {
        const length: ?U.UnitLength = if (args[2] == .null) null else try enumArg(U.UnitLength, args[2]);
        return expectString(want, U.getUnitDisplayName(d, str(args[1]), length));
    }
    if (eql(fname, "formatQuantity") or eql(fname, "formatQuantityToParts")) {
        const q = try quantity(a, args[1]);
        const o = try options(U.UnitFormatOptions, args[2]);
        if (eql(fname, "formatQuantity")) return expectString(want, try U.formatQuantity(a, d, q, o));
        return expectParts(want, try U.formatQuantityToParts(a, d, q, o));
    }
    if (eql(fname, "formatQuantitySequence") or eql(fname, "formatQuantitySequenceToParts")) {
        const qs = try a.alloc(U.Quantity, args[1].array.items.len);
        for (args[1].array.items, qs) |x, *q| q.* = try quantity(a, x);
        const o = try options(U.UnitFormatOptions, args[2]);
        if (eql(fname, "formatQuantitySequence")) return expectString(want, try U.formatQuantitySequence(a, d, qs, o));
        return expectParts(want, try U.formatQuantitySequenceToParts(a, d, qs, o));
    }
    return fail("unknown function {s}", .{fname});
}

test "conformance cases" {
    const gpa = std.testing.allocator;
    var fw = core.Framework.init(gpa, .{ .loader = .{ .load = loadPack } });
    defer fw.deinit();

    const parsed = try std.json.parseFromSlice(Value, gpa, cases.json, .{});
    defer parsed.deinit();

    var failures: usize = 0;
    var skipped: usize = 0;
    const all = parsed.value.array.items;
    for (all, 0..) |c, i| {
        var arena: std.heap.ArenaAllocator = .init(gpa);
        defer arena.deinit();
        const o = c.object;
        const fname = o.get("fn").?.string;
        const args = o.get("args").?.array.items;
        run(&fw, arena.allocator(), fname, args, o.get("result").?) catch |err| {
            if (err == error.Skip) {
                skipped += 1;
                continue;
            }
            failures += 1;
            if (failures <= 25) {
                const s = try std.json.Stringify.valueAlloc(arena.allocator(), o.get("args").?, .{});
                std.debug.print("case {d} {s}({s}): {s}\n", .{ i, fname, s, @errorName(err) });
            }
        };
    }
    if (failures > 0) {
        std.debug.print("{d} of {d} cases failed ({d} skipped)\n", .{ failures, all.len, skipped });
        return error.TestFailed;
    }
}

test "no leaks" {
    const gpa = std.testing.allocator;
    var fw = core.Framework.init(gpa, .{ .loader = .{ .load = loadPack } });
    defer fw.deinit();
    const U = core.units;
    const d = try fw.loadLocale(.{ .id = "de-CH" });
    const n = try D.parse(gpa, "1234.5");
    defer n.deinit(gpa);
    const qs = [_]U.Quantity{
        .{ .value = n, .unit = "meter", .per = "second" },
        .{ .value = D.ONE, .unit = "newton", .times = "meter" },
        .{ .value = D.TWO, .unit = "kilogram" },
    };
    inline for (.{ .long, .short, .narrow }) |length| {
        for (qs) |q| {
            gpa.free(try U.formatQuantity(gpa, d, q, .{ .length = length }));
            D.freeParts(gpa, try U.formatQuantityToParts(gpa, d, q, .{ .length = length, .style = .short }));
        }
        gpa.free(try U.formatQuantitySequence(gpa, d, &qs, .{ .length = length }));
        D.freeParts(gpa, try U.formatQuantitySequenceToParts(gpa, d, &qs, .{ .length = length }));
    }
    const s = try U.formatQuantity(gpa, d, qs[0], .{});
    defer gpa.free(s);
    try std.testing.expectEqualStrings("1'234.5 Meter pro Sekunde", s);
    try std.testing.expectEqualStrings("Meter", U.getUnitDisplayName(d, "meter", null));
}
