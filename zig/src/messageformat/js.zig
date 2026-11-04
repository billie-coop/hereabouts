//! The bits of JavaScript behavior the message format code depends on: number to string,
//! `parseInt`, the regexp character classes, `JSON.stringify` of strings, UTF-16 string
//! order, and the order of `Object.keys`.

const std = @import("std");
const Allocator = std.mem.Allocator;

/// A code point decoded at a byte offset, and its length in bytes. Invalid UTF-8 decodes as
/// U+FFFD, one byte long.
pub const CodePoint = struct { cp: u21, len: u3 };

pub fn decode(s: []const u8, i: usize) CodePoint {
    const n = std.unicode.utf8ByteSequenceLength(s[i]) catch return .{ .cp = 0xfffd, .len = 1 };
    if (i + n > s.len) return .{ .cp = 0xfffd, .len = 1 };
    const cp = std.unicode.utf8Decode(s[i .. i + n]) catch return .{ .cp = 0xfffd, .len = 1 };
    return .{ .cp = cp, .len = n };
}

/// JavaScript's `\s` (WhiteSpace and LineTerminator), which `parseInt` also skips.
pub fn isSpace(cp: u21) bool {
    return switch (cp) {
        0x09...0x0d, 0x20, 0xa0, 0x1680, 0x2000...0x200a, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff => true,
        else => false,
    };
}

/// Characters of an argument name or select choice: anything except ICU pattern syntax and
/// whitespace. JavaScript matches UTF-16 code units and no surrogate is excluded, so every
/// code point above U+FFFF counts.
pub fn isIdentifier(cp: u21) bool {
    return switch (cp) {
        0x09...0x0d, 0x20, 0x85, 0x200e, 0x200f, 0x2028, 0x2029, 0x21...0x2f, 0x3a...0x40, 0x5b...0x5e, 0x60, 0x7b...0x7e, 0xa1...0xa7, 0xa9, 0xab, 0xac, 0xae, 0xb0, 0xb1, 0xb6, 0xbb, 0xbf, 0xd7, 0xf7, 0x2010...0x2027, 0x2030...0x203e, 0x2041...0x2053, 0x2055...0x205e, 0x2190...0x245f, 0x2500...0x2775, 0x2794...0x2bff, 0x2e00...0x2e7f, 0x3001...0x3003, 0x3008...0x3020, 0x3030, 0xfd3e, 0xfd3f, 0xfe45, 0xfe46 => false,
        else => true,
    };
}

/// `parseInt(s, 10)`: leading whitespace, an optional sign, then ASCII digits. NaN if there
/// are no digits; very long numbers round like JavaScript's (possibly to Infinity).
pub fn parseInt(s: []const u8) f64 {
    var i: usize = 0;
    while (i < s.len) {
        const c = decode(s, i);
        if (!isSpace(c.cp)) break;
        i += c.len;
    }
    const start = i;
    if (i < s.len and (s[i] == '-' or s[i] == '+')) i += 1;
    const digits = i;
    while (i < s.len and std.ascii.isDigit(s[i])) i += 1;
    if (i == digits) return std.math.nan(f64);
    return std.fmt.parseFloat(f64, s[start..i]) catch unreachable;
}

/// Room for any `numberToString` result.
pub const NUMBER_BUF = 32;

/// `Number.prototype.toString()`: the shortest digits that round-trip, in plain notation
/// from 1e-7 up to 1e21 and scientific notation outside it ("1e+21", "1.5e-7").
pub fn numberToString(buf: *[NUMBER_BUF]u8, x: f64) []const u8 {
    if (std.math.isNan(x)) return "NaN";
    if (std.math.isInf(x)) return if (x > 0) "Infinity" else "-Infinity";
    if (x == 0) return "0";

    const fl = std.fmt.float;
    const d = fl.binaryToDecimal(u64, @as(u64, @bitCast(@abs(x))), 52, 11, false, &fl.Backend64_TablesFull);
    var m = d.mantissa;
    var e: i64 = d.exponent;
    while (m % 10 == 0) {
        m /= 10;
        e += 1;
    }
    var digits_buf: [20]u8 = undefined;
    const digits = std.fmt.bufPrint(&digits_buf, "{d}", .{m}) catch unreachable;
    const k: i64 = @intCast(digits.len);
    const n = e + k;

    var w = std.Io.Writer.fixed(buf);
    if (x < 0) w.writeByte('-') catch unreachable;
    if (k <= n and n <= 21) {
        w.writeAll(digits) catch unreachable;
        w.splatByteAll('0', @intCast(n - k)) catch unreachable;
    } else if (0 < n and n <= 21) {
        const p: usize = @intCast(n);
        w.print("{s}.{s}", .{ digits[0..p], digits[p..] }) catch unreachable;
    } else if (-6 < n and n <= 0) {
        w.writeAll("0.") catch unreachable;
        w.splatByteAll('0', @intCast(-n)) catch unreachable;
        w.writeAll(digits) catch unreachable;
    } else {
        const exp = n - 1;
        const sign: u8 = if (exp < 0) '-' else '+';
        if (k == 1) {
            w.print("{s}e{c}{d}", .{ digits, sign, @abs(exp) }) catch unreachable;
        } else {
            w.print("{s}.{s}e{c}{d}", .{ digits[0..1], digits[1..], sign, @abs(exp) }) catch unreachable;
        }
    }
    return w.buffered();
}

