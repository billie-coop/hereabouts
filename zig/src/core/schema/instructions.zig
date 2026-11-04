//! Key indices of the schema (`schema/instructions.ts`).
//!
//! The TypeScript builds the schema at runtime from instructions (`scope`, `vector`, ...). The
//! Zig port gets the built tree from a generator (`scripts/zig/core-schema.ts`), so only the key
//! index is needed here.

const std = @import("std");

/// Keys of one schema dimension (currency ids, plural categories, ...) and their positions.
pub const KeyIndex = struct {
    keys: []const []const u8,
    /// Positions of `keys` in byte order of the keys, for binary search. A repeated key is
    /// listed once, at its last position (the TypeScript's object keeps the last).
    sorted: []const u16,

    pub fn size(self: *const KeyIndex) usize {
        return self.keys.len;
    }

    /// Index of a key, or null if not present (`keyIndexGet`, which returns -1).
    pub fn get(self: *const KeyIndex, key: []const u8) ?usize {
        var lo: usize = 0;
        var hi: usize = self.sorted.len;
        while (lo < hi) {
            const mid = (lo + hi) / 2;
            const i = self.sorted[mid];
            switch (std.mem.order(u8, self.keys[i], key)) {
                .lt => lo = mid + 1,
                .gt => hi = mid,
                .eq => return i,
            }
        }
        return null;
    }
};

/// Index of a key, or null if not present.
pub fn keyIndexGet(ki: *const KeyIndex, key: []const u8) ?usize {
    return ki.get(key);
}

test "key index" {
    const ki: KeyIndex = .{ .keys = &.{ "b", "a", "c", "a" }, .sorted = &.{ 3, 0, 2 } };
    try std.testing.expectEqual(@as(?usize, 3), ki.get("a"));
    try std.testing.expectEqual(@as(?usize, 0), ki.get("b"));
    try std.testing.expectEqual(@as(?usize, 2), ki.get("c"));
    try std.testing.expectEqual(@as(?usize, null), ki.get("d"));
}
