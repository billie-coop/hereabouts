//! Time periods (`interval.ts`).

const std = @import("std");

/// A field of a time period.
pub const TimePeriodField = enum {
    year,
    month,
    week,
    day,
    hour,
    minute,
    second,
    millis,

    pub fn toString(self: TimePeriodField) []const u8 {
        return @tagName(self);
    }

    pub fn fromString(s: []const u8) ?TimePeriodField {
        return std.meta.stringToEnum(TimePeriodField, s);
    }
};

/// The fields in order, largest first.
pub const TIME_PERIOD_FIELDS = [_]TimePeriodField{ .year, .month, .week, .day, .hour, .minute, .second, .millis };

/// An amount of time in calendar units. Numbers as in the TypeScript: `dateAdd` truncates
/// fractions, and differences rolled up into fractional fields have them.
pub const TimePeriod = struct {
    year: f64 = 0,
    month: f64 = 0,
    week: f64 = 0,
    day: f64 = 0,
    hour: f64 = 0,
    minute: f64 = 0,
    second: f64 = 0,
    millis: f64 = 0,

    pub fn get(self: TimePeriod, f: TimePeriodField) f64 {
        return switch (f) {
            inline else => |t| @field(self, @tagName(t)),
        };
    }

    pub fn set(self: *TimePeriod, f: TimePeriodField, v: f64) void {
        switch (f) {
            inline else => |t| @field(self, @tagName(t)) = v,
        }
    }

    /// TypeScript timePeriod.
    pub fn init() TimePeriod {
        return .{};
    }
};

/// A zeroed time period.
pub fn timePeriod() TimePeriod {
    return .{};
}

/// Flags for the time period fields.
pub const TimePeriodFieldFlag = struct {
    pub const YEAR: u8 = 1;
    pub const MONTH: u8 = 2;
    pub const WEEK: u8 = 4;
    pub const DAY: u8 = 8;
    pub const HOUR: u8 = 16;
    pub const MINUTE: u8 = 32;
    pub const SECOND: u8 = 64;
    pub const MILLIS: u8 = 128;

    pub fn of(f: TimePeriodField) u8 {
        return @as(u8, 1) << @intFromEnum(f);
    }
};

pub const TIME_FLAGS = TimePeriodFieldFlag.HOUR | TimePeriodFieldFlag.MINUTE |
    TimePeriodFieldFlag.SECOND | TimePeriodFieldFlag.MILLIS;

/// Flags of the given fields, and the flag of the last one given (MILLIS if none).
pub fn timePeriodFieldFlags(fields: ?[]const TimePeriodField) struct { u8, u8 } {
    var flags: u8 = 0;
    var smallest: u8 = TimePeriodFieldFlag.MILLIS;
    if (fields) |fs| {
        for (fs) |f| {
            const flag = TimePeriodFieldFlag.of(f);
            flags |= flag;
            smallest = flag;
        }
    }
    return .{ flags, smallest };
}
