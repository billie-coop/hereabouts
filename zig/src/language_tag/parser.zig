//! Low-level parsing of a language tag (`parseLanguageTag`). No resolution is performed.
//!
//! The parser runs over the input twice: once to measure the result and once to fill it, so
//! a parse makes exactly one allocation (none for an empty tag) and no temporary ones.

const std = @import("std");
const Allocator = std.mem.Allocator;
const lt = @import("language_tag.zig");
const block = @import("block.zig");
const util = @import("util.zig");
const subtags = @import("autogen.subtags.zig");

const LanguageTag = lt.LanguageTag;

// https://www.unicode.org/reports/tr35/tr35-33/tr35.html#Key_And_Type_Definitions_
const unicode_extension_keys = [_][]const u8{
    "ca", // calendar
    "co", // collation
    "cu", // currency
    "nu", // numbering system
    "tz", // timezone
    "va", // common variant type
};

// Additional grandfathered fallbacks from ICU, which take precedence over the IANA table.
const icu_grandfathered = [_]subtags.Grandfathered{
    .{ .key = "cel-gaulish", .preferred = "xtg-x-cel-gaulish" },
    .{ .key = "en-GB-oed", .preferred = "en-GB-x-oed" },
    .{ .key = "i-default", .preferred = "en-x-i-default" },
    .{ .key = "i-enochian", .preferred = "und-x-i-enochian" },
    .{ .key = "i-mingo", .preferred = "see-x-i-mingo" },
    .{ .key = "zh-min", .preferred = "nan-x-zh-min" },
};

// ---------------------------------------------------------------------------
// Subtag patterns (ASCII only, as the TypeScript regular expressions are)
// ---------------------------------------------------------------------------

fn allAlpha(s: []const u8) bool {
    for (s) |c| if (!std.ascii.isAlphabetic(c)) return false;
    return true;
}

fn allAlnum(s: []const u8) bool {
    for (s) |c| if (!std.ascii.isAlphanumeric(c)) return false;
    return true;
}

fn allDigit(s: []const u8) bool {
    for (s) |c| if (!std.ascii.isDigit(c)) return false;
    return true;
}

// ISO 639 language code
fn isLanguage(s: []const u8) bool {
    return s.len >= 2 and s.len <= 8 and allAlpha(s);
}

// Selected ISO 639 codes
fn isExtlang(s: []const u8) bool {
    return s.len == 3 and allAlpha(s);
}

// ISO 15924 script code
fn isScript(s: []const u8) bool {
    return s.len == 4 and allAlpha(s);
}

// ISO 3166-1 or UN M.49 code
fn isRegion(s: []const u8) bool {
    return (s.len >= 2 and s.len <= 3 and allAlpha(s)) or (s.len == 3 and allDigit(s));
}

// Registered variants
fn isVariant(s: []const u8) bool {
    return (s.len >= 5 and s.len <= 8 and allAlnum(s)) or
        (s.len == 4 and std.ascii.isDigit(s[0]) and allAlnum(s));
}

fn isExtensionPrefix(s: []const u8) bool {
    return s.len == 1 and std.ascii.isAlphanumeric(s[0]) and s[0] != 'x' and s[0] != 'X';
}

fn isExtensionSubtag(s: []const u8) bool {
    return s.len >= 2 and s.len <= 8 and allAlnum(s);
}

fn isPrivateUsePrefix(s: []const u8) bool {
    return s.len == 1 and (s[0] == 'x' or s[0] == 'X');
}

fn isPrivateUseSubtag(s: []const u8) bool {
    return s.len >= 1 and s.len <= 8 and allAlnum(s);
}

fn isUnicodeExtensionKey(s: []const u8) bool {
    for (unicode_extension_keys) |k| if (std.mem.eql(u8, k, s)) return true;
    return false;
}

// ---------------------------------------------------------------------------
// Splitting
// ---------------------------------------------------------------------------

/// The subtags of a string, split on '-' and '_' (the TypeScript replaces '_' with '-' and
/// splits on '-'). Empty subtags are kept, as `split` keeps them.
const Parts = struct {
    src: []const u8,
    /// Start of the current part, or null once all parts are used.
    pos: ?usize = 0,
    /// End of the last part taken.
    end: usize = 0,

    fn partEnd(self: Parts, from: usize) usize {
        return std.mem.indexOfAnyPos(u8, self.src, from, "-_") orelse self.src.len;
    }

    fn peek(self: Parts) ?[]const u8 {
        const p = self.pos orelse return null;
        return self.src[p..self.partEnd(p)];
    }

    /// Take the current part if it matches.
    fn match(self: *Parts, comptime pattern: fn ([]const u8) bool) ?[]const u8 {
        const s = self.peek() orelse return null;
        if (!pattern(s)) return null;
        const p = self.pos.?;
        self.end = p + s.len;
        self.pos = if (self.end < self.src.len) self.end + 1 else null;
        return s;
    }

    fn here(self: Parts) usize {
        return self.pos orelse self.src.len;
    }
};

