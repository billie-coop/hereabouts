//! Alias substitution and likely subtags (`resolver.ts`).

const std = @import("std");
const Allocator = std.mem.Allocator;
const lt = @import("../language_tag/language_tag.zig");
const subtags = @import("autogen.subtags.zig");
const aliases = @import("autogen.aliases.zig");

const LanguageTag = lt.LanguageTag;
const FastTag = lt.FastTag;

/// A tag, or a string to parse into one (`string | LanguageTag` in the TypeScript).
pub const Input = union(enum) {
    id: []const u8,
    tag: LanguageTag,
};

/// The core subtags of a tag, for indexing. If an extlang subtag exists, it replaces the
/// language subtag.
pub fn fastTag(real: LanguageTag) FastTag {
    var fast: FastTag = .{
        .language = nonEmpty(real.language),
        .script = nonEmpty(real.script),
        .region = nonEmpty(real.region),
    };
    if (real.extlangs.len > 0) fast.language = real.extlangs[0];
    return fast;
}

fn nonEmpty(v: ?[]const u8) ?[]const u8 {
    const s = v orelse return null;
    return if (s.len == 0) null else s;
}

fn orderField(a: ?[]const u8, b: ?[]const u8) std.math.Order {
    if (a == null or b == null) {
        if (a == null and b == null) return .eq;
        return if (a == null) .lt else .gt;
    }
    return std.mem.order(u8, a.?, b.?);
}

fn orderLikely(q: FastTag, e: subtags.Likely) std.math.Order {
    const o = orderField(q.language, e.key[0]);
    if (o != .eq) return o;
    const s = orderField(q.script, e.key[1]);
    if (s != .eq) return s;
    return orderField(q.region, e.key[2]);
}

fn likelyGet(query: FastTag) ?FastTag {
    const i = std.sort.binarySearch(subtags.Likely, &subtags.likely_subtags, query, orderLikely) orelse
        return null;
    const v = subtags.likely_subtags[i].value;
    return .{ .language = v[0], .script = v[1], .region = v[2] };
}

// Flags for subtag permutations
const F_LANGUAGE = 1;
const F_SCRIPT = 2;
const F_REGION = 4;

const match_order = [_]u3{
    F_LANGUAGE | F_SCRIPT | F_REGION,
    F_LANGUAGE | F_REGION,
    F_LANGUAGE | F_SCRIPT,
    F_LANGUAGE,
    F_SCRIPT,
};

/// Clear or copy fields from src depending on flags.
fn setFields(src: FastTag, flags: u3) FastTag {
    return .{
        .language = if (flags & F_LANGUAGE == 0) null else src.language,
        .script = if (flags & F_SCRIPT == 0) null else src.script,
        .region = if (flags & F_REGION == 0) null else src.region,
    };
}

fn fieldEql(a: ?[]const u8, b: ?[]const u8) bool {
    return orderField(a, b) == .eq;
}

fn aliasesOf(language: []const u8) ?[]const aliases.Pair {
    const i = std.sort.binarySearch(aliases.LanguageAliases, &aliases.language_aliases, language, struct {
        fn cmp(k: []const u8, e: aliases.LanguageAliases) std.math.Order {
            return std.mem.order(u8, k, e.language);
        }
    }.cmp) orelse return null;
    return aliases.language_aliases[i].pairs;
}

/// Lookup any aliases that match this tag, and replace any undefined subtags.
pub fn substituteLanguageAliases(dst: *FastTag) void {
    const language = dst.language orelse return;
    const pairs = aliasesOf(language) orelse return;
    for (pairs) |p| {
        const exact = fieldEql(p.from[0], dst.language) and
            fieldEql(p.from[1], dst.script) and fieldEql(p.from[2], dst.region);
        if ((p.from[1] == null and p.from[2] == null) or exact) {
            dst.language = p.to[0];
            if (dst.script == null) dst.script = p.to[1];
            if (dst.region == null) dst.region = p.to[2];
            break;
        }
    }
}

/// Add any missing subtags using the likely subtags mapping. For example, this would
/// convert "en" to "en-Latn-US".
pub fn addLikelySubtagsFast(dst: *FastTag) void {
    for (match_order) |flags| {
        const m = likelyGet(setFields(dst.*, flags)) orelse continue;
        if (dst.language == null) dst.language = m.language;
        if (dst.script == null) dst.script = m.script;
        if (dst.region == null) dst.region = m.region;
        break;
    }
}

/// A language tag combining the fast tag's core subtags with the original's variant,
/// extensions and private use. Extlangs are dropped.
pub fn returnTag(gpa: Allocator, real: LanguageTag, fast: FastTag) Allocator.Error!LanguageTag {
    return lt.init(gpa, .{
        .language = fast.language,
        .script = fast.script,
        .region = fast.region,
        .variant = real.getVariant(),
        .extensions = real.extensions,
        .private_use = real.private_use,
    });
}

