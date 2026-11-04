//! Runs the shared cases in `conformance/language-tag.json` against the Zig port.
//!
//! Tags are compared as JSON: each case records the TypeScript tag as a plain object (see
//! `describeTag` in the generator), and the Zig tag is written in the same shape.

const std = @import("std");
const h = @import("hereabouts");
const cases = @import("cases");

test {
    std.testing.refAllDecls(h.language_tag);
}

const L = h.language_tag;
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

// ---------------------------------------------------------------------------
// Tags as JSON
// ---------------------------------------------------------------------------

const ExtPair = struct { []const u8, []const []const u8 };

const Desc = struct {
    language: ?[]const u8,
    script: ?[]const u8,
    region: ?[]const u8,
    variant: ?[]const u8,
    extensions: []const ExtPair,
    privateUse: []const u8,
    extlangs: []const []const u8,
    compact: []const u8,
    expanded: []const u8,
};

const DescFull = struct {
    language: ?[]const u8,
    script: ?[]const u8,
    region: ?[]const u8,
    variant: ?[]const u8,
    extensions: []const ExtPair,
    privateUse: []const u8,
    extlangs: []const []const u8,
    compact: []const u8,
    expanded: []const u8,
    get: [4][]const u8,
    has: [3]bool,
};

fn pairLess(_: void, a: ExtPair, b: ExtPair) bool {
    return L.utf16Order(a[0], b[0]) == .lt;
}

fn describe(a: Allocator, t: LanguageTag) !Desc {
    const pairs = try a.alloc(ExtPair, t.extensions.len);
    for (t.extensions, pairs) |e, *p| p.* = .{ e.key, e.subtags };
    std.sort.block(ExtPair, pairs, {}, pairLess);
    return .{
        .language = t.language,
        .script = t.script,
        .region = t.region,
        .variant = t.variant,
        .extensions = pairs,
        .privateUse = t.private_use,
        .extlangs = t.extlangs,
        .compact = try t.compact(a),
        .expanded = try t.expanded(a),
    };
}

fn describeFull(a: Allocator, t: LanguageTag) !DescFull {
    const d = try describe(a, t);
    return .{
        .language = d.language,
        .script = d.script,
        .region = d.region,
        .variant = d.variant,
        .extensions = d.extensions,
        .privateUse = d.privateUse,
        .extlangs = d.extlangs,
        .compact = d.compact,
        .expanded = d.expanded,
        .get = .{ t.tagLanguage(), t.tagScript(), t.tagRegion(), t.tagVariant() },
        .has = .{ t.hasLanguage(), t.hasScript(), t.hasRegion() },
    };
}

fn expectJson(a: Allocator, want: Value, got: anytype) !void {
    const w = try std.json.Stringify.valueAlloc(a, want, .{});
    const g = try std.json.Stringify.valueAlloc(a, got, .{});
    if (!eql(w, g)) return fail("want {s}\n     got {s}", .{ w, g });
}

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

fn fastFromJson(v: Value) L.FastTag {
    const xs = v.array.items;
    return .{ .language = optStr(xs[0]), .script = optStr(xs[1]), .region = optStr(xs[2]) };
}

// ---------------------------------------------------------------------------
// Running a case
// ---------------------------------------------------------------------------

/// Run one case. Everything is allocated in the arena `a`.
fn run(a: Allocator, fname: []const u8, args: []const Value, want: Value) !void {
    if (eql(fname, "parseLanguageTag")) {
        return expectJson(a, want, try describe(a, try L.parseLanguageTag(a, args[0].string)));
    }
    if (eql(fname, "describeFull")) {
        return expectJson(a, want, try describeFull(a, try L.parseLanguageTag(a, args[0].string)));
    }
    if (eql(fname, "languageTag")) {
        return expectJson(a, want, try describeFull(a, try L.LanguageTag.init(a, try fieldsFromArgs(a, args))));
    }
    if (eql(fname, "tagExtensionSubtags")) {
        const t = try L.parseLanguageTag(a, args[0].string);
        return expectJson(a, want, t.extensionSubtags(args[1].string));
    }
    if (eql(fname, "substituteRegionAliases")) {
        var f = fastFromJson(args[0]);
        L.substituteRegionAliases(&f);
        return expectJson(a, want, [3]?[]const u8{ f.language, f.script, f.region });
    }
    return fail("unknown function {s}", .{fname});
}

test "language-tag conformance" {
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
    const t = try L.parseLanguageTag(gpa, "zh-yue-hant-HK-u-nu-hanidec-ca-chinese-t-en-x-foo");
    defer t.deinit(gpa);
    const c = try t.clone(gpa);
    defer c.deinit(gpa);
    const s1 = try c.compact(gpa);
    defer gpa.free(s1);
    try std.testing.expectEqualStrings("zh-Hant-HK-t-en-u-ca-chinese-nu-hanidec-x-foo", s1);
    const s2 = try t.expanded(gpa);
    gpa.free(s2);
    const s3 = try std.fmt.allocPrint(gpa, "{f}", .{t});
    defer gpa.free(s3);
    try std.testing.expectEqualStrings(s1, s3);

    const u = try L.LanguageTag.init(gpa, .{ .language = "EN", .extensions = t.extensions, .private_use = "x-a" });
    u.deinit(gpa);

    // An empty tag owns nothing.
    const e = try L.parseLanguageTag(gpa, "!!");
    try std.testing.expectEqual(@as(usize, 0), e.owned.len);
    e.deinit(gpa);
}
