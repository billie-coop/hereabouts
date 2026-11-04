//! Binary min-heap. Port of `packages/hereabouts/src/utils/heap.ts`.
//!
//! The sift order matches the TypeScript exactly, so items with equal keys come out in the
//! same order (the unit converter's path choice depends on it).

const std = @import("std");
const Allocator = std.mem.Allocator;

/// A min-heap of `T`; `cmp` returns -1, 0 or 1.
pub fn Heap(comptime T: type, comptime cmp: fn (T, T) i32) type {
    return struct {
        const Self = @This();

        items: std.ArrayList(T) = .empty,

        /// Build a heap from the given items (copied).
        pub fn init(gpa: Allocator, data: []const T) Allocator.Error!Self {
            var h: Self = .{};
            try h.items.appendSlice(gpa, data);
            var i: isize = parent(@as(isize, @intCast(data.len)) - 1);
            while (i >= 0) : (i -= 1) h.down(@intCast(i));
            return h;
        }

        pub fn deinit(self: *Self, gpa: Allocator) void {
            self.items.deinit(gpa);
        }

        pub fn empty(self: Self) bool {
            return self.items.items.len == 0;
        }

        pub fn push(self: *Self, gpa: Allocator, item: T) Allocator.Error!void {
            try self.items.append(gpa, item);
            self.up();
        }

        /// Remove and return the smallest item.
        pub fn pop(self: *Self) ?T {
            const items = &self.items;
            if (items.items.len <= 1) return items.pop();
            const r = items.items[0];
            items.items[0] = items.pop().?;
            self.down(0);
            return r;
        }

        fn parent(i: isize) isize {
            return (i - 1) >> 1;
        }

        fn down(self: *Self, start: usize) void {
            const items = self.items.items;
            const len = items.len;
            var i = start;
            while (true) {
                const lx = 2 * i + 1;
                if (lx >= len) break;
                const rx = 2 * i + 2;
                const sm = if (rx < len) (if (cmp(items[lx], items[rx]) == -1) lx else rx) else lx;
                if (cmp(items[sm], items[i]) >= 0) break;
                std.mem.swap(T, &items[sm], &items[i]);
                i = sm;
            }
        }

        fn up(self: *Self) void {
            const items = self.items.items;
            var i = items.len - 1;
            while (i > 0) {
                const px = (i - 1) >> 1;
                if (cmp(items[i], items[px]) != -1) break;
                std.mem.swap(T, &items[i], &items[px]);
                i = px;
            }
        }
    };
}

fn cmpInt(a: i64, b: i64) i32 {
    return if (a < b) -1 else if (a > b) 1 else 0;
}

test "heap pops in order" {
    const gpa = std.testing.allocator;
    var h = try Heap(i64, cmpInt).init(gpa, &.{ 5, 3, 9, 1 });
    defer h.deinit(gpa);
    for ([_]i64{ 7, 2, 8 }) |x| try h.push(gpa, x);
    var prev: i64 = -1;
    var n: usize = 0;
    while (h.pop()) |x| : (n += 1) {
        try std.testing.expect(x >= prev);
        prev = x;
    }
    try std.testing.expectEqual(@as(usize, 7), n);
    try std.testing.expect(h.empty());
}
