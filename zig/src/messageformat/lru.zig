//! Least-recently-used cache with string keys. Port of `packages/hereabouts/src/utils/lru.ts`
//! and `cache.ts`, for the message formatter's parse cache.

const std = @import("std");
const Allocator = std.mem.Allocator;

/// A cache holding at most `capacity` values (none if 0), each built from its key on first
/// use. It owns copies of its keys and frees evicted values with `freeValue`.
pub fn LRU(comptime V: type, comptime freeValue: fn (V, Allocator) void) type {
    return struct {
        const Self = @This();

        const Node = struct {
            key: []u8,
            val: V,
            prev: *Node,
            next: *Node,
        };

        gpa: Allocator,
        storage: std.StringHashMapUnmanaged(*Node) = .empty,
        // Sentinel of the circular list, most-recently used first. Heap-allocated so the list
        // survives the struct being moved.
        root: *Node,
        capacity: usize,

        pub fn init(gpa: Allocator, capacity: usize) Allocator.Error!Self {
            const root = try gpa.create(Node);
            root.prev = root;
            root.next = root;
            return .{ .gpa = gpa, .root = root, .capacity = capacity };
        }

        pub fn deinit(self: *Self) void {
            var n = self.root.next;
            while (n != self.root) {
                const next = n.next;
                self.gpa.free(n.key);
                freeValue(n.val, self.gpa);
                self.gpa.destroy(n);
                n = next;
            }
            self.gpa.destroy(self.root);
            self.storage.deinit(self.gpa);
        }

        /// Number of entries in the cache.
        pub fn size(self: *const Self) usize {
            return self.storage.count();
        }

        /// Get a value, marking it most-recently used.
        pub fn get(self: *Self, key: []const u8) ?V {
            const n = self.storage.get(key) orelse return null;
            self.moveFront(n);
            return n.val;
        }

        /// Set a value, evicting the least-recently used entry when full. Takes ownership
        /// of `val`.
        pub fn set(self: *Self, key: []const u8, val: V) Allocator.Error!void {
            if (self.capacity == 0) {
                freeValue(val, self.gpa);
                return;
            }

            // Key already exists, so replace its value and bump it to the front. Size does
            // not change.
            if (self.storage.get(key)) |n| {
                freeValue(n.val, self.gpa);
                n.val = val;
                self.moveFront(n);
                return;
            }

            errdefer freeValue(val, self.gpa);
            const k = try self.gpa.dupe(u8, key);
            errdefer self.gpa.free(k);
            try self.storage.ensureUnusedCapacity(self.gpa, 1);

            // The lru is full, so reuse the oldest node to keep the total node allocation
            // stable.
            if (self.storage.count() == self.capacity) {
                const old = self.root.prev;
                _ = self.storage.remove(old.key);
                self.gpa.free(old.key);
                freeValue(old.val, self.gpa);
                old.key = k;
                old.val = val;
                self.storage.putAssumeCapacity(k, old);
                self.moveFront(old);
                return;
            }

            // The lru is not full, so allocate a new node.
            const n = try self.gpa.create(Node);
            n.* = .{ .key = k, .val = val, .prev = n, .next = n };
            self.storage.putAssumeCapacity(k, n);
            insert(n, self.root);
        }

        fn moveFront(self: *Self, n: *Node) void {
            n.prev.next = n.next;
            n.next.prev = n.prev;
            insert(n, self.root);
        }

        fn insert(e: *Node, at: *Node) void {
            const n = at.next;
            at.next = e;
            e.prev = at;
            e.next = n;
            n.prev = e;
        }
    };
}

fn freeNothing(_: u32, _: Allocator) void {}

test "lru" {
    var l = try LRU(u32, freeNothing).init(std.testing.allocator, 2);
    defer l.deinit();
    try l.set("a", 1);
    try l.set("b", 2);
    _ = l.get("a");
    try l.set("c", 3);
    try std.testing.expectEqual(@as(?u32, null), l.get("b"));
    try std.testing.expectEqual(@as(?u32, 1), l.get("a"));
    try std.testing.expectEqual(@as(usize, 2), l.size());
}
