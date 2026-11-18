//! Immutable timezone context. Custom database storage must outlive all results.
const std = @import("std");
const Allocator = std.mem.Allocator;
const tz = @import("../timezone/timezone.zig");
const types = @import("types.zig");
const Day = types.Day;
const TimeOfDay = types.TimeOfDay;
const Instant = types.Instant;
const Error = types.Error;
const zone_impl = @import("zone.zig");
const instant_impl = @import("instant.zig");
const DayAtTimeOptions = zone_impl.DayAtTimeOptions;

/// Explicit immutable database selection. Methods preserve TypeScript names; this context
/// and its database may be shared while the database is alive.
pub const ZoneContext = struct {
    database: *const tz.Database = tz.defaultDatabase,
    /// TypeScript `timeZoneId` with explicit database selection.
    pub fn timeZoneId(self: ZoneContext, zone: []const u8) Error![]const u8 {
        return zone_impl.timeZoneId(self.database, zone);
    }
    /// TypeScript `timeZoneOffset` with explicit database selection.
    pub fn timeZoneOffset(self: ZoneContext, zone: []const u8, instant: Instant) Error!i64 {
        return zone_impl.timeZoneOffset(self.database, zone, instant);
    }
    /// TypeScript `systemTimeZone` with explicit database selection.
    pub fn systemTimeZone(self: ZoneContext, io: std.Io, environ: std.process.Environ) ?[]const u8 {
        return zone_impl.systemTimeZone(self.database, io, environ);
    }
    /// TypeScript `dayFromInstant` with explicit database selection.
    pub fn dayFromInstant(self: ZoneContext, instant: Instant, zone: []const u8) Error!Day {
        return zone_impl.dayFromInstant(self.database, instant, zone);
    }
    /// TypeScript `timeOfDayFromInstant` with explicit database selection.
    pub fn timeOfDayFromInstant(self: ZoneContext, instant: Instant, zone: []const u8) Error!TimeOfDay {
        return zone_impl.timeOfDayFromInstant(self.database, instant, zone);
    }
    /// TypeScript `dayToday` with explicit database selection.
    pub fn dayToday(self: ZoneContext, zone: []const u8, now_: Instant) Error!Day {
        return zone_impl.dayToday(self.database, zone, now_);
    }
    /// TypeScript `dayAtTime` with explicit database selection.
    pub fn dayAtTime(self: ZoneContext, d: Day, time: TimeOfDay, zone: []const u8, options: DayAtTimeOptions) Error!Instant {
        return zone_impl.dayAtTime(self.database, d, time, zone, options);
    }
    /// TypeScript `dayStartInstant` with explicit database selection.
    pub fn dayStartInstant(self: ZoneContext, d: Day, zone: []const u8) Error!Instant {
        return zone_impl.dayStartInstant(self.database, d, zone);
    }
    /// TypeScript `instantParse` with explicit database selection.
    pub fn instantParse(self: ZoneContext, s: []const u8, zone: ?[]const u8) Error!?Instant {
        return instant_impl.instantParse(self.database, s, zone);
    }
    /// TypeScript `instantToString` with explicit database selection.
    pub fn instantToString(self: ZoneContext, gpa: Allocator, instant: Instant, zone: ?[]const u8) (Error || Allocator.Error)![]u8 {
        return instant_impl.instantToString(gpa, self.database, instant, zone);
    }
};

/// TypeScript `timeZoneId`, using the bundled immutable database.
pub fn timeZoneId(zone: []const u8) Error![]const u8 {
    return (ZoneContext{}).timeZoneId(zone);
}
/// TypeScript `timeZoneOffset`, using the bundled immutable database.
pub fn timeZoneOffset(zone: []const u8, instant: Instant) Error!i64 {
    return (ZoneContext{}).timeZoneOffset(zone, instant);
}
/// TypeScript `systemTimeZone`, using the bundled immutable database.
pub fn systemTimeZone(io: std.Io, environ: std.process.Environ) ?[]const u8 {
    return (ZoneContext{}).systemTimeZone(io, environ);
}
/// TypeScript `dayFromInstant`, using the bundled immutable database.
pub fn dayFromInstant(instant: Instant, zone: []const u8) Error!Day {
    return (ZoneContext{}).dayFromInstant(instant, zone);
}
/// TypeScript `timeOfDayFromInstant`, using the bundled immutable database.
pub fn timeOfDayFromInstant(instant: Instant, zone: []const u8) Error!TimeOfDay {
    return (ZoneContext{}).timeOfDayFromInstant(instant, zone);
}
/// TypeScript `dayToday`, using the bundled immutable database.
pub fn dayToday(zone: []const u8, now_: Instant) Error!Day {
    return (ZoneContext{}).dayToday(zone, now_);
}
/// TypeScript `dayAtTime`, using the bundled immutable database.
pub fn dayAtTime(d: Day, time: TimeOfDay, zone: []const u8, options: DayAtTimeOptions) Error!Instant {
    return (ZoneContext{}).dayAtTime(d, time, zone, options);
}
/// TypeScript `dayStartInstant`, using the bundled immutable database.
pub fn dayStartInstant(d: Day, zone: []const u8) Error!Instant {
    return (ZoneContext{}).dayStartInstant(d, zone);
}
/// TypeScript `instantParse`, using the bundled immutable database.
pub fn instantParse(s: []const u8, zone: ?[]const u8) Error!?Instant {
    return (ZoneContext{}).instantParse(s, zone);
}
/// TypeScript `instantToString`, using the bundled immutable database.
pub fn instantToString(gpa: Allocator, instant: Instant, zone: ?[]const u8) (Error || Allocator.Error)![]u8 {
    return (ZoneContext{}).instantToString(gpa, instant, zone);
}
