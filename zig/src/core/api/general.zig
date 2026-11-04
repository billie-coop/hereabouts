//! Locale layout, lists, display names and message formatting (`api/general.ts`).
const std = @import("std");
const Allocator = std.mem.Allocator;
const LocaleData = @import("../locale_data.zig").LocaleData;
const tags = @import("../../language_tag/language_tag.zig");
const locales = @import("../../locale/locale.zig");
const VectorArrow = @import("../schema/schema/arrows.zig").VectorArrow;
const internal = @import("../internals/general/internal.zig");
const render = @import("../utils/render.zig");
const Part = @import("../../decimal/decimal.zig").Part;
const mf = @import("../../messageformat/messageformat.zig");
pub const options = @import("../common/general.zig");
pub const DisplayNameOptions = options.DisplayNameOptions;
pub const ListPatternType = options.ListPatternType;
pub const NameInput = union(enum) { code: []const u8, tag: tags.LanguageTag };

pub fn characterOrder(data: *const LocaleData) options.CharacterOrder {
    return std.meta.stringToEnum(options.CharacterOrder, data.schema.Layout.characterOrder.get(&data.bundle)).?;
}
pub fn lineOrder(data: *const LocaleData) options.LineOrder {
    return std.meta.stringToEnum(options.LineOrder, data.schema.Layout.lineOrder.get(&data.bundle)).?;
}
pub fn measurementSystem(data: *const LocaleData, category: ?options.MeasurementCategory) options.MeasurementSystem {
    const region = data.bundle.region;
    if (category == .temperature) {
        for ([_][]const u8{ "BS", "BZ", "PR", "PW" }) |r| if (std.mem.eql(u8, region, r)) return .us;
        return .metric;
    }
    if (std.mem.eql(u8, region, "GB")) return .uk;
    for ([_][]const u8{ "LR", "MM", "US" }) |r| if (std.mem.eql(u8, region, r)) return .us;
    return .metric;
}

/// Cached default formatter, owned by the locale. Do not deinit. Not thread-safe.
pub fn messageFormatter(data: *const LocaleData) Allocator.Error!*mf.MessageFormatter {
    if (data.caches.default_formatter) |f| return f;
    const f = try data.gpa.create(mf.MessageFormatter);
    errdefer data.gpa.destroy(f);
    f.* = try createMessageFormatter(data.gpa, data, .{});
    data.caches.default_formatter = f;
    return f;
}
/// With options, create a caller-owned formatter. Call its deinit when done.
pub fn createMessageFormatter(gpa: Allocator, data: *const LocaleData, opts: mf.MessageFormatterOptions) Allocator.Error!mf.MessageFormatter {
    var o = opts;
    o.plurals = data.bundle.plurals;
    return mf.MessageFormatter.init(gpa, o);
}

fn listParts(a: Allocator, data: *const LocaleData, items: []const []const u8, t: ?ListPatternType) Allocator.Error![]Part {
    const args = try a.alloc([]const Part, items.len);
    for (items, args) |item, *arg| {
        const p = try a.alloc(Part, 1);
        p[0] = .{ .type = "item", .value = item };
        arg.* = p;
    }
    return internal.formatListValue(a, data, args, t orelse .@"and");
}
/// Owned string. Empty items remain present in the list.
pub fn formatList(gpa: Allocator, data: *const LocaleData, items: []const []const u8, t: ?ListPatternType) Allocator.Error![]u8 {
    var arena = std.heap.ArenaAllocator.init(gpa);
    defer arena.deinit();
    return render.joinParts(gpa, try listParts(arena.allocator(), data, items, t));
}
/// Owned parts; free with decimal.freeParts.
pub fn formatListToParts(gpa: Allocator, data: *const LocaleData, items: []const []const u8, t: ?ListPatternType) Allocator.Error![]Part {
    var arena = std.heap.ArenaAllocator.init(gpa);
    defer arena.deinit();
    return render.copyParts(gpa, try listParts(arena.allocator(), data, items, t));
}

