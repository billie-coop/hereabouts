//! Gregorian (and, before the 1582 cutover, Julian) calendar math (`gregorianmath.ts`).

const std = @import("std");
const C = @import("constants.zig");
const F = @import("fields.zig").DateField;
const Fields = @import("fields.zig").Fields;
const util = @import("util.zig");

const floor = std.math.floor;

/// Per month: days (common, leap), days before the month (common, leap).
pub const MONTH_COUNT = [12][4]f64{
    .{ 31, 31, 0, 0 }, // Jan
    .{ 28, 29, 31, 31 }, // Feb
    .{ 31, 31, 59, 60 }, // Mar
    .{ 30, 30, 90, 91 }, // Apr
    .{ 31, 31, 120, 121 }, // May
    .{ 30, 30, 151, 152 }, // Jun
    .{ 31, 31, 181, 182 }, // Jul
    .{ 31, 31, 212, 213 }, // Aug
    .{ 30, 30, 243, 244 }, // Sep
    .{ 31, 31, 273, 274 }, // Oct
    .{ 30, 30, 304, 305 }, // Nov
    .{ 31, 31, 334, 335 }, // Dec
};

/// Index into a month table for a computed month. The callers only compute valid ones; any
/// other (from absurd field values) is clamped rather than read out of bounds.
pub fn monthIndex(i: f64) usize {
    if (!(i >= 0)) return 0;
    if (i >= 11) return 11;
    return @intFromFloat(i);
}

pub fn initGregorianFields(f: *Fields) void {
    if (f[F.JULIAN_DAY] >= C.JD_GREGORIAN_CUTOVER) {
        computeGregorianFields(f);
    } else {
        // Julian calendar for dates before the Gregorian cutover
        computeJulianFields(f);
    }

    // Era and year from the extended year
    var year = f[F.EXTENDED_YEAR];
    var era: f64 = 1; // AD
    if (year < 1) {
        era = 0;
        year = 1 - year;
    }
    f[F.ERA] = era;
    f[F.YEAR] = year;
}

/// Fields for dates on or after the Gregorian cutover.
pub fn computeGregorianFields(f: *Fields) void {
    const ged = f[F.JULIAN_DAY] - C.JD_GREGORIAN_EPOCH;
    var rem: f64 = 0;
    const n400 = util.floorDiv(ged, 146097, &rem);
    const n100 = util.floorDiv(rem, 36524, &rem);
    const n4 = util.floorDiv(rem, 1461, &rem);
    const n1 = util.floorDiv(rem, 365, &rem);

    var year = 400 * n400 + 100 * n100 + 4 * n4 + n1;
    var doy = rem; // 0-based day of year
    if (n100 == 4 or n1 == 4) {
        doy = 365;
    } else {
        year += 1;
    }
    const isLeap = leapGregorian(year);
    var corr: f64 = 0;
    const mar1: f64 = if (isLeap) 60 else 59;
    if (doy >= mar1) corr = if (isLeap) 1 else 2;
    const month = floor((12 * (doy + corr) + 6) / 367);
    const dom = doy - MONTH_COUNT[monthIndex(month)][if (isLeap) 3 else 2] + 1;

    f[F.EXTENDED_YEAR] = year;
    f[F.MONTH] = month + 1;
    f[F.DAY_OF_MONTH] = dom;
    f[F.DAY_OF_YEAR] = doy + 1;
    f[F.IS_LEAP] = if (isLeap) 1 else 0;
}

/// Fields for dates before the Gregorian cutover, in the proleptic Julian calendar (leap years
/// every 4 years).
pub fn computeJulianFields(f: *Fields) void {
    const jed = f[F.JULIAN_DAY] - (C.JD_GREGORIAN_EPOCH - 2);
    const eyear = floor((4 * jed + 1464) / 1461);
    const jan1 = 365 * (eyear - 1) + floor((eyear - 1) / 4);
    const doy = jed - jan1;
    const isLeap = @rem(eyear, 4) == 0;
    var corr: f64 = 0;
    const mar1: f64 = if (isLeap) 60 else 59;
    if (doy >= mar1) corr = if (isLeap) 1 else 2;

    const month = floor((12 * (doy + corr) + 6) / 367);
    const dom = doy - MONTH_COUNT[monthIndex(month)][if (isLeap) 3 else 2] + 1;

    f[F.EXTENDED_YEAR] = eyear;
    f[F.MONTH] = month + 1;
    f[F.DAY_OF_MONTH] = dom;
    f[F.DAY_OF_YEAR] = doy + 1;
    f[F.IS_LEAP] = if (isLeap) 1 else 0;
}

