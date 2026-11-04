const std = @import("std");
const h = @import("hereabouts");
const M = h.messageformat;
const a = std.testing.allocator;

fn cloneFail(gpa: std.mem.Allocator) !void {
    const code: M.MessageCode = .{ .simple = .{ .name = "foo", .args = &.{ .{ .name = "first" }, .{ .name = "second" } }, .options = &.{} } };
    const c = try M.MessageCode.clone(code, gpa);
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
    var t = try M.Translator.init(gpa, .{ .source = &.{.{ .key = "x", .message = "{" }}, .catalogs = &.{.{ .id = "de", .messages = &.{} }} });
    defer t.deinit();
    const issues = try M.Translator.checkCatalogs(&t, gpa, .{});
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
    return M.MessageFormatter.formatMessage(f, gpa, "inner", &.{}, &.{});
}
test "reentrant formatter" {
    var f: M.MessageFormatter = undefined;
    const fs = [_]M.Formatter{.{ .name = "nested", .ctx = &f, .func = nested }};
    f = try M.MessageFormatter.init(a, .{ .cache_size = 1, .formatters = &fs });
    defer f.deinit();
    const s = try M.MessageFormatter.formatMessage(&f, a, "{x, nested} tail", &.{}, &.{.{ .name = "x", .value = .{ .string = "x" } }});
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
        const s = try M.MessageFormatter.formatMessage(f, gpa, &buf, &.{}, &.{});
        gpa.free(s);
        if (i == 999) at1000 = dbg.total_requested_bytes;
    }
    try std.testing.expect(dbg.total_requested_bytes < at1000 + 32 * 1024);
}
test "moved exponent overflow" {
    try std.testing.expectError(error.ExponentOutOfRange, h.decimal.movePoint(a, h.decimal.ONE, std.math.maxInt(i64)));
}
fn patternFail(gpa: std.mem.Allocator) !void {
    const p = try h.core.parsing.date.parseDatePattern(gpa, "literal y");
    defer h.core.parsing.date.freePattern(gpa, p);
    const trailing = try h.core.parsing.date.parseDatePattern(gpa, "'literal'");
    defer h.core.parsing.date.freePattern(gpa, trailing);
}
test "date pattern allocation failures" {
    try std.testing.checkAllAllocationFailures(a, patternFail, .{});
}

test "partial clone cleanup" {
    var fail = std.testing.FailingAllocator.init(std.testing.allocator, .{ .fail_index = 3 });
    const gpa = fail.allocator();
    const c: M.MessageCode = .{ .simple = .{ .name = "foo", .args = &.{ .{ .name = "first" }, .{ .name = "second" } }, .options = &.{} } };
    _ = M.MessageCode.clone(c, gpa) catch |e| {
        try std.testing.expectEqual(error.OutOfMemory, e);
        return;
    };
    return error.ExpectedOutOfMemory;
}

