//! Runs the shared cases in `conformance/locale-matcher.json` against the Zig port.
//!
//! A list of locales is a string, or an array of strings, `{ "tag": [...] }` (the arguments
//! of `languageTag`) and `{ "locale": [id, [...]] }`. Result tags are `[compact, expanded]`.

const std = @import("std");
const h = @import("hereabouts");
const cases = @import("cases");

test {
    std.testing.refAllDecls(h.locale_matcher);
}

const L = h.language_tag;
const M = h.locale_matcher;
const LanguageTag = L.LanguageTag;
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

fn expectJson(a: Allocator, want: Value, got: anytype) !void {
    const w = try std.json.Stringify.valueAlloc(a, want, .{});
    const g = try std.json.Stringify.valueAlloc(a, got, .{});
    if (!eql(w, g)) return fail("want {s}\n     got {s}", .{ w, g });
}

// ---------------------------------------------------------------------------
// Arguments (same as test/language_tag.zig)
// ---------------------------------------------------------------------------

fn optStr(v: Value) ?[]const u8 {
    return if (v == .string) v.string else null;
}

fn arg(args: []const Value, i: usize) Value {
    return if (i < args.len) args[i] else .null;
}

/// Arguments of `languageTag`: subtags (null is undefined), extensions, private use, extlangs.
fn fieldsFromArgs(a: Allocator, args: []const Value) !L.Fields {
    var f: L.Fields = .{
        .language = optStr(arg(args, 0)),
        .script = optStr(arg(args, 1)),
        .region = optStr(arg(args, 2)),
        .variant = optStr(arg(args, 3)),
        .private_use = optStr(arg(args, 5)) orelse "",
    };
    if (arg(args, 4) == .object) {
        const o = arg(args, 4).object;
        const exts = try a.alloc(L.Extension, o.count());
        var it = o.iterator();
        var i: usize = 0;
        while (it.next()) |kv| : (i += 1) {
            exts[i] = .{ .key = kv.key_ptr.*, .subtags = try strings(a, kv.value_ptr.*) };
        }
        f.extensions = exts;
    }
    if (arg(args, 6) == .array) f.extlangs = try strings(a, arg(args, 6));
    return f;
}

fn strings(a: Allocator, v: Value) ![]const []const u8 {
    const items = v.array.items;
    const out = try a.alloc([]const u8, items.len);
    for (items, out) |x, *o| o.* = x.string;
    return out;
}

fn short(a: Allocator, t: LanguageTag) ![2][]const u8 {
    return .{ try t.compact(a), try t.expanded(a) };
}

fn tagArg(a: Allocator, v: Value) !LanguageTag {
    return L.LanguageTag.init(a, try fieldsFromArgs(a, v.array.items));
}

fn locales(a: Allocator, v: Value) ![]const M.Input {
    if (v == .string) {
        const out = try a.alloc(M.Input, 1);
        out[0] = .{ .string = v.string };
        return out;
    }
    const items = v.array.items;
    const out = try a.alloc(M.Input, items.len);
    for (items, out) |x, *o| {
        if (x == .string) {
            o.* = .{ .string = x.string };
        } else if (x.object.get("tag")) |t| {
            o.* = .{ .tag = try tagArg(a, t) };
        } else {
            const l = x.object.get("locale").?.array.items;
            o.* = .{ .locale = .{ .id = l[0].string, .tag = try tagArg(a, l[1]) } };
        }
    }
    return out;
}

fn options(v: Value) M.Options {
    return if (v == .bool) .{ .resolve = v.bool } else .{};
}

fn threshold(v: Value) i32 {
    return if (v == .integer) @intCast(v.integer) else M.DEFAULT_THRESHOLD;
}

fn desired(a: Allocator, v: Value) ![]const []const u8 {
    if (v == .string) {
        const out = try a.alloc([]const u8, 1);
        out[0] = v.string;
        return out;
    }
    return strings(a, v);
}

const EntryJson = struct { []const u8, []const u8, []const u8 };

// ---------------------------------------------------------------------------
// Running a case
// ---------------------------------------------------------------------------

/// Run one case. Everything is allocated in the arena `a`.
fn run(a: Allocator, fname: []const u8, args: []const Value, want: Value) !void {
    if (eql(fname, "getDistance")) {
        const resolve = args[3].bool;
        const d = if (resolve) try h.locale.resolveLanguageTag(a, .{ .id = args[0].string }) else try L.parseLanguageTag(a, args[0].string);
        const s = if (resolve) try h.locale.resolveLanguageTag(a, .{ .id = args[1].string }) else try L.parseLanguageTag(a, args[1].string);
        return expectJson(a, want, M.getDistance(d, s, threshold(args[2])));
    }
    if (eql(fname, "getRegionPartition")) return expectJson(a, want, M.getRegionPartition(args[0].string));
    if (eql(fname, "parse")) {
        const entries = try M.parse(a, try locales(a, args[0]), .{});
        const got = try a.alloc(struct { []const u8, []const u8, []const u8, []const u8 }, entries.len);
        for (entries, got) |e, *g| {
            const s = try short(a, e.tag);
            g.* = .{ e.id, e.compact, s[0], s[1] };
        }
        return expectJson(a, want, got);
    }
    if (eql(fname, "createLocaleMatcher")) {
        const m = M.Matcher.init(a, try locales(a, args[0]), options(args[1])) catch |err| {
            if (err == error.NoSupportedLocales and want.object.get("error") != null) return;
            return err;
        };
        if (want.object.get("error")) |e| return fail("want error {s}", .{e.string});
        const got = try a.alloc(EntryJson, m.supported.len);
        for (m.supported, got) |e, *g| {
            const s = try short(a, e.tag);
            g.* = .{ e.id, s[0], s[1] };
        }
        try expectJson(a, want.object.get("supported").?, got);
        return expectJson(a, want.object.get("default").?, m.default_entry.id);
    }
    if (eql(fname, "matchLocale")) {
        const m = try M.Matcher.init(a, try locales(a, args[0]), options(args[1]));
        const r = try M.Matcher.matchLocale(m, a, try desired(a, args[2]), threshold(args[3]));
        return expectJson(a, want, .{ .id = r.locale.id, .tag = try short(a, r.locale.tag), .distance = r.distance });
    }
    return fail("unknown function {s}", .{fname});
}

test "locale-matcher conformance" {
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
    const tag = try L.parseLanguageTag(gpa, "en-Latn-GB");
    defer tag.deinit(gpa);
    const loc = try h.locale.resolveLocaleId(gpa, "pt_AR");
    defer loc.deinit(gpa);
    const m = try M.Matcher.init(gpa, &.{ .{ .string = "en, zh, es-419" }, .{ .tag = tag }, .{ .locale = loc } }, .{});
    defer m.deinit(gpa);
    for ([_][]const []const u8{ &.{"en-AU-u-ca-persian"}, &.{ "xx", "pt" }, &.{}, &.{"zh"} }) |d| {
        const r = try M.Matcher.matchLocale(m, gpa, d, M.DEFAULT_THRESHOLD);
        r.deinit(gpa);
    }
    try std.testing.expectError(error.NoSupportedLocales, M.Matcher.init(gpa, &.{}, .{}));
}
