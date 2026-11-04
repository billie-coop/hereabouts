//! Locale formatting of plain days, wall times and instants.
const std = @import("std");
const A = std.mem.Allocator;
const dt = @import("../../datetime/datetime.zig");
const D = @import("../../decimal/decimal.zig");
const dates = @import("calendars.zig");
const opts = @import("../common/calendars.zig");
const LocaleData = @import("../locale_data.zig").LocaleData;
pub const DayFormatOptions = struct { date: ?[]const u8 = null, skeleton: ?[]const u8 = null, ca: ?opts.CalendarType = null, nu: ?[]const u8 = null, context: ?@import("../types/general.zig").ContextType = null, alt: opts.DateFormatAltOptions = .{} };
pub const DayIntervalFormatOptions = struct { skeleton: ?[]const u8 = null, ca: ?opts.CalendarType = null, nu: ?[]const u8 = null, context: ?@import("../types/general.zig").ContextType = null, alt: opts.DateFormatAltOptions = .{} };
pub const TimeOfDayFormatOptions = struct { skeleton: ?[]const u8 = null, nu: ?[]const u8 = null, context: ?@import("../types/general.zig").ContextType = null, alt: opts.DateFormatAltOptions = .{} };
pub const Error = D.Error || dt.Error || @import("../systems/calendars/types.zig").Error || error{ InvalidSkeleton, DateOutOfRange };
fn check(s: ?[]const u8, allowed: []const u8) Error!void {
    if (s) |raw| for (raw) |c| {
        if (std.mem.indexOfScalar(u8, allowed, c) == null) return error.InvalidSkeleton;
    };
}
fn inRange(d: dt.Day) Error!void {
    const n = try dt.dayToEpochDay(d);
    const lo = try dt.dayToEpochDay(.{ .year = 1582, .month = 10, .day = 15 });
    const hi = try dt.dayToEpochDay(.{ .year = 8652, .month = 12, .day = 31 });
    if (n < lo or n > hi) return error.DateOutOfRange;
}
fn fromDay(data: *const LocaleData, d: dt.Day, t: ?dt.TimeOfDay) Error!dates.DateInput {
    try inRange(d);
    if (t) |time| _ = try dt.timeOfDayToMillis(time);
    return .{ .calendar = try dates.newGregorianDate(data, .{ .year = d.year, .month = d.month, .day = d.day, .hour = if (t) |v| v.hour else 0, .minute = if (t) |v| v.minute else 0, .second = if (t) |v| v.second else 0, .millis = if (t) |v| v.millis else 0, .zoneId = "Etc/UTC" }) };
}
fn dayOptions(o: DayFormatOptions) Error!opts.DateFormatOptions {
    try check(o.skeleton, "GyYuUrQqMLlwWdDFgEec");
    return .{ .date = if ((o.skeleton != null and o.skeleton.?.len > 0)) null else o.date orelse "medium", .skeleton = o.skeleton, .ca = o.ca, .nu = o.nu, .context = o.context, .alt = o.alt };
}
fn timeOptions(o: TimeOfDayFormatOptions) Error!opts.DateFormatOptions {
    try check(o.skeleton, "abBhHkKjJCmsSA");
    return .{ .skeleton = if ((o.skeleton != null and o.skeleton.?.len > 0)) o.skeleton else "jm", .nu = o.nu, .context = o.context, .alt = o.alt };
}
fn intervalOptions(o: DayIntervalFormatOptions) Error!opts.DateIntervalFormatOptions {
    try check(o.skeleton, "GyYuUrQqMLlwWdDFgEec");
    return .{ .skeleton = if ((o.skeleton != null and o.skeleton.?.len > 0)) o.skeleton else "yMMMd", .ca = o.ca, .nu = o.nu, .context = o.context, .alt = o.alt };
}
fn zoned(instant: dt.Instant, zone: []const u8) Error!dates.DateInput {
    const id = try dt.timeZoneId(zone);
    try inRange(try dt.dayFromInstant(instant, id));
    return .{ .zoned = .{ .date = @floatFromInt(instant), .zone_id = id } };
}
pub fn formatDay(a: A, data: *const LocaleData, d: dt.Day, options: ?DayFormatOptions) Error![]u8 {
    return dates.formatDate(a, data, try fromDay(data, d, null), try dayOptions(options orelse .{}));
}
pub fn formatDayToParts(a: A, data: *const LocaleData, d: dt.Day, options: ?DayFormatOptions) Error![]D.Part {
    return dates.formatDateToParts(a, data, try fromDay(data, d, null), try dayOptions(options orelse .{}));
}
pub fn formatDayInterval(a: A, data: *const LocaleData, start: dt.Day, end: dt.Day, options: ?DayIntervalFormatOptions) Error![]u8 {
    return dates.formatDateInterval(a, data, try fromDay(data, start, null), try fromDay(data, end, null), try intervalOptions(options orelse .{}));
}
pub fn formatDayIntervalToParts(a: A, data: *const LocaleData, start: dt.Day, end: dt.Day, options: ?DayIntervalFormatOptions) Error![]D.Part {
    return dates.formatDateIntervalToParts(a, data, try fromDay(data, start, null), try fromDay(data, end, null), try intervalOptions(options orelse .{}));
}
pub fn formatTimeOfDay(a: A, data: *const LocaleData, t: dt.TimeOfDay, options: ?TimeOfDayFormatOptions) Error![]u8 {
    return dates.formatDate(a, data, try fromDay(data, .{ .year = 1970, .month = 1, .day = 1 }, t), try timeOptions(options orelse .{}));
}
pub fn formatTimeOfDayToParts(a: A, data: *const LocaleData, t: dt.TimeOfDay, options: ?TimeOfDayFormatOptions) Error![]D.Part {
    return dates.formatDateToParts(a, data, try fromDay(data, .{ .year = 1970, .month = 1, .day = 1 }, t), try timeOptions(options orelse .{}));
}
pub fn formatDayRelative(a: A, data: *const LocaleData, d: dt.Day, relative_to: dt.Day, options: ?opts.RelativeTimeFieldFormatOptions) Error![]u8 {
    var arena: std.heap.ArenaAllocator = .init(a);
    defer arena.deinit();
    return dates.formatRelativeTimeField(a, data, try D.fromInt(arena.allocator(), try dt.dayUntil(relative_to, d, .days)), "day", options);
}
pub fn formatInstant(a: A, data: *const LocaleData, instant: dt.Instant, zone: []const u8, options: ?opts.DateFormatOptions) Error![]u8 {
    return dates.formatDate(a, data, try zoned(instant, zone), options);
}
pub fn formatInstantToParts(a: A, data: *const LocaleData, instant: dt.Instant, zone: []const u8, options: ?opts.DateFormatOptions) Error![]D.Part {
    return dates.formatDateToParts(a, data, try zoned(instant, zone), options);
}
pub fn formatInstantRelative(a: A, data: *const LocaleData, instant: dt.Instant, relative_to: dt.Instant, zone: []const u8, options: ?opts.RelativeTimeFormatOptions) Error![]u8 {
    return dates.formatRelativeTime(a, data, try zoned(relative_to, zone), try zoned(instant, zone), options);
}
