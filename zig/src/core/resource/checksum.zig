//! Checksum of the schema's key indices (`resource/checksum.ts`, `utils/fnv.ts`).

const std = @import("std");
const Allocator = std.mem.Allocator;
const KeyIndex = @import("../schema/instructions.zig").KeyIndex;
const utf16Order = @import("../../language_tag/language_tag.zig").utf16Order;

const FNV1A_BASIS: u32 = 0x811c9dc5;

/// Running FNV-1A checksum over the UTF-16 code units of strings, as the TypeScript computes it.
pub const Checksum = struct {
    v: u32 = FNV1A_BASIS,

    pub fn update(self: *Checksum, s: []const u8) void {
        var r = self.v;
        var it = std.unicode.Utf8View.initUnchecked(s).iterator();
        while (it.nextCodepoint()) |cp| {
            if (cp >= 0x10000) {
                const c = cp - 0x10000;
                r = step(r, @intCast(0xd800 + (c >> 10)));
                r = step(r, @intCast(0xdc00 + (c & 0x3ff)));
            } else {
                r = step(r, @intCast(cp));
            }
        }
        self.v = r;
    }

    fn step(r0: u32, c: u16) u32 {
        var r = r0 ^ c;
        r +%= (r << 1) +% (r << 4) +% (r << 7) +% (r << 8) +% (r << 24);
        return r;
    }
};

/// A named key index, as the schema origin lists them.
pub const NamedIndex = struct {
    name: []const u8,
    index: *const KeyIndex,
};

/// Compute a checksum on the key indices used to configure the schema. This lets us quickly
/// confirm that a resource pack was generated from the config used at runtime. Returns the
/// lowercase hex form, without padding. (`checksumIndices`)
pub fn checksumIndices(gpa: Allocator, version: []const u8, map: []const NamedIndex) Allocator.Error![]u8 {
    var c: Checksum = .{};
    // The checksum ignores the patch level of the version, so packs from any patch level work
    // together.
    var it = std.mem.splitScalar(u8, version, '.');
    var v: std.ArrayList(u8) = .empty;
    defer v.deinit(gpa);
    var n: usize = 0;
    while (it.next()) |part| : (n += 1) {
        if (n == 2) break;
        if (n > 0) try v.append(gpa, '.');
        try v.appendSlice(gpa, part);
    }
    c.update(v.items);

    // Visit map keys in sorted order
    const sorted = try gpa.dupe(NamedIndex, map);
    defer gpa.free(sorted);
    std.mem.sort(NamedIndex, sorted, {}, struct {
        fn lt(_: void, a: NamedIndex, b: NamedIndex) bool {
            return utf16Order(a.name, b.name) == .lt;
        }
    }.lt);
    for (sorted) |e| {
        c.update(e.name);
        // Mapped values must be visited in their existing order.
        for (e.index.keys) |key| c.update(key);
    }
    return std.fmt.allocPrint(gpa, "{x}", .{c.v});
}

test "fnv" {
    var c: Checksum = .{};
    c.update("abc");
    // FNV-1a 32 of "abc"
    try std.testing.expectEqual(@as(u32, 0x1a47e90b), c.v);
}
