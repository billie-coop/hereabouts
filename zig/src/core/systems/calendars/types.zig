//! Calendar date types (`types.ts`).

const tzdb = @import("../../../timezone/timezone.zig");
const std = @import("std");
const Allocator = std.mem.Allocator;
const Writer = std.Io.Writer;
const TimeStringOptions = @import("calendar.zig").TimeStringOptions;
const DateDiffOptions = @import("calendar.zig").DateDiffOptions;
const CalendarDateModField = @import("calendar.zig").CalendarDateModField;
const TimePeriod = @import("interval.zig").TimePeriod;
const TimePeriodField = @import("interval.zig").TimePeriodField;
const RelativeTime = @import("difference.zig").RelativeTime;
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
    zone_id: ?[]const u8 = null,

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
    zone_id: ?[]const u8,
};

/// A UTC epoch and the zone id of a date resolved from wall clock fields.
pub const Resolved = struct {
    epoch: f64,
    zone_id: []const u8,
};

/// A fixed `firstDay`, `minDays` week rule.
pub const WeekRule = struct {
    first_day: i64,
    min_days: i64,
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
    month_count: i64,
    /// Amount added to the extended year to give the related (Gregorian) year.
    related_year_offset: i64,
    /// Fixed week rule that overrides the locale's (ISO-8601), if any.
    week_rule: ?WeekRule = null,
    /// Fields assumed by `dateFromFields` for any the caller leaves out.
    default_fields: CalendarDateFields,
    /// Number of days in the zero-based month `m` (0..11) of extended year `y`; 0 for a month
    /// out of range (the TypeScript throws).
    days_in_month: *const fn (y: i64, m: i64) i64,
    /// Number of days in extended year `y`.
    days_in_year: *const fn (y: i64) i64,
    /// Julian day of the day before the first day of the zero-based `month` of extended year
    /// `eyear`.
    month_start: *const fn (eyear: f64, month: f64, useMonth: bool) f64,
    /// Compute the calendar-specific fields (era, year, month, day, day of year, leap) of fields
    /// whose Julian day and time fields have been set.
    compute_fields: *const fn (f: *Fields) void,
    /// Resolve complete wall clock fields to a UTC epoch and the zone id of the resulting date.
    /// `zoneId` and `offset` are those of the date the fields are being set on.
    resolve_fields: *const fn (db: *const tzdb.Database, f: WallFields, zoneId: []const u8, offset: f64) Resolved,
};

