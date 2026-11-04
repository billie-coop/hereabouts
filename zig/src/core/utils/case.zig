//! Upper-casing the first character, as `value[0].toUpperCase() + value.slice(1)` does.

const std = @import("std");
const Allocator = std.mem.Allocator;
const autogen = @import("autogen.upper.zig");

/// What JavaScript's `toUpperCase()` makes of a BMP code point, or null if unchanged.
pub fn upperCodePoint(cp: u21) ?[]const u8 {
    if (cp > 0xffff) return null;
    var lo: usize = 0;
    var hi: usize = autogen.upper.len;
    while (lo < hi) {
        const mid = (lo + hi) / 2;
        const e = autogen.upper[mid];
        if (e.cp < cp) lo = mid + 1 else if (e.cp > cp) hi = mid else return e.upper;
    }
    return null;
}

/// Upper-case the first UTF-16 code unit of `value` (a character outside the BMP is left as
/// is, like the TypeScript). The result is owned by `gpa`.
pub fn titleFirst(gpa: Allocator, value: []const u8) Allocator.Error![]u8 {
    if (value.len == 0) return gpa.dupe(u8, value);
    const n = std.unicode.utf8ByteSequenceLength(value[0]) catch return gpa.dupe(u8, value);
    if (n > value.len) return gpa.dupe(u8, value);
    const cp = std.unicode.utf8Decode(value[0..n]) catch return gpa.dupe(u8, value);
    const up = upperCodePoint(cp) orelse return gpa.dupe(u8, value);
    return std.mem.concat(gpa, u8, &.{ up, value[n..] });
}

test "title first" {
    const gpa = std.testing.allocator;
    const s = try titleFirst(gpa, "ßa");
    defer gpa.free(s);
    try std.testing.expectEqualStrings("SSa", s);
    const t = try titleFirst(gpa, "доллар");
    defer gpa.free(t);
    try std.testing.expectEqualStrings("Доллар", t);
}
