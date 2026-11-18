//! Port of `packages/hereabouts/src/language-tag`: IETF BCP 47 language tags.
//!
//! A `LanguageTag` is plain data. Create one with `parse` or `init`; both put all of the tag's
//! strings in one allocation, freed with `deinit`. A tag written as a struct literal owns
//! nothing and needs no `deinit`.

const std = @import("std");
const Allocator = std.mem.Allocator;
const parser = @import("parser.zig");
const util = @import("util.zig");
const block = @import("block.zig");

/// TypeScript parseLanguageTag.
pub const parseLanguageTag = parser.parse;
pub const FastTag = util.FastTag;
pub const substituteRegionAliases = util.substituteRegionAliases;

/// Index of each core subtag (`LanguageTagField`).
pub const Field = enum(u2) {
    language = 0,
    script = 1,
    region = 2,
    variant = 3,
};

/// The value each core subtag shows when it is not set.
pub const undefined_values = [4][]const u8{ "und", "Zzzz", "ZZ", "" };

/// The subtags of one extension, e.g. key "u" with subtags `.{ "ca-gregory", "nu-latn" }`.
pub const Extension = struct {
    key: []const u8,
    subtags: []const []const u8,
};

/// The fields of a tag, as given to `init`.
pub const Fields = struct {
    language: ?[]const u8 = null,
    script: ?[]const u8 = null,
    region: ?[]const u8 = null,
    variant: ?[]const u8 = null,
    /// Keys must be unique (they are the keys of an object in the TypeScript).
    extensions: []const Extension = &.{},
    private_use: []const u8 = "",
    extlangs: []const []const u8 = &.{},
};