test "decimal exponent and context limits" {
    const D = h.decimal;
    const huge = std.math.maxInt(i64);
    try std.testing.expectError(error.ExponentOutOfRange, D.movePoint(a, D.ONE, std.math.minInt(i64)));
    try std.testing.expectError(error.ExponentOutOfRange, D.shiftLeft(a, D.ONE, huge));
    try std.testing.expectError(error.ExponentOutOfRange, D.shiftRight(a, D.ONE, huge, .half_even));
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
    var f = try M.MessageFormatter.init(a, .{ .cache_size = 1, .max_cached_message_bytes = 5 });
    defer f.deinit();
    a.free(try M.MessageFormatter.formatMessage(&f, a, "small", &.{}, &.{}));
    a.free(try M.MessageFormatter.formatMessage(&f, a, "oversized", &.{}, &.{}));
    try std.testing.expectEqual(@as(usize, 1), f.cache.size());
    try std.testing.expect(f.cache.get("small") != null);
    var disabled = try M.MessageFormatter.init(a, .{ .cache_size = 0 });
    defer disabled.deinit();
    a.free(try M.MessageFormatter.formatMessage(&disabled, a, "text", &.{}, &.{}));
    try std.testing.expectEqual(@as(usize, 0), disabled.cache.size());
    var t = try M.Translator.init(a, .{ .source = &.{}, .cache_size = 2, .plural_cache_size = 1, .max_cached_message_bytes = 32 });
    defer t.deinit();
    var buf: [64]u8 = undefined;
    for (0..500) |i| {
        const key = try std.fmt.bufPrint(&buf, "{d}:{{x}}", .{i});
        a.free(try M.Translator.translate(&t, a, "en", key, &.{}));
        try std.testing.expect(t.parsed.size() <= 2);
        try std.testing.expect(t.plurals.size() <= 1);
    }
    const long = "{x} this pattern exceeds the cache limit of thirty two bytes";
    a.free(try M.Translator.translate(&t, a, "en", long, &.{}));
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
    return M.Translator.translate(t, gpa, "en", "inner", &.{.{ .name = "x", .value = .{ .string = "ok" } }});
}
test "translator callbacks may reenter while evicting the outer pattern" {
    var t: M.Translator = undefined;
    const fs = [_]M.Formatter{.{ .name = "nested", .ctx = &t, .func = nestedTranslation }};
    t = try M.Translator.init(a, .{ .source = &.{.{ .key = "inner", .message = "inner {x}" }}, .cache_size = 1, .formatters = &fs });
    defer t.deinit();
    const s = try M.Translator.translate(&t, a, "en", "{x, nested} tail", &.{.{ .name = "x", .value = .{ .string = "x" } }});
    defer a.free(s);
    try std.testing.expectEqualStrings("inner ok tail", s);
}
test "unknown translator pattern churn retains bounded bytes" {
    var dbg: std.heap.DebugAllocator(.{ .enable_memory_limit = true }) = .init;
    defer _ = dbg.deinit();
    const gpa = dbg.allocator();
    var t = try M.Translator.init(gpa, .{ .source = &.{}, .cache_size = 3 });
    defer t.deinit();
    var buf: [512]u8 = @splat('x');
    var before: usize = 0;
    for (0..600) |i| {
        _ = try std.fmt.bufPrint(buf[0..16], "{d:0>12}{{x}}", .{i});
        gpa.free(try M.Translator.translate(&t, gpa, "en", &buf, &.{}));
        if (i == 299) before = dbg.total_requested_bytes;
    }
    try std.testing.expect(dbg.total_requested_bytes <= before + 4096);
}

fn realLoad(_: ?*anyopaque, language: []const u8) ?[]const u8 {
    return @import("packs").get(language);
}
test "independent timezone databases remain explicit through date operations" {
    const tz = h.timezone;
    const C = h.core.calendars;
    const one = try tz.Database.decode(a, .{ .zoneids = "Etc/UTC|Foo/Bar", .links = "UTC:0|Alias/Foo:1", .index = "", .zoneinfo = &.{ "0_0_0__UTC:0:0__", "2s0_0_0__ONE:0:2s0__" } });
    defer one.deinit(a);
    const two = try tz.Database.decode(a, .{ .zoneids = "Etc/UTC|Foo/Bar", .links = "UTC:0|Alias/Foo:1", .index = "", .zoneinfo = &.{ "0_0_0__UTC:0:0__", "5k0_0_0__TWO:0:5k0__" } });
    defer two.deinit(a);
    const c1: h.datetime.ZoneContext = .{ .database = &one };
    const c2: h.datetime.ZoneContext = .{ .database = &two };
    try std.testing.expectEqual(@as(i64, 3600000), try c1.timeZoneOffset("Foo/Bar", 0));
    try std.testing.expectEqual(@as(i64, 7200000), try c2.timeZoneOffset("Foo/Bar", 0));
    try std.testing.expect(tz.fromUTC("Foo/Bar", 0) == null);
    try std.testing.expectEqual(@as(?i64, -3600000), try c1.instantParse("1970-01-01T00:00", "Alias/Foo"));
    try std.testing.expectEqual(@as(?i64, -7200000), try c2.instantParse("1970-01-01T00:00", "Alias/Foo"));
    const s = try c1.instantToString(a, 0, "Foo/Bar");
    defer a.free(s);
    try std.testing.expectEqualStrings("1970-01-01T01:00:00.000+01:00", s);
    const d1 = try C.gregorianDateFromFields(&one, .{ .year = 1970, .month = 1, .day = 1, .zone_id = "Foo/Bar" }, 1, 1);
    const d2 = try C.gregorianDateFromFields(&two, .{ .year = 1970, .month = 1, .day = 1, .zone_id = "Foo/Bar" }, 1, 1);
    try std.testing.expectEqual(@as(i64, -3600000), C.CalendarDate.unixEpoch(&d1));
    try std.testing.expectEqual(@as(i64, -7200000), C.CalendarDate.unixEpoch(&d2));
    const added = try C.CalendarDate.add(&d1, .{ .day = 1 });
    const set = C.CalendarDate.set(&d1, .{ .day = 2 });
    const rezoned = C.CalendarDate.withZone(&d1, "UTC");
    try std.testing.expect(added.database == &one and set.database == &one and rezoned.database == &one);
    try std.testing.expectEqual(@as(i64, 86400000 - 3600000), C.CalendarDate.unixEpoch(&added));
    try std.testing.expectEqual(C.CalendarDate.unixEpoch(&added), C.CalendarDate.unixEpoch(&set));
    // Each operand keeps its own instant; result wall arithmetic uses the receiver's database.
    const mixed = C.CalendarDate.until(&d1, &d2, .{});
    try std.testing.expectEqual(@as(f64, -1), mixed.hour);
    const locale = blk: {
        var fw = h.core.CLDRFramework.init(a, .{ .loader = .{ .load = realLoad }, .timezone_database = &two });
        defer fw.deinit();
        break :blk try fw.get(.{ .id = "en" });
    };
    defer locale.deinit();
    const from_locale = try locale.calendars.newGregorianDate(.{ .year = 1970, .month = 1, .day = 1, .zone_id = "Foo/Bar" });
    try std.testing.expect(from_locale.database == &two);
    try std.testing.expectEqual(@as(i64, -7200000), C.CalendarDate.unixEpoch(&from_locale));
    try std.testing.expectEqual(@as(i64, 7200000), locale.calendars.timeZoneFromUTC(0, "Foo/Bar").?.offset);
    try std.testing.expectEqual(@as(usize, 2), locale.calendars.timeZoneIds().len);
    try std.testing.expectEqualStrings("Foo/Bar", locale.calendars.resolveTimeZoneId("Alias/Foo").?);
    const converted = locale.calendars.toBuddhistDate(.{ .calendar = d1 });
    try std.testing.expect(converted.database == &one);
    // A custom database need not include the bundled unknown-zone sentinel.
    const unknown = locale.calendars.timeZoneInfo("Missing/Zone");
    try std.testing.expectEqualStrings("Factory", unknown.id);
}