/// Time zone information carried by a calendar date. The strings are static, or owned by the
/// explicit time zone database.
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
    /// Immutable timezone rules used by all later transformations. Must outlive this date.
    database: *const tzdb.Database = tzdb.defaultDatabase,
    /// Rules of the calendar this date belongs to.
    calendar: *const CalendarSystem,
    /// Computed fields (internal layout, indexed by `DateField`).
    field_values: Fields,
    /// Time zone the date is expressed in.
    zone_info: DateZoneInfo,
    /// First day of the week, 1 = Sunday .. 7 = Saturday.
    first_day: i64,
    /// Minimum days in the first week of the year.
    min_days: i64,

    /// TypeScript `dateFromFields` (core/systems/calendars/core.ts).
    pub fn fromFields(db: *const tzdb.Database, calendar: *const CalendarSystem, input_fields: CalendarDateFields, firstDay: i64, minDays: i64) Error!CalendarDate {
        return @import("core.zig").dateFromFields(db, calendar, input_fields, firstDay, minDays);
    }

    /// TypeScript `dateFromUnixEpoch` (core/systems/calendars/core.ts).
    pub fn fromUnixEpoch(db: *const tzdb.Database, calendar: *const CalendarSystem, epoch: i64, zoneId: []const u8, firstDay: i64, minDays: i64) CalendarDate {
        return @import("core.zig").dateFromUnixEpoch(db, calendar, epoch, zoneId, firstDay, minDays);
    }

    /// TypeScript `dateType` (core/systems/calendars/calendar.ts).
    pub fn @"type"(d: *const CalendarDate) CalendarType {
        return @import("calendar.zig").dateType(d);
    }

    /// TypeScript `dateUnixEpoch` (core/systems/calendars/calendar.ts).
    pub fn unixEpoch(d: *const CalendarDate) i64 {
        return @import("calendar.zig").dateUnixEpoch(d);
    }

    /// TypeScript `dateFirstDayOfWeek` (core/systems/calendars/calendar.ts).
    pub fn firstDayOfWeek(d: *const CalendarDate) i64 {
        return @import("calendar.zig").dateFirstDayOfWeek(d);
    }

    /// TypeScript `dateMinDaysInFirstWeek` (core/systems/calendars/calendar.ts).
    pub fn minDaysInFirstWeek(d: *const CalendarDate) i64 {
        return @import("calendar.zig").dateMinDaysInFirstWeek(d);
    }

    /// TypeScript `dateJulianDay` (core/systems/calendars/calendar.ts).
    pub fn julianDay(d: *const CalendarDate) f64 {
        return @import("calendar.zig").dateJulianDay(d);
    }

    /// TypeScript `dateModifiedJulianDay` (core/systems/calendars/calendar.ts).
    pub fn modifiedJulianDay(d: *const CalendarDate) i64 {
        return @import("calendar.zig").dateModifiedJulianDay(d);
    }

    /// TypeScript `dateEra` (core/systems/calendars/calendar.ts).
    pub fn era(d: *const CalendarDate) i64 {
        return @import("calendar.zig").dateEra(d);
    }

    /// TypeScript `dateExtendedYear` (core/systems/calendars/calendar.ts).
    pub fn extendedYear(d: *const CalendarDate) i64 {
        return @import("calendar.zig").dateExtendedYear(d);
    }

    /// TypeScript `dateYear` (core/systems/calendars/calendar.ts).
    pub fn year(d: *const CalendarDate) i64 {
        return @import("calendar.zig").dateYear(d);
    }

    /// TypeScript `dateRelatedYear` (core/systems/calendars/calendar.ts).
    pub fn relatedYear(d: *const CalendarDate) i64 {
        return @import("calendar.zig").dateRelatedYear(d);
    }

    /// TypeScript `dateYearOfWeekOfYear` (core/systems/calendars/calendar.ts).
    pub fn yearOfWeekOfYear(d: *const CalendarDate) i64 {
        return @import("calendar.zig").dateYearOfWeekOfYear(d);
    }

    /// TypeScript `dateWeekOfYear` (core/systems/calendars/calendar.ts).
    pub fn weekOfYear(d: *const CalendarDate) i64 {
        return @import("calendar.zig").dateWeekOfYear(d);
    }

    /// TypeScript `dateYearOfWeekOfYearISO` (core/systems/calendars/calendar.ts).
    pub fn yearOfWeekOfYearISO(d: *const CalendarDate) i64 {
        return @import("calendar.zig").dateYearOfWeekOfYearISO(d);
    }

    /// TypeScript `dateWeekOfYearISO` (core/systems/calendars/calendar.ts).
    pub fn weekOfYearISO(d: *const CalendarDate) i64 {
        return @import("calendar.zig").dateWeekOfYearISO(d);
    }

    /// TypeScript `dateMonth` (core/systems/calendars/calendar.ts).
    pub fn month(d: *const CalendarDate) i64 {
        return @import("calendar.zig").dateMonth(d);
    }

    /// TypeScript `dateWeekOfMonth` (core/systems/calendars/calendar.ts).
    pub fn weekOfMonth(d: *const CalendarDate) i64 {
        return @import("calendar.zig").dateWeekOfMonth(d);
    }

    /// TypeScript `dateDayOfYear` (core/systems/calendars/calendar.ts).
    pub fn dayOfYear(d: *const CalendarDate) i64 {
        return @import("calendar.zig").dateDayOfYear(d);
    }

    /// TypeScript `dateDayOfWeek` (core/systems/calendars/calendar.ts).
    pub fn dayOfWeek(d: *const CalendarDate) i64 {
        return @import("calendar.zig").dateDayOfWeek(d);
    }

    /// TypeScript `dateOrdinalDayOfWeek` (core/systems/calendars/calendar.ts).
    pub fn ordinalDayOfWeek(d: *const CalendarDate) i64 {
        return @import("calendar.zig").dateOrdinalDayOfWeek(d);
    }

    /// TypeScript `dateDayOfWeekInMonth` (core/systems/calendars/calendar.ts).
    pub fn dayOfWeekInMonth(d: *const CalendarDate) i64 {
        return @import("calendar.zig").dateDayOfWeekInMonth(d);
    }

    /// TypeScript `dateDayOfMonth` (core/systems/calendars/calendar.ts).
    pub fn dayOfMonth(d: *const CalendarDate) i64 {
        return @import("calendar.zig").dateDayOfMonth(d);
    }

    /// TypeScript `dateIsAM` (core/systems/calendars/calendar.ts).
    pub fn isAM(d: *const CalendarDate) bool {
        return @import("calendar.zig").dateIsAM(d);
    }

    /// TypeScript `dateHour` (core/systems/calendars/calendar.ts).
    pub fn hour(d: *const CalendarDate) i64 {
        return @import("calendar.zig").dateHour(d);
    }

    /// TypeScript `dateHourOfDay` (core/systems/calendars/calendar.ts).
    pub fn hourOfDay(d: *const CalendarDate) i64 {
        return @import("calendar.zig").dateHourOfDay(d);
    }

    /// TypeScript `dateMinute` (core/systems/calendars/calendar.ts).
    pub fn minute(d: *const CalendarDate) i64 {
        return @import("calendar.zig").dateMinute(d);
    }

    /// TypeScript `dateSecond` (core/systems/calendars/calendar.ts).
    pub fn second(d: *const CalendarDate) i64 {
        return @import("calendar.zig").dateSecond(d);
    }

    /// TypeScript `dateMilliseconds` (core/systems/calendars/calendar.ts).
    pub fn milliseconds(d: *const CalendarDate) i64 {
        return @import("calendar.zig").dateMilliseconds(d);
    }

    /// TypeScript `dateMillisecondsInDay` (core/systems/calendars/calendar.ts).
    pub fn millisecondsInDay(d: *const CalendarDate) i64 {
        return @import("calendar.zig").dateMillisecondsInDay(d);
    }

    /// TypeScript `dateMetaZoneId` (core/systems/calendars/calendar.ts).
    pub fn metaZoneId(d: *const CalendarDate) []const u8 {
        return @import("calendar.zig").dateMetaZoneId(d);
    }

    /// TypeScript `dateTimeZoneId` (core/systems/calendars/calendar.ts).
    pub fn timeZoneId(d: *const CalendarDate) []const u8 {
        return @import("calendar.zig").dateTimeZoneId(d);
    }

    /// TypeScript `dateTimeZoneStableId` (core/systems/calendars/calendar.ts).
    pub fn timeZoneStableId(d: *const CalendarDate) []const u8 {
        return @import("calendar.zig").dateTimeZoneStableId(d);
    }

    /// TypeScript `dateTimeZoneOffset` (core/systems/calendars/calendar.ts).
    pub fn timeZoneOffset(d: *const CalendarDate) i64 {
        return @import("calendar.zig").dateTimeZoneOffset(d);
    }

    /// TypeScript `dateIsLeapYear` (core/systems/calendars/calendar.ts).
    pub fn isLeapYear(d: *const CalendarDate) bool {
        return @import("calendar.zig").dateIsLeapYear(d);
    }

    /// TypeScript `dateIsDaylightSavings` (core/systems/calendars/calendar.ts).
    pub fn isDaylightSavings(d: *const CalendarDate) bool {
        return @import("calendar.zig").dateIsDaylightSavings(d);
    }

    /// TypeScript `dateFieldOfVisualDifference` (core/systems/calendars/calendar.ts).
    pub fn fieldOfVisualDifference(d: *const CalendarDate, other: *const CalendarDate) ?u8 {
        return @import("calendar.zig").dateFieldOfVisualDifference(d, other);
    }

    /// TypeScript `dateCompare` (core/systems/calendars/calendar.ts).
    pub fn compare(a: *const CalendarDate, b: *const CalendarDate) i32 {
        return @import("calendar.zig").dateCompare(a, b);
    }

    /// TypeScript `dateFields` (core/systems/calendars/calendar.ts).
    pub fn fields(d: *const CalendarDate) CalendarDateFields {
        return @import("calendar.zig").dateFields(d);
    }

    /// TypeScript `dateToISOString` (core/systems/calendars/calendar.ts).
    pub fn toISOString(d: *const CalendarDate, gpa: Allocator) Allocator.Error![]u8 {
        return @import("calendar.zig").dateToISOString(gpa, d);
    }

    /// TypeScript `dateToLocalISOString` (core/systems/calendars/calendar.ts).
    pub fn toLocalISOString(d: *const CalendarDate, gpa: Allocator) Allocator.Error![]u8 {
        return @import("calendar.zig").dateToLocalISOString(gpa, d);
    }

    /// TypeScript `dateToDateString` (core/systems/calendars/calendar.ts).
    pub fn toDateString(d: *const CalendarDate, gpa: Allocator) Allocator.Error![]u8 {
        return @import("calendar.zig").dateToDateString(gpa, d);
    }

    /// TypeScript `dateToTimeString` (core/systems/calendars/calendar.ts).
    pub fn toTimeString(d: *const CalendarDate, gpa: Allocator, options: TimeStringOptions) Allocator.Error![]u8 {
        return @import("calendar.zig").dateToTimeString(gpa, d, options);
    }

    /// TypeScript `dateToDateTimeString` (core/systems/calendars/calendar.ts).
    pub fn toDateTimeString(d: *const CalendarDate, gpa: Allocator, options: TimeStringOptions) Allocator.Error![]u8 {
        return @import("calendar.zig").dateToDateTimeString(gpa, d, options);
    }

    /// TypeScript `dateToString` (core/systems/calendars/calendar.ts).
    pub fn toString(d: *const CalendarDate, gpa: Allocator) Allocator.Error![]u8 {
        return @import("calendar.zig").dateToString(gpa, d);
    }

    /// TypeScript `dateSet` (core/systems/calendars/calendar.ts).
    pub fn set(d: *const CalendarDate, input_fields: CalendarDateFields) CalendarDate {
        return @import("calendar.zig").dateSet(d, input_fields);
    }

    /// TypeScript `dateWithZone` (core/systems/calendars/calendar.ts).
    pub fn withZone(d: *const CalendarDate, zoneId: []const u8) CalendarDate {
        return @import("calendar.zig").dateWithZone(d, zoneId);
    }

    /// TypeScript `dateStartOf` (core/systems/calendars/calendar.ts).
    pub fn startOf(d: *const CalendarDate, field: CalendarDateModField) CalendarDate {
        return @import("calendar.zig").dateStartOf(d, field);
    }

    /// TypeScript `dateEndOf` (core/systems/calendars/calendar.ts).
    pub fn endOf(d: *const CalendarDate, field: CalendarDateModField) CalendarDate {
        return @import("calendar.zig").dateEndOf(d, field);
    }

    /// TypeScript `dateAdd` (core/systems/calendars/add.ts).
    pub fn add(d: *const CalendarDate, input_fields: TimePeriod) Error!CalendarDate {
        return @import("add.zig").dateAdd(d, input_fields);
    }

    /// TypeScript `dateSubtract` (core/systems/calendars/add.ts).
    pub fn subtract(d: *const CalendarDate, input_fields: TimePeriod) Error!CalendarDate {
        return @import("add.zig").dateSubtract(d, input_fields);
    }

    /// TypeScript `dateDifference` (core/systems/calendars/difference.ts).
    pub fn difference(d: *const CalendarDate, other: *const CalendarDate, options: DateDiffOptions) TimePeriod {
        return @import("difference.zig").dateDifference(d, other, options);
    }

    /// TypeScript `dateDifferenceSigned` (core/systems/calendars/difference.ts).
    pub fn differenceSigned(d: *const CalendarDate, other: *const CalendarDate, options: DateDiffOptions) TimePeriod {
        return @import("difference.zig").dateDifferenceSigned(d, other, options);
    }

    /// TypeScript `dateRelativeTime` (core/systems/calendars/difference.ts).
    pub fn relativeTime(d: *const CalendarDate, other: *const CalendarDate, fieldArg: ?TimePeriodField, options: DateDiffOptions) RelativeTime {
        return @import("difference.zig").dateRelativeTime(d, other, fieldArg, options);
    }

    /// TypeScript `dateSince` (core/systems/calendars/difference.ts).
    pub fn since(d: *const CalendarDate, other: *const CalendarDate, options: DateDiffOptions) TimePeriod {
        return @import("difference.zig").dateSince(d, other, options);
    }

    /// TypeScript `dateUntil` (core/systems/calendars/difference.ts).
    pub fn until(d: *const CalendarDate, other: *const CalendarDate, options: DateDiffOptions) TimePeriod {
        return @import("difference.zig").dateUntil(d, other, options);
    }

    /// TypeScript `dateToString` (writer counterpart).
    pub fn writeString(d: *const CalendarDate, w: *Writer) Writer.Error!void {
        return @import("calendar.zig").writeString(w, d);
    }

    /// TypeScript `dateToDateString` (writer counterpart).
    pub fn writeDateString(d: *const CalendarDate, w: *Writer) Writer.Error!void {
        return @import("calendar.zig").writeDateString(w, d);
    }

    /// TypeScript `dateToTimeString` (writer counterpart).
    pub fn writeTimeString(d: *const CalendarDate, w: *Writer, options: TimeStringOptions) Writer.Error!void {
        return @import("calendar.zig").writeTimeString(w, d, options);
    }

    /// TypeScript `dateToDateTimeString` (writer counterpart).
    pub fn writeDateTimeString(d: *const CalendarDate, w: *Writer, options: TimeStringOptions) Writer.Error!void {
        return @import("calendar.zig").writeDateTimeString(w, d, options);
    }

    /// TypeScript `dateToISOString/dateToLocalISOString` (writer counterpart).
    pub fn writeISOString(d: *const CalendarDate, w: *Writer, utc: bool) Writer.Error!void {
        return @import("calendar.zig").writeISOString(w, d, utc);
    }
};

/// Errors of the calendar functions.
pub const Error = error{
    /// `dateFromFields` without a month or day, in a calendar without defaults for them.
    InvalidFields,
    /// The date math produced an instant that is not a finite number (an infinite or NaN
    /// time period, or one so large it overflows).
    InvalidDate,
};
