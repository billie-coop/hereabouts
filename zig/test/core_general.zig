//! Shared TypeScript cases for general formatting and the bound locale API.
const std = @import("std");
const h = @import("hereabouts");
const core = h.core;
const gen = core.general;
const opts = core.general_options;
const D = h.decimal;
const mf = h.messageformat;
const cases = @import("cases");
const packs = @import("packs");
const Value = std.json.Value;
const Allocator = std.mem.Allocator;

fn loadPack(_: ?*anyopaque, language: []const u8) ?[]const u8 {
    return packs.get(language);
}
fn eql(a: []const u8, b: []const u8) bool {
    return std.mem.eql(u8, a, b);
}
fn strings(a: Allocator, v: Value) ![]const []const u8 {
    const ss = try a.alloc([]const u8, v.array.items.len);
    for (ss, v.array.items) |*s, item| s.* = item.string;
    return ss;
}
fn context(v: Value) ?opts.ContextType {
    return if (v == .null) null else opts.ContextType.fromString(v.string);
}
fn nameOptions(v: Value) opts.DisplayNameOptions {
    var o: opts.DisplayNameOptions = .{};
    if (v.object.get("type")) |s| o.type = opts.AltType.fromString(s.string) orelse .none;
    if (v.object.get("context")) |s| o.context = opts.ContextType.fromString(s.string) orelse .begin_sentence;
    return o;
}
fn value(a: Allocator, v: anytype) !Value {
    const s = try std.json.Stringify.valueAlloc(a, v, .{});
    return (try std.json.parseFromSlice(Value, a, s, .{})).value;
}
fn string(s: []const u8) Value {
    return .{ .string = s };
}
fn number(v: Value) f64 {
    return switch (v) {
        .integer => |i| @floatFromInt(i),
        .float => |f| f,
        else => unreachable,
    };
}
fn run(fw: *core.CLDRFramework, a: Allocator, name: []const u8, args: []const Value) !Value {
    const internal = core.internals.general;
    if (eql(name, "formatWrapper")) return string(try internal.formatWrapper(a, args[0].string, try strings(a, args[1])));
    if (eql(name, "parseWrapper")) {
        const nodes = try internal.parseWrapper(a, args[0].string);
        var out: std.array_list.Managed(Value) = .init(a);
        for (nodes) |n| try out.append(switch (n) {
            .text => |s| string(s),
            .arg => |i| if (i) |k| .{ .integer = @intCast(k) } else .null,
        });
        return .{ .array = out };
    }
    if (eql(name, "contextTransform")) return string(try internal.contextTransformWithFlag(a, args[0].string, args[1].string, context(args[2])));
    const api = try fw.get(.{ .id = args[0].string });
    const data = api.data;
    if (eql(name, "characterOrder")) return string(@tagName(gen.characterOrder(data)));
    if (eql(name, "lineOrder")) return string(@tagName(gen.lineOrder(data)));
    if (eql(name, "measurementSystem")) return string(@tagName(gen.measurementSystem(data, if (args[1] == .null) null else .temperature)));
    if (eql(name, "getContextTransformInfo")) return (try core.getContextTransformInfo(data)).*;
    if (eql(name, "contextTransformLocale")) return string(try internal.contextTransform(a, args[1].string, data, context(args[2]), args[3].string));
    if (eql(name, "formatList") or eql(name, "formatListToParts")) {
        const t = if (args[2] == .null) null else opts.ListPatternType.fromString(args[2].string);
        const ss = try strings(a, args[1]);
        if (eql(name, "formatList")) return string(try gen.formatList(a, data, ss, t));
        return value(a, try gen.formatListToParts(a, data, ss, t));
    }
    if (eql(name, "getLanguageDisplayName") or eql(name, "getScriptDisplayName") or eql(name, "getRegionDisplayName")) {
        const input: gen.NameInput = if (args[2].bool) .{ .tag = try h.language_tag.parse(a, args[1].string) } else .{ .code = args[1].string };
        const o = nameOptions(args[3]);
        if (eql(name, "getLanguageDisplayName")) return string(try gen.getLanguageDisplayName(a, data, input, o));
        if (eql(name, "getScriptDisplayName")) return string(try gen.getScriptDisplayName(a, data, input, o));
        return string(try gen.getRegionDisplayName(a, data, input, o));
    }
    if (eql(name, "messageFormatter") or eql(name, "messageFormatterOptions")) {
        var custom: ?mf.MessageFormatter = null;
        defer if (custom) |*f| f.deinit();
        const f = if (eql(name, "messageFormatterOptions")) blk: {
            custom = try gen.createMessageFormatter(a, data, .{ .language = "en", .plurals = h.plurals.getPluralRules("en", null), .cache_size = 3 });
            break :blk &custom.?;
        } else try gen.messageFormatter(data);
        return string(try mf.formatMessage(a, f, args[1].string, &.{.{ .number = number(args[2]) }}, &.{}));
    }
    if (eql(name, "bindCLDR")) {
        return value(a, .{
            .characterOrder = @tagName(api.General.characterOrder()),
            .lineOrder = @tagName(api.General.lineOrder()),
            .list = try api.General.formatList(a, &.{ "a", "b", "c" }, null),
            .language = try api.General.getLanguageDisplayName(a, .{ .code = "en-GB" }, .{ .type = .short }),
            .decimal = try api.Numbers.formatDecimal(a, try D.parse(a, "1234.5"), .{}),
            .currency = try api.Numbers.formatCurrency(a, try D.parse(a, "19.95"), "USD", .{}),
            .quantity = try api.Units.formatQuantity(a, .{ .value = try D.parse(a, "17.69"), .unit = "pound" }, .{ .maximum_fraction_digits = 1 }),
        });
    }
    return error.UnknownFunction;
}
fn jsonEql(a: Value, b: Value) bool {
    switch (a) {
        .object => |obj| {
            if (b != .object or obj.count() != b.object.count()) return false;
            var it = obj.iterator();
            while (it.next()) |e| if (!jsonEql(e.value_ptr.*, b.object.get(e.key_ptr.*) orelse return false)) return false;
            return true;
        },
        .array => |xs| {
            if (b != .array or xs.items.len != b.array.items.len) return false;
            for (xs.items, b.array.items) |x, y| if (!jsonEql(x, y)) return false;
            return true;
        },
        .string => |s| return b == .string and eql(s, b.string),
        .integer, .float => return (b == .integer or b == .float) and number(a) == number(b),
        .bool => |x| return b == .bool and x == b.bool,
        .null => return b == .null,
        else => return false,
    }
}
test "conformance cases" {
    const gpa = std.testing.allocator;
    var fw = core.CLDRFramework.init(gpa, .{ .loader = .{ .load = loadPack } });
    defer fw.deinit();
    const parsed = try std.json.parseFromSlice(Value, gpa, cases.json, .{});
    defer parsed.deinit();
    var failures: usize = 0;
    for (parsed.value.array.items, 0..) |c, i| {
        var arena = std.heap.ArenaAllocator.init(gpa);
        defer arena.deinit();
        const a = arena.allocator();
        const o = c.object;
        const name = o.get("fn").?.string;
        const args = o.get("args").?.array.items;
        const want = o.get("result").?;
        const got = run(&fw, a, name, args) catch |err| {
            if (failures < 25) std.debug.print("case {d} {s}: {s}\n", .{ i, name, @errorName(err) });
            failures += 1;
            continue;
        };
        if (!jsonEql(want, got)) {
            if (failures < 25) std.debug.print("case {d} {s}: args {s}\n  want {s}\n  got  {s}\n", .{ i, name, try std.json.Stringify.valueAlloc(a, o.get("args").?, .{}), try std.json.Stringify.valueAlloc(a, want, .{}), try std.json.Stringify.valueAlloc(a, got, .{}) });
            failures += 1;
        }
    }
    if (failures > 0) {
        std.debug.print("{d}/{d} cases failed\n", .{ failures, parsed.value.array.items.len });
        return error.TestFailed;
    }
}

