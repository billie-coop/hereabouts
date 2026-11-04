//! Runs the shared cases in `conformance/locale.json` against the Zig port.
//!
//! A tag argument is a string, or `{ "tag": [...] }` with the arguments of `languageTag`. Tag
//! results are compared as JSON: the full object of `describeTag` in the generator, or the
//! pair `[compact, expanded]`.

const std = @import("std");
const h = @import("hereabouts");
const cases = @import("cases");

test {
    std.testing.refAllDecls(h.locale);
}

const L = h.language_tag;
const Loc = h.locale;
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
// Tags as JSON (same as test/language_tag.zig)
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

/// A tag result: the full description, or `[compact, expanded]`.
fn expectTag(a: Allocator, want: Value, t: LanguageTag) !void {
    if (want == .array) return expectJson(a, want, [2][]const u8{ try t.compact(a), try t.expanded(a) });
    return expectJson(a, want, try describe(a, t));
}

fn input(a: Allocator, v: Value) !Loc.Input {
    if (v == .string) return .{ .id = v.string };
    return .{ .tag = try L.LanguageTag.init(a, try fieldsFromArgs(a, v.object.get("tag").?.array.items)) };
}

fn expectOptString(want: Value, got: ?[]const u8) !void {
    if (want == .null) {
        if (got) |g| return fail("want null, got \"{s}\"", .{g});
        return;
    }
    const g = got orelse return fail("want \"{s}\", got null", .{want.string});
    if (!eql(want.string, g)) return fail("want \"{s}\", got \"{s}\"", .{ want.string, g });
}

// ---------------------------------------------------------------------------
// Running a case
// ---------------------------------------------------------------------------

const resolvers = .{
    .{ "resolveLanguageTag", Loc.resolveLanguageTag },
    .{ "substituteAliases", Loc.substituteAliases },
    .{ "addLikelySubtags", Loc.addLikelySubtags },
    .{ "removeLikelySubtags", Loc.removeLikelySubtags },
};

/// Run one case. Everything is allocated in the arena `a`.
fn run(a: Allocator, fname: []const u8, args: []const Value, want: Value) !void {
    inline for (resolvers) |r| {
        if (eql(fname, r[0])) return expectTag(a, want, try r[1](a, try input(a, args[0])));
    }
    if (eql(fname, "resolveLocaleId")) {
        const l = try Loc.resolveLocaleId(a, args[0].string);
        try expectOptString(want.object.get("id").?, l.id);
        return expectTag(a, want.object.get("tag").?, l.tag);
    }
    if (eql(fname, "localeFlag")) return expectOptString(want, try Loc.localeFlag(a, try input(a, args[0])));
    if (eql(fname, "regionFlag")) return expectOptString(want, Loc.regionFlag(args[0].string));
    if (eql(fname, "subdivisionFlag")) return expectOptString(want, Loc.subdivisionFlag(args[0].string));
    if (eql(fname, "flagRegion")) return expectOptString(want, Loc.flagRegion(args[0].string));
    if (eql(fname, "returnTag")) {
        const real = try L.parseLanguageTag(a, args[0].string);
        const fast = Loc.fastTag((try input(a, args[1])).tag);
        return expectTag(a, want, try Loc.returnTag(a, real, fast));
    }
    return fail("unknown function {s}", .{fname});
}

test "locale conformance" {
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
    const long = "en-u-ca-gregory-nu-latn-co-phonebk-cu-usd-tz-usnyc-va-posix-t-ja-latn-x-0123456789-abcdefgh-ijklmnop-qrstuvwx-yz012345-6789abcd-efghijkl-mnopqrst-uvwxyz01-23456789-abcdefgh-ijklmnop-qrstuvwx-yz012345-6789abcd-efghijkl-mnopqrst-uvwxyz01-23456789-abcdefgh-ijklmnop-qrstuvwx-yz012345-6789abcd-efghijkl-mnopqrst-uvwxyz01-23456789-abcdefgh-ijklmnop-qrstuvwx-yz012345-6789abcd-efghijkl";
    for ([_][]const u8{ "en", "iw-u-ca-hebrew", "zh-yue", long }) |id| {
        const tag = try L.parseLanguageTag(gpa, id);
        defer tag.deinit(gpa);
        for ([_]Loc.Input{ .{ .id = id }, .{ .tag = tag } }) |in| {
            inline for (resolvers) |r| {
                const t = try r[1](gpa, in);
                t.deinit(gpa);
            }
            _ = try Loc.localeFlag(gpa, in);
        }
        const l = try Loc.resolveLocaleId(gpa, id);
        l.deinit(gpa);
    }
    const u = try Loc.resolveLocaleId(gpa, "!!");
    u.deinit(gpa);
}