/// Number of days in the zero-based month `m` (0..11) of year `y`.
pub fn daysInMonth(y: f64, m: usize) f64 {
    return MONTH_COUNT[m][if (leapGregorian(y)) 1 else 0];
}

/// `CalendarSystem.days_in_month` for the Gregorian-based calendars.
pub fn daysInMonthInt(y: i64, m: i64) i64 {
    if (m < 0 or m > 11) return 0;
    return @intFromFloat(daysInMonth(@floatFromInt(y), @intCast(m)));
}

/// Julian day of the day before the first day of the zero-based `month` of extended year
/// `eyear`.
pub fn monthStart(eyear: f64, month: f64, useMonth: bool) f64 {
    _ = useMonth;
    var isLeap = @rem(util.toInt32(eyear), 4) == 0;
    const y = eyear - 1;
    var jd = 365 * y + floor(y / 4) + (C.JD_GREGORIAN_EPOCH - 3);
    if (eyear >= C.JD_GREGORIAN_CUTOVER_YEAR) {
        isLeap = isLeap and (@rem(eyear, 100) != 0 or @rem(eyear, 400) == 0);
        jd += floor(y / 400) - floor(y / 100) + 2;
    }
    if (month != 0) {
        const m = floor(month);
        const d = month - m;
        jd += MONTH_COUNT[monthIndex(m)][if (isLeap) 3 else 2];

        // A fractional month adds that fraction of the next month's days. No caller passes one.
        if (d != 0) jd += d * MONTH_COUNT[monthIndex(m + 1)][if (isLeap) 1 else 0];
    }
    return jd;
}

/// True if the year is a leap year in the Gregorian calendar (the Julian calendar before the
/// cutover year).
pub fn leapGregorian(y: f64) bool {
    var r = @rem(y, 4) == 0;
    if (y >= C.JD_GREGORIAN_CUTOVER_YEAR) r = r and (@rem(y, 100) != 0 or @rem(y, 400) == 0);
    return r;
}

/// Year, month and day to Julian day. The year is truncated to 32 bits (`y |= 0`); the month
/// and day are clamped to valid values.
pub fn ymdToJD(yarg: f64, marg: f64, darg: f64, monthCount: f64) f64 {
    var y = util.toInt32(yarg);
    const leap = leapGregorian(y);
    var m = if (marg < 1) 1 else if (marg > monthCount) monthCount else marg;
    const dc = MONTH_COUNT[monthIndex(m - 1)][if (leap) 1 else 0];
    const d = if (darg < 1) 1 else if (darg > dc) dc else darg;

    // Adjustment due to Gregorian calendar switch on Oct 4, 1582 -> Oct 15, 1582
    if (y < C.JD_GREGORIAN_CUTOVER_YEAR or
        (y == C.JD_GREGORIAN_CUTOVER_YEAR and
            (m < C.JD_GREGORIAN_CUTOVER_MONTH or
                (m == C.JD_GREGORIAN_CUTOVER_MONTH and d < C.JD_GREGORIAN_CUTOVER_DAY))))
    {
        if (m < 3) {
            m += 12;
            y -= 1;
        }
        return 1721117 + floor((1461 * y) / 4) + floor((153 * m - 457) / 5) + d;
    }

    const a = util.toInt32((14 - m) / 12);
    y = y + 4800 - a;
    m = m + 12 * a - 3;
    return d + util.toInt32((153 * m + 2) / 5) + 365 * y + util.toInt32(y / 4) -
        util.toInt32(y / 100) + util.toInt32(y / 400) - 32045;
}
