//! String helpers that mirror JavaScript semantics.

const std = @import("std");

/// The first UTF-16 code unit of a code point.
fn firstUnit(cp: u21) u21 {
    return if (cp < 0x10000) cp else 0xD800 + ((cp - 0x10000) >> 10);
}

/// Order of JavaScript's default `Array.prototype.sort`: by UTF-16 code units. For UTF-8 this
/// is code point order, except that code points above U+FFFF sort before U+E000..U+FFFF.
/// Invalid UTF-8 falls back to byte order from the first bad byte.
pub fn lessUtf16(a: []const u8, b: []const u8) bool {
    var i: usize = 0;
    var j: usize = 0;
    while (i < a.len and j < b.len) {
        const la = std.unicode.utf8ByteSequenceLength(a[i]) catch return std.mem.lessThan(u8, a[i..], b[j..]);
        const lb = std.unicode.utf8ByteSequenceLength(b[j]) catch return std.mem.lessThan(u8, a[i..], b[j..]);
        if (i + la > a.len or j + lb > b.len) return std.mem.lessThan(u8, a[i..], b[j..]);
        const ca = std.unicode.utf8Decode(a[i .. i + la]) catch return std.mem.lessThan(u8, a[i..], b[j..]);
        const cb = std.unicode.utf8Decode(b[j .. j + lb]) catch return std.mem.lessThan(u8, a[i..], b[j..]);
        if (ca != cb) {
            const ua = firstUnit(ca);
            const ub = firstUnit(cb);
            return if (ua != ub) ua < ub else ca < cb;
        }
        i += la;
        j += lb;
    }
    return i == a.len and j < b.len;
}

fn lessThan(_: void, a: []const u8, b: []const u8) bool {
    return lessUtf16(a, b);
}

/// Sort strings in place, as JavaScript's default sort does.
pub fn sort(xs: [][]const u8) void {
    std.mem.sort([]const u8, xs, {}, lessThan);
}

/// The value of a JavaScript array-index key ("0", "17", ... up to 2^32 - 2), or null. Object
/// keys that are array indices are enumerated first, in numeric order.
pub fn arrayIndex(s: []const u8) ?u32 {
    if (s.len == 0 or s.len > 10) return null;
    if (s[0] == '0' and s.len > 1) return null;
    var v: u64 = 0;
    for (s) |c| {
        if (c < '0' or c > '9') return null;
        v = v * 10 + (c - '0');
    }
    return if (v <= 4294967294) @intCast(v) else null;
}

test "utf-16 order" {
    try std.testing.expect(lessUtf16("a", "b"));
    try std.testing.expect(lessUtf16("a", "ab"));
    try std.testing.expect(!lessUtf16("ab", "a"));
    try std.testing.expect(!lessUtf16("a", "a"));
    // U+1F600 is D83D DE00 in UTF-16, before U+FF5E
    try std.testing.expect(lessUtf16("\u{1F600}", "\u{FF5E}"));
    try std.testing.expect(lessUtf16("\u{FF5E}", "\u{10FFFF}") == false);
}

test "array index" {
    try std.testing.expectEqual(@as(?u32, 0), arrayIndex("0"));
    try std.testing.expectEqual(@as(?u32, 42), arrayIndex("42"));
    try std.testing.expectEqual(@as(?u32, null), arrayIndex("042"));
    try std.testing.expectEqual(@as(?u32, null), arrayIndex("-1"));
    try std.testing.expectEqual(@as(?u32, 4294967294), arrayIndex("4294967294"));
    try std.testing.expectEqual(@as(?u32, null), arrayIndex("4294967295"));
}
