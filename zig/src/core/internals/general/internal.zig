//! General helpers: wrapper patterns, context transforms and list formatting
//! (`internals/general/internal.ts`). Ported with numbers and units, which need them; the
//! display names and list API build on these.

const std = @import("std");
const Allocator = std.mem.Allocator;
const Part = @import("../../../decimal/decimal.zig").Part;
const LocaleData = @import("../../locale_data.zig").LocaleData;
const VectorArrow = @import("../../schema/schema/arrows.zig").VectorArrow;
const general = @import("../../types/general.zig");
const ContextType = general.ContextType;
const ListPatternType = general.ListPatternType;
const wrapper = @import("../../parsing/wrapper.zig");
const WrapperNode = wrapper.WrapperNode;
const Value = @import("../../utils/render.zig").Value;
const case = @import("../../utils/case.zig");

/// Parse a wrapper pattern like '{0} {1}' into `a` (the TypeScript caches parsed patterns;
/// parsing is cheap, so this parses each time). (`parseWrapper`)
pub fn parseWrapper(a: Allocator, raw: []const u8) Allocator.Error![]const WrapperNode {
    return wrapper.parseWrapperPatternAlloc(a, raw);
}

/// The context transform flags of a field ('currencyName', ...): two characters, the first
/// for 'standalone' and the second for 'ui-list-or-menu' ('T' means title case). '' if none.
pub fn contextTransformFlag(data: *const LocaleData, field: []const u8) []const u8 {
    return data.schema.ContextTransforms.contextTransforms.get(&data.bundle, &.{field});
}

/// Contextually transform a string: upper-case its first character for the start of a
/// sentence, or when the locale's flags for the field say so. Owned by `gpa`.
/// (`contextTransform`, with the flags read from the locale data)
pub fn contextTransform(gpa: Allocator, value: []const u8, data: *const LocaleData, context: ?ContextType, field: ?[]const u8) Allocator.Error![]u8 {
    if (value.len == 0) return gpa.dupe(u8, value);
    const flag = if (field) |f| contextTransformFlag(data, f) else "";
    const title = if (context) |c| switch (c) {
        .begin_sentence => true,
        .standalone => flag.len > 0 and flag[0] == 'T',
        .ui_list_or_menu => flag.len > 1 and flag[1] == 'T',
        .middle_of_text => false,
    } else false;
    return if (title) case.titleFirst(gpa, value) else gpa.dupe(u8, value);
}

fn selectListPattern(data: *const LocaleData, t: ListPatternType) VectorArrow {
    const p = data.schema.ListPatterns;
    return switch (t) {
        .unit_long => p.unitLong,
        .unit_narrow => p.unitNarrow,
        .unit_short => p.unitShort,
        .@"or" => p.@"or",
        .and_short => p.andShort,
        .@"and" => p.@"and",
    };
}

fn wrap(a: Allocator, pattern: []const u8, args: []const []const Part) Allocator.Error![]Part {
    var v = Value.init(a);
    try v.wrap(try parseWrapper(a, pattern), args);
    return v.render();
}

/// Format a list of items (each a list of parts) using the locale's list pattern, allocating
/// in `a` (an arena). (`formatListValue`)
pub fn formatListValue(a: Allocator, data: *const LocaleData, items: []const []const Part, t: ListPatternType) Allocator.Error![]Part {
    const arrow = selectListPattern(data, t);
    const b = &data.bundle;
    var len = items.len;
    if (len < 2) {
        return if (len == 1) a.dupe(Part, items[0]) else a.alloc(Part, 0);
    }
    if (len == 2) {
        return wrap(a, arrow.get(b, &.{"two"}), &.{ items[0], items[1] });
    }
    var res = try wrap(a, arrow.get(b, &.{"end"}), &.{ items[len - 2], items[len - 1] });
    len -= 2;
    const middle = arrow.get(b, &.{"middle"});
    while (len > 1) {
        len -= 1;
        res = try wrap(a, middle, &.{ items[len], res });
    }
    return wrap(a, arrow.get(b, &.{"start"}), &.{ items[0], res });
}

/// Fill a wrapper pattern with string arguments. Owned by `gpa`. (`formatWrapper`)
pub fn formatWrapper(gpa: Allocator, format: []const u8, args: []const []const u8) Allocator.Error![]u8 {
    var arena: std.heap.ArenaAllocator = .init(gpa);
    defer arena.deinit();
    const pattern = try parseWrapper(arena.allocator(), format);
    var res: std.ArrayList(u8) = .empty;
    errdefer res.deinit(gpa);
    for (pattern) |node| switch (node) {
        .text => |s| try res.appendSlice(gpa, s),
        .arg => |i| if (i) |k| {
            if (k < args.len) try res.appendSlice(gpa, args[k]);
        },
    };
    return res.toOwnedSlice(gpa);
}
