//! Port of `packages/hereabouts/src/datetime/types.ts`.

const std = @import("std");
const Allocator = std.mem.Allocator;
const DayAtTimeOptions = @import("zone.zig").DayAtTimeOptions;

/// A calendar day in the proleptic Gregorian calendar, such as 31 January 2026. It has no time
/// and no time zone: a due date or a birthday. `month` is 1-12 and `day` is 1-31.
///
/// Create one with `Day.init` or `Day.parse`. A hand-built value is checked by every function that
/// takes it, so `.{ .year = 2026, .month = 2, .day = 30 }` is an error, not 2 March.
pub const Day = struct {
    year: i32,
    month: i32,
    day: i32,

    /// TypeScript `day` (datetime/day.ts).
    pub fn init(year: i64, month: i64, dayOfMonth: i64) Error!Day {
        return @import("day.zig").day(year, month, dayOfMonth);
    }

    /// TypeScript `dayToEpochDay` (datetime/day.ts).
    pub fn toEpochDay(d: Day) Error!i64 {
        return @import("day.zig").dayToEpochDay(d);
    }

    /// TypeScript `dayFromEpochDay` (datetime/day.ts).
    pub fn fromEpochDay(n: i64) Error!Day {
        return @import("day.zig").dayFromEpochDay(n);
    }

    /// TypeScript `dayParse` (datetime/day.ts).
    pub fn parse(s: []const u8) ?Day {
        return @import("day.zig").dayParse(s);
    }

    /// TypeScript `dayFromString` (datetime/day.ts).
    pub fn fromString(s: []const u8) Error!Day {
        return @import("day.zig").dayFromString(s);
    }

    /// TypeScript `dayToString` (datetime/day.ts).
    pub fn toString(d: Day, gpa: Allocator) (Error || Allocator.Error)![]u8 {
        return @import("day.zig").dayToString(gpa, d);
    }

    /// TypeScript `dayToString` (buffer writer counterpart).
    pub fn toStringBuffer(d: Day, buf: []u8) Error![]u8 {
        return @import("day.zig").formatDay(buf, d);
    }

    /// TypeScript `dayAdd` (datetime/day.ts).
    pub fn add(d: Day, duration: DayDuration) Error!Day {
        return @import("day.zig").dayAdd(d, duration);
    }

    /// TypeScript `daySubtract` (datetime/day.ts).
    pub fn subtract(d: Day, duration: DayDuration) Error!Day {
        return @import("day.zig").daySubtract(d, duration);
    }

    /// TypeScript `dayCompare` (datetime/day.ts).
    pub fn compare(a: Day, b: Day) Error!i32 {
        return @import("day.zig").dayCompare(a, b);
    }

    /// TypeScript `dayEquals` (datetime/day.ts).
    pub fn equals(a: Day, b: Day) Error!bool {
        return @import("day.zig").dayEquals(a, b);
    }

    /// TypeScript `dayIsBefore` (datetime/day.ts).
    pub fn isBefore(a: Day, b: Day) Error!bool {
        return @import("day.zig").dayIsBefore(a, b);
    }

    /// TypeScript `dayIsAfter` (datetime/day.ts).
    pub fn isAfter(a: Day, b: Day) Error!bool {
        return @import("day.zig").dayIsAfter(a, b);
    }

    /// TypeScript `dayUntil` (datetime/day.ts).
    pub fn until(from: Day, to: Day, unit: DayUnit) Error!i64 {
        return @import("day.zig").dayUntil(from, to, unit);
    }

    /// TypeScript `dayOfWeek` (datetime/day.ts).
    pub fn ofWeek(d: Day) Error!u8 {
        return @import("day.zig").dayOfWeek(d);
    }

    /// TypeScript `dayOfYear` (datetime/day.ts).
    pub fn ofYear(d: Day) Error!u16 {
        return @import("day.zig").dayOfYear(d);
    }

    /// TypeScript `dayDaysInMonth` (datetime/day.ts).
    pub fn daysInMonth(d: Day) Error!u8 {
        return @import("day.zig").dayDaysInMonth(d);
    }

    /// TypeScript `dayIsLeapYear` (datetime/day.ts).
    pub fn isLeapYear(d: Day) Error!bool {
        return @import("day.zig").dayIsLeapYear(d);
    }

    /// TypeScript `dayStartOfWeek` (datetime/day.ts).
    pub fn startOfWeek(d: Day, firstDay: i64) Error!Day {
        return @import("day.zig").dayStartOfWeek(d, firstDay);
    }

    /// TypeScript `dayEndOfWeek` (datetime/day.ts).
    pub fn endOfWeek(d: Day, firstDay: i64) Error!Day {
        return @import("day.zig").dayEndOfWeek(d, firstDay);
    }

    /// TypeScript `dayStartOf` (datetime/day.ts).
    pub fn startOf(d: Day, unit: DayPeriod) Error!Day {
        return @import("day.zig").dayStartOf(d, unit);
    }

    /// TypeScript `dayEndOf` (datetime/day.ts).
    pub fn endOf(d: Day, unit: DayPeriod) Error!Day {
        return @import("day.zig").dayEndOf(d, unit);
    }

    /// TypeScript `dayRange` (datetime/day.ts).
    pub fn range(start: Day, gpa: Allocator, end: Day, step: DayDuration) (Error || Allocator.Error)![]Day {
        return @import("day.zig").dayRange(gpa, start, end, step);
    }

    /// TypeScript `dayFromInstant` (datetime/zone.ts).
    pub fn fromInstant(instant: Instant, zone: []const u8) Error!Day {
        return @import("zone_context.zig").dayFromInstant(instant, zone);
    }

    /// TypeScript `dayToday` (datetime/zone.ts).
    pub fn today(zone: []const u8, now_: Instant) Error!Day {
        return @import("zone_context.zig").dayToday(zone, now_);
    }

    /// TypeScript `dayAtTime` (datetime/zone.ts).
    pub fn atTime(d: Day, time: TimeOfDay, zone: []const u8, options: DayAtTimeOptions) Error!Instant {
        return @import("zone_context.zig").dayAtTime(d, time, zone, options);
    }

    /// TypeScript `dayStartInstant` (datetime/zone.ts).
    pub fn startInstant(d: Day, zone: []const u8) Error!Instant {
        return @import("zone_context.zig").dayStartInstant(d, zone);
    }
};

