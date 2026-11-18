//! CLDR enhanced language matching (`matcher.ts`):
//! http://www.unicode.org/reports/tr35/tr35.html#EnhancedLanguageMatching

const std = @import("std");
const Allocator = std.mem.Allocator;
const lt = @import("../language_tag/language_tag.zig");
const locale = @import("../locale/locale.zig");
const distance = @import("distance.zig");
const paradigm_locales = @import("autogen.distance.zig").paradigm_locales;

const LanguageTag = lt.LanguageTag;
const Locale = locale.Locale;

/// A locale held by the matcher, paired with its compact tag string
/// (`LocaleMatcherEntry`).
pub const Entry = struct {
    id: []const u8,
    tag: LanguageTag,
    compact: []const u8,
};

/// Options for `create` (`LocaleMatcherOptions`).
pub const Options = struct {
    /// Resolve language tags.
    resolve: bool = true,
};

/// A supported locale: a string of space- and comma-separated ids, a tag, or a locale whose
/// id is kept as given.
pub const Input = union(enum) {
    string: []const u8,
    tag: LanguageTag,
    locale: Locale,
};

/// True for the characters the TypeScript splits ids on: ',' and JavaScript's `\s`.
/// Returns the byte length of the separator at `i`, or 0.
fn separatorLen(s: []const u8, i: usize) usize {
    const c = s[i];
    if (c < 0x80) return if (c == ',' or c == ' ' or (c >= 0x09 and c <= 0x0d)) 1 else 0;
    const n = std.unicode.utf8ByteSequenceLength(c) catch return 0;
    if (i + n > s.len) return 0;
    const cp = std.unicode.utf8Decode(s[i..][0..n]) catch return 0;
    return switch (cp) {
        0xa0, 0x1680, 0x2000...0x200a, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff => n,
        else => 0,
    };
}

/// Splits like `s.split(/[,\s]+/)`: runs of separators split, and a leading or trailing run
/// gives an empty id.
const Splitter = struct {
    s: []const u8,
    i: usize = 0,
    done: bool = false,

    fn next(self: *Splitter) ?[]const u8 {
        if (self.done) return null;
        const start = self.i;
        while (self.i < self.s.len) {
            const n = separatorLen(self.s, self.i);
            if (n == 0) {
                self.i += 1;
                continue;
            }
            const end = self.i;
            while (self.i < self.s.len) {
                const m = separatorLen(self.s, self.i);
                if (m == 0) break;
                self.i += m;
            }
            return self.s[start..end];
        }
        self.done = true;
        return self.s[start..];
    }
};

/// Flatten and split the inputs into a list of matcher entries. Everything is allocated in
/// `arena` and never freed individually. Visible for testing.
pub fn parse(arena: Allocator, locales: []const Input, options: Options) Allocator.Error![]Entry {
    var result: std.ArrayList(Entry) = .empty;
    for (locales) |e| {
        switch (e) {
            .string => |s| {
                var it: Splitter = .{ .s = s };
                while (it.next()) |id| {
                    const tag = try lt.parseLanguageTag(arena, id);
                    try result.append(arena, try entryFor(arena, try arena.dupe(u8, id), tag, options));
                }
            },
            .tag => |tag| try result.append(arena, try entryFor(arena, try tag.compact(arena), tag, options)),
            .locale => |l| {
                // Have a full Locale object, so optionally substitute aliases and add it.
                const tag = if (options.resolve)
                    try locale.substituteAliases(arena, .{ .tag = l.tag })
                else
                    try l.tag.clone(arena);
                try result.append(arena, try entry(arena, try arena.dupe(u8, l.id), tag));
            },
        }
    }
    return result.items;
}

fn entry(arena: Allocator, id: []const u8, tag: LanguageTag) Allocator.Error!Entry {
    return .{ .id = id, .tag = tag, .compact = try tag.compact(arena) };
}

fn entryFor(arena: Allocator, id: []const u8, tag: LanguageTag, options: Options) Allocator.Error!Entry {
    // This code preserves the 'und' undefined locale. If we resolve it, adding likely
    // subtags will expand it to 'en-Latn-US'.
    const l = tag.hasLanguage();
    const s = tag.hasScript();
    const r = tag.hasRegion();
    if (l and s and r) {
        // If all subtags are present, substitute aliases
        return entry(arena, id, if (options.resolve) try locale.substituteAliases(arena, .{ .tag = tag }) else try tag.clone(arena));
    }
    if (l or s or r) {
        // If at least one subtag is present, resolve
        return entry(arena, id, if (options.resolve) try locale.resolveLanguageTag(arena, .{ .tag = tag }) else try tag.clone(arena));
    }
    // Preserve undefined core fields, but include input's extensions
    return entry(arena, id, try lt.LanguageTag.init(arena, .{ .extensions = tag.extensions, .private_use = tag.private_use }));
}

fn paradigmRank(e: Entry) usize {
    for (paradigm_locales, 0..) |p, i| {
        if (std.mem.eql(u8, p, e.compact)) return i;
    }
    return paradigm_locales.len;
}

fn rankLess(_: void, a: Entry, b: Entry) bool {
    return paradigmRank(a) < paradigmRank(b);
}

/// Sort the supported entries: the default (first) entry, then all paradigm locales, then
/// all other locales in their relative positions. Visible for testing.
pub fn sortEntries(entries: []Entry) void {
    if (entries.len > 1) std.sort.block(Entry, entries[1..], {}, rankLess);
}