/// IETF BCP 47 language tag. The core subtag fields are null when the subtag is not set; the
/// `get*` methods return the undefined value ('und', 'Zzzz', 'ZZ') in that case.
pub const LanguageTag = struct {
    /// Canonical language subtag, or null if not set.
    language: ?[]const u8 = null,
    /// Canonical script subtag, or null if not set.
    script: ?[]const u8 = null,
    /// Canonical region subtag, or null if not set.
    region: ?[]const u8 = null,
    /// Canonical variant subtag, or null if not set.
    variant: ?[]const u8 = null,
    /// Extensions keyed by their single-character prefix, e.g. 'u' or 't'. Parsed tags have
    /// them sorted by key.
    extensions: []const Extension = &.{},
    /// Private use subtag, e.g. 'x-foo', or empty string.
    private_use: []const u8 = "",
    /// Extended language subtags, used for BCP 47 canonicalization.
    extlangs: []const []const u8 = &.{},
    /// The allocation holding the strings above, if the tag owns one.
    owned: []align(block.alignment) u8 = &.{},

    /// Free the tag's memory. Copies of a tag share it: free only one.
    pub fn deinit(self: LanguageTag, gpa: Allocator) void {
        if (self.owned.len > 0) gpa.free(self.owned);
    }

    /// A copy that owns its own memory.
    pub fn clone(self: LanguageTag, gpa: Allocator) Allocator.Error!LanguageTag {
        return build(gpa, .{
            .language = self.language,
            .script = self.script,
            .region = self.region,
            .variant = self.variant,
            .extensions = self.extensions,
            .private_use = self.private_use,
            .extlangs = self.extlangs,
        }, false);
    }

    /// Language subtag, or 'und' if undefined (`tagLanguage`).
    pub fn tagLanguage(self: LanguageTag) []const u8 {
        return orUndefined(self.language, .language);
    }

    /// Script subtag, or 'Zzzz' if undefined (`tagScript`).
    pub fn tagScript(self: LanguageTag) []const u8 {
        return orUndefined(self.script, .script);
    }

    /// Region subtag, or 'ZZ' if undefined (`tagRegion`).
    pub fn tagRegion(self: LanguageTag) []const u8 {
        return orUndefined(self.region, .region);
    }

    /// Variant subtag, or '' if undefined (`tagVariant`).
    pub fn tagVariant(self: LanguageTag) []const u8 {
        return orUndefined(self.variant, .variant);
    }

    /// True if the language subtag is defined (`tagHasLanguage`).
    pub fn hasLanguage(self: LanguageTag) bool {
        return self.language != null;
    }

    /// True if the script subtag is defined (`tagHasScript`).
    pub fn hasScript(self: LanguageTag) bool {
        return self.script != null;
    }

    /// True if the region subtag is defined (`tagHasRegion`).
    pub fn hasRegion(self: LanguageTag) bool {
        return self.region != null;
    }

    /// The subtags of the extension with the given key: 'u' for Unicode and 't' for
    /// transforms (`tagExtensionSubtags`).
    pub fn extensionSubtags(self: LanguageTag, key: []const u8) []const []const u8 {
        for (self.extensions) |e| {
            if (std.mem.eql(u8, e.key, key)) return e.subtags;
        }
        return &.{};
    }

    /// Compact string form: undefined fields are omitted (`tagCompact`, `tagToString`).
    pub fn compact(self: LanguageTag, gpa: Allocator) Allocator.Error![]u8 {
        return self.render(gpa, false);
    }

    /// Same as `compact`.
    pub fn toString(self: LanguageTag, gpa: Allocator) Allocator.Error![]u8 {
        return self.render(gpa, false);
    }

    /// Expanded string form: undefined fields show their undefined value (`tagExpanded`).
    pub fn expanded(self: LanguageTag, gpa: Allocator) Allocator.Error![]u8 {
        return self.render(gpa, true);
    }

    /// The compact or expanded string, allocated.
    pub fn render(self: LanguageTag, gpa: Allocator, expand: bool) Allocator.Error![]u8 {
        var counter: Counter = .{};
        self.renderTo(&counter, expand) catch unreachable;
        const buf = try gpa.alloc(u8, counter.n);
        var filler: Filler = .{ .buf = buf };
        self.renderTo(&filler, expand) catch unreachable;
        return buf;
    }

    /// Write the compact or expanded string.
    pub fn write(self: LanguageTag, w: *std.Io.Writer, expand: bool) std.Io.Writer.Error!void {
        var sink: WriterSink = .{ .w = w };
        return self.renderTo(&sink, expand);
    }

    /// Formats the compact string, for `{f}`.
    pub fn format(self: LanguageTag, w: *std.Io.Writer) std.Io.Writer.Error!void {
        return self.write(w, false);
    }

    fn renderTo(self: LanguageTag, sink: anytype, expand: bool) !void {
        const core = [4]?[]const u8{ self.language, self.script, self.region, self.variant };
        for (core, 0..) |val, key| {
            const force = key != 3 and (key == 0 or expand);
            if (val != null or force) {
                // The language always comes first and is never empty.
                if (key > 0) try sink.put("-");
                const v = val orelse "";
                try sink.put(if (v.len > 0) v else undefined_values[key]);
            }
        }
        // Keys in sorted order (UTF-16 order, as JavaScript sorts strings).
        const exts = self.extensions;
        var prev: ?usize = null;
        for (0..exts.len) |_| {
            var best: ?usize = null;
            for (0..exts.len) |i| {
                if (prev) |p| {
                    if (!extLess(exts, p, i)) continue;
                }
                if (best == null or extLess(exts, i, best.?)) best = i;
            }
            const e = exts[best.?];
            prev = best;
            if (e.subtags.len == 0) continue;
            try sink.put("-");
            try sink.put(e.key);
            for (e.subtags) |s| {
                try sink.put("-");
                try sink.put(s);
            }
        }
        if (self.private_use.len > 0) {
            try sink.put("-");
            try sink.put(self.private_use);
        }
    }

    /// TypeScript `languageTag` (language-tag/languagetag.ts).
    pub fn init(gpa: Allocator, fields: Fields) Allocator.Error!LanguageTag {
        return initImpl(gpa, fields);
    }
};

fn orUndefined(v: ?[]const u8, field: Field) []const u8 {
    if (v) |s| {
        if (s.len > 0) return s;
    }
    return undefined_values[@intFromEnum(field)];
}

fn extLess(exts: []const Extension, a: usize, b: usize) bool {
    return switch (utf16Order(exts[a].key, exts[b].key)) {
        .lt => true,
        .gt => false,
        .eq => a < b,
    };
}

const Counter = struct {
    n: usize = 0,
    fn put(self: *Counter, s: []const u8) error{}!void {
        self.n += s.len;
    }
};

const Filler = struct {
    buf: []u8,
    i: usize = 0,
    fn put(self: *Filler, s: []const u8) error{}!void {
        @memcpy(self.buf[self.i..][0..s.len], s);
        self.i += s.len;
    }
};

const WriterSink = struct {
    w: *std.Io.Writer,
    fn put(self: *WriterSink, s: []const u8) std.Io.Writer.Error!void {
        return self.w.writeAll(s);
    }
};

