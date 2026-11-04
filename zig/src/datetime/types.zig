//! Port of `packages/hereabouts/src/datetime/types.ts`.

const std = @import("std");

/// A calendar day in the proleptic Gregorian calendar, such as 31 January 2026. It has no time
/// and no time zone: a due date or a birthday. `month` is 1-12 and `day` is 1-31.
///
/// Create one with `day` or `dayParse`. A hand-built value is checked by every function that
/// takes it, so `.{ .year = 2026, .month = 2, .day = 30 }` is an error, not 2 March.
pub const Day = struct {
    year: i32,
    month: i32,
    day: i32,
};

/// A wall clock time, such as 06:30. It has no day and no time zone: the time an alarm rings or
/// a reminder is sent, whatever zone it is resolved in.
///
/// Create one with `timeOfDay` or `timeOfDayParse`; functions that take one check it.
pub const TimeOfDay = struct {
    hour: i32,
    minute: i32,
    second: i32,
    millis: i32,
};

/// A single moment, the same everywhere: milliseconds since 1970-01-01T00:00:00Z. Durations
/// between instants are plain milliseconds. Valid instants are within +/-8.64e15 (the range of
/// JavaScript Date).
pub const Instant = i64;

/// A calendar duration, added to or subtracted from a `Day`. Years and months are applied first
/// (the day of month is clamped to the end of a shorter month), then weeks and days.
pub const DayDuration = struct {
    years: i64 = 0,
    months: i64 = 0,
    weeks: i64 = 0,
    days: i64 = 0,
};

/// Units for `dayUntil`.
pub const DayUnit = enum {
    days,
    weeks,
    months,
    years,

    pub fn fromString(s: []const u8) ?DayUnit {
        return std.meta.stringToEnum(DayUnit, s);
    }
};

/// Periods for `dayStartOf` and `dayEndOf`.
pub const DayPeriod = enum {
    month,
    year,

    pub fn fromString(s: []const u8) ?DayPeriod {
        return std.meta.stringToEnum(DayPeriod, s);
    }
};

/// How to turn a wall clock time into an instant when the clocks change on that day.
///
/// - `compatible` (default): a skipped time moves forward by the length of the gap (02:30 on a
///   spring-forward day becomes 03:30); a repeated time takes the first occurrence.
/// - `earlier`: the earlier of the two possible instants.
/// - `later`: the later of the two possible instants.
/// - `reject`: an error if the time is skipped or repeated.
///
/// The names and behaviour match the `disambiguation` option of the JavaScript Temporal API.
pub const Disambiguation = enum {
    compatible,
    earlier,
    later,
    reject,

    pub fn fromString(s: []const u8) ?Disambiguation {
        return std.meta.stringToEnum(Disambiguation, s);
    }
};

/// The errors of this module. The TypeScript throws a RangeError for each; the message starts
/// with the text in the comment.
pub const Error = error{
    /// "Invalid day"
    InvalidDay,
    /// "Day out of range"
    DayOutOfRange,
    /// "Invalid time of day"
    InvalidTimeOfDay,
    /// "Milliseconds since midnight must be an integer from 0 to 86399999"
    InvalidMillis,
    /// "First day of week must be 1 (Sunday) through 7 (Saturday)"
    InvalidFirstDay,
    /// "Range step must be positive"
    InvalidStep,
    /// "Unknown time zone"
    UnknownTimeZone,
    /// "Invalid instant"
    InvalidInstant,
    /// "Instant out of range"
    InstantOutOfRange,
    /// "Time happens twice"
    RepeatedTime,
    /// "Time doesn't exist"
    SkippedTime,
};