/// A locale matcher made by `create`. Pass it to `match`; free with `deinit`.
pub const Matcher = struct {
    /// Supported locales, sorted: default first, then paradigm locales, then all others.
    supported: []const Entry,
    /// The default locale, i.e. the first supported locale given.
    default_entry: Entry,
    arena: std.heap.ArenaAllocator.State,

    pub fn deinit(self: Matcher, gpa: Allocator) void {
        self.arena.promote(gpa).deinit();
    }

    /// The first supported locale with this compact tag, for exact matches (`exactMap`).
    pub fn exact(self: Matcher, compact: []const u8) ?*const Entry {
        for (self.supported) |*e| {
            if (std.mem.eql(u8, e.compact, compact)) return e;
        }
        return null;
    }

    /// TypeScript `createLocaleMatcher` (locale-matcher/matcher.ts).
    pub fn init(gpa: Allocator, supported_locales: []const Input, options: Options) Error!Matcher {
        return @import("matcher.zig").create(gpa, supported_locales, options);
    }

    /// TypeScript `matchLocale` (locale-matcher/matcher.ts).
    pub fn matchLocale(matcher: Matcher, gpa: Allocator, desired_locales: []const []const u8, threshold: i32) Allocator.Error!Match {
        return @import("matcher.zig").match(gpa, matcher, desired_locales, threshold);
    }
};

pub const Error = Allocator.Error || error{
    /// 'LocaleMatcher expects at least one supported locale'
    NoSupportedLocales,
};

/// Create a matcher for the given list of supported locales (`createLocaleMatcher`). The
/// first locale in the list is the default, selected if no match is within the distance
/// threshold.
pub fn create(gpa: Allocator, supported_locales: []const Input, options: Options) Error!Matcher {
    var arena = std.heap.ArenaAllocator.init(gpa);
    errdefer arena.deinit();
    const supported = try parse(arena.allocator(), supported_locales, options);
    if (supported.len == 0) return error.NoSupportedLocales;
    sortEntries(supported);
    return .{ .supported = supported, .default_entry = supported[0], .arena = arena.state };
}

/// A result of `match` (`LocaleMatch`). Free with `deinit`.
pub const Match = struct {
    /// The locale that was matched.
    locale: Locale,
    /// Distance of the match from the desired locale.
    distance: i32,

    pub fn deinit(self: Match, gpa: Allocator) void {
        self.locale.deinit(gpa);
    }
};

/// Find the desired locale that is the closest match to a supported locale, within the given
/// threshold (`matchLocale`; the TypeScript default is `DEFAULT_THRESHOLD`). Any matches
/// whose distance is greater than or equal to the threshold are treated as having maximum
/// distance. Each desired string may hold several space- or comma-separated ids.
pub fn match(gpa: Allocator, matcher: Matcher, desired_locales: []const []const u8, threshold: i32) Allocator.Error!Match {
    var arena = std.heap.ArenaAllocator.init(gpa);
    defer arena.deinit();
    const a = arena.allocator();
    const inputs = try a.alloc(Input, desired_locales.len);
    for (desired_locales, inputs) |s, *in| in.* = .{ .string = s };
    const desireds = try parse(a, inputs, .{});

    var best_distance = distance.MAX_DISTANCE;
    var best_match: ?Entry = null;
    var best_desired = if (desireds.len == 0) matcher.default_entry else desireds[0];
    for (desireds) |desired| {
        // Short-circuit if we find an exact match
        if (matcher.exact(desired.compact)) |e| {
            best_match = e.*;
            best_distance = 0;
            best_desired = desired;
            break;
        }
        for (matcher.supported) |supported| {
            const d = distance.getDistance(desired.tag, supported.tag, threshold);
            if (d < best_distance) {
                best_distance = d;
                best_match = supported;
                best_desired = desired;
            }
        }
    }

    const m = best_match orelse matcher.default_entry;
    const tag = try lt.LanguageTag.init(gpa, .{
        .language = m.tag.tagLanguage(),
        .script = m.tag.tagScript(),
        .region = m.tag.tagRegion(),
        .variant = m.tag.tagVariant(),
        .extensions = best_desired.tag.extensions,
        .private_use = best_desired.tag.private_use,
    });
    errdefer tag.deinit(gpa);
    return .{
        .locale = .{ .id = try gpa.dupe(u8, m.id), .tag = tag },
        .distance = if (best_match == null) distance.MAX_DISTANCE else best_distance,
    };
}

test "split" {
    var it: Splitter = .{ .s = " en, pt_AR \u{3000}" };
    try std.testing.expectEqualStrings("", it.next().?);
    try std.testing.expectEqualStrings("en", it.next().?);
    try std.testing.expectEqualStrings("pt_AR", it.next().?);
    try std.testing.expectEqualStrings("", it.next().?);
    try std.testing.expect(it.next() == null);
}

test "match" {
    const gpa = std.testing.allocator;
    const m = try create(gpa, &.{.{ .string = "en, en_GB, zh, pt_AR, es-419" }}, .{});
    defer m.deinit(gpa);
    const r = try match(gpa, m, &.{"en-AU"}, distance.DEFAULT_THRESHOLD);
    defer r.deinit(gpa);
    try std.testing.expectEqual(@as(i32, 3), r.distance);
    try std.testing.expectEqualStrings("en_GB", r.locale.id);
}