/// The input's tag, parsed if it's a string. Free with `done`.
const Source = struct {
    tag: LanguageTag,
    parsed: bool,

    fn init(a: Allocator, input: Input) Allocator.Error!Source {
        return switch (input) {
            .id => |s| .{ .tag = try lt.parse(a, s), .parsed = true },
            .tag => |t| .{ .tag = t, .parsed = false },
        };
    }

    fn done(self: Source, a: Allocator) void {
        if (self.parsed) self.tag.deinit(a);
    }
};

const Op = enum { aliases, resolve, add, remove };

fn apply(gpa: Allocator, input: Input, op: Op) Allocator.Error!LanguageTag {
    // A parsed input is temporary: keep it on the stack when it fits.
    var sfa = std.heap.stackFallback(512, gpa);
    const tmp = sfa.get();
    const src = try Source.init(tmp, input);
    defer src.done(tmp);
    const tag = src.tag;
    var fast = fastTag(tag);
    switch (op) {
        .aliases => {
            substituteLanguageAliases(&fast);
            lt.substituteRegionAliases(&fast);
        },
        .resolve => {
            // TODO: add flags to determine which operations to perform.
            substituteLanguageAliases(&fast);
            lt.substituteRegionAliases(&fast);
            addLikelySubtagsFast(&fast);
        },
        .add => addLikelySubtagsFast(&fast),
        .remove => fast = removeFast(fast),
    }
    return returnTag(gpa, tag, fast);
}

/// Substitute language and region aliases only.
pub fn substituteAliases(gpa: Allocator, input: Input) Allocator.Error!LanguageTag {
    return apply(gpa, input, .aliases);
}

/// Substitute all relevant aliases, and then add likely subtags.
pub fn resolveLanguageTag(gpa: Allocator, input: Input) Allocator.Error!LanguageTag {
    return apply(gpa, input, .resolve);
}

/// Add any missing subtags using the likely subtags mapping. For example, this would
/// convert "en" to "en-Latn-US".
pub fn addLikelySubtags(gpa: Allocator, input: Input) Allocator.Error!LanguageTag {
    return apply(gpa, input, .add);
}

/// Remove any subtags that would be added by `addLikelySubtags`. For example, this would
/// convert "en-Latn-US" to "en".
pub fn removeLikelySubtags(gpa: Allocator, input: Input) Allocator.Error!LanguageTag {
    return apply(gpa, input, .remove);
}

fn removeFast(tag: FastTag) FastTag {
    var max = tag;
    if (max.language == null or max.script == null or max.region == null) {
        addLikelySubtagsFast(&max);
    }
    var tmp: FastTag = .{};

    // Using "en-Latn-US" as an example...
    // 1. Match "en-Zzzz-ZZ"
    tmp.language = max.language;
    var m = tmp;
    addLikelySubtagsFast(&m);
    if (m.eql(max)) return tmp;

    // 2. Match "en-Zzzz-US"
    tmp.region = max.region;
    m = tmp;
    addLikelySubtagsFast(&m);
    if (m.eql(max)) {
        tmp.language = max.language;
        return tmp;
    }

    // 3. Match "en-Latn-ZZ"
    tmp.region = null;
    tmp.script = max.script;
    m = tmp;
    addLikelySubtagsFast(&m);
    if (m.eql(max)) return tmp;

    // 4. Nothing matched, so return a copy of the original tag.
    return max;
}

fn expectExpanded(comptime f: anytype, input: []const u8, want: []const u8) !void {
    const gpa = std.testing.allocator;
    const t = try f(gpa, .{ .id = input });
    defer t.deinit(gpa);
    const s = try t.expanded(gpa);
    defer gpa.free(s);
    try std.testing.expectEqualStrings(want, s);
}

test "resolve" {
    try expectExpanded(resolveLanguageTag, "iw", "he-Hebr-IL");
    try expectExpanded(resolveLanguageTag, "en-120", "en-Latn-CM");
    try expectExpanded(resolveLanguageTag, "en-eng-eng-AAA", "en-Latn-AA");
    try expectExpanded(resolveLanguageTag, "zh-Hanb", "zh-Hanb-TW");
    try expectExpanded(removeLikelySubtags, "zh-Hant-TW", "zh-Zzzz-TW");
    try expectExpanded(removeLikelySubtags, "und-BY", "ru-Zzzz-BY");
    try expectExpanded(substituteAliases, "sgn-US", "ase-Zzzz-US");
}

test "fast tag merging" {
    const gpa = std.testing.allocator;
    const f = fastTag(.{ .script = "Latn", .region = "US" });
    const tag = try lt.parse(gpa, "und-POSIX-u-ca-calendar");
    defer tag.deinit(gpa);
    const r = try returnTag(gpa, tag, f);
    defer r.deinit(gpa);
    const s = try r.expanded(gpa);
    defer gpa.free(s);
    try std.testing.expectEqualStrings("und-Latn-US-posix-u-ca-calendar", s);
}
