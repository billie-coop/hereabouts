//! Parsed message code. Port of `packages/hereabouts/src/messageformat/parser/types.ts`.
//!
//! The TypeScript uses nested arrays (`[MessageOpType.ARG, 'name']`); here each instruction is
//! a variant of the tagged union `MessageCode`, with the same tag numbers.

const std = @import("std");
const Allocator = std.mem.Allocator;

/// Argument reference inside a message instruction: a number (`{0}`) or a name (`{count}`).
/// Numbers are JavaScript numbers, as `parseInt` gave them: integers, which very long digit
/// strings round (and past about 1e308 stay names, as the TypeScript does).
pub const Argument = union(enum) {
    number: f64,
    name: []const u8,

    pub fn eql(a: Argument, b: Argument) bool {
        return switch (a) {
            .number => |x| b == .number and b.number == x,
            .name => |x| b == .name and std.mem.eql(u8, x, b.name),
        };
    }
};

/// Type of a message instruction.
pub const MessageOpType = enum(u8) {
    text = 0,
    arg = 1,
    plural = 2,
    select = 3,
    block = 4,
    noop = 5,
    simple = 6,
    argsub = 7,
};

/// Type of a plural instruction.
pub const PluralNumberType = enum(u8) { cardinal = 0, ordinal = 1 };

/// Type of plural choice match.
pub const PluralChoiceType = enum(u8) { exact = 0, category = 1 };

/// A plural choice: an exact value (`=1`, stored without the `=`) or a category (`one`).
pub const PluralChoice = struct {
    type: PluralChoiceType,
    value: []const u8,
    code: MessageCode,
};

/// A select choice: the value to match and its body.
pub const SelectChoice = struct {
    value: []const u8,
    code: MessageCode,
};

pub const Plural = struct {
    args: []const Argument,
    offset: f64,
    type: PluralNumberType,
    choices: []const PluralChoice,
};

pub const Select = struct {
    args: []const Argument,
    choices: []const SelectChoice,
};

/// A custom formatter call: name, one or more arguments and zero or more options.
pub const Simple = struct {
    name: []const u8,
    args: []const Argument,
    options: []const []const u8,
};

/// A message instruction.
pub const MessageCode = union(MessageOpType) {
    text: []const u8,
    arg: Argument,
    plural: Plural,
    select: Select,
    block: []const MessageCode,
    noop,
    simple: Simple,
    argsub,

    /// Free code returned by `parseMessagePattern` or `clone`.
    pub fn deinit(self: MessageCode, gpa: Allocator) void {
        switch (self) {
            .text => |s| gpa.free(s),
            .arg => |a| freeArg(gpa, a),
            .plural => |p| {
                freeArgs(gpa, p.args);
                for (p.choices) |c| {
                    gpa.free(c.value);
                    c.code.deinit(gpa);
                }
                gpa.free(p.choices);
            },
            .select => |s| {
                freeArgs(gpa, s.args);
                for (s.choices) |c| {
                    gpa.free(c.value);
                    c.code.deinit(gpa);
                }
                gpa.free(s.choices);
            },
            .block => |b| {
                for (b) |c| c.deinit(gpa);
                gpa.free(b);
            },
            .simple => |s| {
                gpa.free(s.name);
                freeArgs(gpa, s.args);
                for (s.options) |o| gpa.free(o);
                gpa.free(s.options);
            },
            .noop, .argsub => {},
        }
    }
};

fn freeArg(gpa: Allocator, a: Argument) void {
    if (a == .name) gpa.free(a.name);
}

fn freeArgs(gpa: Allocator, args: []const Argument) void {
    for (args) |a| freeArg(gpa, a);
    gpa.free(args);
}

fn cloneArg(gpa: Allocator, a: Argument) Allocator.Error!Argument {
    return switch (a) {
        .number => a,
        .name => |n| .{ .name = try gpa.dupe(u8, n) },
    };
}

fn cloneArgs(gpa: Allocator, args: []const Argument) Allocator.Error![]const Argument {
    const out = try gpa.alloc(Argument, args.len);
    var n: usize = 0;
    errdefer {
        for (out[0..n]) |a| freeArg(gpa, a);
        gpa.free(out);
    }
    for (args) |a| {
        out[n] = try cloneArg(gpa, a);
        n += 1;
    }
    return out;
}

fn cloneStrings(gpa: Allocator, xs: []const []const u8) Allocator.Error![]const []const u8 {
    const out = try gpa.alloc([]const u8, xs.len);
    var n: usize = 0;
    errdefer {
        for (out[0..n]) |s| gpa.free(s);
        gpa.free(out);
    }
    for (xs) |x| {
        out[n] = try gpa.dupe(u8, x);
        n += 1;
    }
    return out;
}

/// A deep copy of `code` owned by `gpa`; free it with `deinit`.
pub fn clone(gpa: Allocator, code: MessageCode) Allocator.Error!MessageCode {
    switch (code) {
        .text => |s| return .{ .text = try gpa.dupe(u8, s) },
        .arg => |a| return .{ .arg = try cloneArg(gpa, a) },
        .plural => |p| {
            const args = try cloneArgs(gpa, p.args);
            errdefer freeArgs(gpa, args);
            const choices = try gpa.alloc(PluralChoice, p.choices.len);
            var n: usize = 0;
            errdefer {
                for (choices[0..n]) |c| {
                    gpa.free(c.value);
                    c.code.deinit(gpa);
                }
                gpa.free(choices);
            }
            for (p.choices) |c| {
                const value = try gpa.dupe(u8, c.value);
                errdefer gpa.free(value);
                choices[n] = .{ .type = c.type, .value = value, .code = try clone(gpa, c.code) };
                n += 1;
            }
            return .{ .plural = .{ .args = args, .offset = p.offset, .type = p.type, .choices = choices } };
        },
        .select => |s| {
            const args = try cloneArgs(gpa, s.args);
            errdefer freeArgs(gpa, args);
            const choices = try gpa.alloc(SelectChoice, s.choices.len);
            var n: usize = 0;
            errdefer {
                for (choices[0..n]) |c| {
                    gpa.free(c.value);
                    c.code.deinit(gpa);
                }
                gpa.free(choices);
            }
            for (s.choices) |c| {
                const value = try gpa.dupe(u8, c.value);
                errdefer gpa.free(value);
                choices[n] = .{ .value = value, .code = try clone(gpa, c.code) };
                n += 1;
            }
            return .{ .select = .{ .args = args, .choices = choices } };
        },
        .block => |b| {
            const out = try gpa.alloc(MessageCode, b.len);
            var n: usize = 0;
            errdefer {
                for (out[0..n]) |c| c.deinit(gpa);
                gpa.free(out);
            }
            for (b) |c| {
                out[n] = try clone(gpa, c);
                n += 1;
            }
            return .{ .block = out };
        },
        .simple => |s| {
            const name = try gpa.dupe(u8, s.name);
            errdefer gpa.free(name);
            const args = try cloneArgs(gpa, s.args);
            errdefer freeArgs(gpa, args);
            return .{ .simple = .{ .name = name, .args = args, .options = try cloneStrings(gpa, s.options) } };
        },
        .noop => return .noop,
        .argsub => return .argsub,
    }
}
