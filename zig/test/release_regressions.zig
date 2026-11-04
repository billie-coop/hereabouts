const std = @import("std");
const h = @import("hereabouts");
const M = h.messageformat;
const a = std.testing.allocator;

fn cloneFail(gpa: std.mem.Allocator) !void {
    const code: M.MessageCode = .{ .simple = .{ .name = "foo", .args = &.{ .{ .name = "first" }, .{ .name = "second" } }, .options = &.{} } };
    const c = try M.cloneMessageCode(gpa, code);
    defer c.deinit(gpa);
}
test "clone allocation failures" {
    try std.testing.checkAllAllocationFailures(a, cloneFail, .{});
}
fn namesFail(gpa: std.mem.Allocator) !void {
    const names = try M.messageArgNames(gpa, "{first} {second}", .{});
    defer M.freeStrings(gpa, names);
}
test "names allocation failures" {
    try std.testing.checkAllAllocationFailures(a, namesFail, .{});
}
fn catalogFail(gpa: std.mem.Allocator) !void {
    var t = try M.createTranslator(gpa, .{ .source = &.{.{ .key = "x", .message = "{" }}, .catalogs = &.{.{ .id = "de", .messages = &.{} }} });
    defer t.deinit();
    const issues = try M.checkCatalogs(gpa, &t, .{});
    defer M.freeCatalogIssues(gpa, issues);
}
test "catalog allocation failures" {
    try std.testing.checkAllAllocationFailures(a, catalogFail, .{});
}
fn intFail(gpa: std.mem.Allocator) !void {
    const s = try h.core.numbering.formatInt(gpa, h.core.numbering.INTERNAL_NUMBERING, 42, true, 1);
    defer gpa.free(s);
}
test "integer allocation failures" {
    try std.testing.checkAllAllocationFailures(a, intFail, .{});
}
test "timezone offset overflow" {
    try std.testing.expectError(error.InvalidTimeZoneData, h.timezone.Database.decode(a, .{ .zoneids = "A", .links = "", .index = "", .zoneinfo = &.{"0_0_0__A:0:1y2p0ij32e8e7__"} }));
}
test "timezone standard offset overflow" {
    try std.testing.expectError(error.InvalidTimeZoneData, h.timezone.Database.decode(a, .{ .zoneids = "A", .links = "", .index = "", .zoneinfo = &.{"1y2p0ij32e8e7_0_0__A:0:0__"} }));
}
fn nested(ctx: ?*const anyopaque, gpa: std.mem.Allocator, _: []const ?M.MessageArg, _: []const []const u8) M.Error![]const u8 {
    const f: *M.MessageFormatter = @ptrCast(@alignCast(@constCast(ctx.?)));
    return M.formatMessage(gpa, f, "inner", &.{}, &.{});
}
test "reentrant formatter" {
    var f: M.MessageFormatter = undefined;
    const fs = [_]M.Formatter{.{ .name = "nested", .ctx = &f, .func = nested }};
    f = try M.createMessageFormatter(a, .{ .cache_size = 1, .formatters = &fs });
    defer f.deinit();
    const s = try M.formatMessage(a, &f, "{x, nested} tail", &.{}, &.{.{ .name = "x", .value = .{ .string = "x" } }});
    defer a.free(s);
    try std.testing.expectEqualStrings("inner tail", s);
}
test "scale minimum overflow" {
    try std.testing.expectError(error.ExponentOutOfRange, h.decimal.setScale(a, h.decimal.ONE, std.math.minInt(i64), .half_even));
}

