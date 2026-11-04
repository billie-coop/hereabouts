//! Hand-implemented parser for ICU message format. Port of
//! `packages/hereabouts/src/messageformat/parser/parser.ts`.
//!
//! The parser produces an instruction tree which can be cached for repeated use, and is
//! intended to be evaluated by a separate engine. It never fails: text it can't parse comes
//! out as text or is dropped, as in the TypeScript.
//!
//! Note: The 'choice' formatter is not implemented since it is deprecated.
//!
//! See ICU docs for details on syntax:
//! https://unicode-org.github.io/icu-docs/apidoc/released/icu4j/com/ibm/icu/text/MessageFormat.html

const std = @import("std");
const Allocator = std.mem.Allocator;
const types = @import("types.zig");
const matcher_ = @import("matcher.zig");

const MessageCode = types.MessageCode;
const Argument = types.Argument;
const PluralChoice = types.PluralChoice;
const SelectChoice = types.SelectChoice;
const MessageMatcher = matcher_.MessageMatcher;
const MessageState = matcher_.MessageState;

const LEFT = '{';
const RIGHT = '}';
const MINUS = '-';
const APOS = '\'';
const POUND = '#';

/// How apostrophes quote text in a message pattern, using ICU's names.
///
/// - `double_optional` (ICU's default since ICU 4.8, and what translators expect): an
///   apostrophe starts quoted text only right before `{` or `}` (or `#` inside a plural), so
///   `Here's {name}` needs no escaping. `''` is always one apostrophe.
/// - `double_required` (this library's 1.x behaviour, still the default for
///   `createMessageFormatter`): every single apostrophe starts quoted text, so `Here's {name}`
///   drops the rest of the message and literal apostrophes have to be written `''`.
pub const ApostropheMode = enum {
    double_optional,
    double_required,

    /// Parse the TypeScript names: 'double-optional', 'double-required'.
    pub fn fromString(s: []const u8) ?ApostropheMode {
        if (std.mem.eql(u8, s, "double-optional")) return .double_optional;
        if (std.mem.eql(u8, s, "double-required")) return .double_required;
        return null;
    }
};

/// Inputs to the parse of one message pattern.
const Parser = struct {
    a: Allocator,
    raw: []const u8,
    matcher: MessageMatcher,
    disable_escapes: bool,
    // ICU DOUBLE_OPTIONAL: an apostrophe only quotes before a syntax character.
    optional: bool,

    fn at(p: *const Parser, i: usize) ?u8 {
        return if (i < p.raw.len) p.raw[i] else null;
    }

    /// True if an apostrophe at `i` starts quoted text: always in `double_required` mode; in
    /// `double_optional` mode only right before `{`, `}`, or `#` where `#` is special.
    fn quotes(p: *const Parser, i: usize, pound: bool) bool {
        if (!p.optional) return true;
        const next = p.at(i + 1) orelse return false;
        return next == LEFT or next == RIGHT or (pound and next == POUND);
    }

    /// `raw.substring(s, e)`: clamps both ends and swaps them if s > e.
    fn substring(p: *const Parser, s: usize, e: usize) []const u8 {
        const x = @min(s, p.raw.len);
        const y = @min(e, p.raw.len);
        return p.raw[@min(x, y)..@max(x, y)];
    }
};

/// Parses a string into message code. The result can be evaluated with `evaluateMessage`;
/// free it with `deinit`. `apostrophe_mode` null means the TypeScript's `undefined`, which
/// is `double_required`.
pub fn parseMessagePattern(
    gpa: Allocator,
    raw: []const u8,
    matcher: MessageMatcher,
    disable_escapes: bool,
    apostrophe_mode: ?ApostropheMode,
) Allocator.Error!MessageCode {
    var arena = std.heap.ArenaAllocator.init(gpa);
    defer arena.deinit();
    var p: Parser = .{
        .a = arena.allocator(),
        .raw = raw,
        .matcher = matcher,
        .disable_escapes = disable_escapes,
        .optional = apostrophe_mode == .double_optional,
    };
    var r: MessageState = .{ .t = raw, .s = 0, .e = raw.len };
    const code = try outer(&p, &r, false);
    return types.clone(gpa, code);
}

