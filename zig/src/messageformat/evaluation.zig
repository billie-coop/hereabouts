//! Evaluates parsed messages. Port of `packages/hereabouts/src/messageformat/evaluation`.

const std = @import("std");
const Allocator = std.mem.Allocator;
const D = @import("../decimal/decimal.zig");
const plurals = @import("../plurals/plurals.zig");
const js = @import("js.zig");
const types = @import("types.zig");

const Decimal = D.Decimal;
const MessageCode = types.MessageCode;
const Argument = types.Argument;
const PluralRules = plurals.PluralRules;

/// Errors from evaluating a message. Custom formatters and converters return
/// `error.FormatFailed` to fail an evaluation (where the TypeScript would throw).
pub const Error = Allocator.Error || error{FormatFailed};

/// A value of a type the formatters don't know, for custom formatters: a pointer plus a
/// name the formatter checks before casting it back. The default converter turns these into
/// '' and NaN, as the TypeScript does for objects that aren't Decimals.
pub const Opaque = struct {
    type_name: []const u8,
    ptr: ?*const anyopaque = null,
};

/// An argument value. The TypeScript accepts any value and casts at the time of evaluation;
/// these are the kinds it distinguishes. `.null` is JavaScript's null (a missing argument);
/// an argument that wasn't given at all is a Zig `null` (`?MessageArg`), like `undefined`.
pub const MessageArg = union(enum) {
    string: []const u8,
    number: f64,
    boolean: bool,
    decimal: Decimal,
    null,
    object: Opaque,
};

/// A named argument. Named arguments override positional ones with the same key (`"0"`).
pub const NamedArg = struct {
    name: []const u8,
    value: MessageArg,
};

/// Combined positional and named arguments.
pub const MessageArgs = struct {
    positional: []const MessageArg = &.{},
    named: []const NamedArg = &.{},
};

/// Argument converter: functions that map raw arguments to the types required by the
/// internal tags. They allocate results in the allocator they get (an arena freed after the
/// evaluation), or return static data.
pub const MessageArgConverter = struct {
    ctx: ?*const anyopaque = null,
    as_string_fn: *const fn (ctx: ?*const anyopaque, a: Allocator, arg: ?MessageArg) Error![]const u8,
    as_decimal_fn: *const fn (ctx: ?*const anyopaque, a: Allocator, arg: ?MessageArg) Error!Decimal,

    pub fn asString(self: MessageArgConverter, a: Allocator, arg: ?MessageArg) Error![]const u8 {
        return self.as_string_fn(self.ctx, a, arg);
    }

    pub fn asDecimal(self: MessageArgConverter, a: Allocator, arg: ?MessageArg) Error!Decimal {
        return self.as_decimal_fn(self.ctx, a, arg);
    }
};

/// Default argument converter: converts arguments to string or Decimal.
pub const default_converter: MessageArgConverter = .{
    .as_string_fn = defaultAsString,
    .as_decimal_fn = defaultAsDecimal,
};

/// Convert to a string if possible: strings as they are, numbers and booleans as JavaScript
/// prints them, Decimals with `decimal.toString`, anything else ''.
fn defaultAsString(_: ?*const anyopaque, a: Allocator, arg: ?MessageArg) Error![]const u8 {
    const v = arg orelse return "";
    return switch (v) {
        .string => |s| s,
        .number => |n| try numberToString(a, n),
        .boolean => |b| if (b) "true" else "false",
        .decimal => |d| try D.toString(a, d),
        .null, .object => "",
    };
}

/// Convert to a Decimal if possible, or NaN: strings that parse, numbers, booleans (0 or 1)
/// and Decimals.
fn defaultAsDecimal(_: ?*const anyopaque, a: Allocator, arg: ?MessageArg) Error!Decimal {
    const v = arg orelse return D.NAN;
    return switch (v) {
        .string => |s| D.parse(a, s) catch |err| switch (err) {
            error.OutOfMemory => error.OutOfMemory,
            else => D.NAN,
        },
        .number => |n| try decimalFromNumber(a, n),
        .boolean => |b| if (b) D.ONE else D.ZERO,
        .decimal => |d| d,
        .null, .object => D.NAN,
    };
}

