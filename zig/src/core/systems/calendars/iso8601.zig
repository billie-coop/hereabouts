//! The ISO-8601 calendar (`iso8601.ts`).

const tzdb = @import("../../../timezone/timezone.zig");
const C = @import("constants.zig");
const core = @import("core.zig");
const DayOfWeek = @import("fields.zig").DayOfWeek;
const gregorian = @import("gregorian.zig");
const gm = @import("gregorianmath.zig");
const types = @import("types.zig");

const CalendarDate = types.CalendarDate;
const CalendarDateFields = types.CalendarDateFields;
const CalendarSystem = types.CalendarSystem;
const Error = types.Error;

/// A date in the ISO-8601 calendar.
pub const ISO8601Date = CalendarDate;

/// Rules of the Gregorian calendar with the ISO-8601 first day of week and minimum days in the
/// first week; the locale's week settings are ignored. Type `iso8601`.
pub const iso8601Calendar: CalendarSystem = .{
    .type = .iso8601,
    .name = "ISO8601",
    .monthCount = 12,
    .relatedYearOffset = 0,
    .weekRule = .{ .firstDay = DayOfWeek.MONDAY, .minDays = C.ISO8601_MIN_DAYS },
    // 1.x ISO8601Date.fromFields applies no defaults
    .defaultFields = .{},
    .daysInMonth = gm.daysInMonthInt,
    .daysInYear = gregorian.gregorianDaysInYear,
    .monthStart = gm.monthStart,
    .computeFields = gm.initGregorianFields,
    .resolveFields = gregorian.gregorianResolveFields,
};

/// An ISO-8601 date from the given fields. The week arguments are ignored.
pub fn iso8601DateFromFields(db: *const tzdb.Database, fields: CalendarDateFields, firstDay: i64, minDays: i64) Error!ISO8601Date {
    _ = firstDay;
    _ = minDays;
    return core.dateFromFields(db, &iso8601Calendar, fields, 1, 1);
}

/// An ISO-8601 date from a UNIX epoch. The week arguments are ignored.
pub fn iso8601DateFromUnixEpoch(db: *const tzdb.Database, epoch: i64, zoneId: []const u8, firstDay: i64, minDays: i64) ISO8601Date {
    _ = firstDay;
    _ = minDays;
    return core.dateFromUnixEpoch(db, &iso8601Calendar, epoch, zoneId, 1, 1);
}

/// True if the date is in the ISO-8601 calendar.
pub fn isISO8601Date(d: *const CalendarDate) bool {
    return d.calendar.type == .iso8601;
}
