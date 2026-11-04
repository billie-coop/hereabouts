//! Runs the shared cases in `conformance/messageformat.json` against the Zig port.
//!
//! Each case names a TypeScript function (or a scenario: a formatter or translator and a list
//! of calls), its arguments and the TypeScript result. Arguments are JSON with a few
//! encodings: `{"$decimal": "1.5"}`, `{"$number": "NaN"}`, `{"$object": ...}`. Custom
//! formatters are named and implemented here as in the generator: `upper`, `list`, and any
//! other name returning itself. Matcher positions are UTF-16 offsets, converted here.

const std = @import("std");
const h = @import("hereabouts");
const cases = @import("cases");

test {
    std.testing.refAllDecls(h.messageformat);
}

const M = h.messageformat;
const D = h.decimal;
const P = h.plurals;
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
// Reading arguments
// ---------------------------------------------------------------------------

fn num(v: Value) f64 {
    return switch (v) {
        .integer => |i| @floatFromInt(i),
        .float => |f| f,
        .number_string => |s| std.fmt.parseFloat(f64, s) catch unreachable,
        else => unreachable,
    };
}

fn field(v: Value, name: []const u8) ?Value {
    const x = v.object.get(name) orelse return null;
    return if (x == .null) null else x;
}

fn messageArg(a: Allocator, v: Value) !M.MessageArg {
    return switch (v) {
        .null => .null,
        .bool => |b| .{ .boolean = b },
        .integer, .float, .number_string => .{ .number = num(v) },
        .string => |s| .{ .string = s },
        .object => |o| {
            if (o.get("$decimal")) |d| return .{ .decimal = try D.parse(a, d.string) };
            if (o.get("$number")) |n| {
                const s = n.string;
                return .{ .number = if (eql(s, "NaN")) std.math.nan(f64) else if (eql(s, "Infinity")) std.math.inf(f64) else -std.math.inf(f64) };
            }
            return .{ .object = .{ .type_name = "object" } };
        },
        .array => .{ .object = .{ .type_name = "object" } },
    };
}

fn positionalArgs(a: Allocator, v: Value) ![]M.MessageArg {
    const items = v.array.items;
    const out = try a.alloc(M.MessageArg, items.len);
    for (items, out) |x, *o| o.* = try messageArg(a, x);
    return out;
}

fn namedArgs(a: Allocator, v: Value) ![]M.NamedArg {
    var out: std.ArrayList(M.NamedArg) = .empty;
    var it = v.object.iterator();
    while (it.next()) |e| try out.append(a, .{ .name = e.key_ptr.*, .value = try messageArg(a, e.value_ptr.*) });
    return out.items;
}

fn strings(a: Allocator, v: Value) ![]const []const u8 {
    const items = v.array.items;
    const out = try a.alloc([]const u8, items.len);
    for (items, out) |x, *o| o.* = x.string;
    return out;
}

fn apostropheMode(v: ?Value) ?M.ApostropheMode {
    const x = v orelse return null;
    if (x == .null) return null;
    return M.ApostropheMode.fromString(x.string).?;
}

// ---------------------------------------------------------------------------
// The custom formatters
// ---------------------------------------------------------------------------

fn upper(_: ?*const anyopaque, a: Allocator, args: []const ?M.MessageArg, _: []const []const u8) M.Error![]const u8 {
    const s = try M.default_converter.asString(a, if (args.len > 0) args[0] else null);
    const out = try a.dupe(u8, s);
    for (out) |*c| {
        if (c.* >= 'a' and c.* <= 'z') c.* -= 32;
    }
    return out;
}

fn kind(a: Allocator, arg: ?M.MessageArg) ![]const u8 {
    const v = arg orelse return "undefined";
    return switch (v) {
        .null => "null",
        .decimal => |d| try std.fmt.allocPrint(a, "decimal:{s}", .{try D.toString(a, d)}),
        .object => |o| o.type_name,
        .string => |s| try std.fmt.allocPrint(a, "string:{s}", .{s}),
        .number => |n| try std.fmt.allocPrint(a, "number:{s}", .{try M.numberToString(a, n)}),
        .boolean => |b| if (b) "boolean:true" else "boolean:false",
    };
}

