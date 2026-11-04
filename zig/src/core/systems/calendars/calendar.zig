//! Reading, formatting and setting calendar dates (`calendar.ts`).
//!
//! Calendar calculations are compatible with those in the Unicode ICU project.

const std = @import("std");
const C = @import("constants.zig");
const core = @import("core.zig");
const fields_ = @import("fields.zig");
const gregorian = @import("gregorian.zig");
const interval = @import("interval.zig");
const types = @import("types.zig");
const util = @import("util.zig");
const zoneutil = @import("../../internals/calendars/zoneutil.zig");

const F = fields_.DateField;
const CalendarDate = types.CalendarDate;
const CalendarDateFields = types.CalendarDateFields;
const CalendarType = types.CalendarType;
const Allocator = std.mem.Allocator;
const Writer = std.Io.Writer;

const floor = std.math.floor;
const toInt = util.toInt;

/// Fields `dateStartOf` and `dateEndOf` round to.
pub const CalendarDateModField = enum {
    year,
    month,
    day,
    hour,
    minute,
    second,

    pub fn fromString(s: []const u8) ?CalendarDateModField {
        return std.meta.stringToEnum(CalendarDateModField, s);
    }
};

/// Options of `dateToTimeString` and `dateToDateTimeString`.
pub const TimeStringOptions = struct {
    /// Include the time zone id.
    includeZoneId: bool = false,
    /// Include the time zone offset.
    includeZoneOffset: bool = false,
    /// Only output milliseconds if non-zero.
    optionalMilliseconds: bool = false,
};

/// Options of the date difference functions.
pub const DateDiffOptions = struct {
    /// Calculate weeks.
    includeWeeks: bool = false,
    /// Express the result in these fields (null for the default fields).
    fields: ?[]const interval.TimePeriodField = null,
    /// Roll smaller fields up into a fraction of the smallest field requested.
    rollupFractional: bool = false,
};

/// Fields compared by `dateFieldOfVisualDifference`, with their pattern field characters.
const differenceFields = [_]struct { usize, u8 }{
    .{ F.ERA, 'G' },
    .{ F.YEAR, 'y' },
    .{ F.MONTH, 'M' },
    .{ F.DAY_OF_MONTH, 'd' },
    .{ F.AM_PM, 'a' },
    .{ F.HOUR, 'H' },
    .{ F.MINUTE, 'm' },
    .{ F.SECOND, 's' },
};

/// Calendar type of the date, e.g. `.gregory`.
pub fn dateType(d: *const CalendarDate) CalendarType {
    return d.calendar.type;
}

/// Unix epoch of the date, as the double the TypeScript computes.
pub fn unixEpoch(d: *const CalendarDate) f64 {
    return d.fields[F.LOCAL_MILLIS] - @as(f64, @floatFromInt(d.zoneInfo.offset));
}

/// Unix epoch in milliseconds (UTC).
pub fn dateUnixEpoch(d: *const CalendarDate) i64 {
    return toInt(unixEpoch(d));
}

/// First day of the week, 1 = Sunday .. 7 = Saturday.
pub fn dateFirstDayOfWeek(d: *const CalendarDate) i64 {
    return d.firstDay;
}

/// Minimum days in the first week of the year.
pub fn dateMinDaysInFirstWeek(d: *const CalendarDate) i64 {
    return d.minDays;
}

/// The real Julian day (fractional), UTC.
pub fn dateJulianDay(d: *const CalendarDate) f64 {
    const ms = (d.fields[F.MILLIS_IN_DAY] - @as(f64, @floatFromInt(d.zoneInfo.offset))) / C.ONE_DAY_MS;
    return d.fields[F.JULIAN_DAY] - 0.5 + ms;
}

/// CLDR's modified Julian day, the basis for all date calculations.
pub fn dateModifiedJulianDay(d: *const CalendarDate) i64 {
    return toInt(d.fields[F.JULIAN_DAY]);
}

/// Era.
pub fn dateEra(d: *const CalendarDate) i64 {
    return toInt(d.fields[F.ERA]);
}

/// Extended year.
pub fn dateExtendedYear(d: *const CalendarDate) i64 {
    return toInt(d.fields[F.EXTENDED_YEAR]);
}

/// Year (of the era).
pub fn dateYear(d: *const CalendarDate) i64 {
    return toInt(d.fields[F.YEAR]);
}