/// One group of extension subtags: a key such as 'ca' and its values, e.g. 'ca-gregory', or
/// the subtags before the first key. Groups are runs of parts, so a slice of the source.
const Group = struct { prefix: u8, text: []const u8 };

/// Yields the extension groups in source order.
const Extensions = struct {
    parts: Parts,
    prefix: ?u8 = null,
    group_start: ?usize = null,
    group_end: usize = 0,

    fn next(self: *Extensions) ?Group {
        while (true) {
            const prefix = self.prefix orelse {
                const p = self.parts.match(isExtensionPrefix) orelse return null;
                self.prefix = p[0];
                continue;
            };
            const start = self.parts.here();
            if (self.parts.match(isExtensionSubtag)) |subtag| {
                if (!isUnicodeExtensionKey(subtag) or self.group_start == null) {
                    if (self.group_start == null) self.group_start = start;
                    self.group_end = self.parts.end;
                    continue;
                }
                // A key starts a new group.
                const g = self.group(prefix);
                self.group_start = start;
                self.group_end = self.parts.end;
                return g;
            }
            self.prefix = null;
            if (self.group_start != null) {
                const g = self.group(prefix);
                self.group_start = null;
                return g;
            }
        }
    }

    fn group(self: Extensions, prefix: u8) Group {
        return .{ .prefix = prefix, .text = self.parts.src[self.group_start.?..self.group_end] };
    }
};

/// What a parse found, as slices of the source.
const Scan = struct {
    language: ?[]const u8 = null,
    script: ?[]const u8 = null,
    region: ?[]const u8 = null,
    variant: ?[]const u8 = null,
    extlangs: Parts,
    extlang_count: usize = 0,
    /// Where the extensions start; null if the language didn't parse.
    extensions: ?Parts = null,
    private_use: []const u8 = "",
};

fn scan(src: []const u8) Scan {
    var parts: Parts = .{ .src = src };
    var s: Scan = .{ .extlangs = parts };
    s.language = parts.match(isLanguage);
    if (s.language) |language| {
        s.extlangs = parts;
        if (language.len <= 3) {
            while (parts.match(isExtlang) != null) s.extlang_count += 1;
        }
        s.script = parts.match(isScript);
        s.region = parts.match(isRegion);
        s.variant = parts.match(isVariant);
        while (parts.match(isVariant) != null) {}
        s.extensions = parts;
        var exts: Extensions = .{ .parts = parts };
        while (exts.next() != null) {}
        parts = exts.parts;
    }

    // The subtag pattern also matches 'x', so a second private use section can't start.
    if (parts.match(isPrivateUsePrefix) != null) {
        const start = parts.end - 1;
        var n: usize = 0;
        while (parts.match(isPrivateUseSubtag) != null) n += 1;
        if (n > 0) s.private_use = src[start..parts.end];
    }

    // If no region was parsed, check if one of the extlangs is actually a valid ISO 3166.
    if (s.region == null) {
        var it = s.extlangs;
        for (0..s.extlang_count) |_| {
            const e = it.match(isExtlang).?;
            var upper: [3]u8 = undefined;
            _ = std.ascii.upperString(&upper, e);
            if (util.replaceRegion(&upper)) |r| {
                s.region = r;
                // Ignore the extlangs since we currently don't add them to the LanguageTag.
                break;
            }
        }
    }
    return s;
}

