//! Emoji flags for regions, subdivisions and locales (`flags.ts`). Every flag is a static
//! string: nothing here allocates except the likely-region lookup in `localeFlag`.

const std = @import("std");
const Allocator = std.mem.Allocator;
const lt = @import("../language_tag/language_tag.zig");
const resolver = @import("resolver.zig");
const rgi = @import("autogen.flags.zig").rgi_regions;

// The subdivisions with an RGI flag: England, Scotland and Wales.
const rgi_subdivisions = " gbeng gbsct gbwls ";

fn encode(comptime c: u21) []const u8 {
    comptime {
        var buf: [4]u8 = undefined;
        const n = std.unicode.utf8Encode(c, &buf) catch unreachable;
        const out = buf[0..n].*;
        return &out;
    }
}

// Regional indicator A is U+1F1E6.
const region_flags = blk: {
    @setEvalBranchQuota(100000);
    var out: [rgi.len][8]u8 = undefined;
    for (rgi, 0..) |code, i| {
        out[i] = (encode(0x1f1e6 + @as(u21, code[0]) - 'A') ++ encode(0x1f1e6 + @as(u21, code[1]) - 'A'))[0..8].*;
    }
    break :blk out;
};

/// The codes the subdivision lookup can match: runs of the list above between two spaces.
/// Matching is a substring search, so 'gbeng gbsct' matches too.
const subdivision_codes = blk: {
    @setEvalBranchQuota(10000);
    var codes: []const []const u8 = &.{};
    const s = rgi_subdivisions;
    for (0..s.len) |i| {
        if (s[i] != ' ' or i + 1 >= s.len) continue;
        for (i + 1..s.len) |j| {
            if (s[j] == ' ' and j - (i + 1) >= 3) codes = codes ++ .{s[i + 1 .. j]};
        }
    }
    break :blk codes;
};

// The black flag U+1F3F4, then tag characters (U+E0000 plus ASCII), then the cancel tag U+E007F.
const subdivision_flags = blk: {
    @setEvalBranchQuota(100000);
    var flags: [subdivision_codes.len][]const u8 = undefined;
    for (subdivision_codes, 0..) |code, i| {
        var f: []const u8 = encode(0x1f3f4);
        for (code) |c| f = f ++ encode(0xe0000 + @as(u21, c));
        flags[i] = f ++ encode(0xe007f);
    }
    break :blk flags;
};

fn rgiIndex(code: [2]u8) ?usize {
    return std.sort.binarySearch(*const [2]u8, &rgi, code, struct {
        fn cmp(k: [2]u8, e: *const [2]u8) std.math.Order {
            return std.mem.order(u8, &k, e);
        }
    }.cmp);
}

/// JavaScript's `toUpperCase` of the input, if it's two ASCII characters. Besides ASCII,
/// only these characters uppercase to ASCII: 'ı' (I), 'ſ' (S), 'ß' (SS) and the Latin
/// ligatures U+FB00 to U+FB06.
fn upperCode(s: []const u8) ?[2]u8 {
    var out: [2]u8 = undefined;
    var n: usize = 0;
    var view = std.unicode.Utf8View.init(s) catch return null;
    var it = view.iterator();
    while (it.nextCodepoint()) |c| {
        const up: []const u8 = switch (c) {
            0...0x7f => &.{std.ascii.toUpper(@intCast(c))},
            0x131 => "I",
            0x17f => "S",
            0xdf => "SS",
            0xfb00 => "FF",
            0xfb01 => "FI",
            0xfb02 => "FL",
            0xfb03 => "FFI",
            0xfb04 => "FFL",
            0xfb05, 0xfb06 => "ST",
            else => return null,
        };
        if (n + up.len > 2) return null;
        @memcpy(out[n..][0..up.len], up);
        n += up.len;
    }
    return if (n == 2) out else null;
}

/// The emoji flag for a region code such as 'FR' or 'fr', or null when the region has no
/// flag: numeric areas like '419' (Latin America), unknown codes like 'ZZ', and anything
/// that isn't a region code.
pub fn regionFlag(region: []const u8) ?[]const u8 {
    const code = upperCode(region) orelse return null;
    const i = rgiIndex(code) orelse return null;
    return &region_flags[i];
}

