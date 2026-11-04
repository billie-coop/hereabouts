//! Matches message syntax fragments. Port of
//! `packages/hereabouts/src/messageformat/parser/matcher.ts`.
//!
//! The TypeScript compiles regular expressions; here each pattern is a small hand-written
//! scanner with the same behavior. Positions are byte offsets into UTF-8 text (the TypeScript
//! counts UTF-16 code units).

const std = @import("std");
const Allocator = std.mem.Allocator;
const js = @import("js.zig");
const Argument = @import("types.zig").Argument;

/// A string and range of characters [s, e) (from 's' up to but not including 'e'),
/// representing the current state of the parse of a given scope inside a message string.
pub const MessageState = struct {
    t: []const u8,
    s: usize,
    e: usize,
};

// This library supports these operations by default.
const BUILTINS = [_][]const u8{ "plural", "select", "selectordinal" };

/// Matches message syntax fragments at the start of a range. Each method that matches moves
/// the start of the range `r` past the match.
///
/// A sticky matcher (the TypeScript default) may match past the end of the range, as a sticky
/// regexp reads the whole string; a substring matcher matches only inside [s, e). The parser
/// can't tell them apart.
///
/// Formatter names are matched as literal text. (The TypeScript joins them into a regexp
/// unescaped, so names with regexp syntax such as `.` or `(` behave differently there.)
pub const MessageMatcher = struct {
    /// Builtin and formatter names, longest first so prefixes are matched last. The names
    /// are borrowed from the caller.
    names: []const []const u8,
    sticky: bool,

    pub fn deinit(self: MessageMatcher, gpa: Allocator) void {
        gpa.free(self.names);
    }

    /// The end of the text a pattern may look at, and where it starts. A substring match
    /// reads `t.substring(s, e)`, which swaps its ends if s > e.
    fn window(self: MessageMatcher, r: *const MessageState) struct { usize, usize } {
        if (self.sticky) return .{ @min(r.s, r.t.len), r.t.len };
        const lo = @min(@min(r.s, r.e), r.t.len);
        const hi = @min(@max(r.s, r.e), r.t.len);
        return .{ lo, hi };
    }

    /// Run a scanner: on a match, advance r.s by its length and return the matched text.
    fn match(self: MessageMatcher, r: *MessageState, comptime scan: fn (MessageMatcher, []const u8, usize, usize) ?usize) ?[]const u8 {
        const lo, const hi = self.window(r);
        if (self.sticky and r.s > r.t.len) return null;
        const end = scan(self, r.t, lo, hi) orelse return null;
        const m = r.t[lo..end];
        r.s += m.len;
        return m;
    }

    /// The next character (code point), or null at the end of the text. (The TypeScript
    /// gives a UTF-16 code unit.)
    pub fn char(_: MessageMatcher, r: *const MessageState) ?u21 {
        if (r.s >= r.t.len) return null;
        return js.decode(r.t, r.s).cp;
    }

    /// Indicate if we've reached the end of input.
    pub fn complete(_: MessageMatcher, r: *const MessageState) bool {
        return r.e == r.s;
    }

    /// Match one or more spaces (or commas).
    pub fn spaces(self: MessageMatcher, r: *MessageState) bool {
        return self.match(r, scanSpaces) != null;
    }

    /// Match a list of arguments separated by semicolons: `0`, `a;b;c`. Null if there are
    /// none. The caller owns the list; names point into `r.t`.
    pub fn arguments(self: MessageMatcher, gpa: Allocator, r: *MessageState) Allocator.Error!?[]Argument {
        var args: std.ArrayList(Argument) = .empty;
        errdefer args.deinit(gpa);
        var any = false;
        while (true) {
            const a = self.match(r, scanArg) orelse break;
            const n = js.parseInt(a);
            any = true;
            try args.append(gpa, if (std.math.isFinite(n)) .{ .number = n } else .{ .name = a });

            // Tuple arguments are separated by a single semicolon
            if (r.s >= r.t.len or r.t[r.s] != ';') break;
            r.s += 1;
            if (self.complete(r)) break;
        }
        if (!any) return null;
        return try args.toOwnedSlice(gpa);
    }

    /// Match variable identifier.
    pub fn identifier(self: MessageMatcher, r: *MessageState) ?[]const u8 {
        return self.match(r, scanIdent);
    }

    /// Match a list of options. The caller owns the list; options point into `r.t`.
    pub fn options(self: MessageMatcher, gpa: Allocator, r: *MessageState) Allocator.Error![][]const u8 {
        var out: std.ArrayList([]const u8) = .empty;
        errdefer out.deinit(gpa);
        while (true) {
            _ = self.spaces(r);
            const opt = self.match(r, scanOption) orelse break;
            try out.append(gpa, opt);
            if (self.complete(r)) break;
        }
        return out.toOwnedSlice(gpa);
    }

    /// Match a formatter name.
    pub fn formatter(self: MessageMatcher, r: *MessageState) ?[]const u8 {
        return self.match(r, scanFormatter);
    }

    /// Match a plural offset, `offset:3`. 0 if there is none.
    pub fn pluralOffset(self: MessageMatcher, r: *MessageState) f64 {
        const m = self.match(r, scanOffset) orelse return 0;
        // This must parse successfully since it is constrained by the match
        return js.parseInt(m["offset:".len..]);
    }

    /// Match a plural choice (exact `=1` or category `one`).
    pub fn pluralChoice(self: MessageMatcher, r: *MessageState) ?[]const u8 {
        return self.match(r, scanChoice);
    }
};