test "bound API and ownership" {
    const a = std.testing.allocator;
    var fw = core.CLDRFramework.init(a, .{ .loader = .{ .load = loadPack } });
    defer fw.deinit();
    const en = try fw.get(.{ .id = "en" });
    try std.testing.expect(en.data == (try fw.get(.{ .id = "en" })).data);
    try std.testing.expect(en.Schema == fw.config());
    try std.testing.expect(en.General.bundle() == en.data);
    try std.testing.expectEqualStrings("en", en.General.locale().id);
    const s = try en.General.formatList(a, &.{ "one", "two", "three" }, null);
    defer a.free(s);
    try std.testing.expectEqualStrings("one, two, and three", s);
    D.freeParts(a, try en.General.formatListToParts(a, &.{ "a", "" }, .@"or"));
    a.free(try en.General.getLanguageDisplayName(a, .{ .code = "zh-TW" }, .{}));
    a.free(try en.General.getScriptDisplayName(a, .{ .tag = .{ .language = "en" } }, .{}));
    a.free(try en.General.getRegionDisplayName(a, .{ .code = "US" }, .{}));
    const tag = try en.General.parseLanguageTag(a, "zh-TW");
    defer tag.deinit(a);
    const resolved = try en.General.resolveLocale(a, "zh-TW");
    defer resolved.deinit(a);
    const resolved_tag = try en.General.resolveLocaleTag(a, tag);
    defer resolved_tag.deinit(a);
    try std.testing.expectEqualStrings("Hant", resolved_tag.tag.getScript());
    const n = try en.Numbers.parseDecimal(a, "1234.5");
    defer n.deinit(a);
    a.free(try en.Numbers.formatDecimal(a, n, .{}));
    D.freeParts(a, try en.Numbers.formatDecimalToParts(a, n, .{}));
    a.free(try en.Numbers.formatCurrency(a, n, "USD", .{}));
    D.freeParts(a, try en.Numbers.formatCurrencyToParts(a, n, "USD", .{}));
    a.free(try en.Numbers.getCurrencyDisplayName(a, "USD", .{}));
    a.free(try en.Numbers.getCurrencyPluralName(a, n, "USD", .{}));
    try std.testing.expect(en.Numbers.getCurrencySymbol("USD", .default).len > 0);
    const adjusted = try en.Numbers.adjustDecimal(a, n, .{});
    defer adjusted.deinit(a);
    _ = try en.Numbers.getPluralCardinal(a, n, null);
    _ = try en.Numbers.getPluralOrdinal(a, n, null);
    _ = en.Numbers.getCurrencyFractions("USD");
    _ = en.Numbers.getCurrencyForRegion("US");
    _ = en.Units.availableUnits();
    _ = en.Units.getUnitDisplayName("meter", null);
    const q: core.units.Quantity = .{ .value = n, .unit = "meter" };
    a.free(try en.Units.formatQuantity(a, q, .{}));
    D.freeParts(a, try en.Units.formatQuantityToParts(a, q, .{}));
    a.free(try en.Units.formatQuantitySequence(a, &.{ q, q }, .{}));
    D.freeParts(a, try en.Units.formatQuantitySequenceToParts(a, &.{ q, q }, .{}));
    const f = try en.General.messageFormatter();
    try std.testing.expect(f == try en.General.messageFormatter());
    a.free(try mf.formatMessage(a, f, "{0 plural one {one} other {other}}", &.{.{ .number = 2 }}, &.{}));
    var custom = try en.General.createMessageFormatter(a, .{ .cache_size = 3 });
    defer custom.deinit();
    a.free(try mf.formatMessage(a, &custom, "{0}", &.{.{ .string = "hello" }}, &.{}));
    a.free(try fw.info(a));
    a.free(try core.internals.general.formatWrapper(a, "{0}-{1}", &.{ "a", "b" }));
    a.free(try core.internals.general.contextTransformWithFlag(a, "ßeta", "TN", .standalone));
    _ = try core.getContextTransformInfo(en.data);
}

test "public declarations" {
    std.testing.refAllDecls(core.general);
    std.testing.refAllDecls(core.general_options);
    std.testing.refAllDecls(core.bound_api.General);
    std.testing.refAllDecls(core.bound_api.Numbers);
    std.testing.refAllDecls(core.bound_api.Units);
    std.testing.refAllDecls(core.cldr);
    try std.testing.expectEqual(opts.AltType.stand_alone, opts.AltType.fromString("stand-alone").?);
    try std.testing.expectEqualStrings("stand-alone", opts.AltType.stand_alone.string());
    try std.testing.expect(opts.AltType.fromString("INVALID") == null);
}