/// A number as JavaScript prints it (`String(n)`), owned by `a`.
pub fn numberToString(a: Allocator, n: f64) Allocator.Error![]const u8 {
    var buf: [js.NUMBER_BUF]u8 = undefined;
    return a.dupe(u8, js.numberToString(&buf, n));
}

/// `decimal(n)` for a JavaScript number: NaN and infinities as such, otherwise its string.
pub fn decimalFromNumber(a: Allocator, n: f64) Allocator.Error!Decimal {
    if (std.math.isNan(n)) return D.NAN;
    if (std.math.isInf(n)) return if (n > 0) D.POSITIVE_INFINITY else D.NEGATIVE_INFINITY;
    var buf: [js.NUMBER_BUF]u8 = undefined;
    return D.parse(a, js.numberToString(&buf, n)) catch |err| switch (err) {
        error.OutOfMemory => error.OutOfMemory,
        else => unreachable,
    };
}

/// User-defined message formatter, e.g. `upper` for `{name upper}`: gets the argument values
/// (null for one that wasn't given) and the options, and returns text allocated in `a` (an
/// arena freed after the evaluation) or static text.
pub const Formatter = struct {
    name: []const u8,
    ctx: ?*const anyopaque = null,
    func: *const fn (ctx: ?*const anyopaque, a: Allocator, args: []const ?MessageArg, options: []const []const u8) Error![]const u8,
};

/// The names of formatters, for `buildMessageMatcher`. Caller frees the list.
pub fn formatterNames(gpa: Allocator, formatters: []const Formatter) Allocator.Error![]const []const u8 {
    const names = try gpa.alloc([]const u8, formatters.len);
    for (formatters, names) |f, *n| n.* = f.name;
    return names;
}

/// The text of an argument reference: `0`, `name`. Numbers print as JavaScript prints them.
fn keyString(buf: *[js.NUMBER_BUF]u8, key: Argument) []const u8 {
    return switch (key) {
        .name => |s| s,
        .number => |n| js.numberToString(buf, n),
    };
}

fn get(key: Argument, args: MessageArgs) ?MessageArg {
    var buf: [js.NUMBER_BUF]u8 = undefined;
    const k = keyString(&buf, key);
    for (args.named) |na| {
        if (std.mem.eql(u8, na.name, k)) return na.value;
    }
    // The TypeScript reads named arguments from a plain object, so names it inherits from
    // Object.prototype ('toString', ...) are never missing: they are functions, which convert
    // to '' and NaN ('__proto__' is an object).
    if (js.isObjectPrototypeKey(k)) {
        return .{ .object = .{ .type_name = if (std.mem.eql(u8, k, "__proto__")) "object" else "function" } };
    }
    if (key == .number) {
        const n = key.number;
        if (n >= 0 and n < @as(f64, @floatFromInt(args.positional.len))) return args.positional[@intFromFloat(n)];
    }
    return null;
}

/// An argument is "missing" when it was not provided (or provided as null).
///
/// When a message references a missing argument, ICU passes the argument's reference text
/// through to the output verbatim, e.g. `{0}` or `{name}`. This applies to plain arguments
/// as well as plural/select/selectordinal: the formatter is not evaluated at all. Emitting the
/// reference text (rather than an empty string or `NaN`) surfaces template/argument
/// mismatches.
fn missing(arg: ?MessageArg) bool {
    const v = arg orelse return true;
    return v == .null;
}

// Save a bit of processing of common exact matches
fn exact(n: []const u8) ?Decimal {
    if (std.mem.eql(u8, n, "0")) return D.ZERO;
    if (std.mem.eql(u8, n, "1")) return D.ONE;
    if (std.mem.eql(u8, n, "2")) return D.TWO;
    return null;
}

/// Inputs to the evaluation of one message.
const Context = struct {
    a: Allocator,
    out: *std.ArrayList(u8),
    gpa: Allocator,
    plurals: PluralRules,
    converter: MessageArgConverter,
    formatters: []const Formatter,
    args: MessageArgs,

    fn emit(ctx: *Context, s: []const u8) Error!void {
        try ctx.out.appendSlice(ctx.gpa, s);
    }

    fn emitRef(ctx: *Context, key: Argument) Error!void {
        var buf: [js.NUMBER_BUF]u8 = undefined;
        try ctx.emit("{");
        try ctx.emit(keyString(&buf, key));
        try ctx.emit("}");
    }
};

