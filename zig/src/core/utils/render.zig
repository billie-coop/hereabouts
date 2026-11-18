//! Accumulates a formatted value as parts (`utils/render.ts`).
//!
//! The TypeScript has a string builder and a parts builder behind one interface. The Zig port
//! always builds parts and joins them for the string form; the two give the same text. (The
//! TypeScript string builder's `length`, `get` and `insert` count characters where the parts
//! builder counts parts; the number renderer, the only user, gets the same result either way.)

const std = @import("std");
const Allocator = std.mem.Allocator;
const Part = @import("../../decimal/decimal.zig").Part;
const WrapperNode = @import("../parsing/wrapper.zig").WrapperNode;

/// A value being built. Part values are borrowed: they must outlive the builder (use an
/// arena). Copy the result out with `toString` or `toParts`.
pub const Value = struct {
    a: Allocator,
    parts: std.ArrayList(Part) = .empty,

    pub fn init(a: Allocator) Value {
        return .{ .a = a };
    }

    pub fn deinit(self: *Value) void {
        self.parts.deinit(self.a);
    }

    pub fn length(self: *const Value) usize {
        return self.parts.items.len;
    }

    /// Value of the i-th part, or ''.
    pub fn get(self: *const Value, i: usize) []const u8 {
        return if (i < self.parts.items.len) self.parts.items[i].value else "";
    }

    pub fn add(self: *Value, t: []const u8, value: []const u8) Allocator.Error!void {
        try self.parts.append(self.a, .{ .type = t, .value = value });
    }

    pub fn append(self: *Value, value: []const Part) Allocator.Error!void {
        try self.parts.appendSlice(self.a, value);
    }

    pub fn insert(self: *Value, i: usize, t: []const u8, value: []const u8) Allocator.Error!void {
        try self.parts.insert(self.a, i, .{ .type = t, .value = value });
    }

    /// The parts so far (borrowed), leaving the builder empty.
    pub fn render(self: *Value) Allocator.Error![]Part {
        return self.parts.toOwnedSlice(self.a);
    }

    pub fn reset(self: *Value) void {
        self.parts.clearRetainingCapacity();
    }

    /// Fill a parsed wrapper pattern: text nodes become 'literal' parts, argument nodes the
    /// argument's parts.
    pub fn wrap(self: *Value, pattern: []const WrapperNode, args: []const []const Part) Allocator.Error!void {
        for (pattern) |n| switch (n) {
            .text => |s| try self.add("literal", s),
            .arg => |i| if (i) |k| {
                if (k < args.len) try self.append(args[k]);
            },
        };
    }
};

/// Concatenate the values of parts, owned by `gpa`.
pub fn joinParts(gpa: Allocator, parts: []const Part) Allocator.Error![]u8 {
    var n: usize = 0;
    for (parts) |p| n += p.value.len;
    const out = try gpa.alloc(u8, n);
    var i: usize = 0;
    for (parts) |p| {
        @memcpy(out[i .. i + p.value.len], p.value);
        i += p.value.len;
    }
    return out;
}

/// Copy parts so that `gpa` owns them (free with `decimal.freeParts`). Types are static
/// strings and are not copied.
pub fn copyParts(gpa: Allocator, parts: []const Part) Allocator.Error![]Part {
    const out = try gpa.alloc(Part, parts.len);
    var done: usize = 0;
    errdefer {
        for (out[0..done]) |p| gpa.free(p.value);
        gpa.free(out);
    }
    for (parts, 0..) |p, i| {
        out[i] = .{ .type = p.type, .value = try gpa.dupe(u8, p.value) };
        done += 1;
    }
    return out;
}