fn list(_: ?*const anyopaque, a: Allocator, args: []const ?M.MessageArg, options: []const []const u8) M.Error![]const u8 {
    var out: std.ArrayList(u8) = .empty;
    try out.print(a, "{d}[", .{args.len});
    for (args, 0..) |x, i| {
        if (i > 0) try out.append(a, ',');
        try out.appendSlice(a, try kind(a, x));
    }
    try out.appendSlice(a, "](");
    for (options, 0..) |o, i| {
        if (i > 0) try out.append(a, ',');
        try out.appendSlice(a, o);
    }
    try out.append(a, ')');
    return out.items;
}

fn ownName(ctx: ?*const anyopaque, _: Allocator, _: []const ?M.MessageArg, _: []const []const u8) M.Error![]const u8 {
    const name: *const []const u8 = @ptrCast(@alignCast(ctx.?));
    return name.*;
}

fn formatters(a: Allocator, names: []const []const u8) ![]M.Formatter {
    const out = try a.alloc(M.Formatter, names.len);
    for (names, out) |n, *f| {
        if (eql(n, "upper")) {
            f.* = .{ .name = n, .func = upper };
        } else if (eql(n, "list")) {
            f.* = .{ .name = n, .func = list };
        } else {
            const p = try a.create([]const u8);
            p.* = n;
            f.* = .{ .name = n, .ctx = @ptrCast(p), .func = ownName };
        }
    }
    return out;
}

// ---------------------------------------------------------------------------
// Message code as JSON
// ---------------------------------------------------------------------------

fn argument(v: Value) M.Argument {
    return if (v == .string) .{ .name = v.string } else .{ .number = num(v) };
}

fn arguments(a: Allocator, v: Value) ![]M.Argument {
    const items = v.array.items;
    const out = try a.alloc(M.Argument, items.len);
    for (items, out) |x, *o| o.* = argument(x);
    return out;
}

fn codeFromJson(a: Allocator, v: Value) !M.MessageCode {
    const x = v.array.items;
    switch (@as(M.MessageOpType, @enumFromInt(x[0].integer))) {
        .text => return .{ .text = x[1].string },
        .arg => return .{ .arg = argument(x[1]) },
        .plural => {
            const cs = x[4].array.items;
            const choices = try a.alloc(M.PluralChoice, cs.len);
            for (cs, choices) |c, *o| {
                const y = c.array.items;
                o.* = .{ .type = @enumFromInt(y[0].integer), .value = y[1].string, .code = try codeFromJson(a, y[2]) };
            }
            return .{ .plural = .{ .args = try arguments(a, x[1]), .offset = num(x[2]), .type = @enumFromInt(x[3].integer), .choices = choices } };
        },
        .select => {
            const cs = x[2].array.items;
            const choices = try a.alloc(M.SelectChoice, cs.len);
            for (cs, choices) |c, *o| {
                const y = c.array.items;
                o.* = .{ .value = y[0].string, .code = try codeFromJson(a, y[1]) };
            }
            return .{ .select = .{ .args = try arguments(a, x[1]), .choices = choices } };
        },
        .block => {
            const items = x[1].array.items;
            const out = try a.alloc(M.MessageCode, items.len);
            for (items, out) |c, *o| o.* = try codeFromJson(a, c);
            return .{ .block = out };
        },
        .noop => return .noop,
        .simple => return .{ .simple = .{ .name = x[1].string, .args = try arguments(a, x[2]), .options = try strings(a, x[3]) } },
        .argsub => return .argsub,
    }
}

fn expectArgument(want: Value, got: M.Argument) !void {
    const w = argument(want);
    if (!w.eql(got)) {
        return switch (got) {
            .name => |n| fail("argument: want {f}, got name \"{s}\"", .{ std.json.fmt(want, .{}), n }),
            .number => |n| fail("argument: want {f}, got number {d}", .{ std.json.fmt(want, .{}), n }),
        };
    }
}

fn expectArguments(want: Value, got: []const M.Argument) !void {
    const items = want.array.items;
    if (items.len != got.len) return fail("arguments: want {d}, got {d}", .{ items.len, got.len });
    for (items, got) |w, g| try expectArgument(w, g);
}

