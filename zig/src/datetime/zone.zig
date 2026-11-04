//! Port of `packages/hereabouts/src/datetime/zone.ts`.
//!
//! The only functions that take a time zone. Everything else in this module is plain integer
//! math on days and times of day; daylight saving time is handled here and nowhere else.
//!
//! Zones are IANA ids such as "America/Vancouver". Aliases ("Asia/Calcutta") and any letter
//! case are accepted. An unknown zone is `error.UnknownTimeZone`: silently falling back to UTC
//! is how off-by-one-day bugs start. Instants outside +/-8.64e15 (JavaScript Date's range) are
//! `error.InvalidInstant`.

const std = @import("std");
const builtin = @import("builtin");
const tz = @import("../timezone/timezone.zig");
const types = @import("types.zig");
const day_ = @import("day.zig");
const tod = @import("time_of_day.zig");

const Day = types.Day;
const TimeOfDay = types.TimeOfDay;
const Instant = types.Instant;
const Disambiguation = types.Disambiguation;
const Error = types.Error;

const MS_PER_DAY = 86400000;

/// Same range as JavaScript Date.
pub const MAX_INSTANT: i64 = 8_640_000_000_000_000;

pub fn checkInstant(instant: Instant) Error!void {
    if (instant > MAX_INSTANT or instant < -MAX_INSTANT) return error.InvalidInstant;
}

/// The canonical IANA id for a zone id or alias in any letter case ("asia/calcutta" ->
/// "Asia/Kolkata"). `error.UnknownTimeZone` for an unknown zone.
pub fn timeZoneId(db: *const tz.Database, zone: []const u8) Error![]const u8 {
    // The tz data indexes canonical spellings, aliases and their lower case forms.
    if (db.resolveId(zone)) |id| return id;
    var buf: [256]u8 = undefined;
    const lower = toLower(&buf, zone) orelse return error.UnknownTimeZone;
    return db.resolveId(lower) orelse error.UnknownTimeZone;
}

/// JavaScript `toLowerCase` as far as it matters for ASCII ids: ASCII letters, and the Kelvin
/// sign (U+212A), which lower-cases to `k`. Null if the text doesn't fit in `buf`.
fn toLower(buf: []u8, s: []const u8) ?[]const u8 {
    var n: usize = 0;
    var i: usize = 0;
    while (i < s.len) : (n += 1) {
        if (n == buf.len) return null;
        if (i + 2 < s.len and s[i] == 0xe2 and s[i + 1] == 0x84 and s[i + 2] == 0xaa) {
            buf[n] = 'k';
            i += 3;
        } else {
            buf[n] = std.ascii.toLower(s[i]);
            i += 1;
        }
    }
    return buf[0..n];
}

// Offset lookup without the instant check, for the probes in dayAtTime that may step just
// outside the supported range.
fn offsetAt(db: *const tz.Database, zone: []const u8, t: i64) Error!i64 {
    const info = db.fromUTC(try timeZoneId(db, zone), t) orelse return error.UnknownTimeZone;
    return info.offset;
}

/// The zone's offset from UTC, in milliseconds, at an instant.
pub fn timeZoneOffset(db: *const tz.Database, zone: []const u8, instant: Instant) Error!i64 {
    try checkInstant(instant);
    return offsetAt(db, zone, instant);
}

/// The current time, as `Date.now()` gives it in JavaScript.
pub fn now(io: std.Io) Instant {
    const ns = std.Io.Clock.real.now(io).nanoseconds;
    return @intCast(@divFloor(ns, std.time.ns_per_ms));
}

/// The time zone the device or server is set to, as a canonical IANA id, or null if the
/// platform doesn't report one the time zone data knows. Reads the `TZ` environment variable,
/// then the `/etc/localtime` link (the JavaScript asks `Intl`). Null on Windows.
pub fn systemTimeZone(db: *const tz.Database, io: std.Io, environ: std.process.Environ) ?[]const u8 {
    if (builtin.os.tag == .windows or builtin.os.tag == .wasi) return null;
    if (environ.getPosix("TZ")) |v| {
        if (zoneFromPath(db, v)) |id| return id;
    }
    var buf: [std.Io.Dir.max_path_bytes]u8 = undefined;
    const n = std.Io.Dir.readLinkAbsolute(io, "/etc/localtime", &buf) catch return null;
    return zoneFromPath(db, buf[0..n]);
}

/// A zone id from `TZ` or a link target: "America/Vancouver", ":America/Vancouver",
/// "/usr/share/zoneinfo/America/Vancouver".
fn zoneFromPath(db: *const tz.Database, p: []const u8) ?[]const u8 {
    var s = p;
    if (s.len > 0 and s[0] == ':') s = s[1..];
    const marker = "zoneinfo/";
    if (std.mem.lastIndexOf(u8, s, marker)) |i| s = s[i + marker.len ..];
    if (s.len == 0) return null;
    return db.resolveId(s);
}

/// Wall clock milliseconds (as if the zone were UTC) for an instant.
fn toWall(db: *const tz.Database, instant: Instant, zone: []const u8) Error!i64 {
    try checkInstant(instant);
    return instant + try timeZoneOffset(db, zone, instant);
}

/// The day it is in `zone` at `instant`. For "today", see `dayToday`.
pub fn dayFromInstant(db: *const tz.Database, instant: Instant, zone: []const u8) Error!Day {
    return day_.dayFromEpochDay(@divFloor(try toWall(db, instant, zone), MS_PER_DAY));
}

