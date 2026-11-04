//! The Persian calendar (`persian.ts`).

const std = @import("std");
const C = @import("constants.zig");
const core = @import("core.zig");
const F = @import("fields.zig").DateField;
const Fields = @import("fields.zig").Fields;
const gm = @import("gregorianmath.zig");
const math = @import("math.zig");
const types = @import("types.zig");
const util = @import("util.zig");

const CalendarDate = types.CalendarDate;
const CalendarDateFields = types.CalendarDateFields;
const CalendarSystem = types.CalendarSystem;
const Error = types.Error;

const floor = std.math.floor;

/// A date in the Persian calendar.
pub const PersianDate = CalendarDate;

/// A Persian date from the given fields. As in 1.x, the 'zoneId' field is ignored and the date
/// is constructed in UTC.
pub fn persianDateFromFields(fields: CalendarDateFields, firstDay: i64, minDays: i64) Error!PersianDate {
    return core.dateFromFields(&persianCalendar, fields, firstDay, minDays);
}

/// A Persian date from a UNIX epoch.
pub fn persianDateFromUnixEpoch(epoch: i64, zoneId: []const u8, firstDay: i64, minDays: i64) PersianDate {
    return core.dateFromUnixEpoch(&persianCalendar, epoch, zoneId, firstDay, minDays);
}

/// True if the date is in the Persian calendar.
pub fn isPersianDate(d: *const CalendarDate) bool {
    return d.calendar.type == .persian;
}

/// Per month: days (common, leap), days before the month.
const MONTH_COUNT = [12][3]f64{
    .{ 31, 31, 0 }, // Farvardin
    .{ 31, 31, 31 }, // Ordibehesht
    .{ 31, 31, 62 }, // Khordad
    .{ 31, 31, 93 }, // Tir
    .{ 31, 31, 124 }, // Mordad
    .{ 31, 31, 155 }, // Shahrivar
    .{ 30, 30, 186 }, // Mehr
    .{ 30, 30, 216 }, // Aban
    .{ 30, 30, 246 }, // Azar
    .{ 30, 30, 276 }, // Dey
    .{ 30, 30, 306 }, // Bahman
    .{ 29, 30, 336 }, // Esfand
};

fn computePersianFields(f: *Fields) void {
    const jd = f[F.JULIAN_DAY];
    const days = jd - C.JD_PERSIAN_EPOCH;
    const year = 1 + floor((33 * days + 3) / 12053);

    const favardin1 = 365 * (year - 1) + floor((8 * year + 21) / 33);
    const doy = days - favardin1;
    const month = floor(if (doy < 216) doy / 31 else (doy - 6) / 30);
    const dom = doy - MONTH_COUNT[gm.monthIndex(month)][2] + 1;

    f[F.ERA] = 0;
    f[F.YEAR] = year;
    f[F.EXTENDED_YEAR] = year;
    f[F.MONTH] = month + 1;
    f[F.DAY_OF_MONTH] = dom;
    f[F.DAY_OF_YEAR] = doy + 1;
    f[F.IS_LEAP] = if (leapPersian(year)) 1 else 0;
}

/// True if the year is a leap year in the Persian calendar. The remainder is JavaScript's, so
/// for years before 1 it can be negative (and counts as a leap year), as in the TypeScript.
fn leapPersian(y: f64) bool {
    var rem: f64 = 0;
    _ = util.floorDiv(25 * y + 11, 33, &rem);
    return rem < 8;
}

fn persianDaysInMonth(y: i64, m: i64) i64 {
    if (m < 0 or m > 11) return 0;
    return @intFromFloat(MONTH_COUNT[@intCast(m)][if (leapPersian(@floatFromInt(y))) 1 else 0]);
}

fn persianDaysInYear(y: i64) i64 {
    return if (leapPersian(@floatFromInt(y))) 366 else 365;
}

fn persianMonthStart(eyear: f64, month: f64, useMonth: bool) f64 {
    _ = useMonth;
    var jd = C.JD_PERSIAN_EPOCH - 1 + 365 * (eyear - 1) + floor((8 * eyear + 21) / 33);
    if (month != 0) {
        const m = floor(month);
        const d = month - m;
        jd += MONTH_COUNT[gm.monthIndex(m)][2];
        // A fractional month adds that fraction of the next month's days ("number of days
        // between two vernal equinoxes" for Esfand). No caller passes one.
        if (d != 0) jd += d * MONTH_COUNT[gm.monthIndex(m + 1)][if (leapPersian(eyear)) 1 else 0];
    }
    return jd;
}

fn persianYmdToJD(yarg: f64, marg: f64, darg: f64) f64 {
    const y = util.toInt32(yarg);
    const leap = leapPersian(y);
    const mc = 12;
    const m = if (marg < 1) 1 else if (marg > mc) mc else marg;
    const dc = MONTH_COUNT[gm.monthIndex(m - 1)][if (leap) 1 else 0];
    const d = if (darg < 1) 1 else if (darg > dc) dc else darg;

    const favardin1 = 365 * (y - 1) + floor((8 * y + 21) / 33);
    const mdays = MONTH_COUNT[gm.monthIndex(m - 1)][2];
    const days = favardin1 + d + mdays - 1;
    return days + C.JD_PERSIAN_EPOCH;
}

/// Persian dates are set in the date's own time zone using its current offset; the 'zoneId'
/// field is ignored (1.x behaviour).
fn persianResolveFields(f: types.WallFields, zoneId: []const u8, offset: f64) types.Resolved {
    const jd = persianYmdToJD(f.year, f.month, f.day);
    const ms = math.wallTimeToMillis(f.hour, f.minute, f.second, f.millis) - offset;
    return .{ .epoch = math.unixEpochFromJD(jd, ms), .zoneId = zoneId };
}

/// Rules of the Persian calendar. Type `persian`.
pub const persianCalendar: CalendarSystem = .{
    .type = .persian,
    .name = "Persian",
    .monthCount = 12,
    .relatedYearOffset = 622,
    .defaultFields = .{ .year = 1, .month = 1, .day = 1 },
    .daysInMonth = persianDaysInMonth,
    .daysInYear = persianDaysInYear,
    .monthStart = persianMonthStart,
    .computeFields = computePersianFields,
    .resolveFields = persianResolveFields,
};