fn expectStr(want: Value, got: []const u8) !void {
    if (want != .string or !eql(want.string, got)) return fail("want {f}, got \"{s}\"", .{ std.json.fmt(want, .{}), got });
}

fn expectCode(want: Value, got: M.MessageCode) !void {
    const x = want.array.items;
    const op: M.MessageOpType = @enumFromInt(x[0].integer);
    if (op != std.meta.activeTag(got)) return fail("code: want op {s}, got {s}", .{ @tagName(op), @tagName(std.meta.activeTag(got)) });
    switch (got) {
        .text => |s| try expectStr(x[1], s),
        .arg => |g| try expectArgument(x[1], g),
        .plural => |p| {
            try expectArguments(x[1], p.args);
            if (num(x[2]) != p.offset) return fail("offset: want {d}, got {d}", .{ num(x[2]), p.offset });
            if (x[3].integer != @intFromEnum(p.type)) return fail("plural type differs", .{});
            const cs = x[4].array.items;
            if (cs.len != p.choices.len) return fail("plural choices: want {d}, got {d}", .{ cs.len, p.choices.len });
            for (cs, p.choices) |c, g| {
                const y = c.array.items;
                if (y[0].integer != @intFromEnum(g.type)) return fail("choice type differs", .{});
                try expectStr(y[1], g.value);
                try expectCode(y[2], g.code);
            }
        },
        .select => |s| {
            try expectArguments(x[1], s.args);
            const cs = x[2].array.items;
            if (cs.len != s.choices.len) return fail("select choices: want {d}, got {d}", .{ cs.len, s.choices.len });
            for (cs, s.choices) |c, g| {
                const y = c.array.items;
                try expectStr(y[0], g.value);
                try expectCode(y[1], g.code);
            }
        },
        .block => |b| {
            const items = x[1].array.items;
            if (items.len != b.len) return fail("block: want {d}, got {d}", .{ items.len, b.len });
            for (items, b) |w, g| try expectCode(w, g);
        },
        .simple => |s| {
            try expectStr(x[1], s.name);
            try expectArguments(x[2], s.args);
            const opts = x[3].array.items;
            if (opts.len != s.options.len) return fail("options: want {d}, got {d}", .{ opts.len, s.options.len });
            for (opts, s.options) |w, g| try expectStr(w, g);
        },
        .noop, .argsub => {},
    }
}

fn expectDecimal(want: Value, got: D.Decimal) !void {
    const o = want.object;
    const data = o.get("data").?.array.items;
    var same = data.len == got.data.len and o.get("sign").?.integer == got.sign and
        o.get("exp").?.integer == got.exp and o.get("flag").?.integer == @intFromEnum(got.flag);
    if (same) {
        for (data, got.data) |x, y| {
            if (x.integer != y) same = false;
        }
    }
    if (!same) return fail("decimal: want {f}, got data={any} sign={d} exp={d}", .{ std.json.fmt(want, .{}), got.data, got.sign, got.exp });
}

fn expectBool(want: Value, got: bool) !void {
    if (want != .bool or want.bool != got) return fail("want {f}, got {}", .{ std.json.fmt(want, .{}), got });
}

fn expectInt(want: Value, got: usize) !void {
    if (want != .integer or want.integer != got) return fail("want {f}, got {d}", .{ std.json.fmt(want, .{}), got });
}

// ---------------------------------------------------------------------------
// UTF-16 positions
// ---------------------------------------------------------------------------

/// Byte offset of UTF-16 offset `i` in `s`; past the end, the distance is kept.
fn jsToByte(s: []const u8, i: usize) usize {
    var units: usize = 0;
    var b: usize = 0;
    while (b < s.len and units < i) {
        const n = std.unicode.utf8ByteSequenceLength(s[b]) catch 1;
        units += if (n == 4) 2 else 1;
        b += n;
    }
    return if (units < i) b + (i - units) else b;
}

