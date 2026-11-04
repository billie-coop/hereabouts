//! Port of `packages/hereabouts/src/datetime/time-of-day.ts`.

const std = @import("std");
const Allocator = std.mem.Allocator;
const types = @import("types.zig");
const scan = @import("scan.zig");

const TimeOfDay = types.TimeOfDay;
const Error = types.Error;

const MS_PER_DAY = 86400000;

fn valid(h: i64, m: i64, s: i64, ms: i64) bool {
    return h >= 0 and h <= 23 and m >= 0 and m <= 59 and s >= 0 and s <= 59 and ms >= 0 and ms <= 999;
}

/// Create a wall clock time from hour (0-23), minute, second and milliseconds.
/// `error.InvalidTimeOfDay` if a field is out of range.
pub fn timeOfDay(hour: i64, minute: i64, second: i64, millis: i64) Error!TimeOfDay {
    if (!valid(hour, minute, second, millis)) return error.InvalidTimeOfDay;
    return .{ .hour = @intCast(hour), .minute = @intCast(minute), .second = @intCast(second), .millis = @intCast(millis) };
}

/// True if every field of `t` is in range.
pub fn isTimeOfDay(t: TimeOfDay) bool {
    return valid(t.hour, t.minute, t.second, t.millis);
}

/// Milliseconds since midnight of `t`, or `error.InvalidTimeOfDay` unless it is valid. Every
/// function that takes a TimeOfDay checks it, so `.hour = 24` fails loudly instead of rolling
/// over to the next day.
pub fn millisOf(t: TimeOfDay) Error!i64 {
    if (!isTimeOfDay(t)) return error.InvalidTimeOfDay;
    return ((@as(i64, t.hour) * 60 + t.minute) * 60 + t.second) * 1000 + t.millis;
}

/// Milliseconds since midnight, 0 to 86,399,999.
pub fn timeOfDayToMillis(t: TimeOfDay) Error!i64 {
    return millisOf(t);
}

/// The time of day for a number of milliseconds since midnight (0 to 86,399,999).
pub fn timeOfDayFromMillis(ms: i64) Error!TimeOfDay {
    if (ms < 0 or ms >= MS_PER_DAY) return error.InvalidMillis;
    const millis = @rem(ms, 1000);
    const s = @divExact(ms - millis, 1000);
    return .{
        .hour = @intCast(@divFloor(s, 3600)),
        .minute = @intCast(@rem(@divFloor(s, 60), 60)),
        .second = @intCast(@rem(s, 60)),
        .millis = @intCast(millis),
    };
}

/// Parse an ISO 8601 time, `HH:MM`, `HH:MM:SS` or `HH:MM:SS.fff` (up to 9 fraction digits,
/// truncated to milliseconds). Null if the text isn't in that form or a field is out of range.
pub fn timeOfDayParse(s: []const u8) ?TimeOfDay {
    var p: scan.Scanner = .{ .s = s };
    const h = p.digits(2) orelse return null;
    if (!p.eat(':')) return null;
    const min = p.digits(2) orelse return null;
    var sec: i64 = 0;
    var ms: i64 = 0;
    if (p.eat(':')) {
        sec = p.digits(2) orelse return null;
        if (p.eat('.')) {
            const f = p.run();
            if (f.len == 0 or f.len > 9) return null;
            ms = scan.fractionMillis(f);
        }
    }
    if (!p.done()) return null;
    return timeOfDay(h, min, sec, ms) catch null;
}

/// Like `timeOfDayParse`, but `error.InvalidTimeOfDay` if the text isn't a valid time.
pub fn timeOfDayFromString(s: []const u8) Error!TimeOfDay {
    return timeOfDayParse(s) orelse error.InvalidTimeOfDay;
}

/// Format as ISO 8601 into `buf` (12 bytes), in the shortest form that keeps every field:
/// `06:30`, `06:30:15` or `06:30:15.250`.
pub fn formatTimeOfDay(buf: []u8, t: TimeOfDay) Error![]u8 {
    _ = try millisOf(t);
    const h: u32 = @intCast(t.hour);
    const m: u32 = @intCast(t.minute);
    const s: u32 = @intCast(t.second);
    const ms: u32 = @intCast(t.millis);
    if (ms != 0) return std.fmt.bufPrint(buf, "{d:0>2}:{d:0>2}:{d:0>2}.{d:0>3}", .{ h, m, s, ms }) catch unreachable;
    if (s != 0) return std.fmt.bufPrint(buf, "{d:0>2}:{d:0>2}:{d:0>2}", .{ h, m, s }) catch unreachable;
    return std.fmt.bufPrint(buf, "{d:0>2}:{d:0>2}", .{ h, m }) catch unreachable;
}

/// Format as ISO 8601, in the shortest form that keeps every field: `06:30`, `06:30:15` or
/// `06:30:15.250`. The caller owns the result.
pub fn timeOfDayToString(gpa: Allocator, t: TimeOfDay) (Error || Allocator.Error)![]u8 {
    var buf: [16]u8 = undefined;
    return gpa.dupe(u8, try formatTimeOfDay(&buf, t));
}

/// Compare two times of day: -1 if `a` is earlier, 0 if equal, 1 if later.
pub fn timeOfDayCompare(a: TimeOfDay, b: TimeOfDay) Error!i32 {
    const c = try millisOf(a) - try millisOf(b);
    return if (c < 0) -1 else if (c > 0) 1 else 0;
}
