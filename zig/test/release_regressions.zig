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