fn byteToJs(s: []const u8, i: usize) usize {
    var units: usize = 0;
    var b: usize = 0;
    while (b < s.len and b < i) {
        const n = std.unicode.utf8ByteSequenceLength(s[b]) catch 1;
        units += if (n == 4) 2 else 1;
        b += n;
    }
    return if (b < i) units + (i - b) else units;
}

// ---------------------------------------------------------------------------
// Running a case
// ---------------------------------------------------------------------------

fn runMatcher(a: Allocator, args: []const Value, want: Value) !void {
    const m = try M.buildMessageMatcher(a, try strings(a, args[0]), args[1].bool);
    const text = args[2].string;
    const e = args[4].integer;
    var r: M.MessageState = .{
        .t = text,
        .s = jsToByte(text, @intCast(args[3].integer)),
        .e = if (e == -1) text.len else jsToByte(text, @intCast(e)),
    };
    const results = want.object.get("results").?.array.items;
    for (args[5].array.items, results) |op_v, w| {
        const op = op_v.string;
        if (eql(op, "char")) {
            const c = m.char(&r);
            if (c) |cp| {
                var buf: [4]u8 = undefined;
                const n = std.unicode.utf8Encode(cp, &buf) catch unreachable;
                try expectStr(w, buf[0..n]);
            } else if (w != .null) return fail("char: want {f}, got null", .{std.json.fmt(w, .{})});
        } else if (eql(op, "complete")) {
            try expectBool(w, m.complete(&r));
        } else if (eql(op, "spaces")) {
            try expectBool(w, m.spaces(&r));
        } else if (eql(op, "arguments")) {
            const got = try m.arguments(a, &r);
            if (got) |g| {
                if (w == .null) return fail("arguments: want null", .{});
                try expectArguments(w, g);
            } else if (w != .null) return fail("arguments: want {f}, got null", .{std.json.fmt(w, .{})});
        } else if (eql(op, "options")) {
            const got = try m.options(a, &r);
            const items = w.array.items;
            if (items.len != got.len) return fail("options: want {d}, got {d}", .{ items.len, got.len });
            for (items, got) |x, g| try expectStr(x, g);
        } else if (eql(op, "pluralOffset")) {
            const got = m.pluralOffset(&r);
            if (num(w) != got) return fail("offset: want {d}, got {d}", .{ num(w), got });
        } else {
            const got = if (eql(op, "identifier")) m.identifier(&r) else if (eql(op, "formatter")) m.formatter(&r) else m.pluralChoice(&r);
            if (got) |g| try expectStr(w, g) else if (w != .null) return fail("{s}: want {f}, got null", .{ op, std.json.fmt(w, .{}) });
        }
    }
    const s = byteToJs(text, r.s);
    if (want.object.get("s").?.integer != s) return fail("final s: want {d}, got {d}", .{ want.object.get("s").?.integer, s });
}

fn runFormatter(a: Allocator, args: []const Value, want: Value) !void {
    const spec = args[0];
    var cache_size: ?usize = null;
    if (field(spec, "cacheSize")) |c| {
        if (c.integer > 0) cache_size = @intCast(c.integer); // TS zero selects the default.
    }
    var f = try M.createMessageFormatter(a, .{
        .language = if (field(spec, "language")) |l| l.string else null,
        .region = if (field(spec, "region")) |r| r.string else null,
        .formatters = if (field(spec, "formatters")) |n| try formatters(a, try strings(a, n)) else &.{},
        .cache_size = cache_size,
        .disable_escapes = if (field(spec, "disableEscapes")) |d| d.bool else false,
        .apostrophe_mode = apostropheMode(field(spec, "apostropheMode")),
    });
    const results = want.object.get("results").?.array.items;
    for (args[1].array.items, results) |call, w| {
        const c = call.array.items;
        const got = try M.formatMessage(a, &f, c[0].string, try positionalArgs(a, c[1]), try namedArgs(a, c[2]));
        expectStr(w, got) catch |err| {
            std.debug.print("    message: \"{s}\" args {f} {f}\n", .{ c[0].string, std.json.fmt(c[1], .{}), std.json.fmt(c[2], .{}) });
            return err;
        };
    }
    try expectStr(want.object.get("toString").?, try M.messageFormatterToString(a, &f));
}

