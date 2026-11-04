//! Days, times of day, instants and time zones: the date-fns replacement.
//! Port of `packages/hereabouts/src/datetime`.
//!
//! - `Day`: a calendar day, no time, no zone. Due dates, birthdays.
//! - `TimeOfDay`: a wall clock time, no day, no zone. "Remind me at 9:00".
//! - `Instant`: a moment, milliseconds since 1970 UTC. Payments, `created_at`.
//! - Zone: an IANA id such as "America/Vancouver", looked up in the active `timezone` data.
//!
//! Day and time-of-day math is exact integer arithmetic and never touches a zone. Only the
//! functions in `zone.zig` take one. Every function checks its inputs and returns an `Error`
//! instead of rolling over; the parse functions return null for text that isn't valid. Names
//! are the TypeScript names. Functions returning a string or slice take an allocator and the
//! caller owns the result.

const types = @import("types.zig");
const day_ = @import("day.zig");
const time_of_day = @import("time_of_day.zig");
const instant = @import("instant.zig");
const zone = @import("zone.zig");

pub const Day = types.Day;
pub const TimeOfDay = types.TimeOfDay;
pub const Instant = types.Instant;
pub const DayDuration = types.DayDuration;
pub const DayUnit = types.DayUnit;
pub const DayPeriod = types.DayPeriod;
pub const Disambiguation = types.Disambiguation;
pub const Error = types.Error;

pub const isLeapYear = day_.isLeapYear;
pub const daysInMonth = day_.daysInMonth;
pub const isDay = day_.isDay;
pub const dayAdd = day_.dayAdd;
pub const dayCompare = day_.dayCompare;
pub const dayDaysInMonth = day_.dayDaysInMonth;
pub const dayEndOf = day_.dayEndOf;
pub const dayEndOfWeek = day_.dayEndOfWeek;
pub const dayEquals = day_.dayEquals;
pub const dayFromEpochDay = day_.dayFromEpochDay;
pub const dayFromString = day_.dayFromString;
pub const dayIsAfter = day_.dayIsAfter;
pub const dayIsBefore = day_.dayIsBefore;
pub const dayIsLeapYear = day_.dayIsLeapYear;
pub const dayOfWeek = day_.dayOfWeek;
pub const dayOfYear = day_.dayOfYear;
pub const dayParse = day_.dayParse;
pub const dayRange = day_.dayRange;
pub const dayStartOf = day_.dayStartOf;
pub const dayStartOfWeek = day_.dayStartOfWeek;
pub const daySubtract = day_.daySubtract;
pub const dayToEpochDay = day_.dayToEpochDay;
pub const dayToString = day_.dayToString;
pub const formatDay = day_.formatDay;
pub const dayUntil = day_.dayUntil;

pub const day = day_.day;

pub const instantParse = instant.instantParse;
pub const instantToString = instant.instantToString;

pub const isTimeOfDay = time_of_day.isTimeOfDay;
pub const timeOfDay = time_of_day.timeOfDay;
pub const timeOfDayCompare = time_of_day.timeOfDayCompare;
pub const timeOfDayFromMillis = time_of_day.timeOfDayFromMillis;
pub const timeOfDayFromString = time_of_day.timeOfDayFromString;
pub const timeOfDayParse = time_of_day.timeOfDayParse;
pub const timeOfDayToMillis = time_of_day.timeOfDayToMillis;
pub const timeOfDayToString = time_of_day.timeOfDayToString;
pub const formatTimeOfDay = time_of_day.formatTimeOfDay;

pub const DayAtTimeOptions = zone.DayAtTimeOptions;
pub const dayAtTime = zone.dayAtTime;
pub const dayFromInstant = zone.dayFromInstant;
pub const dayStartInstant = zone.dayStartInstant;
pub const dayToday = zone.dayToday;
pub const systemTimeZone = zone.systemTimeZone;
pub const timeOfDayFromInstant = zone.timeOfDayFromInstant;
pub const timeZoneId = zone.timeZoneId;
pub const timeZoneOffset = zone.timeZoneOffset;
pub const now = zone.now;
