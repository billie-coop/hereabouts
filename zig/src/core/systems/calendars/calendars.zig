//! Calendar systems: dates in the Gregorian, ISO-8601, Buddhist, Japanese and Persian calendars,
//! with time zones, field math, adding periods and differences.
//! Port of `packages/hereabouts/src/core/systems/calendars`.
//!
//! A `CalendarDate` is plain immutable data: a calendar's rules, computed fields, time zone info
//! and week rules. Construct one with `CalendarDate.fromUnixEpoch` / `CalendarDate.fromFields` (or the
//! per-calendar `gregorianDateFromUnixEpoch`, ...) and read or operate on it with methods
//! whose names drop the TypeScript date prefix.
//!
//! Numbers: the date math is done in doubles exactly as the TypeScript does it (floors,
//! truncations and JavaScript remainders included), so results match for any input, including
//! far past and future dates. Accessors return the (integer) fields as `i64`; `TimePeriod`
//! fields are `f64`, since differences rolled up into fractions have them. Epochs are `i64`
//! milliseconds.
//!
//! Differences from the TypeScript:
//! - `dateAdd`, `dateSubtract` and the `*FromFields` functions return an error where the
//!   TypeScript throws or produces a date of NaN fields (see `Error`).
//! - String functions take an allocator (the caller owns the result); `write*` variants write
//!   to a `std.Io.Writer`.
//! - `isCalendarDate` and `dateAsJSDate` have no equivalent (the types make the first moot, and
//!   there is no JavaScript `Date`).
//! - `dateFieldOfVisualDifference` returns the pattern field character (`'y'`, ...) or null.

const add = @import("add.zig");
const buddhist = @import("buddhist.zig");
const calendar = @import("calendar.zig");
const core = @import("core.zig");
const difference = @import("difference.zig");
const fields = @import("fields.zig");
const gregorian = @import("gregorian.zig");
const interval = @import("interval.zig");
const iso8601 = @import("iso8601.zig");
const japanese = @import("japanese.zig");
const persian = @import("persian.zig");
const timezone = @import("timezone.zig");
const types = @import("types.zig");

pub const constants = @import("constants.zig");

// types
pub const CalendarType = types.CalendarType;
pub const CalendarDateFields = types.CalendarDateFields;
pub const CalendarSystem = types.CalendarSystem;
pub const CalendarDate = types.CalendarDate;
pub const DateZoneInfo = types.DateZoneInfo;
pub const WallFields = types.WallFields;
pub const Resolved = types.Resolved;
pub const WeekRule = types.WeekRule;
pub const Fields = types.Fields;
pub const Error = types.Error;
pub const DateField = fields.DateField;
pub const DayOfWeek = fields.DayOfWeek;

// interval
pub const TimePeriod = interval.TimePeriod;
pub const TimePeriodField = interval.TimePeriodField;
pub const TIME_PERIOD_FIELDS = interval.TIME_PERIOD_FIELDS;

// core

// calendars
pub const gregorianCalendar = &gregorian.gregorianCalendar;
pub const gregorianDateFromFields = gregorian.gregorianDateFromFields;
pub const gregorianDateFromUnixEpoch = gregorian.gregorianDateFromUnixEpoch;
pub const isGregorianDate = gregorian.isGregorianDate;
pub const iso8601Calendar = &iso8601.iso8601Calendar;
pub const iso8601DateFromFields = iso8601.iso8601DateFromFields;
pub const iso8601DateFromUnixEpoch = iso8601.iso8601DateFromUnixEpoch;
pub const isISO8601Date = iso8601.isISO8601Date;
pub const buddhistCalendar = &buddhist.buddhistCalendar;
pub const buddhistDateFromFields = buddhist.buddhistDateFromFields;
pub const buddhistDateFromUnixEpoch = buddhist.buddhistDateFromUnixEpoch;
pub const isBuddhistDate = buddhist.isBuddhistDate;
pub const japaneseCalendar = &japanese.japaneseCalendar;
pub const japaneseDateFromFields = japanese.japaneseDateFromFields;
pub const japaneseDateFromUnixEpoch = japanese.japaneseDateFromUnixEpoch;
pub const isJapaneseDate = japanese.isJapaneseDate;
pub const persianCalendar = &persian.persianCalendar;
pub const persianDateFromFields = persian.persianDateFromFields;
pub const persianDateFromUnixEpoch = persian.persianDateFromUnixEpoch;
pub const isPersianDate = persian.isPersianDate;

/// The calendar system of a type.
pub fn calendarSystem(t: CalendarType) *const CalendarSystem {
    return switch (t) {
        .buddhist => buddhistCalendar,
        .gregory => gregorianCalendar,
        .iso8601 => iso8601Calendar,
        .japanese => japaneseCalendar,
        .persian => persianCalendar,
    };
}

// calendar
pub const CalendarDateModField = calendar.CalendarDateModField;
pub const TimeStringOptions = calendar.TimeStringOptions;
pub const DateDiffOptions = calendar.DateDiffOptions;

// add, difference
pub const RelativeTime = difference.RelativeTime;

// time zones
pub const zoneInfoFromUTC = timezone.zoneInfoFromUTC;
pub const currentMetazone = timezone.currentMetazone;
pub const getStableTimeZoneId = timezone.getStableTimeZoneId;
pub const substituteZoneAlias = timezone.substituteZoneAlias;

test {
    _ = @import("util.zig");
    _ = timezone;
    _ = @import("../../internals/calendars/zoneutil.zig");
}