/// Evaluates parsed message `code` against positional and named arguments, producing a
/// string owned by `gpa`. Plural categories are selected using `plural_rules`, arguments are
/// converted using `converter`, and `formatters` implements the custom formatter names the
/// message was parsed with.
pub fn evaluateMessage(
    gpa: Allocator,
    plural_rules: PluralRules,
    converter: MessageArgConverter,
    formatters: []const Formatter,
    code: MessageCode,
    positional: []const MessageArg,
    named: []const NamedArg,
) Error![]u8 {
    var arena = std.heap.ArenaAllocator.init(gpa);
    defer arena.deinit();
    var out: std.ArrayList(u8) = .empty;
    errdefer out.deinit(gpa);
    var ctx: Context = .{
        .a = arena.allocator(),
        .out = &out,
        .gpa = gpa,
        .plurals = plural_rules,
        .converter = converter,
        .formatters = formatters,
        .args = .{ .positional = positional, .named = named },
    };
    try evaluate(&ctx, code, null);
    return out.toOwnedSlice(gpa);
}

fn evaluate(ctx: *Context, code: MessageCode, argsub: ?MessageArg) Error!void {
    const args = ctx.args;
    switch (code) {
        .text => |s| try ctx.emit(s),

        .block => |b| for (b) |n| try evaluate(ctx, n, argsub),

        .arg => |key| {
            const arg = get(key, args);
            if (missing(arg)) return ctx.emitRef(key);
            try ctx.emit(try ctx.converter.asString(ctx.a, arg));
        },

        .argsub => try ctx.emit(try ctx.converter.asString(ctx.a, argsub)),

        .plural => |p| {
            const arg = get(p.args[0], args);
            if (missing(arg)) return ctx.emitRef(p.args[0]);
            const num = try ctx.converter.asDecimal(ctx.a, arg);
            const sub = if (p.offset != 0) try D.subtract(ctx.a, num, try decimalFromNumber(ctx.a, p.offset)) else num;
            const category = switch (p.type) {
                .cardinal => plurals.cardinal(ctx.plurals, sub, 0),
                .ordinal => plurals.ordinal(ctx.plurals, sub),
            };

            var other: ?MessageCode = null;
            for (p.choices) |c| {
                switch (c.type) {
                    .exact => {
                        const v = exact(c.value) orelse try ctx.converter.asDecimal(ctx.a, .{ .string = c.value });
                        if (try D.compare(ctx.a, num, v, false) == 0) {
                            return evaluate(ctx, c.code, .{ .decimal = num });
                        }
                    },
                    .category => {
                        if (std.mem.eql(u8, c.value, category.toString())) {
                            return evaluate(ctx, c.code, .{ .decimal = sub });
                        } else if (std.mem.eql(u8, c.value, "other")) {
                            // Capture the 'other' as a fallback
                            other = c.code;
                        }
                    },
                }
            }

            // If no match and 'other' exists, emit that value.
            if (other) |o| try evaluate(ctx, o, .{ .decimal = sub });
        },

        .select => |s| {
            const arg = get(s.args[0], args);
            if (missing(arg)) return ctx.emitRef(s.args[0]);
            const str = try ctx.converter.asString(ctx.a, arg);

            var other: ?MessageCode = null;
            for (s.choices) |c| {
                if (std.mem.eql(u8, c.value, str)) return evaluate(ctx, c.code, arg);

                // Capture the 'other' as a fallback
                if (std.mem.eql(u8, c.value, "other")) other = c.code;
            }

            // If no match and 'other' exists, emit that value.
            if (other) |o| try evaluate(ctx, o, arg);
        },

        .simple => |s| {
            // One or more arguments and zero or more options
            for (ctx.formatters) |f| {
                if (!std.mem.eql(u8, f.name, s.name)) continue;
                const fargs = try ctx.a.alloc(?MessageArg, s.args.len);
                for (s.args, fargs) |k, *v| v.* = get(k, args);
                try ctx.emit(try f.func(f.ctx, ctx.a, fargs, s.options));
                return;
            }
        },

        .noop => {},
    }
}
