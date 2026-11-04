//! Date pattern parsing. Literal strings and field nodes are owned by the caller.
const std = @import("std");
const A = std.mem.Allocator;
pub const DateTimeField = struct { char: u8, width: usize };
pub const DateTimeNode = union(enum) { text: []const u8, field: DateTimeField };
pub const DATE_PATTERN_CHARS = "GyYuUrQqMLlwWdDFgEecabBhHKkjJCmsSAzZOvVXx";
pub fn patternChar(ch: u8) bool {
    return std.mem.indexOfScalar(u8, DATE_PATTERN_CHARS, ch) != null;
}

pub fn parseDatePattern(gpa: A, raw: []const u8) A.Error![]DateTimeNode {
    var nodes: std.ArrayList(DateTimeNode) = .empty;
    errdefer {
        for (nodes.items) |n| if (n == .text) {
            gpa.free(n.text);
        };
        nodes.deinit(gpa);
    }
    if (raw.len == 0) return nodes.toOwnedSlice(gpa);
    var buf: std.ArrayList(u8) = .empty;
    defer buf.deinit(gpa);
    var field: u8 = 0;
    var width: usize = 0;
    var quote = false;
    var i: usize = 0;
    while (i < raw.len) : (i += 1) {
        const ch = raw[i];
        if (quote) {
            if (ch == '\'') {
                if (i + 1 < raw.len and raw[i + 1] == '\'') {
                    try buf.append(gpa, '\'');
                    i += 1;
                } else {
                    quote = false;
                    field = 0;
                }
            } else try buf.append(gpa, ch);
            continue;
        }
        if (patternChar(ch)) {
            if (buf.items.len > 0) {
                try nodes.ensureUnusedCapacity(gpa, 1);
                nodes.appendAssumeCapacity(.{ .text = try buf.toOwnedSlice(gpa) });
            }
            if (ch != field) {
                if (field != 0) try nodes.append(gpa, .{ .field = .{ .char = field, .width = width } });
                field = ch;
                width = 1;
            } else width += 1;
        } else {
            if (field != 0) try nodes.append(gpa, .{ .field = .{ .char = field, .width = width } });
            field = 0;
            if (ch == '\'') {
                if (i + 1 < raw.len and raw[i + 1] == '\'') {
                    try buf.append(gpa, '\'');
                    i += 1;
                } else quote = true;
            } else try buf.append(gpa, ch);
        }
    }
    if (width > 0 and field != 0) {
        try nodes.append(gpa, .{ .field = .{ .char = field, .width = width } });
    } else {
        try nodes.ensureUnusedCapacity(gpa, 1);
        nodes.appendAssumeCapacity(.{ .text = try buf.toOwnedSlice(gpa) });
    }
    return nodes.toOwnedSlice(gpa);
}
pub fn freePattern(gpa: A, nodes: []const DateTimeNode) void {
    for (nodes) |n| if (n == .text) {
        gpa.free(n.text);
    };
    gpa.free(nodes);
}
pub fn intervalPatternBoundary(nodes: []const DateTimeNode) ?usize {
    var seen: u64 = 0;
    for (nodes, 0..) |n, i| if (n == .field) {
        const idx = std.mem.indexOfScalar(u8, DATE_PATTERN_CHARS, n.field.char) orelse continue;
        const bit = @as(u64, 1) << @as(u6, @intCast(idx));
        if (seen & bit != 0) return i;
        seen |= bit;
    };
    return null;
}