/// `JSON.stringify` of a string.
pub fn writeJsonString(w: *std.Io.Writer, s: []const u8) std.Io.Writer.Error!void {
    try w.writeByte('"');
    for (s) |c| {
        switch (c) {
            '"' => try w.writeAll("\\\""),
            '\\' => try w.writeAll("\\\\"),
            0x08 => try w.writeAll("\\b"),
            0x0c => try w.writeAll("\\f"),
            '\n' => try w.writeAll("\\n"),
            '\r' => try w.writeAll("\\r"),
            '\t' => try w.writeAll("\\t"),
            0...0x07, 0x0b, 0x0e...0x1f => try w.print("\\u{x:0>4}", .{c}),
            else => try w.writeByte(c),
        }
    }
    try w.writeByte('"');
}

/// UTF-16 code units of a UTF-8 string, one at a time.
const Utf16Iterator = struct {
    s: []const u8,
    i: usize = 0,
    low: ?u16 = null,

    fn next(self: *Utf16Iterator) ?u16 {
        if (self.low) |l| {
            self.low = null;
            return l;
        }
        if (self.i >= self.s.len) return null;
        const c = decode(self.s, self.i);
        self.i += c.len;
        if (c.cp < 0x10000) return @intCast(c.cp);
        const v = c.cp - 0x10000;
        self.low = @intCast(0xdc00 + (v & 0x3ff));
        return @intCast(0xd800 + (v >> 10));
    }
};

/// JavaScript's default string order (`Array.prototype.sort`, `<`): by UTF-16 code units.
pub fn lessThan(_: void, a: []const u8, b: []const u8) bool {
    var x: Utf16Iterator = .{ .s = a };
    var y: Utf16Iterator = .{ .s = b };
    while (true) {
        const p = x.next();
        const q = y.next();
        if (q == null) return false;
        if (p == null) return true;
        if (p.? != q.?) return p.? < q.?;
    }
}

/// Properties every JavaScript object inherits from Object.prototype, which `obj[key]`
/// finds even when the object doesn't have them.
pub const OBJECT_PROTOTYPE_KEYS = [_][]const u8{
    "__defineGetter__",     "__defineSetter__", "__lookupGetter__", "__lookupSetter__",
    "__proto__",            "constructor",      "hasOwnProperty",   "isPrototypeOf",
    "propertyIsEnumerable", "toLocaleString",   "toString",         "valueOf",
};

pub fn isObjectPrototypeKey(k: []const u8) bool {
    for (OBJECT_PROTOTYPE_KEYS) |p| {
        if (std.mem.eql(u8, p, k)) return true;
    }
    return false;
}

/// The value of an array index key ("0", "17"; not "017" or "4294967295"), which
/// `Object.keys` lists first, in numeric order.
fn arrayIndex(s: []const u8) ?u32 {
    if (s.len == 0 or s.len > 10) return null;
    if (s.len > 1 and s[0] == '0') return null;
    for (s) |c| if (!std.ascii.isDigit(c)) return null;
    const v = std.fmt.parseInt(u64, s, 10) catch return null;
    return if (v < 0xffffffff) @intCast(v) else null;
}

/// The order `Object.keys` gives an object whose keys were added in the order of `keys`:
/// array indices first, ascending, then the rest as added. Returns the positions in `keys`.
pub fn objectKeyOrder(gpa: Allocator, keys: []const []const u8) Allocator.Error![]usize {
    const order = try gpa.alloc(usize, keys.len);
    for (order, 0..) |*o, i| o.* = i;
    const Ctx = struct {
        keys: []const []const u8,
        fn less(ctx: @This(), a: usize, b: usize) bool {
            const x = arrayIndex(ctx.keys[a]);
            const y = arrayIndex(ctx.keys[b]);
            if (x != null and y != null) return x.? < y.?;
            if (x != null) return true;
            if (y != null) return false;
            return a < b;
        }
    };
    std.mem.sort(usize, order, Ctx{ .keys = keys }, Ctx.less);
    return order;
}

test "numberToString" {
    var buf: [NUMBER_BUF]u8 = undefined;
    const cases = [_]struct { f64, []const u8 }{
        .{ 0, "0" },           .{ -0.0, "0" },                                         .{ 1, "1" },
        .{ 1.5, "1.5" },       .{ -2.25, "-2.25" },                                    .{ 0.30000000000000004, "0.30000000000000004" },
        .{ 1e21, "1e+21" },    .{ 123e18, "123000000000000000000" },                   .{ 1e-7, "1e-7" },
        .{ 1.5e-7, "1.5e-7" }, .{ 0.000001, "0.000001" },                              .{ 1.2345e25, "1.2345e+25" },
        .{ 5e-324, "5e-324" }, .{ 1.7976931348623157e308, "1.7976931348623157e+308" },
    };
    for (cases) |c| try std.testing.expectEqualStrings(c[1], numberToString(&buf, c[0]));
}

test "parseInt" {
    try std.testing.expectEqual(@as(f64, 12), parseInt("\u{3000}12abc"));
    try std.testing.expect(std.math.isNan(parseInt("abc")));
    try std.testing.expectEqual(@as(f64, -12), parseInt("-12"));
}

test "lessThan" {
    // U+FF5E sorts after U+1F600 in UTF-16 order (surrogates come first).
    try std.testing.expect(lessThan({}, "\u{1F600}", "\u{FF5E}"));
    try std.testing.expect(lessThan({}, "a", "ab"));
    try std.testing.expect(!lessThan({}, "b", "ab"));
}
