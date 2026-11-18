//! Formatters that collect the characters of a formatted decimal.
//! Port of `packages/hereabouts/src/decimal/format.ts`.
//!
//! A formatter is any value with `add(self, s: []const u8) !void`. Digits arrive from least- to
//! most-significant, so `render` reverses them. Formatters keep the slices they are given, so
//! those must outlive the formatter (separators and digit strings usually do).

const std = @import("std");
const Allocator = std.mem.Allocator;

/// A single part of a multi-part value, e.g. `{ .type = "integer", .value = "123" }`.
pub const Part = struct {
    type: []const u8,
    value: []const u8,
};

/// Free parts returned by functions in this package (their values are owned).
pub fn freeParts(gpa: Allocator, parts: []const Part) void {
    for (parts) |p| {
        gpa.free(p.value);
    }
    gpa.free(parts);
}

/// Join slices in reverse order.
fn joinReversed(gpa: Allocator, pieces: []const []const u8) Allocator.Error![]u8 {
    var len: usize = 0;
    for (pieces) |p| {
        len += p.len;
    }
    const out = try gpa.alloc(u8, len);
    var i: usize = 0;
    var j: usize = pieces.len;
    while (j > 0) {
        j -= 1;
        @memcpy(out[i .. i + pieces[j].len], pieces[j]);
        i += pieces[j].len;
    }
    return out;
}

/// Formatter that renders a decimal into a string.
pub const StringFormatter = struct {
    allocator: Allocator,
    pieces: std.ArrayList([]const u8) = .empty,

    pub fn init(allocator: Allocator) StringFormatter {
        return .{ .allocator = allocator };
    }

    pub fn deinit(self: *StringFormatter) void {
        self.pieces.deinit(self.allocator);
    }

    pub fn add(self: *StringFormatter, c: []const u8) Allocator.Error!void {
        try self.pieces.append(self.allocator, c);
    }

    /// The formatted string, owned by `gpa`.
    pub fn render(self: *StringFormatter, gpa: Allocator) Allocator.Error![]u8 {
        return joinReversed(gpa, self.pieces.items);
    }
};

/// Formatter that renders a decimal into parts: integer, group, decimal and fraction.
pub const PartsFormatter = struct {
    allocator: Allocator,
    decimal: []const u8,
    group: []const u8,
    /// Parts in reverse order, values owned by `allocator`.
    parts: std.ArrayList(Part) = .empty,
    curr: std.ArrayList([]const u8) = .empty,

    pub fn init(allocator: Allocator, decimal: []const u8, group: []const u8) PartsFormatter {
        return .{ .allocator = allocator, .decimal = decimal, .group = group };
    }

    pub fn deinit(self: *PartsFormatter) void {
        for (self.parts.items) |p| {
            self.allocator.free(p.value);
        }
        self.parts.deinit(self.allocator);
        self.curr.deinit(self.allocator);
    }

    fn push(self: *PartsFormatter, t: []const u8, value: []const u8) Allocator.Error!void {
        const v = try self.allocator.dupe(u8, value);
        errdefer self.allocator.free(v);
        try self.parts.append(self.allocator, .{ .type = t, .value = v });
    }

    fn pushCurrent(self: *PartsFormatter, t: []const u8) Allocator.Error!void {
        const v = try joinReversed(self.allocator, self.curr.items);
        errdefer self.allocator.free(v);
        try self.parts.append(self.allocator, .{ .type = t, .value = v });
        self.curr.clearRetainingCapacity();
    }

    pub fn add(self: *PartsFormatter, c: []const u8) Allocator.Error!void {
        if (std.mem.eql(u8, c, self.decimal)) {
            try self.pushCurrent("fraction");
            try self.push("decimal", c);
        } else if (std.mem.eql(u8, c, self.group)) {
            try self.pushCurrent("integer");
            try self.push("group", c);
        } else {
            try self.curr.append(self.allocator, c);
        }
    }

    /// The parts, owned by `gpa`; free with `freeParts`. Leaves the formatter empty.
    pub fn render(self: *PartsFormatter, gpa: Allocator) Allocator.Error![]Part {
        if (self.curr.items.len > 0) {
            try self.pushCurrent("integer");
        }
        const n = self.parts.items.len;
        const out = try gpa.alloc(Part, n);
        var done: usize = 0;
        errdefer {
            for (out[0..done]) |p| gpa.free(p.value);
            gpa.free(out);
        }
        for (0..n) |i| {
            const p = self.parts.items[n - 1 - i];
            out[i] = .{ .type = p.type, .value = try gpa.dupe(u8, p.value) };
            done += 1;
        }
        return out;
    }
};