/// Related (Gregorian) year.
pub fn dateRelatedYear(d: *const CalendarDate) i64 {
    return toInt(d.fields[F.EXTENDED_YEAR] + @as(f64, @floatFromInt(d.calendar.relatedYearOffset)));
}

/// Year of the week of year, using the date's week rules.
pub fn dateYearOfWeekOfYear(d: *const CalendarDate) i64 {
    return toInt(weekOfYear(d, d.firstDay, d.minDays)[1]);
}

/// Week of year, using the date's week rules.
pub fn dateWeekOfYear(d: *const CalendarDate) i64 {
    return toInt(weekOfYear(d, d.firstDay, d.minDays)[0]);
}

/// Year of the ISO week of year.
pub fn dateYearOfWeekOfYearISO(d: *const CalendarDate) i64 {
    return toInt(weekOfYear(d, 2, 4)[1]);
}

/// ISO week of year.
pub fn dateWeekOfYearISO(d: *const CalendarDate) i64 {
    return toInt(weekOfYear(d, 2, 4)[0]);
}

/// Ordinal month, one-based, e.g. Gregorian January = 1.
pub fn dateMonth(d: *const CalendarDate) i64 {
    return toInt(d.fields[F.MONTH]);
}

/// Week of the month, using the date's week rules. In the United States (weeks start on Sunday)
/// Saturday 9/1/2018 is in week 1 and Sunday 9/2/2018 begins week 2.
pub fn dateWeekOfMonth(d: *const CalendarDate) i64 {
    const dom = d.fields[F.DAY_OF_MONTH];
    return toInt(weekNumber(@floatFromInt(d.firstDay), @floatFromInt(d.minDays), dom, dom, d.fields[F.DAY_OF_WEEK]));
}

/// Day of year.
pub fn dateDayOfYear(d: *const CalendarDate) i64 {
    return toInt(d.fields[F.DAY_OF_YEAR]);
}

/// Day of the week, 1 = Sunday .. 7 = Saturday.
pub fn dateDayOfWeek(d: *const CalendarDate) i64 {
    return toInt(d.fields[F.DAY_OF_WEEK]);
}

/// Ordinal day of the week: 1 on the first day of the (locale's) week, 2 on the second, ...
pub fn dateOrdinalDayOfWeek(d: *const CalendarDate) i64 {
    const weekday = d.fields[F.DAY_OF_WEEK];
    return toInt(@rem(7 - @as(f64, @floatFromInt(d.firstDay)) + weekday, 7) + 1);
}

/// Which occurrence of its weekday in the month the date is, for "2nd Sunday in August".
pub fn dateDayOfWeekInMonth(d: *const CalendarDate) i64 {
    return toInt(util.toInt32((d.fields[F.DAY_OF_MONTH] - 1) / 7) + 1);
}

/// Day of month.
pub fn dateDayOfMonth(d: *const CalendarDate) i64 {
    return toInt(d.fields[F.DAY_OF_MONTH]);
}

/// True before noon.
pub fn dateIsAM(d: *const CalendarDate) bool {
    return d.fields[F.AM_PM] == 0;
}

/// Hour of the morning or afternoon for the 12-hour clock (0 - 11); noon and midnight are 0.
pub fn dateHour(d: *const CalendarDate) i64 {
    return toInt(d.fields[F.HOUR]);
}

/// Hour of the day for the 24-hour clock (0 - 23).
pub fn dateHourOfDay(d: *const CalendarDate) i64 {
    return toInt(d.fields[F.HOUR_OF_DAY]);
}

/// Minute of the hour (0 - 59).
pub fn dateMinute(d: *const CalendarDate) i64 {
    return toInt(d.fields[F.MINUTE]);
}

/// Second of the minute (0 - 59).
pub fn dateSecond(d: *const CalendarDate) i64 {
    return toInt(d.fields[F.SECOND]);
}

/// Milliseconds of the second.
pub fn dateMilliseconds(d: *const CalendarDate) i64 {
    return toInt(d.fields[F.MILLIS]);
}

/// Milliseconds in the day.
pub fn dateMillisecondsInDay(d: *const CalendarDate) i64 {
    return toInt(d.fields[F.MILLIS_IN_DAY]);
}

/// CLDR metazone id, or "" if the zone has none.
pub fn dateMetaZoneId(d: *const CalendarDate) []const u8 {
    return d.zoneInfo.metazoneid;
}

/// Time zone id.
pub fn dateTimeZoneId(d: *const CalendarDate) []const u8 {
    return d.zoneInfo.zoneid;
}