test "direct locale methods and TypeScript method mapping" {
    inline for (.{ h.core.CLDR, h.core.CLDRView, h.core.LocaleHandle, h.datetime.Day, h.datetime.TimeOfDay, h.core.calendars.CalendarDate, M.MessageFormatter, M.Translator, h.unit_converter.UnitConverter, h.unit_converter.UnitFactors }) |T| std.testing.refAllDecls(T);
    var fw = h.core.CLDRFramework.init(a, .{ .loader = .{ .load = realLoad } });
    defer fw.deinit();
    const de = try fw.get(.{ .id = "de" });
    defer de.deinit();
    const n = try de.parseDecimal(a, "1234.5");
    defer n.deinit(a);
    const direct = try de.formatDecimal(a, n, .{ .maximum_fraction_digits = 1 });
    defer a.free(direct);
    const grouped = try de.numbers.formatDecimal(a, n, .{ .maximum_fraction_digits = 1 });
    defer a.free(grouped);
    try std.testing.expectEqualStrings("1.234,5", direct);
    try std.testing.expectEqualStrings(direct, grouped);
    const borrowed = h.core.bindCLDR(de.data);
    const list = try borrowed.formatList(a, &.{ "eins", "zwei" }, null);
    defer a.free(list);
    try std.testing.expectEqualStrings("eins und zwei", list);
    const handle = try fw.framework.loadLocale(.{ .id = "de" });
    defer handle.deinit();
    const owned_list = try handle.formatList(a, &.{ "eins", "zwei" }, null);
    defer a.free(owned_list);
    try std.testing.expectEqualStrings(list, owned_list);
    const d = try h.datetime.Day.init(2026, 1, 31);
    const next = try d.add(.{ .months = 1 });
    try std.testing.expectEqual(@as(i32, 28), next.day);
    const time = try h.datetime.TimeOfDay.init(9, 0, 0, 0);
    const rendered = try time.toString(a);
    defer a.free(rendered);
    try std.testing.expectEqualStrings("09:00", rendered);
    var f = try M.MessageFormatter.init(a, .{});
    defer f.deinit();
    a.free(try f.formatMessage(a, "hello", &.{}, &.{}));
    const date = try de.newGregorianDate(.{ .year = 2026, .month = 1, .day = 31 });
    try std.testing.expectEqual(@as(i64, 2026), date.year());
    try std.testing.expectEqual(@as(?i64, 31), date.fields().day);
}