fn outer(p: *Parser, r: *MessageState, argsub: bool) Allocator.Error!MessageCode {
    const str = p.raw;

    // Accumulate parsed instruction nodes
    var n: std.ArrayList(MessageCode) = .empty;

    // Accumulate plain text characters
    var buf: std.ArrayList(u8) = .empty;

    // Iterate until we reach the end of this range
    while (r.s < r.e) {
        const c = str[r.s];

        // Look for characters which mark the start of a special section
        switch (c) {
            LEFT => {
                // Push non-empty buffer
                if (buf.items.len > 0) {
                    try n.append(p.a, try textarg(p, buf.items, argsub));
                    buf = .empty;
                }
                const hidden = p.at(r.s + 1) == MINUS;

                if (seek(p, r.s, r.e)) |k| {
                    if (hidden) {
                        // Tag is hidden from processor, emit as text
                        try n.append(p.a, try text2(p, "{", p.substring(r.s + 2, k + 1)));

                        // Skip over hidden tag
                        r.s = k;
                    } else {
                        // Process tag interior
                        var rr: MessageState = .{ .t = r.t, .s = r.s + 1, .e = k };
                        if (try inner(p, &rr)) |child| {
                            try n.append(p.a, child);
                        } else if (argsub and r.s + 1 != k) {
                            // If we're not in the outermost scope, push text
                            try n.append(p.a, try textarg(p, str[r.s + 1 .. k], argsub));
                        }

                        // Skip over processed tag
                        r.s = k;
                    }
                } else {
                    try n.append(p.a, try textarg(p, str[r.s..r.e], argsub));
                    r.s = r.e;
                }
            },

            APOS => {
                if (p.disable_escapes) {
                    try buf.append(p.a, c);
                } else if (p.at(r.s + 1) == c) {
                    // Convert double apostrophe to single
                    try buf.append(p.a, c);
                    r.s += 1;
                } else if (!p.quotes(r.s, argsub)) {
                    // A lone apostrophe that doesn't quote anything is just an apostrophe
                    try buf.append(p.a, c);
                } else {
                    // Skip over apostrophe
                    r.s += 1;

                    // Capture string wrapped in apostrophes
                    const k = std.mem.indexOfScalarPos(u8, str, r.s, c) orelse r.e;

                    // Since this is escaped text, push text node without substituting '#'
                    try buf.appendSlice(p.a, p.substring(r.s, k));

                    // Skip over escaped text
                    r.s = k;
                }
            },

            // Append plain character to output buffer
            else => try buf.append(p.a, c),
        }
        r.s += 1;
    }

    // Push any trailing characters
    if (buf.items.len > 0) try n.append(p.a, try textarg(p, buf.items, argsub));

    // Flatten blocks
    return flatten(n.items);
}

fn inner(p: *Parser, r: *MessageState) Allocator.Error!?MessageCode {
    const m = p.matcher;

    // Skip any optional leading spaces
    _ = m.spaces(r);

    // See if we have any arguments. we must have at least one or we fail this tag.
    const args = (try m.arguments(p.a, r)) orelse return null;

    // Check if we're done..
    if (!m.spaces(r) or m.complete(r)) {
        // We have a simple argument.
        return .{ .arg = args[0] };
    }

    // See if any of our known formatters are present
    const name = m.formatter(r) orelse return null;
    _ = m.spaces(r);

    // Execute logic to parse instructions by type
    if (std.mem.eql(u8, name, "plural")) return try plural(p, args, .cardinal, r);
    if (std.mem.eql(u8, name, "selectordinal")) return try plural(p, args, .ordinal, r);
    if (std.mem.eql(u8, name, "select")) return try select(p, args, r);
    return .{ .simple = .{ .name = name, .args = args, .options = try m.options(p.a, r) } };
}

/// Parse a nested tag sequence '{' ... '}'
fn tag(p: *Parser, r: *MessageState, argsub: bool) Allocator.Error!?MessageCode {
    const m = p.matcher;
    _ = m.spaces(r);

    // Ensure we see a tag start next
    if (m.char(r) != LEFT) return null;

    const hidden = p.at(r.s + 1) == MINUS;

    // Find matching end delimiter. The TypeScript notes this can't fail, since the enclosing
    // tag was balanced; if it did, its -1 would give this.
    const k = seek(p, r.s, r.e) orelse {
        const node: MessageCode = if (hidden) try text2(p, "{", p.substring(r.s + 2, 0)) else .noop;
        r.s = 0;
        return node;
    };

    // Parse nested block and skip over it
    const node: MessageCode = if (hidden) try text2(p, "{", p.substring(r.s + 2, k + 1)) else blk: {
        var rr: MessageState = .{ .t = r.t, .s = r.s + 1, .e = k };
        break :blk try outer(p, &rr, argsub);
    };
    r.s = k + 1;
    return node;
}

/// Parse a plural instruction.
fn plural(p: *Parser, args: []const Argument, typ: types.PluralNumberType, r: *MessageState) Allocator.Error!MessageCode {
    const m = p.matcher;

    // See if we have an offset argument
    const offset = m.pluralOffset(r);
    _ = m.spaces(r);

    var choices: std.ArrayList(PluralChoice) = .empty;
    while (true) {
        // Parse a plural choice
        const choice = m.pluralChoice(r) orelse break;

        // Parse a tag into a block of instructions
        const block = (try tag(p, r, true)) orelse return .noop;

        // Determine which choice node to construct
        if (choice[0] == '=') {
            try choices.append(p.a, .{ .type = .exact, .value = choice[1..], .code = block });
        } else {
            // Plural category match
            try choices.append(p.a, .{ .type = .category, .value = choice, .code = block });
        }

        // Skip spaces
        _ = m.spaces(r);
        if (m.complete(r)) break;
    }

    // If we parsed no choices, emit a no-op
    if (choices.items.len == 0) return .noop;
    return .{ .plural = .{ .args = args, .offset = offset, .type = typ, .choices = choices.items } };
}