/// CLDR stable time zone id.
pub fn dateTimeZoneStableId(d: *const CalendarDate) []const u8 {
    return d.zoneInfo.stableid;
}

/// Time zone offset in milliseconds.
pub fn dateTimeZoneOffset(d: *const CalendarDate) i64 {
    return d.zoneInfo.offset;
}

/// True in a leap year.
pub fn dateIsLeapYear(d: *const CalendarDate) bool {
    return d.fields[F.IS_LEAP] == 1;
}

/// True in daylight saving time.
pub fn dateIsDaylightSavings(d: *const CalendarDate) bool {
    return d.zoneInfo.dst == 1;
}

/// The largest field in which the dates visually differ, as a date pattern field character
/// ('G' era, 'y' year, 'M' month, 'd' day, 'a' day period, 'H' hour, 'm' minute, 's' second),
/// or null if none does. Assumes the dates are of the same type and time zone offset.
pub fn dateFieldOfVisualDifference(d: *const CalendarDate, other: *const CalendarDate) ?u8 {
    for (differenceFields) |e| {
        if (d.fields[e[0]] != other.fields[e[0]]) return e[1];
    }
    return null;
}

/// Compare two dates: -1 if a < b, 0 if equal, 1 if a > b.
pub fn dateCompare(a: *const CalendarDate, b: *const CalendarDate) i32 {
    const x = unixEpoch(a);
    const y = unixEpoch(b);
    return if (x < y) -1 else if (x > y) 1 else 0;
}

/// All the date and time fields (the year is the extended year).
pub fn dateFields(d: *const CalendarDate) CalendarDateFields {
    const f = &d.fields;
    return .{
        .year = toInt(f[F.EXTENDED_YEAR]),
        .month = toInt(f[F.MONTH]),
        .day = toInt(f[F.DAY_OF_MONTH]),
        .hour = toInt(f[F.HOUR_OF_DAY]),
        .minute = toInt(f[F.MINUTE]),
        .second = toInt(f[F.SECOND]),
        .millis = toInt(f[F.MILLIS]),
        .zoneId = d.zoneInfo.zoneid,
    };
}

/// Write the digits of an integer (its sign dropped), zero padded to `width`: the TypeScript's
/// `numberingFormatString(INTERNAL_NUMBERING, n, false, width)` for an integer.
fn zeropad(w: *Writer, n: f64, width: usize) Writer.Error!void {
    var buf: [24]u8 = undefined;
    const s = std.fmt.bufPrint(&buf, "{d}", .{@abs(toInt(n))}) catch unreachable;
    if (s.len < width) try w.splatByteAll('0', width - s.len);
    try w.writeAll(s);
}

fn writeYMD(w: *Writer, f: *const types.Fields) Writer.Error!void {
    const y = f[F.EXTENDED_YEAR];
    if (y < 0) try w.writeByte('-');
    try zeropad(w, @abs(y), 4);
    try w.writeByte('-');
    try zeropad(w, f[F.MONTH], 2);
    try w.writeByte('-');
    try zeropad(w, f[F.DAY_OF_MONTH], 2);
}

/// Write the date as `YYYY-MM-DD` (a negative year gets a minus sign).
pub fn writeDateString(w: *Writer, d: *const CalendarDate) Writer.Error!void {
    try writeYMD(w, &d.fields);
}

/// Write the time as `HH:MM:SS.mmm`, with the options' extras.
pub fn writeTimeString(w: *Writer, d: *const CalendarDate, options: TimeStringOptions) Writer.Error!void {
    const f = &d.fields;
    try zeropad(w, f[F.HOUR_OF_DAY], 2);
    try w.writeByte(':');
    try zeropad(w, f[F.MINUTE], 2);
    try w.writeByte(':');
    try zeropad(w, f[F.SECOND], 2);
    const ms = f[F.MILLIS];
    // Check if the caller disabled milliseconds when zero
    if (!(options.optionalMilliseconds and ms == 0)) {
        try w.writeByte('.');
        try zeropad(w, ms, 3);
    }
    if (options.includeZoneOffset) try writeZoneOffset(w, d);
    if (options.includeZoneId) {
        try w.writeByte(' ');
        try w.writeAll(d.zoneInfo.zoneid);
    }
}

/// Write the date and time, `YYYY-MM-DD HH:MM:SS.mmm` plus the options' extras.
pub fn writeDateTimeString(w: *Writer, d: *const CalendarDate, options: TimeStringOptions) Writer.Error!void {
    try writeDateString(w, d);
    try w.writeByte(' ');
    try writeTimeString(w, d, options);
}

