//! Runs the shared cases in `conformance/core-numbers.json`: the core foundation (packs,
//! bundles, schema, framework, numbering systems, patterns) and number and currency formatting.
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

// ---------------------------------------------------------------------------------------------
// Schema paths
// ---------------------------------------------------------------------------------------------

const Arrow = union(enum) {
    field: core.arrows.FieldArrow,
    vector: core.arrows.VectorArrow,
    digits: core.arrows.DigitsArrow,
};

const NSI = core.schema_types.NumberSystemInfo;

fn resolveIn(comptime T: type, v: *const T, segs: []const []const u8) ?Arrow {
    if (T == core.arrows.FieldArrow) return if (segs.len == 0) .{ .field = v.* } else null;
    if (T == core.arrows.VectorArrow) return if (segs.len == 0) .{ .vector = v.* } else null;
    if (T == core.arrows.DigitsArrow) return if (segs.len == 0) .{ .digits = v.* } else null;
    if (segs.len == 0) return null;
    if (T == core.arrows.ScopeArrow(NSI)) {
        const child = v.get(segs[0]) orelse return null;
        return resolveIn(NSI, child, segs[1..]);
    }
    inline for (std.meta.fields(T)) |f| {
        if (eql(f.name, segs[0])) return resolveIn(f.type, &@field(v.*, f.name), segs[1..]);
    }
    return null;
}

fn resolvePath(a: Allocator, path: []const u8) !Arrow {
    var segs: std.ArrayList([]const u8) = .empty;
    var it = std.mem.splitScalar(u8, path, '.');
    while (it.next()) |s| try segs.append(a, s);
    return resolveIn(core.Schema, &core.schema.schema, segs.items) orelse fail("unknown path {s}", .{path});
}

/// Keys of a vector lookup: each a string or an array of fallback strings.
fn vectorKeys(a: Allocator, v: Value) ![]const []const []const u8 {
    const items = v.array.items;
    const out = try a.alloc([]const []const u8, items.len);
    for (items, out) |k, *o| {
        if (k == .string) {
            const one = try a.alloc([]const u8, 1);
            one[0] = k.string;
            o.* = one;
        } else {
            const many = try a.alloc([]const u8, k.array.items.len);
            for (k.array.items, many) |s, *m| m.* = s.string;
            o.* = many;
        }
    }
    return out;
}

// ---------------------------------------------------------------------------------------------
// Checking results
// ---------------------------------------------------------------------------------------------

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

fn symbolsJson(a: Allocator, s: anytype) !Value {
    var o: std.json.ObjectMap = .empty;
    inline for (std.meta.fields(@TypeOf(s))) |f| {
        const v = @field(s, f.name);
        const key = try snakeToCamel(a, f.name);
        if (@TypeOf(v) == []const u8) {
            if (v.len > 0) try o.put(a, key, .{ .string = v });
        } else {
            try o.put(a, key, try symbolsJson(a, v));
        }
    }
    return .{ .object = o };
}

fn patternJson(a: Allocator, p: core.parsing.number.NumberPattern) !Value {
    var o: std.json.ObjectMap = .empty;
    var nodes: std.json.Array = .init(a);
    for (p.nodes) |n| try nodes.append(switch (n) {
        .text => |s| .{ .string = s },
        .field => |f| .{ .integer = @intFromEnum(f) },
    });
    try o.put(a, "nodes", .{ .array = nodes });
    try o.put(a, "minInt", .{ .integer = p.min_int });
    try o.put(a, "maxFrac", .{ .integer = p.max_frac });
    try o.put(a, "minFrac", .{ .integer = p.min_frac });
    try o.put(a, "priGroup", .{ .integer = p.pri_group });
    try o.put(a, "secGroup", .{ .integer = p.sec_group });
    return .{ .object = o };
}

fn joinDigits(a: Allocator, d: *const [10][]const u8) ![]u8 {
    return std.mem.concat(a, u8, d);
}

