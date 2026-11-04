//! Wrapper patterns like "{1} at {0}" (`parsing/wrapper.ts`).

const std = @import("std");
const Allocator = std.mem.Allocator;

/// Literal text, or an argument index. The TypeScript reads each character inside braces with
/// `Number(ch)`: a digit is its value, whitespace is 0 and anything else is NaN (null here),
/// which fills nothing.
pub const WrapperNode = union(enum) {
    text: []const u8,
    arg: ?u8,
};

pub fn isJsSpace(cp: u21) bool {
    return switch (cp) {
        '\t', '\n', 0x0b, 0x0c, '\r', ' ', 0xa0, 0x1680, 0x2000...0x200a, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff => true,
        else => false,
    };
}

/// Parse a generic wrapper pattern, allocating in `a` without freeing (use an arena).
/// Quote characters are dropped. (`parseWrapperPattern`)
pub fn parseWrapperPatternAlloc(a: Allocator, raw: []const u8) Allocator.Error![]WrapperNode {
    var nodes: std.ArrayList(WrapperNode) = .empty;
    var buf: std.ArrayList(u8) = .empty;
    var intag = false;
    var i: usize = 0;
    while (i < raw.len) {
        const n = std.unicode.utf8ByteSequenceLength(raw[i]) catch 1;
        const end = @min(raw.len, i + n);
        const ch = raw[i..end];
        switch (raw[i]) {
            '{' => {
                if (buf.items.len > 0) {
                    try nodes.append(a, .{ .text = try buf.toOwnedSlice(a) });
                }
                intag = true;
            },
            '}' => intag = false,
            '\'' => {},
            else => {
                if (intag) {
                    // Index doesn't exceed single digits.
                    const cp = std.unicode.utf8Decode(ch) catch 0xfffd;
                    const v: ?u8 = if (cp >= '0' and cp <= '9') @intCast(cp - '0') else if (isJsSpace(cp)) 0 else null;
                    try nodes.append(a, .{ .arg = v });
                } else {
                    try buf.appendSlice(a, ch);
                }
            },
        }
        i = end;
    }
    if (buf.items.len > 0) {
        try nodes.append(a, .{ .text = try buf.toOwnedSlice(a) });
    }
    return nodes.toOwnedSlice(a);
}

/// A parsed wrapper pattern that owns its memory.
pub const WrapperPattern = struct {
    arena: std.heap.ArenaAllocator,
    nodes: []const WrapperNode,

    pub fn deinit(self: WrapperPattern) void {
        self.arena.deinit();
    }
};

/// Parse a generic wrapper pattern. Free with `deinit`. (`parseWrapperPattern`)
pub fn parseWrapperPattern(gpa: Allocator, raw: []const u8) Allocator.Error!WrapperPattern {
    var arena: std.heap.ArenaAllocator = .init(gpa);
    errdefer arena.deinit();
    const nodes = try parseWrapperPatternAlloc(arena.allocator(), raw);
    return .{ .arena = arena, .nodes = nodes };
}

test "wrapper" {
    const w = try parseWrapperPattern(std.testing.allocator, "{1} at '{0}'");
    defer w.deinit();
    try std.testing.expectEqual(@as(usize, 3), w.nodes.len);
    try std.testing.expectEqual(@as(?u8, 1), w.nodes[0].arg);
    try std.testing.expectEqualStrings(" at ", w.nodes[1].text);
}