/// Write the calendar name, date, time and zone, e.g. "Gregorian 2024-03-01 12:00:00.000 Etc/UTC".
pub fn writeString(w: *Writer, d: *const CalendarDate) Writer.Error!void {
    try w.writeAll(d.calendar.name);
    try w.writeByte(' ');
    try writeDateString(w, d);
    try w.writeByte(' ');
    try writeTimeString(w, d, .{ .includeZoneId = true });
}

/// Write the ISO-8601 string of the date in UTC (`utc`) or with its zone's offset. Always in the
/// Gregorian calendar.
pub fn writeISOString(w: *Writer, d: *const CalendarDate, utc: bool) Writer.Error!void {
    const g = core.newDate(&gregorian.gregorianCalendar, unixEpoch(d), if (utc) "Etc/UTC" else d.zoneInfo.zoneid, d.firstDay, d.minDays);
    const f = &g.fields;
    try writeYMD(w, f);
    try w.writeByte('T');
    try zeropad(w, f[F.HOUR_OF_DAY], 2);
    try w.writeByte(':');
    try zeropad(w, f[F.MINUTE], 2);
    try w.writeByte(':');
    try zeropad(w, f[F.SECOND], 2);
    try w.writeByte('.');
    try zeropad(w, f[F.MILLIS], 3);
    if (utc) return w.writeByte('Z');
    const o = util.toInt32(@as(f64, @floatFromInt(d.zoneInfo.offset)) / C.ONE_MINUTE_MS);
    try w.writeByte(if (o < 0) '-' else '+');
    try zeropad(w, util.toInt32(o / 60), 2);
    try w.writeByte(':');
    try zeropad(w, util.toInt32(@rem(o, 60)), 2);
}

fn writeZoneOffset(w: *Writer, d: *const CalendarDate) Writer.Error!void {
    const t = zoneutil.getTZC(d.zoneInfo.offset);
    const zero = t.hours == 0 and t.minutes == 0;
    try w.writeByte(if (zero) '+' else if (t.negative) '-' else '+');
    try zeropad(w, @floatFromInt(t.hours), 2);
    try w.writeByte(':');
    try zeropad(w, @floatFromInt(t.minutes), 2);
}

fn allocString(gpa: Allocator, comptime f: anytype, args: anytype) Allocator.Error![]u8 {
    var out: Writer.Allocating = .init(gpa);
    errdefer out.deinit();
    @call(.auto, f, .{&out.writer} ++ args) catch return error.OutOfMemory;
    return out.toOwnedSlice();
}

/// ISO-8601 string of the date in UTC, e.g. "2024-03-01T12:00:00.000Z". Always in the Gregorian
/// calendar. The caller owns the result.
pub fn dateToISOString(gpa: Allocator, d: *const CalendarDate) Allocator.Error![]u8 {
    return allocString(gpa, writeISOString, .{ d, true });
}

/// ISO-8601 string of the date with its zone's offset, e.g. "2024-03-01T07:00:00.000-05:00".
/// Always in the Gregorian calendar. The caller owns the result.
pub fn dateToLocalISOString(gpa: Allocator, d: *const CalendarDate) Allocator.Error![]u8 {
    return allocString(gpa, writeISOString, .{ d, false });
}

/// The date, `YYYY-MM-DD`. The caller owns the result.
pub fn dateToDateString(gpa: Allocator, d: *const CalendarDate) Allocator.Error![]u8 {
    return allocString(gpa, writeDateString, .{d});
}

/// The time, `HH:MM:SS.mmm` with the options' extras. The caller owns the result.
pub fn dateToTimeString(gpa: Allocator, d: *const CalendarDate, options: TimeStringOptions) Allocator.Error![]u8 {
    return allocString(gpa, writeTimeString, .{ d, options });
}

/// The date and time, with the options' extras. The caller owns the result.
pub fn dateToDateTimeString(gpa: Allocator, d: *const CalendarDate, options: TimeStringOptions) Allocator.Error![]u8 {
    return allocString(gpa, writeDateTimeString, .{ d, options });
}

/// String representation, e.g. "Gregorian 2024-03-01 12:00:00.000 Etc/UTC". The caller owns the
/// result.
pub fn dateToString(gpa: Allocator, d: *const CalendarDate) Allocator.Error![]u8 {
    return allocString(gpa, writeString, .{d});
}