/// The emoji flag for a CLDR subdivision code, as used in the `sd` locale extension: 'gbeng'
/// (England), 'gbsct' (Scotland) or 'gbwls' (Wales). Other subdivisions have no flag.
pub fn subdivisionFlag(subdivision: []const u8) ?[]const u8 {
    // Lowercasing never makes a non-ASCII character match: U+212A KELVIN SIGN becomes 'k',
    // which isn't in the list.
    var buf: [32]u8 = undefined;
    if (subdivision.len > buf.len) return null;
    for (subdivision, 0..) |c, i| {
        if (c >= 0x80) return null;
        buf[i] = std.ascii.toLower(c);
    }
    const code = buf[0..subdivision.len];
    for (subdivision_codes, 0..) |s, i| {
        if (std.mem.eql(u8, s, code)) return subdivision_flags[i];
    }
    return null;
}

/// The emoji flag for a locale: its subdivision flag if it has one (`en-GB-u-sd-gbsct`),
/// otherwise the flag of its region. A locale without a region uses its likely region, so
/// 'ja' gives 🇯🇵 and 'en' gives 🇺🇸; old region codes are replaced first ('en-UK' gives 🇬🇧).
/// Null when the region has no flag ('es-419', 'eo').
pub fn localeFlag(gpa: Allocator, locale: resolver.Input) Allocator.Error!?[]const u8 {
    var sfa = std.heap.stackFallback(1024, gpa);
    const tmp = sfa.get();
    const tag = switch (locale) {
        .id => |s| try lt.parseLanguageTag(tmp, s),
        .tag => |t| t,
    };
    defer if (locale == .id) tag.deinit(tmp);
    for (tag.extensionSubtags("u")) |u| {
        if (std.mem.startsWith(u8, u, "sd-")) {
            if (subdivisionFlag(u[3..])) |flag| return flag;
        }
    }
    const resolved = try resolver.resolveLanguageTag(tmp, .{ .tag = tag });
    defer resolved.deinit(tmp);
    const region = resolved.region orelse return null;
    return regionFlag(region);
}

/// The region code of an emoji flag: 'FR' for 🇫🇷. Null for anything else, including a flag
/// followed by other text.
pub fn flagRegion(flag: []const u8) ?[]const u8 {
    // Two regional indicators, U+1F1E6 to U+1F1FF: F0 9F 87 A6 to F0 9F 87 BF.
    if (flag.len != 8) return null;
    var code: [2]u8 = undefined;
    for (0..2) |i| {
        const c = flag[i * 4 ..][0..4];
        if (c[0] != 0xf0 or c[1] != 0x9f or c[2] != 0x87 or c[3] < 0xa6 or c[3] > 0xbf) return null;
        code[i] = 'A' + (c[3] - 0xa6);
    }
    const i = rgiIndex(code) orelse return null;
    return rgi[i];
}

test "flags" {
    try std.testing.expectEqualStrings("🇸🇨", regionFlag("SC").?);
    try std.testing.expectEqualStrings("🇫🇷", regionFlag("fr").?);
    try std.testing.expectEqualStrings("🇸🇸", regionFlag("ß").?);
    try std.testing.expect(regionFlag("419") == null);
    try std.testing.expectEqualStrings("🏴󠁧󠁢󠁳󠁣󠁴󠁿", subdivisionFlag("GBSCT").?);
    try std.testing.expect(subdivisionFlag("usca") == null);
    try std.testing.expectEqualStrings("CA", flagRegion("🇨🇦").?);
    try std.testing.expect(flagRegion("🇿🇿") == null);
    const gpa = std.testing.allocator;
    try std.testing.expectEqualStrings("🇯🇵", (try localeFlag(gpa, .{ .id = "ja" })).?);
    try std.testing.expectEqualStrings("🇬🇧", (try localeFlag(gpa, .{ .id = "en-UK" })).?);
}