// ---------------------------------------------------------------------------------------------
// Running a case
// ---------------------------------------------------------------------------------------------

const Runner = struct {
    fw: *core.Framework,

    fn data(self: Runner, id: []const u8) !core.LocaleHandle {
        return self.fw.loadLocale(.{ .id = id });
    }

    fn run(self: Runner, a: Allocator, fname: []const u8, args: []const Value, want: Value) !void {
        const N = core.numbers;
        // ----- Foundation -----
        if (eql(fname, "checksumIndices")) {
            const named = try a.alloc(core.checksum.NamedIndex, core.schema.index_names.len);
            for (core.schema.index_names, named) |name, *n| n.* = .{ .name = name, .index = core.schema.index(name).? };
            return expectString(want, try core.checksum.checksumIndices(a, str(args[0]), named));
        }
        if (eql(fname, "loadLocale")) {
            const handle = try self.data(str(args[0]));
            defer handle.deinit();
            const d = handle.data();
            const b = d.bundle;
            const w = want.object;
            try expectString(w.get("id").?, b.id);
            try expectString(w.get("language").?, b.language);
            try expectString(w.get("region").?, b.region);
            try expectString(w.get("languageRegion").?, b.language_region);
            try expectString(w.get("languageScript").?, b.language_script);
            try expectString(w.get("calendarSystem").?, b.calendar_system);
            try expectString(w.get("numberSystem").?, b.number_system);
            const l = w.get("locale").?.object;
            try expectString(l.get("id").?, d.locale.id);
            return expectString(l.get("tag").?, try d.locale.tag.compact(a));
        }
        if (eql(fname, "resolveLocale")) {
            const l = try core.resolveLocale(a, str(args[0]));
            try expectString(want.object.get("id").?, l.id);
            return expectString(want.object.get("tag").?, try l.tag.compact(a));
        }
        if (eql(fname, "availableLocales")) {
            const all = core.availableLocales();
            const items = want.array.items;
            if (items.len != all.len) return fail("count: want {d}, got {d}", .{ items.len, all.len });
            for (items, all) |w, l| {
                try expectString(w.array.items[0], l.id);
                try expectString(w.array.items[1], try l.tag.compact(a));
            }
            return;
        }
        if (eql(fname, "bundleGet")) {
            const handle = try self.data(str(args[0]));
            defer handle.deinit();
            const d = handle.data();
            for (args[1].array.items, want.array.items) |off, w| try expectString(w, d.bundle.get(@intCast(int(off))));
            return;
        }
        if (eql(fname, "fieldGet") or eql(fname, "vectorExists")) {
            const handle = try self.data(str(args[0]));
            defer handle.deinit();
            const d = handle.data();
            for (args[1].array.items, want.array.items) |p, w| {
                const arrow = try resolvePath(a, str(p));
                if (eql(fname, "fieldGet")) {
                    try expectString(w, arrow.field.get(&d.bundle));
                } else {
                    try expectBool(w, arrow.vector.exists(&d.bundle));
                }
            }
            return;
        }
        if (eql(fname, "vectorMapping")) {
            const handle = try self.data(str(args[0]));
            defer handle.deinit();
            const d = handle.data();
            const arrow = try resolvePath(a, str(args[1]));
            return expectJson(a, want, try arrow.vector.mapping(a, &d.bundle));
        }
        if (eql(fname, "vectorGet")) {
            const handle = try self.data(str(args[0]));
            defer handle.deinit();
            const d = handle.data();
            const arrow = try resolvePath(a, str(args[1]));
            return expectString(want, arrow.vector.getAlt(&d.bundle, try vectorKeys(a, args[2])));
        }
        if (eql(fname, "vectorValid")) {
            const arrow = try resolvePath(a, str(args[0]));
            return expectBool(want, arrow.vector.valid(try vectorKeys(a, args[1])));
        }
        if (eql(fname, "digitsGet")) {
            const handle = try self.data(str(args[0]));
            defer handle.deinit();
            const d = handle.data();
            const arrow = try resolvePath(a, str(args[1]));
            const r = arrow.digits.get(&d.bundle, str(args[2]), float(args[3]));
            try expectString(want.array.items[0], r.pattern);
            return expectInt(want.array.items[1], r.divisor);
        }
        if (eql(fname, "scopeGet")) {
            return expectBool(want, core.schema.schema.Numbers.numberSystem.get(str(args[1])) != null);
        }
        if (eql(fname, "keyIndexGet")) {
            const ki = core.schema.index(str(args[0])) orelse return fail("no index {s}", .{str(args[0])});
            for (args[1].array.items, want.array.items) |k, w| {
                const i: i64 = if (ki.get(str(k))) |x| @intCast(x) else -1;
                try expectInt(w, i);
            }
            return;
        }
        if (eql(fname, "parseWrapperPattern")) {
            const nodes = try core.parsing.wrapper.parseWrapperPatternAlloc(a, str(args[0]));
            var arr: std.json.Array = .init(a);
            for (nodes) |n| try arr.append(switch (n) {
                .text => |s| .{ .string = s },
                .arg => |i| if (i) |k| .{ .integer = k } else .null,
            });
            return expectJson(a, want, .{ .array = arr });
        }
        if (eql(fname, "formatWrapper")) {
            const xs = try a.alloc([]const u8, args[1].array.items.len);
            for (args[1].array.items, xs) |x, *o| o.* = x.string;
            return expectString(want, try core.internals.general.formatWrapper(a, str(args[0]), xs));
        }
        if (eql(fname, "parseNumberPattern")) {
            const p = try core.parsing.number.parseNumberPatternAlloc(a, str(args[0]));
            var arr: std.json.Array = .init(a);
            try arr.append(try patternJson(a, p[0]));
            try arr.append(try patternJson(a, p[1]));
            return expectJson(a, want, .{ .array = arr });
        }
        if (eql(fname, "numberingFormatString")) {
            const handle = try self.data(str(args[0]));
            defer handle.deinit();
            const d = handle.data();
            const params = try core.getNumberParams(d, str(args[1]), null);
            const group = args[3].bool;
            const min_int = int(args[4]);
            const s = if (args[2] == .string)
                try core.numbering.formatString(a, params.system, try D.parse(a, str(args[2])), group, min_int)
            else
                try core.numbering.formatInt(a, params.system, int(args[2]), group, min_int);
            return expectString(want, s);
        }
        if (eql(fname, "fastFormatDecimal")) {
            const digits = core.numbering.digitsOf(str(args[1])).?;
            return expectString(want, try core.numbering.fastFormatDecimal(a, str(args[0]), digits, int(args[2])));
        }
        if (eql(fname, "getNumberParams")) {
            const handle = try self.data(str(args[0]));
            defer handle.deinit();
            const d = handle.data();
            const p = try core.getNumberParams(d, optStr(args[1]), optStr(args[2]));
            const w = want.object;
            try expectString(w.get("numberSystemName").?, p.number_system_name);
            try expectString(w.get("digits").?, try joinDigits(a, p.digits));
            try expectString(w.get("latinDigits").?, try joinDigits(a, p.latin_digits));
            try expectJson(a, w.get("symbols").?, try symbolsJson(a, p.symbols));
            try expectInt(w.get("minimumGroupingDigits").?, p.minimum_grouping_digits);
            try expectInt(w.get("primaryGroupingSize").?, p.primary_grouping_size);
            try expectInt(w.get("secondaryGroupingSize").?, p.secondary_grouping_size);
            try expectJson(a, w.get("currencySpacing").?, try symbolsJson(a, p.currency_spacing));
            try expectString(w.get("system").?, p.system.name);
            return expectString(w.get("latnSystem").?, p.latn_system.name);
        }
        if (eql(fname, "getCurrencyFractions")) {
            const f = N.getCurrencyFractions(str(args[0]));
            const w = want.object;
            try expectInt(w.get("digits").?, f.digits);
            try expectInt(w.get("rounding").?, f.rounding);
            try expectInt(w.get("cashDigits").?, f.cash_digits);
            return expectInt(w.get("cashRounding").?, f.cash_rounding);
        }
        if (eql(fname, "getCurrencyForRegion")) {
            return expectString(want, N.getCurrencyForRegion(str(args[0])));
        }
        if (eql(fname, "contextTransform")) {
            const handle = try self.data(str(args[0]));
            defer handle.deinit();
            const d = handle.data();
            const ctx = if (args[2] == .null) null else try enumArg(core.types.general.ContextType, args[2]);
            return expectString(want, try core.internals.general.contextTransform(a, str(args[1]), d, ctx, optStr(args[3])));
        }
        if (eql(fname, "formatListValue")) {
            const handle = try self.data(str(args[0]));
            defer handle.deinit();
            const d = handle.data();
            const items = try a.alloc([]const Part, args[1].array.items.len);
            for (args[1].array.items, items) |x, *o| {
                const p = try a.alloc(Part, 1);
                p[0] = .{ .type = "item", .value = x.string };
                o.* = p;
            }
            const t = try enumArg(core.types.general.ListPatternType, args[2]);
            const parts = try core.internals.general.formatListValue(a, d, items, t);
            return expectString(want, try core.utils.render.joinParts(a, parts));
        }

        // ----- Numbers -----
        const handle = try self.data(str(args[0]));
        defer handle.deinit();
        const d = handle.data();
        if (eql(fname, "formatDecimal") or eql(fname, "formatDecimalToParts")) {
            const n = try D.parse(a, str(args[1]));
            const o = try options(N.DecimalFormatOptions, args[2]);
            if (eql(fname, "formatDecimal")) return expectResult(want, N.formatDecimal(a, d, n, o), strCheck);
            return expectResult(want, N.formatDecimalToParts(a, d, n, o), partsCheck);
        }
        if (eql(fname, "formatCurrency") or eql(fname, "formatCurrencyToParts")) {
            const n = try D.parse(a, str(args[1]));
            const o = try options(N.CurrencyFormatOptions, args[3]);
            if (eql(fname, "formatCurrency")) return expectResult(want, N.formatCurrency(a, d, n, str(args[2]), o), strCheck);
            return expectResult(want, N.formatCurrencyToParts(a, d, n, str(args[2]), o), partsCheck);
        }
        if (eql(fname, "getCurrencySymbol")) {
            const w: core.number_options.CurrencySymbolWidth = if (args[2] == .null) .default else try enumArg(core.number_options.CurrencySymbolWidth, args[2]);
            return expectString(want, N.getCurrencySymbol(d, str(args[1]), w));
        }
        if (eql(fname, "getCurrencyDisplayName")) {
            return expectString(want, try N.getCurrencyDisplayName(a, d, str(args[1]), try options(N.CurrencyDisplayNameOptions, args[2])));
        }
        if (eql(fname, "getCurrencyPluralName")) {
            const n = try D.parse(a, str(args[1]));
            return expectString(want, try N.getCurrencyPluralName(a, d, n, str(args[2]), try options(N.CurrencyDisplayNameOptions, args[3])));
        }
        if (eql(fname, "getPluralCardinal") or eql(fname, "getPluralOrdinal")) {
            const n = try D.parse(a, str(args[1]));
            const o: ?N.DecimalAdjustOptions = if (args[2] == .null) null else try options(N.DecimalAdjustOptions, args[2]);
            const r = if (eql(fname, "getPluralCardinal")) try N.getPluralCardinal(a, d, n, o) else try N.getPluralOrdinal(a, d, n, o);
            return expectString(want, r);
        }
        if (eql(fname, "adjustDecimal")) {
            const n = try D.parse(a, str(args[1]));
            const r = try N.adjustDecimal(a, d, n, try options(N.DecimalAdjustOptions, args[2]));
            return expectString(want, try D.toString(a, r));
        }
        return fail("unknown function {s}", .{fname});
    }
};

