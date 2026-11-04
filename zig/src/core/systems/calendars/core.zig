//! Constructing calendar dates (`core.ts`).

const std = @import("std");
const fields_ = @import("fields.zig");
const math = @import("math.zig");
const types = @import("types.zig");
const timezone = @import("timezone.zig");

const CalendarDate = types.CalendarDate;
const CalendarDateFields = types.CalendarDateFields;
const CalendarSystem = types.CalendarSystem;
const Error = types.Error;

/// A date in the calendar from a UTC epoch (milliseconds, as a double) and time zone. Every date
/// is created here.
pub fn newDate(calendar: *const CalendarSystem, epoch: f64, zoneId: []const u8, firstDay: i64, minDays: i64) CalendarDate {
    var f = fields_.emptyFields();
    const zoneInfo = math.initBaseFromUnixEpoch(&f, epoch, zoneId);
    calendar.computeFields(&f);
    const rule = calendar.weekRule;
    return .{
        .calendar = calendar,
        .fields = f,
        .zoneInfo = zoneInfo,
        .firstDay = if (rule) |r| r.firstDay else firstDay,
        .minDays = if (rule) |r| r.minDays else minDays,
    };
}

/// Like `newDate`, but `error.InvalidDate` if the epoch is not finite (in the TypeScript such a
/// date has NaN fields, or throws).
pub fn newDateChecked(calendar: *const CalendarSystem, epoch: f64, zoneId: []const u8, firstDay: i64, minDays: i64) Error!CalendarDate {
    if (!std.math.isFinite(epoch)) return error.InvalidDate;
    return newDate(calendar, epoch, zoneId, firstDay, minDays);
}

/// A date from a Julian day and milliseconds in the day (UTC).
pub fn newDateFromJD(calendar: *const CalendarSystem, jd: f64, msDay: f64, zoneId: []const u8, firstDay: i64, minDays: i64) Error!CalendarDate {
    return newDateChecked(calendar, math.unixEpochFromJD(jd, msDay), zoneId, firstDay, minDays);
}

/// A date in the calendar from a UNIX epoch (milliseconds, UTC) and time zone. An unknown zone
/// is UTC. The week arguments are 1 and 1 in the TypeScript by default.
pub fn dateFromUnixEpoch(calendar: *const CalendarSystem, epoch: i64, zoneId: []const u8, firstDay: i64, minDays: i64) CalendarDate {
    return newDate(calendar, @floatFromInt(epoch), zoneId, firstDay, minDays);
}

/// A date in the calendar from the given fields. Fields left out take the calendar's defaults;
/// the time zone defaults to UTC. The 'year' field is the extended year.
///
/// `error.InvalidFields` if the month or day is missing and the calendar has no default for it
/// (ISO-8601 and Japanese have none; the TypeScript throws a TypeError, or for a missing day
/// returns a date of NaN fields).
pub fn dateFromFields(calendar: *const CalendarSystem, fields: CalendarDateFields, firstDay: i64, minDays: i64) Error!CalendarDate {
    const merged = calendar.defaultFields.merge(fields);
    const w = try wallFields(merged);
    const r = calendar.resolveFields(w, timezone.zoneInfoFromUTC("UTC", 0).zoneid, 0);
    return newDate(calendar, r.epoch, r.zoneId, firstDay, minDays);
}

fn num(v: ?i64) f64 {
    return if (v) |x| @floatFromInt(x) else 0;
}

/// Complete wall fields from merged date fields: a missing year is 0 (`undefined | 0`), missing
/// time fields are 0 (`|| 0`).
pub fn wallFields(f: CalendarDateFields) Error!types.WallFields {
    if (f.month == null or f.day == null) return error.InvalidFields;
    return .{
        .year = num(f.year),
        .month = num(f.month),
        .day = num(f.day),
        .hour = num(f.hour),
        .minute = num(f.minute),
        .second = num(f.second),
        .millis = num(f.millis),
        .zoneId = if (f.zoneId) |z| (if (z.len == 0) null else z) else null,
    };
}

/// True if the date is in the calendar of the given type.
pub fn isCalendarType(d: *const CalendarDate, t: types.CalendarType) bool {
    return d.calendar.type == t;
}
