//! Renders formatted numbers into parts (`internals/numbers/render.ts`). The string form is
//! the parts joined (see `utils/render.zig`).

const std = @import("std");
const Allocator = std.mem.Allocator;
const D = @import("../../../decimal/decimal.zig");
const Decimal = D.Decimal;
const Part = D.Part;
const private = @import("../../common/private.zig");
const NumberParams = private.NumberParams;
const CurrencySpacingPatterns = private.CurrencySpacingPatterns;
const NumberPattern = @import("../../parsing/number.zig").NumberPattern;
const wrapper = @import("../../parsing/wrapper.zig");
const numbering = @import("../../systems/numbering/decimal.zig");
const Value = @import("../../utils/render.zig").Value;
const spacing = @import("autogen.spacing.zig");

/// Renders numbers with the symbols and digits of `params`. Everything is allocated in `a`
/// without freeing (use an arena).
pub const NumberRenderer = struct {
    a: Allocator,
    params: *const NumberParams,

    /// Format a number with a pattern. `currency_symbol` fills the currency field and turns on
    /// the currency decimal and group symbols; `decimal_symbol`, if set, overrides the decimal
    /// symbol. `grouping` defaults (null) to true. A non-zero `exponent` fills the exponent
    /// field.
    pub fn render(
        self: NumberRenderer,
        n: Decimal,
        pattern: NumberPattern,
        currency_symbol: []const u8,
        percent_symbol: []const u8,
        decimal_symbol: []const u8,
        min_int: i64,
        grouping: ?bool,
        exponent: i64,
    ) Allocator.Error![]Part {
        const a = self.a;
        const params = self.params;
        const symbols = params.symbols;
        const currency = currency_symbol.len > 0;

        const decimal = if (decimal_symbol.len > 0)
            decimal_symbol
        else if (currency)
            (if (symbols.currency_decimal.len > 0) symbols.currency_decimal else symbols.decimal)
        else
            symbols.decimal;
        var group: []const u8 = "";
        if (grouping orelse true) {
            group = symbols.group;
            if (currency and symbols.currency_group.len > 0) group = symbols.currency_group;
        }

        var pri_group = pattern.pri_group;
        var sec_group = pattern.sec_group;
        if (pri_group <= 0) pri_group = params.primary_grouping_size;
        if (sec_group <= 0) sec_group = params.secondary_grouping_size;

        var fmt = D.PartsFormatter.init(a, decimal, group);
        try D.format(a, n, &fmt, decimal, group, min_int, params.minimum_grouping_digits, pri_group, sec_group, true, params.digits);
        const formatted = try fmt.render(a);

        var res = Value.init(a);
        var have_number = false;
        var currency_before = false;
        var currency_idx: ?usize = null;
        for (pattern.nodes) |node| switch (node) {
            .text => |s| try res.add("literal", s),
            .field => |f| switch (f) {
                .currency => {
                    // Save the offset to the segment before or after the currency symbol.
                    currency_before = !have_number;
                    const i = res.length();
                    try res.add("currency", currency_symbol);
                    const j = res.length();
                    // After the number, i > 0.
                    currency_idx = if (currency_before) j else if (i == 0) null else i - 1;
                },
                .minus => try res.add("minus", symbols.minus_sign),
                .plus => try res.add("plus", symbols.plus_sign),
                .number => {
                    try res.append(formatted);
                    have_number = true;
                },
                .percent => try res.add("percent", percent_symbol),
                .exponent => {
                    // Don't emit the exponent if undefined or zero
                    if (exponent != 0) {
                        try res.add("exponent", symbols.exponential);
                        if (exponent < 0) {
                            try res.add("minus", symbols.minus_sign);
                        } else {
                            try res.add("plus", symbols.plus_sign);
                        }
                        var buf: [24]u8 = undefined;
                        const e = std.fmt.bufPrint(&buf, "{d}", .{exponent}) catch unreachable;
                        try res.add("integer", try numbering.fastFormatDecimal(a, e, params.digits, 1));
                    }
                },
            },
        };

        // Adjust spacing between currency symbol based on surrounding characters.
        if (currency_idx) |idx| {
            const sp = params.currency_spacing;
            const curr = res.get(idx);
            if (currency_before) {
                if (insertBetween(sp.after, lastUnit(currency_symbol), firstUnit(curr))) {
                    try res.insert(idx, "spacer", sp.after.insert_between);
                }
            } else {
                if (insertBetween(sp.before, firstUnit(currency_symbol), lastUnit(curr))) {
                    try res.insert(idx + 1, "spacer", sp.before.insert_between);
                }
            }
        }
        return res.render();
    }

    pub fn empty(self: NumberRenderer) Allocator.Error![]Part {
        return self.a.alloc(Part, 0);
    }

    /// A single part.
    pub fn make(self: NumberRenderer, t: []const u8, val: []const u8) Allocator.Error![]Part {
        const out = try self.a.alloc(Part, 1);
        out[0] = .{ .type = t, .value = val };
        return out;
    }

    /// Fill a wrapper pattern like '{0} {1}' with the given values.
    pub fn wrap(self: NumberRenderer, raw: []const u8, args: []const []const Part) Allocator.Error![]Part {
        var res = Value.init(self.a);
        try res.wrap(try wrapper.parseWrapperPatternAlloc(self.a, raw), args);
        return res.render();
    }
};

/// First UTF-16 code unit of a string, or null if empty.
fn firstUnit(s: []const u8) ?u16 {
    if (s.len == 0) return null;
    const n = std.unicode.utf8ByteSequenceLength(s[0]) catch return 0xfffd;
    if (n > s.len) return 0xfffd;
    const cp = std.unicode.utf8Decode(s[0..n]) catch return 0xfffd;
    if (cp >= 0x10000) return @intCast(0xd800 + ((cp - 0x10000) >> 10));
    return @intCast(cp);
}

/// Last UTF-16 code unit of a string, or null if empty.
fn lastUnit(s: []const u8) ?u16 {
    if (s.len == 0) return null;
    var i = s.len - 1;
    while (i > 0 and (s[i] & 0xc0) == 0x80) i -= 1;
    const cp = std.unicode.utf8Decode(s[i..]) catch return 0xfffd;
    if (cp >= 0x10000) return @intCast(0xdc00 + ((cp - 0x10000) & 0x3ff));
    return @intCast(cp);
}

fn inRanges(ranges: []const [2]u16, c: u16) bool {
    var lo: usize = 0;
    var hi: usize = ranges.len;
    while (lo < hi) {
        const mid = (lo + hi) / 2;
        if (c < ranges[mid][0]) hi = mid else if (c > ranges[mid][1]) lo = mid + 1 else return true;
    }
    return false;
}

/// The currency spacing matchers found in CLDR. A missing character (null) is tested as the
/// TypeScript tests `undefined`: as the string 'undefined'.
pub fn spacingMatch(matcher: []const u8, c: ?u16) bool {
    if (std.mem.eql(u8, matcher, "[:digit:]")) {
        return if (c) |u| inRanges(&spacing.digit_ranges, u) else false;
    }
    if (std.mem.eql(u8, matcher, "[[:^S:]&[:^Z:]]")) {
        return if (c) |u| !inRanges(&spacing.symbol_ranges, u) else true;
    }
    // The TypeScript fails calling an undefined matcher; no CLDR data has one.
    return false;
}

fn insertBetween(sp: CurrencySpacingPatterns, currency: ?u16, surrounding: ?u16) bool {
    return spacingMatch(sp.currency_match, currency) and spacingMatch(sp.surrounding_match, surrounding);
}
