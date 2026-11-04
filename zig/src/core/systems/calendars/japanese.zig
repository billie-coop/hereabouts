//! The Japanese Imperial calendar (`japanese.ts`): the Gregorian calendar with Japanese eras.

const tzdb = @import("../../../timezone/timezone.zig");
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

/// A date in the Japanese Imperial calendar.
/// A Japanese date from the given fields. Without a month or day, `error.InvalidFields`: the
/// calendar has no default fields.
pub fn japaneseDateFromFields(db: *const tzdb.Database, fields: CalendarDateFields, firstDay: i64, minDays: i64) Error!CalendarDate {
    return core.dateFromFields(db, &japaneseCalendar, fields, firstDay, minDays);
}

/// A Japanese date from a UNIX epoch.
pub fn japaneseDateFromUnixEpoch(db: *const tzdb.Database, epoch: i64, zoneId: []const u8, firstDay: i64, minDays: i64) CalendarDate {
    return core.dateFromUnixEpoch(db, &japaneseCalendar, epoch, zoneId, firstDay, minDays);
}

/// True if the date is in the Japanese calendar.
pub fn isJapaneseDate(d: *const CalendarDate) bool {
    return d.calendar.type == .japanese;
}

fn computeJapaneseFields(f: *Fields) void {
    gm.initGregorianFields(f);
    const year = f[F.EXTENDED_YEAR];
    const len = ERAS.len;
    const end = len / 3;
    var low: usize = 0;
    if (year > ERAS[len - 3]) {
        low = end - 1;
    } else {
        var high: usize = end;
        while (low + 1 < high) {
            const i = (low + high) / 2;
            const j = i * 3;
            var diff = year - ERAS[j];
            if (diff == 0) {
                diff = f[F.MONTH] - 1 - (ERAS[j + 1] - 1);
                if (diff == 0) diff = f[F.DAY_OF_MONTH] - ERAS[j + 2];
            }
            if (diff >= 0) {
                low = i;
            } else {
                high = i;
            }
        }
    }
    f[F.ERA] = @floatFromInt(low);
    f[F.YEAR] = year - ERAS[low * 3] + 1;
}

const ERAS = @import("autogen.eras.zig").eras;

/// Rules of the Japanese Imperial calendar. Type `japanese`.
pub const japaneseCalendar: CalendarSystem = .{
    .type = .japanese,
    .name = "Japanese",
    .month_count = 12,
    .related_year_offset = 0,
    // 1.x JapaneseDate.fromFields applies no defaults
    .default_fields = .{},
    .days_in_month = gm.daysInMonthInt,
    .days_in_year = gregorian.gregorianDaysInYear,
    .month_start = gm.monthStart,
    .compute_fields = computeJapaneseFields,
    .resolve_fields = gregorian.gregorianResolveFields,
};