test "default formatter bounded memory" {
    var dbg: std.heap.DebugAllocator(.{ .enable_memory_limit = true }) = .init;
    defer _ = dbg.deinit();
    const gpa = dbg.allocator();
    const l = try h.core.resolveLocale(gpa, "en");
    const b = try h.core.stringBundle(gpa, l.tag, &.{}, &.{}, null);
    var data = try h.core.LocaleData.initDefault(gpa, l, b);
    defer data.deinit();
    const f = try h.core.general.messageFormatter(&data);
    var at1000: usize = 0;
    var buf: [1024]u8 = @splat('x');
    for (0..2000) |i| {
        _ = std.fmt.bufPrint(buf[0..8], "{d:0>8}", .{i}) catch unreachable;
        const s = try M.formatMessage(gpa, f, &buf, &.{}, &.{});
        gpa.free(s);
        if (i == 999) at1000 = dbg.total_requested_bytes;
    }
    try std.testing.expect(dbg.total_requested_bytes < at1000 + 32 * 1024);
}
test "moved exponent overflow" {
    try std.testing.expectError(error.ExponentOutOfRange, h.decimal.movePoint(a, h.decimal.ONE, std.math.maxInt(i64)));
}
fn patternFail(gpa: std.mem.Allocator) !void {
    const p = try h.core.date_parsing.parseDatePattern(gpa, "literal y");
    defer h.core.date_parsing.freePattern(gpa, p);
    const trailing = try h.core.date_parsing.parseDatePattern(gpa, "'literal'");
    defer h.core.date_parsing.freePattern(gpa, trailing);
}
test "date pattern allocation failures" {
    try std.testing.checkAllAllocationFailures(a, patternFail, .{});
}

test "partial clone cleanup" {
    var fail = std.testing.FailingAllocator.init(std.testing.allocator, .{ .fail_index = 3 });
    const gpa = fail.allocator();
    const c: M.MessageCode = .{ .simple = .{ .name = "foo", .args = &.{ .{ .name = "first" }, .{ .name = "second" } }, .options = &.{} } };
    _ = M.cloneMessageCode(gpa, c) catch |e| {
        try std.testing.expectEqual(error.OutOfMemory, e);
        return;
    };
    return error.ExpectedOutOfMemory;
}

test "decimal exponent and context limits" {
    const D = h.decimal;
    const huge = std.math.maxInt(i64);
    try std.testing.expectError(error.ExponentOutOfRange, D.movePoint(a, D.ONE, std.math.minInt(i64)));
    try std.testing.expectError(error.ExponentOutOfRange, D.shiftleft(a, D.ONE, huge));
    try std.testing.expectError(error.ExponentOutOfRange, D.shiftright(a, D.ONE, huge, .half_even));
    try std.testing.expectError(error.ExponentOutOfRange, D.multiply(a, D.ONE, D.ONE, .{ .scale = std.math.minInt(i64) }));
    try std.testing.expectError(error.ExponentOutOfRange, D.divide(a, D.ONE, D.ONE, .{ .precision = huge }));
    try std.testing.expectError(error.ExponentOutOfRange, D.scientific(a, D.ONE, huge));
    const edge = try D.movePoint(a, D.ONE, D.MAX_EXPONENT);
    defer edge.deinit(a);
    try std.testing.expect(D.integerDigits(edge) > 0);
    try std.testing.expectError(error.ExponentOutOfRange, D.movePoint(a, edge, 1));
    try std.testing.expectError(error.ExponentOutOfRange, D.multiply(a, edge, edge, .{}));
}

