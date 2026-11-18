//! Number patterns like "#,##0.00;(#,##0.00)" (`parsing/number.ts`).

const std = @import("std");
const Allocator = std.mem.Allocator;

pub const NumberField = enum(u8) {
    minus = 0,
    percent = 1,
    currency = 2,
    number = 3,
    exponent = 4,
    plus = 5,
};

/// Literal text, or a field.
pub const NumberNode = union(enum) {
    text: []const u8,
    field: NumberField,
};

/// A parsed number pattern.
pub const NumberPattern = struct {
    nodes: []const NumberNode,
    min_int: i64 = 0,
    max_frac: i64 = 0,
    min_frac: i64 = 0,
    pri_group: i64 = 0,
    sec_group: i64 = 0,
};

const Builder = struct {
    nodes: std.ArrayList(NumberNode) = .empty,
    min_int: i64 = 0,
    max_frac: i64 = 0,
    min_frac: i64 = 0,
    pri_group: i64 = 0,
    sec_group: i64 = 0,

    fn finish(self: *Builder, a: Allocator) Allocator.Error!NumberPattern {
        return .{
            .nodes = try self.nodes.toOwnedSlice(a),
            .min_int = self.min_int,
            .max_frac = self.max_frac,
            .min_frac = self.min_frac,
            .pri_group = self.pri_group,
            .sec_group = self.sec_group,
        };
    }
};

/// Parse a number pattern into its positive and negative forms, allocating in `a` without
/// freeing (use an arena). Without a ';' the negative form is the positive one with a minus
/// node in front. (`parseNumberPattern`)
pub fn parseNumberPatternAlloc(a: Allocator, raw: []const u8) Allocator.Error![2]NumberPattern {
    var curr: Builder = .{};
    var save: ?Builder = null;
    var buf: std.ArrayList(u8) = .empty;
    var attached = false;
    var ingroup = false;
    var indecimal = false;

    const len = raw.len;
    var i: usize = 0;
    outer: while (i < len) {
        const ch = raw[i];
        switch (ch) {
            '\'' => {
                // `while (i++ < len) { ch = raw[i]; if (ch === "'") break; buf += ch; }`: an
                // unterminated quote reads one past the end, adding 'undefined'.
                while (true) {
                    const ok = i < len;
                    i += 1;
                    if (!ok) break;
                    if (i >= len) {
                        try buf.appendSlice(a, "undefined");
                        continue;
                    }
                    if (raw[i] == '\'') break;
                    try buf.append(a, raw[i]);
                }
            },
            ';' => {
                // If we encounter more than one pattern separator, bail out
                if (save != null) break :outer;
                try pushText(a, &curr, &buf);
                // Save current pattern and start parsing a new one
                save = curr;
                curr = .{};
                // Reset state for next parse
                indecimal = false;
                ingroup = false;
                attached = false;
            },
            '-' => try pushField(a, &curr, &buf, .minus),
            '%' => try pushField(a, &curr, &buf, .percent),
            'E' => try pushField(a, &curr, &buf, .exponent),
            '+' => try pushField(a, &curr, &buf, .plus),
            '#' => {
                try attach(a, &curr, &buf, &attached);
                if (ingroup) {
                    curr.pri_group += 1;
                } else if (indecimal) {
                    curr.max_frac += 1;
                }
            },
            ',' => {
                try attach(a, &curr, &buf, &attached);
                if (ingroup) {
                    curr.sec_group = curr.pri_group;
                    curr.pri_group = 0;
                } else {
                    ingroup = true;
                }
            },
            '.' => {
                ingroup = false;
                try attach(a, &curr, &buf, &attached);
                indecimal = true;
            },
            '0' => {
                try attach(a, &curr, &buf, &attached);
                if (ingroup) {
                    curr.pri_group += 1;
                } else if (indecimal) {
                    curr.max_frac += 1;
                    curr.min_frac += 1;
                }
                if (!indecimal) curr.min_int += 1;
            },
            else => {
                // U+00A4 CURRENCY SIGN
                if (ch == 0xc2 and i + 1 < len and raw[i + 1] == 0xa4) {
                    try pushField(a, &curr, &buf, .currency);
                    i += 1;
                } else {
                    try buf.append(a, ch);
                }
            },
        }
        i += 1;
    }
    try pushText(a, &curr, &buf);
    if (save) |*s| {
        return .{ try s.finish(a), try curr.finish(a) };
    }
    // Derive negative from positive by prepending a minus node
    const pos = try curr.finish(a);
    const neg_nodes = try a.alloc(NumberNode, pos.nodes.len + 1);
    neg_nodes[0] = .{ .field = .minus };
    @memcpy(neg_nodes[1..], pos.nodes);
    var neg = pos;
    neg.nodes = neg_nodes;
    return .{ pos, neg };
}

fn pushText(a: Allocator, curr: *Builder, buf: *std.ArrayList(u8)) Allocator.Error!void {
    if (buf.items.len > 0) {
        try curr.nodes.append(a, .{ .text = try buf.toOwnedSlice(a) });
    }
}

fn pushField(a: Allocator, curr: *Builder, buf: *std.ArrayList(u8), f: NumberField) Allocator.Error!void {
    try pushText(a, curr, buf);
    try curr.nodes.append(a, .{ .field = f });
}

fn attach(a: Allocator, curr: *Builder, buf: *std.ArrayList(u8), attached: *bool) Allocator.Error!void {
    try pushText(a, curr, buf);
    if (!attached.*) {
        try curr.nodes.append(a, .{ .field = .number });
        attached.* = true;
    }
}

/// Positive and negative patterns that own their memory.
pub const ParsedNumberPattern = struct {
    arena: std.heap.ArenaAllocator,
    positive: NumberPattern,
    negative: NumberPattern,

    pub fn deinit(self: ParsedNumberPattern) void {
        self.arena.deinit();
    }
};

/// Parse a number pattern into its positive and negative forms. Free with `deinit`.
pub fn parseNumberPattern(gpa: Allocator, raw: []const u8) Allocator.Error!ParsedNumberPattern {
    var arena: std.heap.ArenaAllocator = .init(gpa);
    errdefer arena.deinit();
    const p = try parseNumberPatternAlloc(arena.allocator(), raw);
    return .{ .arena = arena, .positive = p[0], .negative = p[1] };
}

test "number pattern" {
    const p = try parseNumberPattern(std.testing.allocator, "#,##,##0.###");
    defer p.deinit();
    try std.testing.expectEqual(@as(i64, 3), p.positive.pri_group);
    try std.testing.expectEqual(@as(i64, 2), p.positive.sec_group);
    try std.testing.expectEqual(@as(i64, 3), p.positive.max_frac);
    try std.testing.expectEqual(NumberField.minus, p.negative.nodes[0].field);
}