/// Parse a select instruction.
fn select(p: *Parser, args: []const Argument, r: *MessageState) Allocator.Error!MessageCode {
    const m = p.matcher;
    var choices: std.ArrayList(SelectChoice) = .empty;
    while (true) {
        // Parse an identifier to be used as the select choice
        const ident = m.identifier(r) orelse break;

        // Parse a tag into a block of instructions
        const block = (try tag(p, r, true)) orelse return .noop;

        // Append and skip to the next choice
        try choices.append(p.a, .{ .value = ident, .code = block });
        _ = m.spaces(r);
        if (m.complete(r)) break;
    }

    // If we parsed no choices, just emit a no-op
    if (choices.items.len == 0) return .noop;
    return .{ .select = .{ .args = args, .choices = choices.items } };
}

/// Seek to the matching '}' character at the same nesting level, skipping over any
/// apostrophes. This adds some redundant scanning of the string but simplifies some of the
/// parsing logic in other areas. It ensures we're always dealing with a well-formed tag where
/// all '{' have a corresponding '}'. Null if there is none.
fn seek(p: *const Parser, start: usize, j: usize) ?usize {
    const r = p.raw;
    var d: i64 = 0; // Track nesting depth
    var i = start;

    while (i < j) : (i += 1) {
        const c = r[i];
        switch (c) {
            // Increase depth
            LEFT => d += 1,

            RIGHT => {
                // Reduce depth
                d -= 1;
                // Depth is zero, we're done
                if (d == 0) break;
            },

            APOS => {
                if (p.disable_escapes) {
                    // Escapes disabled: an apostrophe is a plain character (1.x ignored the option here)
                } else if (p.at(i + 1) == c) {
                    // Skip single escaped apostrophe
                    i += 1;
                } else if (!p.quotes(i, true)) {
                    // A lone apostrophe that doesn't quote anything
                } else {
                    // Find matching apostrophe; with none, assume rest of string is escaped
                    i = std.mem.indexOfScalarPos(u8, r, i + 1, c) orelse return null;
                }
            },

            else => {},
        }
    }

    // If we still have un-matched characters, fail
    return if (d != 0) null else i;
}

fn flatten(n: []const MessageCode) MessageCode {
    if (n.len == 0) return .noop;
    if (n.len == 1) return n[0];
    return .{ .block = n };
}

/// A text node copying `s` (which may point into a buffer that gets reused).
fn text(p: *Parser, s: []const u8) Allocator.Error!MessageCode {
    return .{ .text = try p.a.dupe(u8, s) };
}

fn text2(p: *Parser, s: []const u8, t: []const u8) Allocator.Error!MessageCode {
    return .{ .text = try std.mem.concat(p.a, u8, &.{ s, t }) };
}

/// Emit a text node, performing argument substitution for all occurrences of the '#'
/// character when `argsub` is set.
fn textarg(p: *Parser, s: []const u8, argsub: bool) Allocator.Error!MessageCode {
    // If no argument substitution is requested, return plain text
    if (!argsub) return text(p, s);

    // If no '#' character is found, return plain text
    var j = std.mem.indexOfScalar(u8, s, POUND) orelse return text(p, s);
    var i: usize = 0;

    // We need to perform substitution on each occurrence of '#' in the string and return
    // a block.
    var n: std.ArrayList(MessageCode) = .empty;
    while (true) {
        // Push leading text
        if (i < j) try n.append(p.a, try text(p, s[i..j]));

        // Add a substitution op
        try n.append(p.a, .argsub);

        // Skip over '#' and search for next occurrence
        i = j + 1;
        j = std.mem.indexOfScalarPos(u8, s, i, POUND) orelse break;
    }

    // Push trailing text
    if (i < s.len) try n.append(p.a, try text(p, s[i..]));

    return flatten(n.items);
}

test "parse" {
    const gpa = std.testing.allocator;
    const m = try matcher_.buildMessageMatcher(gpa, &.{}, true);
    defer m.deinit(gpa);
    const code = try parseMessagePattern(gpa, "{n, plural, one {# item} other {# items}}!", m, false, null);
    defer code.deinit(gpa);
    try std.testing.expectEqual(types.MessageOpType.block, std.meta.activeTag(code));
    try std.testing.expectEqual(@as(usize, 2), code.block[0].plural.choices.len);
}