const tiny_pack = "{\"version\":\"1\",\"language\":\"en\",\"defaultTag\":\"en-Latn-US\",\"scripts\":{\"Latn\":{\"strings\":\"marker\",\"exceptions\":\"\",\"regions\":{\"US\":\"\"},\"defaultRegion\":\"US\"}}}";
fn tinyLoad(_: ?*anyopaque, _: []const u8) ?[]const u8 {
    return tiny_pack;
}
fn survivingLocale(gpa: std.mem.Allocator, capacity: usize) !h.core.LocaleHandle {
    var fw = h.core.Framework.init(gpa, .{ .loader = .{ .load = tinyLoad }, .skip_checksum = true, .pack_cache_size = capacity, .locale_cache_size = capacity });
    defer fw.deinit();
    const first = try fw.loadLocale(.{ .id = "en-US" });
    errdefer first.deinit();
    const copy = first.clone();
    defer copy.deinit();
    const again = try fw.loadLocale(.{ .id = "en-US" });
    defer again.deinit();
    if (capacity > 0) try std.testing.expect(first.data() == again.data());
    for ([_][]const u8{ "fr-FR", "de-DE", "en-GB" }) |id| {
        const next = try fw.loadLocale(.{ .id = id });
        defer next.deinit();
        try std.testing.expect(fw.packs.count() <= capacity);
        try std.testing.expect(fw.locales.count() <= capacity);
        try std.testing.expectEqualStrings("marker", first.data().get(0));
    }
    return first;
}
fn handleFailure(gpa: std.mem.Allocator) !void {
    const handle = try survivingLocale(gpa, 1);
    defer handle.deinit();
    try std.testing.expectEqualStrings("en-US", handle.data().locale.id);
    try std.testing.expectEqualStrings("marker", handle.data().get(0));
}
test "locale handles survive eviction and framework destruction" {
    for ([_]usize{ 0, 1, 2 }) |capacity| {
        const handle = try survivingLocale(a, capacity);
        defer handle.deinit();
        const copy = handle.clone();
        defer copy.deinit();
        try std.testing.expectEqualStrings("en-US", copy.data().locale.id);
        try std.testing.expectEqualStrings("marker", copy.data().get(0));
    }
    try std.testing.checkAllAllocationFailures(a, handleFailure, .{});
}
fn failedDerived(_: void, _: *const h.core.LocaleData, gpa: std.mem.Allocator) std.mem.Allocator.Error!u32 {
    _ = try gpa.alloc(u8, 10000);
    return error.OutOfMemory;
}
test "failed derived cache builds reclaim their arenas" {
    const handle = try survivingLocale(a, 1);
    defer handle.deinit();
    for (0..3) |_| try std.testing.expectError(error.OutOfMemory, handle.data().cached(u32, .latn_system, {}, failedDerived));
}
test "framework cache memory plateaus under locale churn" {
    var dbg: std.heap.DebugAllocator(.{ .enable_memory_limit = true }) = .init;
    defer _ = dbg.deinit();
    const gpa = dbg.allocator();
    var fw = h.core.Framework.init(gpa, .{ .loader = .{ .load = tinyLoad }, .skip_checksum = true, .pack_cache_size = 1, .locale_cache_size = 2 });
    defer fw.deinit();
    var before: usize = 0;
    var buf: [32]u8 = undefined;
    for (0..300) |i| {
        const id = try std.fmt.bufPrint(&buf, "en-US-x-{d:0>6}", .{i});
        const handle = try fw.loadLocale(.{ .id = id });
        handle.deinit();
        if (i == 149) before = dbg.total_requested_bytes;
    }
    try std.testing.expect(dbg.total_requested_bytes <= before + 4096);
    try std.testing.expectEqual(@as(usize, 2), fw.locales.count());
}
test "formatter and translator cache limits and oversized bypass" {
    var f = try M.createMessageFormatter(a, .{ .cache_size = 1, .max_cached_message_bytes = 5 });
    defer f.deinit();
    a.free(try M.formatMessage(a, &f, "small", &.{}, &.{}));
    a.free(try M.formatMessage(a, &f, "oversized", &.{}, &.{}));
    try std.testing.expectEqual(@as(usize, 1), f.cache.size());
    try std.testing.expect(f.cache.get("small") != null);
    var disabled = try M.createMessageFormatter(a, .{ .cache_size = 0 });
    defer disabled.deinit();
    a.free(try M.formatMessage(a, &disabled, "text", &.{}, &.{}));
    try std.testing.expectEqual(@as(usize, 0), disabled.cache.size());
    var t = try M.createTranslator(a, .{ .source = &.{}, .cache_size = 2, .plural_cache_size = 1, .max_cached_message_bytes = 32 });
    defer t.deinit();
    var buf: [64]u8 = undefined;
    for (0..500) |i| {
        const key = try std.fmt.bufPrint(&buf, "{d}:{{x}}", .{i});
        a.free(try M.translate(a, &t, "en", key, &.{}));
        try std.testing.expect(t.parsed.size() <= 2);
        try std.testing.expect(t.plurals.size() <= 1);
    }
    const long = "{x} this pattern exceeds the cache limit of thirty two bytes";
    a.free(try M.translate(a, &t, "en", long, &.{}));
    try std.testing.expect(t.parsed.get(long) == null);
}

