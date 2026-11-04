//! Calendar math shared by the calendars (`math.ts`).

const tzdb = @import("../../../timezone/timezone.zig");
const std = @import("std");
const C = @import("constants.zig");
const fields_ = @import("fields.zig");
const F = fields_.DateField;
const DayOfWeek = fields_.DayOfWeek;
const Fields = fields_.Fields;
const gm = @import("gregorianmath.zig");
const interval = @import("interval.zig");
const timezone = @import("timezone.zig");
const types = @import("types.zig");
const util = @import("util.zig");

const TimePeriod = interval.TimePeriod;
const CalendarDate = types.CalendarDate;
const DateZoneInfo = types.DateZoneInfo;

const floor = std.math.floor;

pub const YearMonthDay = struct { year: f64, month: f64, day: f64 };
pub const YearMonth = struct { year: f64, month: f64 };

/// Extended year, month and day of a date.
pub fn toYMD(d: *const CalendarDate) YearMonthDay {
    return .{
        .year = d.fields[F.EXTENDED_YEAR],
        .month = d.fields[F.MONTH],
        .day = d.fields[F.DAY_OF_MONTH],
    };
}

/// Unix epoch milliseconds (UTC) of a Julian day and local milliseconds in the day.
pub fn unixEpochFromJD(jd: f64, msDay: f64) f64 {
    const days = jd - C.JD_UNIX_EPOCH;
    return days * C.ONE_DAY_MS + util.round(msDay);
}

/// Clamp the month and day so the year, month and day form a valid (Gregorian) date.
pub fn clampYMD(year: f64, monthArg: f64, d: f64) YearMonthDay {
    const month = util.clamp(monthArg, 1, 12);
    const day = util.clamp(d, 1, gm.daysInMonth(year, gm.monthIndex(month - 1)));
    return .{ .year = year, .month = month, .day = day };
}

/// Carry months outside 1..12 into the year.
pub fn adjustYM(yearp: f64, monthp: f64) YearMonth {
    var year = yearp;
    var month = monthp;
    month -= 1;
    year += floor(month / 12);
    month = @rem(month, 12);
    if (month < 0) month += 12;
    month += 1;
    return .{ .year = year, .month = month };
}

/// Add the time fields to milliseconds, returning whole days and the remaining milliseconds.
pub fn adjustTime(millis: f64, added: TimePeriod) struct { f64, f64 } {
    var ms = millis + timeToMillis(added);
    // Extract days from the time fields and add them.
    const days = util.toInt32(ms / C.ONE_DAY_MS);
    ms -= days * C.ONE_DAY_MS;
    return .{ days, ms };
}

/// The time fields of a period in milliseconds.
pub fn timeToMillis(period: TimePeriod) f64 {
    return util.orZero(period.hour) * C.ONE_HOUR_MS +
        util.orZero(period.minute) * C.ONE_MINUTE_MS +
        util.orZero(period.second) * C.ONE_SECOND_MS +
        util.orZero(period.millis);
}

/// Wall clock time fields in milliseconds, each clamped to its range and truncated.
pub fn wallTimeToMillis(hour: f64, minute: f64, second: f64, millis: f64) f64 {
    return util.toInt32(util.clamp(util.orZero(hour), 0, 23)) * C.ONE_HOUR_MS +
        util.toInt32(util.clamp(util.orZero(minute), 0, 59)) * C.ONE_MINUTE_MS +
        util.toInt32(util.clamp(util.orZero(second), 0, 59)) * C.ONE_SECOND_MS +
        util.toInt32(util.clamp(util.orZero(millis), 0, 999));
}

/// Keep the integral part of each field (NaN is 0).
pub fn truncateFields(p: TimePeriod) TimePeriod {
    var r: TimePeriod = .{};
    for (interval.TIME_PERIOD_FIELDS) |f| r.set(f, @trunc(util.orZero(p.get(f))));
    return r;
}

/// Set the Julian day and milliseconds in the day from zone-adjusted Unix epoch milliseconds.
pub fn fieldsFromUnixEpoch(ms: f64, f: *Fields) void {
    const jd, const msDay = jdFromUnixEpoch(ms);
    f[F.JULIAN_DAY] = jd;
    f[F.MILLIS_IN_DAY] = msDay;
}

/// Julian day and milliseconds remainder of a Unix epoch timestamp.
pub fn jdFromUnixEpoch(ms: f64) struct { f64, f64 } {
    const days = floor(ms / C.ONE_DAY_MS);
    const jd = days + C.JD_UNIX_EPOCH;
    const msDay = floor(ms - days * C.ONE_DAY_MS);
    return .{ jd, msDay };
}

/// Set the fields common to all calendars from a UTC epoch in a zone; returns the zone info.
pub fn initBaseFromUnixEpoch(db: *const tzdb.Database, f: *Fields, ms: f64, zoneIdArg: []const u8) DateZoneInfo {
    const zoneId = timezone.substituteZoneAlias(zoneIdArg);
    const zoneInfo = timezone.zoneInfoFromUTC(db, zoneId, ms);
    fieldsFromUnixEpoch(ms + @as(f64, @floatFromInt(zoneInfo.offset)), f);
    computeBaseFields(f);
    return zoneInfo;
}

/// Compute the fields common to all calendars from the JULIAN_DAY and MILLIS_IN_DAY fields.
pub fn computeBaseFields(f: *Fields) void {
    const jd = util.clamp(f[F.JULIAN_DAY], C.JD_MIN, C.JD_MAX);

    var msDay = f[F.MILLIS_IN_DAY];
    const ms = msDay + (jd - C.JD_UNIX_EPOCH) * C.ONE_DAY_MS;

    f[F.LOCAL_MILLIS] = ms;
    f[F.JULIAN_DAY] = jd;
    f[F.MILLIS_IN_DAY] = msDay;
    f[F.MILLIS] = @rem(msDay, 1000);

    msDay = util.toInt32(msDay / 1000);
    f[F.SECOND] = @rem(msDay, 60);

    msDay = util.toInt32(msDay / 60);
    f[F.MINUTE] = @rem(msDay, 60);

    msDay = util.toInt32(msDay / 60);
    f[F.HOUR_OF_DAY] = msDay;
    f[F.AM_PM] = util.toInt32(msDay / 12);
    f[F.HOUR] = @rem(msDay, 12);

    var dow = @rem(jd + DayOfWeek.MONDAY, 7);
    if (dow < DayOfWeek.SUNDAY) dow += 7;
    f[F.DAY_OF_WEEK] = dow;
}

/// Negate every field of a time period.
pub fn negatePeriod(p: TimePeriod) TimePeriod {
    var r: TimePeriod = .{};
    for (interval.TIME_PERIOD_FIELDS) |f| {
        const v = p.get(f);
        r.set(f, if (util.truthy(v)) -v else 0);
    }
    return r;
}