/// A wall clock time, such as 06:30. It has no day and no time zone: the time an alarm rings or
/// a reminder is sent, whatever zone it is resolved in.
///
/// Create one with `TimeOfDay.init` or `TimeOfDay.parse`; functions that take one check it.
pub const TimeOfDay = struct {
    hour: i32,
    minute: i32,
    second: i32,
    millis: i32,

    /// TypeScript `timeOfDay` (datetime/time-of-day.ts).
    pub fn init(hour: i64, minute: i64, second: i64, millis: i64) Error!TimeOfDay {
        return @import("time_of_day.zig").timeOfDay(hour, minute, second, millis);
    }

    /// TypeScript `timeOfDayToMillis` (datetime/time-of-day.ts).
    pub fn toMillis(t: TimeOfDay) Error!i64 {
        return @import("time_of_day.zig").timeOfDayToMillis(t);
    }

    /// TypeScript `timeOfDayFromMillis` (datetime/time-of-day.ts).
    pub fn fromMillis(ms: i64) Error!TimeOfDay {
        return @import("time_of_day.zig").timeOfDayFromMillis(ms);
    }

    /// TypeScript `timeOfDayParse` (datetime/time-of-day.ts).
    pub fn parse(s: []const u8) ?TimeOfDay {
        return @import("time_of_day.zig").timeOfDayParse(s);
    }

    /// TypeScript `timeOfDayFromString` (datetime/time-of-day.ts).
    pub fn fromString(s: []const u8) Error!TimeOfDay {
        return @import("time_of_day.zig").timeOfDayFromString(s);
    }

    /// TypeScript `timeOfDayToString` (datetime/time-of-day.ts).
    pub fn toString(t: TimeOfDay, gpa: Allocator) (Error || Allocator.Error)![]u8 {
        return @import("time_of_day.zig").timeOfDayToString(gpa, t);
    }

    /// TypeScript `timeOfDayToString` (buffer writer counterpart).
    pub fn toStringBuffer(t: TimeOfDay, buf: []u8) Error![]u8 {
        return @import("time_of_day.zig").formatTimeOfDay(buf, t);
    }

    /// TypeScript `timeOfDayCompare` (datetime/time-of-day.ts).
    pub fn compare(a: TimeOfDay, b: TimeOfDay) Error!i32 {
        return @import("time_of_day.zig").timeOfDayCompare(a, b);
    }

    /// TypeScript `timeOfDayFromInstant` (datetime/zone.ts).
    pub fn fromInstant(instant: Instant, zone: []const u8) Error!TimeOfDay {
        return @import("zone_context.zig").timeOfDayFromInstant(instant, zone);
    }
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
