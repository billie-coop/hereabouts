//! The Gregorian calendar (`gregorian.ts`).

const tzdb = @import("../../../timezone/timezone.zig");
const core = @import("core.zig");
const gm = @import("gregorianmath.zig");
const math = @import("math.zig");
const timezone = @import("timezone.zig");
const types = @import("types.zig");

const CalendarDate = types.CalendarDate;
const CalendarDateFields = types.CalendarDateFields;
const CalendarSystem = types.CalendarSystem;
const Error = types.Error;

/// A date in the Gregorian calendar (or one of the calendars built on it).
/// Days in a year of the Gregorian calendar (Julian calendar before the 1582 cutover).
pub fn gregorianDaysInYear(y: i64) i64 {
    return if (gm.leapGregorian(@floatFromInt(y))) 366 else 365;
}

/// Resolve wall clock fields to a UTC epoch in the requested time zone (falling back to the
/// date's own zone), using the Gregorian calendar. Shared by the Gregorian-based calendars.
pub fn gregorianResolveFields(db: *const tzdb.Database, f: types.WallFields, zoneId: []const u8, offset: f64) types.Resolved {
    _ = offset;
    const jd = gm.ymdToJD(f.year, f.month, f.day, 12);
    const ms = math.wallTimeToMillis(f.hour, f.minute, f.second, f.millis);
    const epoch = math.unixEpochFromJD(jd, ms);
    const zone = f.zone_id orelse zoneId;
    // UTC epoch of the wall clock time in the requested zone
    return .{ .epoch = timezone.utcFromWall(db, zone, epoch) orelse epoch, .zone_id = zone };
}

/// Rules of the Gregorian calendar. Type `gregory`.
pub const gregorianCalendar: CalendarSystem = .{
    .type = .gregory,
    .name = "Gregorian",
    .month_count = 12,
    .related_year_offset = 0,
    .default_fields = .{ .year = 1970, .month = 1, .day = 1, .hour = 0, .minute = 0, .second = 0, .millis = 0 },
    .days_in_month = gm.daysInMonthInt,
    .days_in_year = gregorianDaysInYear,
    .month_start = gm.monthStart,
    .compute_fields = gm.initGregorianFields,
    .resolve_fields = gregorianResolveFields,
};

/// A Gregorian date from the given fields (TypeScript defaults for the week: 1, 1).
pub fn gregorianDateFromFields(db: *const tzdb.Database, fields: CalendarDateFields, firstDay: i64, minDays: i64) Error!CalendarDate {
    return core.dateFromFields(db, &gregorianCalendar, fields, firstDay, minDays);
}

/// A Gregorian date from a UNIX epoch (TypeScript defaults for the week: 1, 1).
pub fn gregorianDateFromUnixEpoch(db: *const tzdb.Database, epoch: i64, zoneId: []const u8, firstDay: i64, minDays: i64) CalendarDate {
    return core.dateFromUnixEpoch(db, &gregorianCalendar, epoch, zoneId, firstDay, minDays);
}

/// True if the date is in the Gregorian calendar or one of the calendars built on it
/// (iso8601, buddhist, japanese).
pub fn isGregorianDate(d: *const CalendarDate) bool {
    return switch (d.calendar.type) {
        .gregory, .iso8601, .buddhist, .japanese => true,
        .persian => false,
    };
}