fn getAlt(data: *const LocaleData, arrow: VectorArrow, code: []const u8, alt: options.AltType) []const u8 {
    const s = arrow.get(&data.bundle, &.{ alt.toString(), code });
    return if (s.len > 0) s else arrow.get(&data.bundle, &.{ "none", code });
}
fn inputTag(a: Allocator, input: NameInput) Allocator.Error!tags.LanguageTag {
    return switch (input) {
        .code => |s| tags.parseLanguageTag(a, s),
        .tag => |t| t,
    };
}
fn compound(a: Allocator, data: *const LocaleData, arrow: VectorArrow, tag: tags.LanguageTag, region: bool, alt: options.AltType) Allocator.Error![]const u8 {
    const code = try std.fmt.allocPrint(a, "{s}-{s}", .{ tag.tagLanguage(), if (region) tag.tagRegion() else tag.tagScript() });
    return getAlt(data, arrow, code, alt);
}
/// Owned display name. The input distinguishes a raw code from a parsed language tag.
pub fn getLanguageDisplayName(gpa: Allocator, data: *const LocaleData, input: NameInput, o: DisplayNameOptions) Allocator.Error![]u8 {
    var arena = std.heap.ArenaAllocator.init(gpa);
    defer arena.deinit();
    const a = arena.allocator();
    const arrow = data.schema.Names.languages.displayName;
    var tag = try inputTag(a, input);
    var s: []const u8 = if (input == .code) getAlt(data, arrow, input.code, o.type) else "";
    if (s.len == 0 and tag.hasLanguage() and tag.hasRegion()) s = try compound(a, data, arrow, tag, true, o.type);
    if (s.len == 0 and tag.hasLanguage() and tag.hasScript()) s = try compound(a, data, arrow, tag, false, o.type);
    if (s.len == 0 and !tag.hasScript() and !tag.hasRegion()) s = getAlt(data, arrow, tag.tagLanguage(), o.type);
    if (s.len == 0) {
        tag = try locales.resolveLanguageTag(a, .{ .tag = tag });
        s = try compound(a, data, arrow, tag, true, o.type);
        if (s.len == 0) s = try compound(a, data, arrow, tag, false, o.type);
        if (s.len == 0) s = getAlt(data, arrow, tag.tagLanguage(), o.type);
    }
    return internal.contextTransform(gpa, s, data, o.context, "languages");
}
pub fn getScriptDisplayName(gpa: Allocator, data: *const LocaleData, input: NameInput, o: DisplayNameOptions) Allocator.Error![]u8 {
    var arena = std.heap.ArenaAllocator.init(gpa);
    defer arena.deinit();
    const a = arena.allocator();
    const arrow = data.schema.Names.scripts.displayName;
    var s: []const u8 = "";
    switch (input) {
        .code => |c| s = getAlt(data, arrow, c, o.type),
        .tag => |t| if (!t.hasLanguage() or t.hasScript()) {
            s = getAlt(data, arrow, t.tagScript(), o.type);
        },
    }
    if (s.len == 0) {
        const tag = try locales.resolveLanguageTag(a, .{ .tag = try inputTag(a, input) });
        s = getAlt(data, arrow, tag.tagScript(), o.type);
    }
    return internal.contextTransform(gpa, s, data, o.context, "script");
}
pub fn getRegionDisplayName(gpa: Allocator, data: *const LocaleData, input: NameInput, o: DisplayNameOptions) Allocator.Error![]u8 {
    var arena = std.heap.ArenaAllocator.init(gpa);
    defer arena.deinit();
    const a = arena.allocator();
    const arrow = data.schema.Names.regions.displayName;
    var s: []const u8 = "";
    switch (input) {
        .code => |c| s = getAlt(data, arrow, c, o.type),
        .tag => |t| if (!t.hasLanguage() or t.hasRegion()) {
            s = getAlt(data, arrow, t.tagRegion(), o.type);
        },
    }
    if (s.len == 0) {
        const tag = try locales.resolveLanguageTag(a, .{ .tag = try inputTag(a, input) });
        s = getAlt(data, arrow, tag.tagRegion(), o.type);
    }
    return gpa.dupe(u8, s);
}