/// A new date with some fields set. The 'year' field is the extended year (0 is 1 BC in the
/// Gregorian calendar). Out of range fields are clamped.
pub fn dateSet(d: *const CalendarDate, fields: CalendarDateFields) CalendarDate {
    const w = core.wallFields(dateFields(d).merge(fields)) catch unreachable;
    const r = d.calendar.resolveFields(w, d.zoneInfo.zoneid, @floatFromInt(d.zoneInfo.offset));
    return core.newDate(d.calendar, r.epoch, r.zoneId, d.firstDay, d.minDays);
}

/// The same instant in another time zone.
pub fn dateWithZone(d: *const CalendarDate, zoneId: []const u8) CalendarDate {
    return core.newDate(d.calendar, unixEpoch(d), zoneId, d.firstDay, d.minDays);
}

/// Start of the year, month, day, ... of the date.
pub fn dateStartOf(d: *const CalendarDate, field: CalendarDateModField) CalendarDate {
    return switch (field) {
        .year => dateSet(d, .{ .month = 0, .day = 0, .hour = 0, .minute = 0, .second = 0, .millis = 0 }),
        .month => dateSet(d, .{ .day = 0, .hour = 0, .minute = 0, .second = 0, .millis = 0 }),
        .day => dateSet(d, .{ .hour = 0, .minute = 0, .second = 0, .millis = 0 }),
        .hour => dateSet(d, .{ .minute = 0, .second = 0, .millis = 0 }),
        .minute => dateSet(d, .{ .second = 0, .millis = 0 }),
        .second => dateSet(d, .{ .millis = 0 }),
    };
}

/// End (last millisecond) of the year, month, day, ... of the date.
pub fn dateEndOf(d: *const CalendarDate, field: CalendarDateModField) CalendarDate {
    return switch (field) {
        .year => dateSet(d, .{ .month = 13, .day = 32, .hour = 23, .minute = 59, .second = 59, .millis = 999 }),
        .month => dateSet(d, .{ .day = 32, .hour = 23, .minute = 59, .second = 59, .millis = 999 }),
        .day => dateSet(d, .{ .hour = 23, .minute = 59, .second = 59, .millis = 999 }),
        .hour => dateSet(d, .{ .minute = 59, .second = 59, .millis = 999 }),
        .minute => dateSet(d, .{ .second = 59, .millis = 999 }),
        .second => dateSet(d, .{ .millis = 999 }),
    };
}

/// Week of year and year of the week of year under the given week rules.
fn weekOfYear(d: *const CalendarDate, firstDayArg: i64, minDaysArg: i64) [2]f64 {
    const firstDay: f64 = @floatFromInt(firstDayArg);
    const minDays: f64 = @floatFromInt(minDaysArg);
    const f = &d.fields;
    const dow = f[F.DAY_OF_WEEK];
    const doy = f[F.DAY_OF_YEAR];
    const eyear = f[F.EXTENDED_YEAR];

    var ywoy = eyear;
    const rdow = @rem(dow + 7 - firstDay, 7);
    const rdowJan1 = @rem(dow - doy + 7001 - firstDay, 7);
    var woy = floor((doy - 1 + rdowJan1) / 7);
    if (7 - rdowJan1 >= minDays) woy += 1;

    if (woy == 0) {
        const prevDay = doy + yearLength(d, eyear - 1);
        woy = weekNumber(firstDay, minDays, prevDay, prevDay, dow);
        ywoy -= 1;
    } else {
        const lastDoy = yearLength(d, eyear);
        if (doy >= lastDoy - 5) {
            var lastRdow = @rem(rdow + lastDoy - doy, 7);
            if (lastRdow < 0) lastRdow += 7;
            if (6 - lastRdow >= minDays and doy + 7 - rdow > lastDoy) {
                woy = 1;
                ywoy += 1;
            }
        }
    }
    return .{ woy, ywoy };
}

fn yearLength(d: *const CalendarDate, y: f64) f64 {
    return d.calendar.monthStart(y + 1, 0, false) - d.calendar.monthStart(y, 0, false);
}

fn weekNumber(firstDay: f64, minDays: f64, desiredDay: f64, dayOfPeriod: f64, dayOfWeek: f64) f64 {
    var psow = @rem(dayOfWeek - firstDay - dayOfPeriod + 1, 7);
    if (psow < 0) psow += 7;
    const weekNo = floor((desiredDay + psow - 1) / 7);
    return if (7 - psow >= minDays) weekNo + 1 else weekNo;
}
