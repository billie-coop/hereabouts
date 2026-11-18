//! Port of `packages/hereabouts/src/datetime/instant.ts`.

const std = @import("std");
const Allocator = std.mem.Allocator;
const types = @import("types.zig");
const scan = @import("scan.zig");
const day_ = @import("day.zig");
const tod = @import("time_of_day.zig");
const zone_ = @import("zone.zig");
const tz = @import("../timezone/timezone.zig");

const Instant = types.Instant;
const Error = types.Error;

const MS_PER_DAY = 86400000;

/// Parse an ISO 8601 date and time into an instant: `2026-01-31T09:00:00Z`,
/// `2026-01-31T09:00:00.123-08:00`, `2026-01-31 09:00+0530`, ...
///
/// Text without a UTC offset or `Z` is a wall clock time, so it needs a zone: pass `zone` to
/// read it there (clock changes resolved as `dayAtTime` .compatible), otherwise it is rejected.
/// A date alone is a `Day`, not an instant: use `dayParse`. Null for text that isn't valid
/// (including `24:00` and partial forms such as `2026-01`). An unknown `zone` is
/// `error.UnknownTimeZone`, as for every function that takes a zone (only checked when the text
/// needs it). Offsets may include seconds (`+00:09:21`), as historical ones do.
pub fn instantParse(db: *const tz.Database, s: []const u8, zone: ?[]const u8) Error!?Instant {
    // date [T or space] time [offset]
    var p: scan.Scanner = .{ .s = s };
    const year = p.year() orelse return null;
    if (!p.eat('-')) return null;
    const month = p.digits(2) orelse return null;
    if (!p.eat('-')) return null;
    const dd = p.digits(2) orelse return null;
    if (p.eatAny("Tt ") == null) return null;
    const hour = p.digits(2) orelse return null;
    if (!p.eat(':')) return null;
    const minute = p.digits(2) orelse return null;
    var second: i64 = 0;
    var millis: i64 = 0;
    if (p.eat(':')) {
        second = p.digits(2) orelse return null;
        if (p.eatAny(".,") != null) {
            const f = p.run();
            if (f.len == 0 or f.len > 9) return null;
            millis = scan.fractionMillis(f);
        }
    }

    const Offset = union(enum) { none, z, sign: struct { neg: bool, h: i64, m: i64, s: i64 } };
    var offset: Offset = .none;
    if (p.eatAny("Zz") != null) {
        offset = .z;
    } else if (p.eatAny("+-")) |sign| {
        const oh = p.digits(2) orelse return null;
        var om: i64 = 0;
        var os: i64 = 0;
        if (!p.done()) {
            _ = p.eat(':');
            om = p.digits(2) orelse return null;
            if (p.eat(':')) os = p.digits(2) orelse return null;
        }
        offset = .{ .sign = .{ .neg = sign == '-', .h = oh, .m = om, .s = os } };
    }
    if (!p.done()) return null;

    const d = day_.day(year, month, dd) catch return null;
    const t = tod.timeOfDay(hour, minute, second, millis) catch return null;

    // Wall clock milliseconds; only the final instant is range checked.
    const wall = (day_.dayToEpochDay(d) catch unreachable) * MS_PER_DAY + (tod.timeOfDayToMillis(t) catch unreachable);
    const r: i64 = switch (offset) {
        .z => wall,
        .sign => |o| blk: {
            if (o.h > 23 or o.m > 59 or o.s > 59) return null;
            const secs = (o.h * 60 + o.m) * 60 + o.s;
            break :blk wall - secs * 1000 * @as(i64, if (o.neg) -1 else 1);
        },
        .none => if (zone) |z|
            try zone_.wallToInstant(db, wall, try zone_.timeZoneId(db, z), .compatible)
        else
            return null,
    };
    return if (r <= zone_.MAX_INSTANT and r >= -zone_.MAX_INSTANT) r else null;
}

/// Format an instant as ISO 8601 with milliseconds. Without a zone it is in UTC
/// (`2026-01-31T17:00:00.000Z`, as `Date.toISOString()` gives it); with a zone it is that
/// zone's wall clock time and offset (`2026-01-31T09:00:00.000-08:00`). An offset with seconds
/// is written with them (`+00:09:21`), so the text always parses back to the same instant. The
/// caller owns the result.
pub fn instantToString(gpa: Allocator, db: *const tz.Database, instant: Instant, zone: ?[]const u8) (Error || Allocator.Error)![]u8 {
    try zone_.checkInstant(instant);
    const offset = if (zone) |z| try zone_.timeZoneOffset(db, z, instant) else 0;
    const wall = instant + offset;
    const n = @divFloor(wall, MS_PER_DAY);
    const t = tod.timeOfDayFromMillis(wall - n * MS_PER_DAY) catch unreachable;

    var date_buf: [16]u8 = undefined;
    const date = try day_.formatDay(&date_buf, try day_.dayFromEpochDay(n));

    var suffix_buf: [16]u8 = undefined;
    var suffix: []const u8 = "Z";
    if (zone != null) {
        // Historical offsets can include seconds (Paris was +00:09:21 until 1911); keep them, as
        // Temporal does, so the text still names the same instant.
        const secs: u64 = @intCast(@divFloor(@as(i64, @intCast(@abs(offset))) + 500, 1000));
        const sign: u8 = if (offset < 0) '-' else '+';
        suffix = if (secs % 60 != 0)
            std.fmt.bufPrint(&suffix_buf, "{c}{d:0>2}:{d:0>2}:{d:0>2}", .{ sign, secs / 3600, secs / 60 % 60, secs % 60 }) catch unreachable
        else
            std.fmt.bufPrint(&suffix_buf, "{c}{d:0>2}:{d:0>2}", .{ sign, secs / 3600, secs / 60 % 60 }) catch unreachable;
    }
    const h: u32 = @intCast(t.hour);
    const m: u32 = @intCast(t.minute);
    const sec: u32 = @intCast(t.second);
    const ms: u32 = @intCast(t.millis);
    return std.fmt.allocPrint(gpa, "{s}T{d:0>2}:{d:0>2}:{d:0>2}.{d:0>3}{s}", .{ date, h, m, sec, ms, suffix });
}