/// The grandfathered tag's preferred form, if the input is one. The TypeScript lowercases the
/// input with `toLowerCase`, so U+212A KELVIN SIGN counts as 'k'.
fn grandfathered(str: []const u8) ?[]const u8 {
    var buf: [16]u8 = undefined;
    var n: usize = 0;
    var i: usize = 0;
    while (i < str.len) {
        if (n == buf.len) return null;
        const c = str[i];
        if (c < 0x80) {
            buf[n] = if (c == '_') '-' else std.ascii.toLower(c);
            i += 1;
        } else if (std.mem.startsWith(u8, str[i..], "\u{212a}")) {
            buf[n] = 'k';
            i += 3;
        } else {
            return null;
        }
        n += 1;
    }
    const key = buf[0..n];
    for (icu_grandfathered) |g| {
        if (std.mem.eql(u8, g.key, key)) return g.preferred;
    }
    const idx = std.sort.binarySearch(subtags.Grandfathered, &subtags.grandfathered, key, struct {
        fn cmp(k: []const u8, g: subtags.Grandfathered) std.math.Order {
            return std.mem.order(u8, k, g.key);
        }
    }.cmp) orelse return null;
    return subtags.grandfathered[idx].preferred;
}

/// Copy with '_' as '-' (the TypeScript replaces them before splitting).
fn copyDashed(c: *block.Carver, s: []const u8) []const u8 {
    const d = c.bytes(s.len);
    for (s, d) |x, *y| y.* = if (x == '_') '-' else x;
    return d;
}

fn strLess(_: void, a: []const u8, b: []const u8) bool {
    return std.mem.lessThan(u8, a, b);
}

/// Low-level parsing of a language tag. No resolution is performed.
pub fn parse(gpa: Allocator, str: []const u8) Allocator.Error!LanguageTag {
    const src = grandfathered(str) orelse str;
    const s = scan(src);

    const language = block.canonical(.language, s.language);
    const script = block.canonical(.script, s.script);
    const region = block.canonical(.region, s.region);
    const variant = block.canonical(.variant, s.variant);

    // Measure.
    var layout: block.Layout = .{ .strs = s.extlang_count, .bytes = 3 * s.extlang_count + s.private_use.len };
    for ([_]?[]const u8{ language, script, region, variant }) |v| {
        if (v) |x| layout.bytes += x.len;
    }
    var counts = [_]u32{0} ** 128;
    if (s.extensions) |start| {
        var it: Extensions = .{ .parts = start };
        while (it.next()) |g| {
            if (counts[g.prefix] == 0) {
                layout.exts += 1;
                layout.bytes += 1;
            }
            counts[g.prefix] += 1;
            layout.strs += 1;
            layout.bytes += g.text.len;
        }
    }

    // Fill.
    const buf = try block.alloc(gpa, layout);
    var c = block.Carver.init(buf, layout);
    const exts = c.exts(layout.exts);
    var slots: [128][][]const u8 = undefined;
    var e: usize = 0;
    for (counts, 0..) |n, key| {
        if (n == 0) continue;
        const k = c.bytes(1);
        k[0] = @intCast(key);
        slots[key] = c.strs(n);
        exts[e] = .{ .key = k, .subtags = slots[key] };
        e += 1;
    }
    if (s.extensions) |start| {
        var filled = [_]u32{0} ** 128;
        var it: Extensions = .{ .parts = start };
        while (it.next()) |g| {
            slots[g.prefix][filled[g.prefix]] = copyDashed(&c, g.text);
            filled[g.prefix] += 1;
        }
        for (exts) |x| std.sort.pdq([]const u8, slots[x.key[0]], {}, strLess);
    }
    const extlangs = c.strs(s.extlang_count);
    var it = s.extlangs;
    for (extlangs) |*x| x.* = c.copy(it.match(isExtlang).?);

    return .{
        .language = c.copyField(.language, language, true),
        .script = c.copyField(.script, script, true),
        .region = c.copyField(.region, region, true),
        .variant = c.copyField(.variant, variant, true),
        .extensions = exts,
        .private_use = copyDashed(&c, s.private_use),
        .extlangs = extlangs,
        .owned = buf,
    };
}

fn expectCompact(input: []const u8, want: []const u8) !void {
    const gpa = std.testing.allocator;
    const t = try parse(gpa, input);
    defer t.deinit(gpa);
    const s = try t.compact(gpa);
    defer gpa.free(s);
    try std.testing.expectEqualStrings(want, s);
}

test "parse" {
    try expectCompact("en-latn-us", "en-Latn-US");
    try expectCompact("FR_latn_fr", "fr-Latn-FR");
    try expectCompact("i-klingon", "tlh");
    try expectCompact("en-abc-def-us", "en-US");
    try expectCompact("en-ARG", "en-AR");
    try expectCompact("zh-x-foo-x-bar-baz", "zh-x-foo-x-bar-baz");
    try expectCompact("x--x--", "und");
    try expectCompact("fr-u-ca-islamic-u_co_phonebk", "fr-u-ca-islamic-co-phonebk");
    try expectCompact("", "und");
}