/// The wall clock time in `zone` at `instant`.
pub fn timeOfDayFromInstant(db: *const tz.Database, instant: Instant, zone: []const u8) Error!TimeOfDay {
    return tod.timeOfDayFromMillis(@mod(try toWall(db, instant, zone), MS_PER_DAY));
}

/// Today's date in `zone` at `now_` (the current time is `now(io)`).
///
/// Which zone "today" is in is a product decision: the user's zone for "is my invoice overdue?",
/// the customer's zone for "is it overdue for them?". A server usually runs in UTC, so code that
/// asks the system for today gets the wrong day for much of the world.
pub fn dayToday(db: *const tz.Database, zone: []const u8, now_: Instant) Error!Day {
    return dayFromInstant(db, now_, zone);
}

/// Options for `dayAtTime`.
pub const DayAtTimeOptions = struct {
    /// What to do when the time is skipped or repeated because the clocks change that day.
    disambiguation: Disambiguation = .compatible,
};

const Resolved = struct {
    /// Sorted, `len` of them.
    candidates: [2]i64 = undefined,
    len: usize = 0,
    before: i64,
    after: i64,
};

// The instants at which the wall clock in `zone` reads `wall` (wall clock milliseconds, as if
// the zone were UTC), sorted: one normally, two when the clocks went back over it, none when
// they went forward over it. Offsets are probed a day before and a day after, so one of them
// applies unless the zone changed its offset more than once within two days (no zone does).
fn resolveWall(db: *const tz.Database, wall: i64, zone: []const u8) Error!Resolved {
    var r: Resolved = .{
        .before = try offsetAt(db, zone, wall - MS_PER_DAY),
        .after = try offsetAt(db, zone, wall + MS_PER_DAY),
    };
    for ([_]i64{ r.before, r.after }) |offset| {
        const t = wall - offset;
        if (try offsetAt(db, zone, t) == offset and !(r.len == 1 and r.candidates[0] == t)) {
            r.candidates[r.len] = t;
            r.len += 1;
        }
    }
    if (r.len == 2 and r.candidates[1] < r.candidates[0]) {
        std.mem.swap(i64, &r.candidates[0], &r.candidates[1]);
    }
    return r;
}

fn result(t: i64) Error!Instant {
    if (t > MAX_INSTANT or t < -MAX_INSTANT) return error.InstantOutOfRange;
    return t;
}

/// The instant when the wall clock in `zone` shows `time` on day `d`: "9:00 on the due date in
/// Tokyo". When the clocks change that day the time can be skipped (02:30 on a spring-forward
/// day) or happen twice (01:30 on a fall-back day); `options.disambiguation` decides, with the
/// same rules as JavaScript Temporal.
///
/// Use this to schedule: store the day (or a rule that picks days), the time of day and, for a
/// pinned schedule, the zone; compute the instant when needed. Don't store the instant as the
/// source of truth: time zone rules change, and a repeating time isn't every 24 hours.
pub fn dayAtTime(db: *const tz.Database, d: Day, time: TimeOfDay, zone: []const u8, options: DayAtTimeOptions) Error!Instant {
    const wall = try day_.dayToEpochDay(d) * MS_PER_DAY + try tod.timeOfDayToMillis(time);
    return result(try wallToInstant(db, wall, zone, options.disambiguation));
}

/// The instant for wall clock milliseconds in `zone` (see `dayAtTime`), without the final
/// range check, so callers can decide how to report an out-of-range result.
pub fn wallToInstant(db: *const tz.Database, wall: i64, zone: []const u8, mode: Disambiguation) Error!i64 {
    const r = try resolveWall(db, wall, zone);

    if (r.len == 1) return r.candidates[0];
    if (r.len > 1) {
        // Repeated: the clocks went back, so this wall time happens twice.
        return switch (mode) {
            .reject => error.RepeatedTime,
            .later => r.candidates[r.len - 1],
            else => r.candidates[0],
        };
    }

    // Skipped: the clocks went forward over this wall time. Read with the offset from before
    // the change it lands after the gap (02:30 -> 03:30); with the offset from after, before it.
    return switch (mode) {
        .reject => error.SkippedTime,
        .earlier => wall - r.after,
        else => wall - r.before,
    };
}

/// The first instant of day `d` in `zone`: midnight, or when a clock change skips midnight, the
/// moment the clocks jump to (e.g. 01:00, or 00:30 if they jumped from 23:30 to 00:30).
pub fn dayStartInstant(db: *const tz.Database, d: Day, zone: []const u8) Error!Instant {
    const n = try day_.dayToEpochDay(d);
    const wall = n * MS_PER_DAY;
    const r = try resolveWall(db, wall, zone);
    if (r.len > 0) return result(r.candidates[0]);
    // Midnight was skipped. Find the first instant whose local day is `d`: at `wall - after` the
    // clock still reads the previous day, at `wall - before` it already reads `d`.
    var lo = wall - r.after;
    var hi = wall - r.before;
    while (hi - lo > 1) {
        const mid = lo + @divFloor(hi - lo, 2);
        if (@divFloor(mid + try offsetAt(db, zone, mid), MS_PER_DAY) >= n) {
            hi = mid;
        } else {
            lo = mid;
        }
    }
    return result(hi);
}