fn quantitiesFail(gpa: std.mem.Allocator) !void {
    const qs = try h.core.dates.timePeriodToQuantity(gpa, .{ .year = 1, .day = 3, .millis = 25 });
    defer h.core.unit_options.freeQuantities(gpa, qs);
    try std.testing.expectEqual(@as(usize, 3), qs.len);
}
test "period quantity ownership and allocation failures" {
    try std.testing.checkAllAllocationFailures(a, quantitiesFail, .{});
}

test "locale cache hits refresh LRU order" {
    var fw = h.core.Framework.init(a, .{ .loader = .{ .load = tinyLoad }, .skip_checksum = true, .pack_cache_size = 1, .locale_cache_size = 2 });
    defer fw.deinit();
    const us = try fw.loadLocale(.{ .id = "en-US" });
    defer us.deinit();
    const gb = try fw.loadLocale(.{ .id = "en-GB" });
    defer gb.deinit();
    const hit = try fw.loadLocale(.{ .id = "en-US" });
    defer hit.deinit();
    const ca = try fw.loadLocale(.{ .id = "en-CA" });
    defer ca.deinit();
    const retained = try fw.loadLocale(.{ .id = "en-US" });
    defer retained.deinit();
    try std.testing.expect(us.data() == retained.data());
    const evicted = try fw.loadLocale(.{ .id = "en-GB" });
    defer evicted.deinit();
    try std.testing.expect(gb.data() != evicted.data());
    try std.testing.expectEqualStrings("marker", gb.data().get(0));
}
fn nestedTranslation(ctx: ?*const anyopaque, gpa: std.mem.Allocator, _: []const ?M.MessageArg, _: []const []const u8) M.Error![]const u8 {
    const t: *M.Translator = @ptrCast(@alignCast(@constCast(ctx.?)));
    return M.translate(gpa, t, "en", "inner", &.{.{ .name = "x", .value = .{ .string = "ok" } }});
}
test "translator callbacks may reenter while evicting the outer pattern" {
    var t: M.Translator = undefined;
    const fs = [_]M.Formatter{.{ .name = "nested", .ctx = &t, .func = nestedTranslation }};
    t = try M.createTranslator(a, .{ .source = &.{.{ .key = "inner", .message = "inner {x}" }}, .cache_size = 1, .formatters = &fs });
    defer t.deinit();
    const s = try M.translate(a, &t, "en", "{x, nested} tail", &.{.{ .name = "x", .value = .{ .string = "x" } }});
    defer a.free(s);
    try std.testing.expectEqualStrings("inner ok tail", s);
}
test "unknown translator pattern churn retains bounded bytes" {
    var dbg: std.heap.DebugAllocator(.{ .enable_memory_limit = true }) = .init;
    defer _ = dbg.deinit();
    const gpa = dbg.allocator();
    var t = try M.createTranslator(gpa, .{ .source = &.{}, .cache_size = 3 });
    defer t.deinit();
    var buf: [512]u8 = @splat('x');
    var before: usize = 0;
    for (0..600) |i| {
        _ = try std.fmt.bufPrint(buf[0..16], "{d:0>12}{{x}}", .{i});
        gpa.free(try M.translate(gpa, &t, "en", &buf, &.{}));
        if (i == 299) before = dbg.total_requested_bytes;
    }
    try std.testing.expect(dbg.total_requested_bytes <= before + 4096);
}
