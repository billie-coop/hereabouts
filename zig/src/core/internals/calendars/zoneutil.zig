//! Time zone offset components (`internals/calendars/zoneutil.ts`).

const std = @import("std");
const util = @import("../../systems/calendars/util.zig");

/// A UTC offset broken into its parts.
pub const TZC = struct {
    /// Absolute offset in minutes (fractional for offsets with seconds, e.g. local mean time).
    offset: f64,
    /// True if the offset is west of UTC.
    negative: bool,
    /// Whole hours of the absolute offset.
    hours: i64,
    /// Remaining whole minutes of the absolute offset.
    minutes: i64,
};

/// The parts of a UTC offset in milliseconds.
pub fn getTZC(offsetMs: i64) TZC {
    var offset: f64 = @floatFromInt(offsetMs);
    const negative = offset < 0;
    if (negative) offset *= -1;
    offset /= 60000;
    const hours = util.toInt32(offset / 60);
    const minutes = util.toInt32(@rem(offset, 60));
    return .{ .offset = offset, .negative = negative, .hours = @intFromFloat(hours), .minutes = @intFromFloat(minutes) };
}

test getTZC {
    const t = getTZC(-17762000);
    try std.testing.expect(t.negative);
    try std.testing.expectEqual(@as(i64, 4), t.hours);
    try std.testing.expectEqual(@as(i64, 56), t.minutes);
}
