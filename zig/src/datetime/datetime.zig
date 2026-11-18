//! Days, times of day, instants and time zones: the date-fns replacement.
//! Port of `packages/hereabouts/src/datetime`.
//!
//! - `Day`: a calendar day, no time, no zone. Due dates, birthdays.
//! - `TimeOfDay`: a wall clock time, no day, no zone. "Remind me at 9:00".
//! - `Instant`: a moment, milliseconds since 1970 UTC. Payments, `created_at`.
//! - Zone: an IANA id such as "America/Vancouver", looked up in immutable `timezone` data (ZoneContext selects a custom database).
//!
//! Day and time-of-day math is exact integer arithmetic and never touches a zone. Only the
//! functions in `zone.zig` take one. Every function checks its inputs and returns an `Error`
//! instead of rolling over; the parse functions return null for text that isn't valid. Method names follow the TypeScript names with the receiver type word dropped. Functions returning a string or slice take an allocator and the
//! caller owns the result.

const types = @import("types.zig");
const day_ = @import("day.zig");
const time_of_day = @import("time_of_day.zig");
const instant_impl = @import("instant.zig");
const zone = @import("zone.zig");
const context = @import("zone_context.zig");
pub const ZoneContext = context.ZoneContext;

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

pub const isTimeOfDay = time_of_day.isTimeOfDay;

pub const DayAtTimeOptions = zone.DayAtTimeOptions;
pub const systemTimeZone = context.systemTimeZone;
pub const timeZoneId = context.timeZoneId;
pub const timeZoneOffset = context.timeZoneOffset;
pub const now = zone.now;

/// Namespace for the TypeScript Instant integer alias.
pub const instant = struct {
    /// TypeScript instantParse.
    pub const parse = context.instantParse;
    /// TypeScript instantToString.
    pub const toString = context.instantToString;
};