/// Build a matcher for the builtin formatters plus `formatters` (names are borrowed). The
/// TypeScript picks a sticky matcher when the runtime supports sticky regexps, which all
/// current ones do.
pub fn buildMessageMatcher(gpa: Allocator, formatters: []const []const u8, sticky: bool) Allocator.Error!MessageMatcher {
    const names = try gpa.alloc([]const u8, BUILTINS.len + formatters.len);
    @memcpy(names[0..BUILTINS.len], &BUILTINS);
    @memcpy(names[BUILTINS.len..], formatters);
    // Sort keys by length descending to ensure prefixes are matched last
    const Ctx = struct {
        fn longer(_: void, a: []const u8, b: []const u8) bool {
            return a.len > b.len;
        }
    };
    std.sort.insertion([]const u8, names, {}, Ctx.longer);
    return .{ .names = names, .sticky = sticky };
}

// Scanners: given the text, a start and an end, return the end of the match or null.

fn scanWhile(t: []const u8, i: usize, hi: usize, comptime pred: fn (u21) bool) ?usize {
    var j = i;
    while (j < hi) {
        const c = js.decode(t, j);
        if (j + c.len > hi or !pred(c.cp)) break;
        j += c.len;
    }
    return if (j > i) j else null;
}

fn isSpaceOrComma(cp: u21) bool {
    return cp == ',' or js.isSpace(cp);
}

fn isOption(cp: u21) bool {
    return !(js.isSpace(cp) or cp == ',' or cp == '{' or cp == '}');
}

fn scanSpaces(_: MessageMatcher, t: []const u8, i: usize, hi: usize) ?usize {
    return scanWhile(t, i, hi, isSpaceOrComma);
}

fn scanIdent(_: MessageMatcher, t: []const u8, i: usize, hi: usize) ?usize {
    return scanWhile(t, i, hi, js.isIdentifier);
}

fn scanOption(_: MessageMatcher, t: []const u8, i: usize, hi: usize) ?usize {
    return scanWhile(t, i, hi, isOption);
}

fn scanDigits(t: []const u8, i: usize, hi: usize) ?usize {
    var j = i;
    while (j < hi and std.ascii.isDigit(t[j])) j += 1;
    return if (j > i) j else null;
}

// (0[1..9]+|\d+|IDENTIFIER): note `[1..9]` is the set of '1', '.' and '9'.
fn scanArg(m: MessageMatcher, t: []const u8, i: usize, hi: usize) ?usize {
    if (i < hi and t[i] == '0') {
        var j = i + 1;
        while (j < hi and (t[j] == '1' or t[j] == '.' or t[j] == '9')) j += 1;
        if (j > i + 1) return j;
    }
    if (scanDigits(t, i, hi)) |j| return j;
    return scanIdent(m, t, i, hi);
}

fn scanFormatter(m: MessageMatcher, t: []const u8, i: usize, hi: usize) ?usize {
    for (m.names) |name| {
        if (name.len > 0 and i + name.len <= hi and std.mem.eql(u8, t[i .. i + name.len], name)) return i + name.len;
    }
    return null;
}

// offset:-?\d+
fn scanOffset(_: MessageMatcher, t: []const u8, i: usize, hi: usize) ?usize {
    const prefix = "offset:";
    if (i + prefix.len > hi or !std.mem.eql(u8, t[i .. i + prefix.len], prefix)) return null;
    var j = i + prefix.len;
    if (j < hi and t[j] == '-') j += 1;
    return scanDigits(t, j, hi);
}

// (=\d+(\.\d+)?)|zero|one|two|few|many|other
fn scanChoice(_: MessageMatcher, t: []const u8, i: usize, hi: usize) ?usize {
    if (i < hi and t[i] == '=') {
        if (scanDigits(t, i + 1, hi)) |j| {
            if (j < hi and t[j] == '.') {
                if (scanDigits(t, j + 1, hi)) |k| return k;
            }
            return j;
        }
    }
    for ([_][]const u8{ "zero", "one", "two", "few", "many", "other" }) |w| {
        if (i + w.len <= hi and std.mem.eql(u8, t[i .. i + w.len], w)) return i + w.len;
    }
    return null;
}

test "matcher" {
    const gpa = std.testing.allocator;
    const m = try buildMessageMatcher(gpa, &.{"foo"}, true);
    defer m.deinit(gpa);
    var r: MessageState = .{ .t = "abc foo", .s = 0, .e = 7 };
    const args = (try m.arguments(gpa, &r)).?;
    defer gpa.free(args);
    try std.testing.expectEqualStrings("abc", args[0].name);
    try std.testing.expect(m.spaces(&r));
    try std.testing.expectEqualStrings("foo", m.formatter(&r).?);
    try std.testing.expect(m.complete(&r));
}
