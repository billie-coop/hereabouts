//! Calendar date types (`types.ts`).

const std = @import("std");
const fields_ = @import("fields.zig");

pub const Fields = fields_.Fields;

/// Calendar systems. The Gregorian calendar is "gregory" so that it fits into a language tag
/// ("zh-u-ca-gregory"); "gregorian" exceeds the 8-character limit.
/// See https://www.unicode.org/reports/tr35/#Key_And_Type_Definitions_
pub const CalendarType = enum {
    buddhist,
    gregory,
    iso8601,
    japanese,
    persian,

    /// The type's name, e.g. "gregory".
    pub fn toString(self: CalendarType) []const u8 {
        return @tagName(self);
    }

    /// The type with the given name, or null.
    pub fn fromString(s: []const u8) ?CalendarType {
        return std.meta.stringToEnum(CalendarType, s);
    }
};

/// Fields of a date, as given to `dateFromFields` and `dateSet` (null fields are left out) and as
/// returned by `dateFields`. `year` is the extended year: 0 is 1 BC in the Gregorian calendar.
pub const CalendarDateFields = struct {
    year: ?i64 = null,
    month: ?i64 = null,
    day: ?i64 = null,
    hour: ?i64 = null,
    minute: ?i64 = null,
    second: ?i64 = null,
    millis: ?i64 = null,
    zoneId: ?[]const u8 = null,

    /// These fields with `over`'s non-null fields laid on top (`{ ...self, ...over }`).
    pub fn merge(self: CalendarDateFields, over: CalendarDateFields) CalendarDateFields {
        var r = self;
        inline for (std.meta.fields(CalendarDateFields)) |f| {
            if (@field(over, f.name)) |v| @field(r, f.name) = v;
        }
        return r;
    }
};

/// Wall clock fields resolved by a calendar: a complete date, numbers as in the TypeScript.
pub const WallFields = struct {
    year: f64,
    month: f64,
    day: f64,
    hour: f64,
    minute: f64,
    second: f64,
    millis: f64,
    /// Requested zone, if any (an empty id counts as none).
    zoneId: ?[]const u8,
};

/// A UTC epoch and the zone id of a date resolved from wall clock fields.
pub const Resolved = struct {
    epoch: f64,
    zoneId: []const u8,
};

/// A fixed `firstDay`, `minDays` week rule.
pub const WeekRule = struct {
    firstDay: i64,
    minDays: i64,
};

/// The rules of a calendar system: the calendar-specific arithmetic shared by all of its dates.
/// One exists per calendar (`gregorianCalendar`, `iso8601Calendar`, `buddhistCalendar`,
/// `japaneseCalendar`, `persianCalendar`); every date points to its calendar's.
pub const CalendarSystem = struct {
    /// Calendar type, e.g. `.gregory`.
    type: CalendarType,
    /// Name used by `dateToString`, e.g. "Gregorian".
    name: []const u8,
    /// Number of months in a year.
    monthCount: i64,
    /// Amount added to the extended year to give the related (Gregorian) year.
    relatedYearOffset: i64,
    /// Fixed week rule that overrides the locale's (ISO-8601), if any.
    weekRule: ?WeekRule = null,
    /// Fields assumed by `dateFromFields` for any the caller leaves out.
    defaultFields: CalendarDateFields,
    /// Number of days in the zero-based month `m` (0..11) of extended year `y`; 0 for a month
    /// out of range (the TypeScript throws).
    daysInMonth: *const fn (y: i64, m: i64) i64,
    /// Number of days in extended year `y`.
    daysInYear: *const fn (y: i64) i64,
    /// Julian day of the day before the first day of the zero-based `month` of extended year
    /// `eyear`.
    monthStart: *const fn (eyear: f64, month: f64, useMonth: bool) f64,
    /// Compute the calendar-specific fields (era, year, month, day, day of year, leap) of fields
    /// whose Julian day and time fields have been set.
    computeFields: *const fn (f: *Fields) void,
    /// Resolve complete wall clock fields to a UTC epoch and the zone id of the resulting date.
    /// `zoneId` and `offset` are those of the date the fields are being set on.
    resolveFields: *const fn (f: WallFields, zoneId: []const u8, offset: f64) Resolved,
};

/// Time zone information carried by a calendar date. The strings are static, or owned by the
/// active time zone database.
pub const DateZoneInfo = struct {
    /// Canonical tz database id.
    zoneid: []const u8,
    /// CLDR stable id, used to look up zone names.
    stableid: []const u8,
    /// Abbreviation, e.g. "EST".
    abbr: []const u8,
    /// 1 in daylight saving time, else 0.
    dst: u8,
    /// Offset from UTC in milliseconds.
    offset: i64,
    /// CLDR metazone id, or "" if the zone has none.
    metazoneid: []const u8,
};

/// A date and time in a calendar system and time zone. Plain immutable data: read and operate on
/// it with the `date*` functions.
pub const CalendarDate = struct {
    /// Rules of the calendar this date belongs to.
    calendar: *const CalendarSystem,
    /// Computed fields (internal layout, indexed by `DateField`).
    fields: Fields,
    /// Time zone the date is expressed in.
    zoneInfo: DateZoneInfo,
    /// First day of the week, 1 = Sunday .. 7 = Saturday.
    firstDay: i64,
    /// Minimum days in the first week of the year.
    minDays: i64,
};

/// Errors of the calendar functions.
pub const Error = error{
    /// `dateFromFields` without a month or day, in a calendar without defaults for them.
    InvalidFields,
    /// The date math produced an instant that is not a finite number (an infinite or NaN
    /// time period, or one so large it overflows).
    InvalidDate,
};