fn pairs(a: Allocator, v: Value) ![]M.Message {
    const items = v.array.items;
    const out = try a.alloc(M.Message, items.len);
    for (items, out) |p, *o| o.* = .{ .key = p.array.items[0].string, .message = p.array.items[1].string };
    return out;
}

fn runTranslator(a: Allocator, args: []const Value, want: Value) !void {
    const spec = args[0];
    var catalogs: []M.Catalog = &.{};
    if (field(spec, "catalogs")) |cs| {
        catalogs = try a.alloc(M.Catalog, cs.array.items.len);
        for (cs.array.items, catalogs) |c, *o| {
            const y = c.array.items;
            o.* = .{ .id = y[0].string, .messages = if (y[1] == .null) null else try pairs(a, y[1]) };
        }
    }
    var t = try M.createTranslator(a, .{
        .source = try pairs(a, field(spec, "source").?),
        .source_language = if (field(spec, "sourceLanguage")) |l| l.string else null,
        .catalogs = catalogs,
        .formatters = if (field(spec, "formatters")) |n| try formatters(a, try strings(a, n)) else &.{},
        .apostrophe_mode = apostropheMode(field(spec, "apostropheMode")),
    });
    for (args[1].array.items, want.array.items) |op_v, w| {
        const op = op_v.array.items;
        const name = op[0].string;
        if (eql(name, "translate")) {
            try expectStr(w, try M.translate(a, &t, op[1].string, op[2].string, try namedArgs(a, op[3])));
        } else if (eql(name, "resolveMessage")) {
            const r = M.resolveMessage(&t, op[1].string, op[2].string);
            try expectStr(w.array.items[0], r.message);
            try expectStr(w.array.items[1], r.language);
        } else if (eql(name, "isMessageKey")) {
            try expectBool(w, M.isMessageKey(&t, op[1].string));
        } else if (eql(name, "checkCatalogs")) {
            const issues = try M.checkCatalogs(a, &t, .{ .complete = op[1].bool });
            const items = w.array.items;
            if (items.len != issues.len) {
                for (issues) |i| std.debug.print("    got: {s} {s} {s} {s}\n", .{ i.language, i.problem.name(), i.key, i.detail });
                return fail("issues: want {d}, got {d}", .{ items.len, issues.len });
            }
            for (items, issues) |x, i| {
                try expectStr(x.object.get("language").?, i.language);
                try expectStr(x.object.get("key").?, i.key);
                try expectStr(x.object.get("problem").?, i.problem.name());
                try expectStr(x.object.get("detail").?, i.detail);
            }
        } else {
            try expectInt(w.array.items[0], t.parsed.size());
            try expectInt(w.array.items[1], t.plurals.size());
        }
    }
}

/// Run one case. Everything is allocated in the arena `a`.
fn run(a: Allocator, fname: []const u8, args: []const Value, want: Value) !void {
    if (eql(fname, "matcher")) return runMatcher(a, args, want);
    if (eql(fname, "parseMessagePattern")) {
        const m = try M.buildMessageMatcher(a, try strings(a, args[1]), args[2].bool);
        const code = try M.parseMessagePattern(a, args[0].string, m, args[3].bool, apostropheMode(args[4]));
        return expectCode(want, code);
    }
    if (eql(fname, "asString")) {
        return expectStr(want, try M.default_converter.asString(a, try messageArg(a, args[0])));
    }
    if (eql(fname, "asDecimal")) {
        return expectDecimal(want, try M.default_converter.asDecimal(a, try messageArg(a, args[0])));
    }
    if (eql(fname, "evaluateMessage")) {
        const fs = try formatters(a, &.{ "upper", "list", "quux", "quuxbar", "quuxbaz", "datetime-interval" });
        const got = try M.evaluateMessage(a, P.getPluralRules(args[0].string, null), M.default_converter, fs, try codeFromJson(a, args[1]), try positionalArgs(a, args[2]), try namedArgs(a, args[3]));
        return expectStr(want, got);
    }
    if (eql(fname, "formatMessage")) return runFormatter(a, args, want);
    if (eql(fname, "translator")) return runTranslator(a, args, want);
    if (eql(fname, "messageArgNames")) {
        const o = args[1];
        const got = try M.messageArgNames(a, args[0].string, .{
            .formatters = if (field(o, "formatters")) |n| try strings(a, n) else &.{},
            .apostrophe_mode = apostropheMode(field(o, "apostropheMode")),
        });
        const items = want.array.items;
        if (items.len != got.len) return fail("names: want {d}, got {d}", .{ items.len, got.len });
        for (items, got) |w, g| try expectStr(w, g);
        return;
    }
    return fail("unknown function {s}", .{fname});
}

