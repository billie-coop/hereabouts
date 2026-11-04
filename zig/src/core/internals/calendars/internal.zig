const std = @import("std");
const A = std.mem.Allocator;
const LocaleData = @import("../../locale_data.zig").LocaleData;
const CalendarType = @import("../../systems/calendars/types.zig").CalendarType;
const Schema = @import("../../types/schema.zig").CalendarSchema;
const data = @import("autogen.dates.zig");
pub const parseDatePattern = @import("../../parsing/date.zig").parseDatePattern;
pub const flexDayPeriod = @import("rules.zig").flexDayPeriod;
pub const renderDateTime = @import("formatter.zig").renderDateTime;
pub const renderDateInterval = @import("formatter.zig").renderDateInterval;
pub const CalendarFormatter = struct { cal: *const Schema, tz: *const @import("../../types/schema.zig").TimeZoneSchema };
pub fn getCalendarFormatter(locale: *const LocaleData, c: CalendarType) CalendarFormatter {
    return .{ .cal = calendarSchema(locale, c), .tz = &locale.schema.TimeZones };
}
pub fn weekFirstDay(region: []const u8) i64 {
    return data.week_first.get(region) orelse data.week_first.get("001").?;
}
pub fn weekMinDays(region: []const u8) i64 {
    return data.week_min.get(region) orelse data.week_min.get("001").?;
}
pub fn supportedCalendar(raw: []const u8) ?CalendarType {
    const s = if (std.mem.eql(u8, raw, "gregorian")) "gregory" else raw;
    const c = std.meta.stringToEnum(CalendarType, s) orelse return null;
    return if (c == .iso8601) null else c;
}
pub fn selectCalendar(locale: *const LocaleData, ca: ?CalendarType) CalendarType {
    if (ca) |c| if (c != .iso8601) return c;
    if (supportedCalendar(locale.bundle.calendar_system)) |c| return c;
    if (data.calendar_prefs.get(locale.bundle.region)) |prefs| for (prefs) |p| {
        if (supportedCalendar(data.calendar_ids[p])) |c| return c;
    };
    return .gregory;
}
pub fn calendarSchema(locale: *const LocaleData, c: CalendarType) *const Schema {
    return switch (c) {
        .buddhist => &locale.schema.Buddhist,
        .japanese => &locale.schema.Japanese,
        .persian => &locale.schema.Persian,
        else => &locale.schema.Gregorian,
    };
}
pub fn getHourPattern(a: A, raw: []const u8, negative: bool) A.Error![]const @import("../../parsing/date.zig").DateTimeNode {
    const i = std.mem.indexOfScalar(u8, raw, ';') orelse raw.len;
    return parseDatePattern(a, if (negative) (if (i < raw.len) raw[i + 1 ..] else "") else raw[0..i]);
}