/// Compare strings in UTF-16 code unit order, the order of JavaScript's default sort. Falls
/// back to byte order for invalid UTF-8.
pub fn utf16Order(a: []const u8, b: []const u8) std.math.Order {
    var i: usize = 0;
    var j: usize = 0;
    while (i < a.len and j < b.len) {
        const la = std.unicode.utf8ByteSequenceLength(a[i]) catch return std.mem.order(u8, a[i..], b[j..]);
        const lb = std.unicode.utf8ByteSequenceLength(b[j]) catch return std.mem.order(u8, a[i..], b[j..]);
        if (i + la > a.len or j + lb > b.len) return std.mem.order(u8, a[i..], b[j..]);
        const ca = std.unicode.utf8Decode(a[i..][0..la]) catch return std.mem.order(u8, a[i..], b[j..]);
        const cb = std.unicode.utf8Decode(b[j..][0..lb]) catch return std.mem.order(u8, a[i..], b[j..]);
        const o = std.math.order(utf16Weight(ca), utf16Weight(cb));
        if (o != .eq) return o;
        i += la;
        j += lb;
    }
    return std.math.order(a.len - i, b.len - j);
}

/// Code points weighted so supplementary ones (surrogate pairs) sort between U+D7FF and U+E000.
fn utf16Weight(c: u21) u32 {
    if (c < 0xd800) return c;
    if (c >= 0x10000) return @as(u32, c) - 0x10000 + 0xd800;
    return @as(u32, c) + 0x100000;
}

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

/// Construct a language tag (`languageTag`). Core subtags are canonicalized (case, and the
/// undefined values 'und' / 'root' / 'Zzzz' / 'ZZ' / '' are treated as not set). The other
/// fields are copied as given. Case folding is ASCII only.
fn initImpl(gpa: Allocator, fields: Fields) Allocator.Error!LanguageTag {
    var f = fields;
    f.language = block.canonical(.language, f.language);
    f.script = block.canonical(.script, f.script);
    f.region = block.canonical(.region, f.region);
    f.variant = block.canonical(.variant, f.variant);
    return build(gpa, f, true);
}

/// Copy the fields into one allocation, putting the core subtags in canonical case if `case`.
fn build(gpa: Allocator, f: Fields, case: bool) Allocator.Error!LanguageTag {
    var layout: block.Layout = .{ .exts = f.extensions.len, .strs = f.extlangs.len };
    for ([_]?[]const u8{ f.language, f.script, f.region, f.variant }) |v| {
        if (v) |s| layout.bytes += s.len;
    }
    for (f.extensions) |e| {
        layout.bytes += e.key.len;
        layout.strs += e.subtags.len;
        for (e.subtags) |s| layout.bytes += s.len;
    }
    for (f.extlangs) |s| layout.bytes += s.len;
    layout.bytes += f.private_use.len;

    const buf = try block.alloc(gpa, layout);
    var c = block.Carver.init(buf, layout);
    const exts = c.exts(f.extensions.len);
    for (f.extensions, exts) |src, *dst| {
        const subs = c.strs(src.subtags.len);
        for (src.subtags, subs) |s, *d| d.* = c.copy(s);
        dst.* = .{ .key = c.copy(src.key), .subtags = subs };
    }
    const extlangs = c.strs(f.extlangs.len);
    for (f.extlangs, extlangs) |s, *d| d.* = c.copy(s);
    return .{
        .language = c.copyField(.language, f.language, case),
        .script = c.copyField(.script, f.script, case),
        .region = c.copyField(.region, f.region, case),
        .variant = c.copyField(.variant, f.variant, case),
        .extensions = exts,
        .private_use = c.copy(f.private_use),
        .extlangs = extlangs,
        .owned = buf,
    };
}

test "construct and render" {
    const gpa = std.testing.allocator;
    const t = try LanguageTag.init(gpa, .{
        .language = "EN",
        .script = "latn",
        .region = "us",
        .variant = "VARIANT",
        .extensions = &.{.{ .key = "u", .subtags = &.{ "nu-latn", "ca-gregory" } }},
        .private_use = "x-private",
    });
    defer t.deinit(gpa);
    const s = try t.expanded(gpa);
    defer gpa.free(s);
    try std.testing.expectEqualStrings("en-Latn-US-variant-u-nu-latn-ca-gregory-x-private", s);
    try std.testing.expectEqualStrings("ca-gregory", t.extensionSubtags("u")[1]);

    const und: LanguageTag = .{};
    const e = try und.expanded(gpa);
    defer gpa.free(e);
    try std.testing.expectEqualStrings("und-Zzzz-ZZ", e);
}

test "utf16 order" {
    try std.testing.expectEqual(std.math.Order.lt, utf16Order("a", "b"));
    try std.testing.expectEqual(std.math.Order.lt, utf16Order("a", "ab"));
    // U+10000 is a surrogate pair, which sorts before U+FFFD.
    try std.testing.expectEqual(std.math.Order.lt, utf16Order("\u{10000}", "\u{fffd}"));
    try std.testing.expectEqual(std.math.Order.gt, utf16Order("\u{10000}", "\u{d7ff}"));
}
