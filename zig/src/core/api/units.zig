//! Unit quantity formatting (`api/units.ts`). Strings and parts returned are owned by `gpa`.

const std = @import("std");
const Allocator = std.mem.Allocator;
const D = @import("../../decimal/decimal.zig");
const Part = D.Part;
const LocaleData = @import("../locale_data.zig").LocaleData;
const units = @import("../common/units.zig");
const ListPatternType = @import("../types/general.zig").ListPatternType;
const internal = @import("../internals/units/internal.zig");
const NumberRenderer = @import("../internals/numbers/render.zig").NumberRenderer;
const general = @import("../internals/general/internal.zig");
const render = @import("../utils/render.zig");
const getNumberParams = @import("private/numbers.zig").getNumberParams;

pub const Quantity = units.Quantity;
pub const UnitFormatOptions = units.UnitFormatOptions;
pub const UnitLength = units.UnitLength;

/// Units available in the active schema config (borrowed). (`availableUnits`)
pub fn availableUnits(data: *const LocaleData) []const []const u8 {
    return data.indices("unit-id").?.keys;
}

/// The display name of a unit; null length is 'long'. Borrowed from the locale data.
/// (`getUnitDisplayName`)
pub fn getUnitDisplayName(data: *const LocaleData, name: []const u8, length: ?UnitLength) []const u8 {
    return internal.getUnitInfo(data, length).displayName.get(&data.bundle, &.{name});
}

/// Format a quantity to a string (`formatQuantity`).
pub fn formatQuantity(gpa: Allocator, data: *const LocaleData, q: Quantity, options: UnitFormatOptions) Allocator.Error![]u8 {
    var arena: std.heap.ArenaAllocator = .init(gpa);
    defer arena.deinit();
    return render.joinParts(gpa, try quantityParts(arena.allocator(), data, q, options));
}

/// Format a quantity to parts (`formatQuantityToParts`).
pub fn formatQuantityToParts(gpa: Allocator, data: *const LocaleData, q: Quantity, options: UnitFormatOptions) Allocator.Error![]Part {
    var arena: std.heap.ArenaAllocator = .init(gpa);
    defer arena.deinit();
    return render.copyParts(gpa, try quantityParts(arena.allocator(), data, q, options));
}

/// Format a sequence of quantities to a string, e.g. "5 feet, 3 inches"
/// (`formatQuantitySequence`).
pub fn formatQuantitySequence(gpa: Allocator, data: *const LocaleData, qs: []const Quantity, options: UnitFormatOptions) Allocator.Error![]u8 {
    var arena: std.heap.ArenaAllocator = .init(gpa);
    defer arena.deinit();
    return render.joinParts(gpa, try sequenceParts(arena.allocator(), data, qs, options));
}

/// Format a sequence of quantities to parts (`formatQuantitySequenceToParts`).
pub fn formatQuantitySequenceToParts(gpa: Allocator, data: *const LocaleData, qs: []const Quantity, options: UnitFormatOptions) Allocator.Error![]Part {
    var arena: std.heap.ArenaAllocator = .init(gpa);
    defer arena.deinit();
    return render.copyParts(gpa, try sequenceParts(arena.allocator(), data, qs, options));
}

/// Quantity formatting into parts allocated in `a` (an arena), for other formatters.
pub fn quantityParts(a: Allocator, data: *const LocaleData, q: Quantity, options: UnitFormatOptions) Allocator.Error![]Part {
    const params = try getNumberParams(data, options.nu, null);
    return internal.renderUnit(a, data, .{ .a = a, .params = params }, q, options, params);
}

fn sequenceParts(a: Allocator, data: *const LocaleData, qs: []const Quantity, options: UnitFormatOptions) Allocator.Error![]Part {
    const items = try a.alloc([]const Part, qs.len);
    for (qs, items) |q, *item| item.* = try quantityParts(a, data, q, options);
    return general.formatListValue(a, data, items, selectListType(options));
}

fn selectListType(options: UnitFormatOptions) ListPatternType {
    return switch (options.length orelse .long) {
        .narrow => .unit_narrow,
        .short => .unit_short,
        .long => .unit_long,
    };
}