test "messageformat conformance" {
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
                var buf: [1024]u8 = undefined;
                const line = std.fmt.bufPrint(&buf, "{f}", .{std.json.fmt(c, .{})}) catch buf[0..];
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
    const fs = [_]M.Formatter{ .{ .name = "upper", .func = upper }, .{ .name = "list", .func = list } };

    var f = try M.createMessageFormatter(gpa, .{ .language = "en", .formatters = &fs, .cache_size = 2 });
    defer f.deinit();
    const msgs = [_][]const u8{
        "{0, plural, offset:1 =0 {none} one {# item} other {# items}} {name upper} {0;name list a}",
        "{g, select, a {{x}} other {'{'#'}'}}",
        "{0 plural one",
        "{0}",
        "{0, plural, offset:1 =0 {none} one {# item} other {# items}} {name upper} {0;name list a}",
    };
    for (msgs) |m| {
        const s = try M.formatMessage(gpa, &f, m, &.{.{ .number = 3 }}, &.{
            .{ .name = "name", .value = .{ .string = "ada" } },
            .{ .name = "g", .value = .{ .decimal = D.ONE } },
        });
        gpa.free(s);
    }
    const ts = try M.messageFormatterToString(gpa, &f);
    defer gpa.free(ts);
    try std.testing.expectEqualStrings("MessageFormatter(formatters=[\"upper\",\"list\"] cached=2)", ts);

    const m = try M.buildMessageMatcher(gpa, &.{ "upper", "list" }, true);
    defer m.deinit(gpa);
    const code = try M.parseMessagePattern(gpa, msgs[0], m, false, .double_optional);
    defer code.deinit(gpa);
    const copy = try M.cloneMessageCode(gpa, code);
    copy.deinit(gpa);
    const s = try M.evaluateMessage(gpa, P.getPluralRules("fr", null), M.default_converter, &fs, code, &.{.{ .number = 1.5 }}, &.{});
    defer gpa.free(s);
    try std.testing.expectEqualStrings("0.5 item  2[number:1.5,undefined](a)", s);

    const en = [_]M.Message{
        .{ .key = "a", .message = "{n, plural, one {# x} other {# xs}} {who}" },
        .{ .key = "b", .message = "plain" },
        .{ .key = "c", .message = "{x" },
    };
    const de = [_]M.Message{ .{ .key = "a", .message = "{n, plural, one {# y}} {wer}" }, .{ .key = "z", .message = "z" } };
    var t = try M.createTranslator(gpa, .{ .source = &en, .catalogs = &.{.{ .id = "de", .messages = &de }} });
    defer t.deinit();
    const out = try M.translate(gpa, &t, "de-AT", "a", &.{.{ .name = "n", .value = .{ .number = 1 } }});
    defer gpa.free(out);
    try std.testing.expectEqualStrings("1 y {wer}", out);
    const plain = try M.translate(gpa, &t, "de", "b", &.{});
    defer gpa.free(plain);
    const issues = try M.checkCatalogs(gpa, &t, .{});
    defer M.freeCatalogIssues(gpa, issues);
    try std.testing.expectEqual(@as(usize, 6), issues.len);
    const names = try M.messageArgNames(gpa, en[0].message, .{});
    defer M.freeStrings(gpa, names);
    try std.testing.expectEqual(@as(usize, 2), names.len);

    const T = M.Typed(&en);
    const typed = try T.translate(gpa, &t, "en", "a", .{ .n = 2, .who = "me" });
    defer gpa.free(typed);
    try std.testing.expectEqualStrings("2 xs me", typed);
}

test {
    _ = @import("release_regressions.zig");
}
