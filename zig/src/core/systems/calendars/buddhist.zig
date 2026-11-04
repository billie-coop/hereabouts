//! The Buddhist calendar (`buddhist.ts`).

const tzdb = @import("../../../timezone/timezone.zig");
const C = @import("constants.zig");
const core = @import("core.zig");
const F = @import("fields.zig").DateField;
const Fields = @import("fields.zig").Fields;
const gregorian = @import("gregorian.zig");
const gm = @import("gregorianmath.zig");
const types = @import("types.zig");

const CalendarDate = types.CalendarDate;
const CalendarDateFields = types.CalendarDateFields;
const CalendarSystem = types.CalendarSystem;
const Error = types.Error;

/// A date in the Buddhist calendar.
pub const BuddhistDate = CalendarDate;

fn computeBuddhistFields(f: *Fields) void {
    gm.initGregorianFields(f);
    f[F.ERA] = 0;
    f[F.YEAR] = f[F.EXTENDED_YEAR] - C.BUDDHIST_ERA_START;
}

/// Rules of the Buddhist calendar. Type `buddhist`.
pub const buddhistCalendar: CalendarSystem = .{
    .type = .buddhist,
    .name = "Buddhist",
    .monthCount = 12,
    .relatedYearOffset = 0,
    .defaultFields = .{ .year = 1, .month = 1, .day = 1, .hour = 0, .minute = 0, .second = 0, .millis = 0 },
    .daysInMonth = gm.daysInMonthInt,
    .daysInYear = gregorian.gregorianDaysInYear,
    .monthStart = gm.monthStart,
    .computeFields = computeBuddhistFields,
    .resolveFields = gregorian.gregorianResolveFields,
};

/// A Buddhist date from the given fields.
pub fn buddhistDateFromFields(db: *const tzdb.Database, fields: CalendarDateFields, firstDay: i64, minDays: i64) Error!BuddhistDate {
    return core.dateFromFields(db, &buddhistCalendar, fields, firstDay, minDays);
}

/// A Buddhist date from a UNIX epoch.
pub fn buddhistDateFromUnixEpoch(db: *const tzdb.Database, epoch: i64, zoneId: []const u8, firstDay: i64, minDays: i64) BuddhistDate {
    return core.dateFromUnixEpoch(db, &buddhistCalendar, epoch, zoneId, firstDay, minDays);
}

/// True if the date is in the Buddhist calendar.
pub fn isBuddhistDate(d: *const CalendarDate) bool {
    return d.calendar.type == .buddhist;
}