test "conformance cases" {
    const gpa = std.testing.allocator;
    var fw = core.Framework.init(gpa, .{ .loader = .{ .load = loadPack } });
    defer fw.deinit();
    const runner: Runner = .{ .fw = &fw };

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
        runner.run(arena.allocator(), fname, args, o.get("result").?) catch |err| {
            if (err == error.Skip) {
                skipped += 1;
                continue;
            }
            failures += 1;
            if (failures <= 25) {
                const a = try std.json.Stringify.valueAlloc(arena.allocator(), o.get("args").?, .{});
                std.debug.print("case {d} {s}({s}): {s}\n", .{ i, fname, a, @errorName(err) });
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
    const N = core.numbers;
    for ([_][]const u8{ "en", "ar-EG", "de-CH", "en", "hi-u-nu-deva" }) |id| {
        const d_handle = try fw.loadLocale(.{ .id = id });

        defer d_handle.deinit();

        const d = d_handle.data();
        const n = try D.parse(gpa, "-1234567.891");
        defer n.deinit(gpa);
        inline for (.{ .decimal, .short, .long, .scientific, .percent, .permille_scaled }) |style| {
            const s = try N.formatDecimal(gpa, d, n, .{ .style = style });
            gpa.free(s);
            const p = try N.formatDecimalToParts(gpa, d, n, .{ .style = style, .nu = "native" });
            D.freeParts(gpa, p);
        }
        inline for (.{ .symbol, .accounting, .code, .name, .short }) |style| {
            const s = try N.formatCurrency(gpa, d, n, "EUR", .{ .style = style, .cash = true });
            gpa.free(s);
            const p = try N.formatCurrencyToParts(gpa, d, n, "CHF", .{ .style = style });
            D.freeParts(gpa, p);
        }
        try std.testing.expectError(error.InvalidNaN, N.formatCurrency(gpa, d, D.NAN, "USD", .{}));
        const adj = try N.adjustDecimal(gpa, d, n, .{ .maximum_significant_digits = 3 });
        adj.deinit(gpa);
        gpa.free(try N.getCurrencyDisplayName(gpa, d, "USD", .{}));
        gpa.free(try N.getCurrencyPluralName(gpa, d, n, "USD", .{}));
        _ = try N.getPluralCardinal(gpa, d, n, .{ .maximum_fraction_digits = 0 });
        _ = try N.getPluralOrdinal(gpa, d, n, null);
        gpa.free(try fw.info(gpa));
    }

    // A pack and a bundle without the framework.
    const pack = try core.loadPack(gpa, packs.get("sr").?);
    defer pack.deinit();
    const l = try core.resolveLocale(gpa, "sr-Latn-BA");
    const b = try core.Pack.get(pack, gpa, l.tag);
    var ld = try LocaleData.initDefault(gpa, l, b);
    defer ld.deinit();
    const s = try N.formatCurrency(gpa, &ld, D.ONE, "BAM", .{ .style = .name });
    defer gpa.free(s);
    try std.testing.expect(std.mem.startsWith(u8, s, "1,00 "));
    try std.testing.expectError(error.InvalidPack, core.loadPack(gpa, "{}"));
    try std.testing.expectError(error.InvalidPack, core.loadPack(gpa, "not json"));
}

fn snakeToCamel(a: Allocator, name: []const u8) Allocator.Error![]const u8 {
    var count: usize = 0;
    for (name) |c| if (c != '_') {
        count += 1;
    };
    const out = try a.alloc(u8, count);
    var n: usize = 0;
    var upper = false;
    for (name) |c| {
        if (c == '_') {
            upper = true;
            continue;
        }
        out[n] = if (upper) std.ascii.toUpper(c) else c;
        upper = false;
        n += 1;
    }
    return out;
}
