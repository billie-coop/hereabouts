//! Runs the shared cases in `conformance/datetime.json` against the Zig port.
//!
//! Each case names a TypeScript function, its arguments and the TypeScript result (or the
//! message of the RangeError it threw). `dtSweep` is a composite case; see
//! `scripts/conformance/datetime.ts`.

const std = @import("std");
const h = @import("hereabouts");
const cases = @import("cases");

const dt = h.datetime;
const tz = h.timezone;
const Day = dt.Day;
const TimeOfDay = dt.TimeOfDay;
const Value = std.json.Value;
const Allocator = std.mem.Allocator;

test {
    std.testing.refAllDecls(dt);
}

const Mismatch = error{Mismatch};

fn fail(comptime f: []const u8, args: anytype) Mismatch {
    std.debug.print("    " ++ f ++ "\n", args);
    return error.Mismatch;
}

fn eql(a: []const u8, b: []const u8) bool {
    return std.mem.eql(u8, a, b);
}

/// The TypeScript error message starts with this text for each error.
fn errorPrefix(err: anyerror) []const u8 {
    return switch (err) {
        error.InvalidDay => "Invalid day",
        error.DayOutOfRange => "Day out of range",
        error.InvalidTimeOfDay => "Invalid time of day",
        error.InvalidMillis => "Milliseconds since midnight",
        error.InvalidFirstDay => "First day of week",
        error.InvalidStep => "Range step",
        error.UnknownTimeZone => "Unknown time zone",
        error.InvalidInstant => "Invalid instant",
        error.InstantOutOfRange => "Instant out of range",
        error.RepeatedTime => "Time happens twice",
        error.SkippedTime => "Time doesn't exist",
        else => "?",
    };
}

// ---------------------------------------------------------------------------
// Reading arguments
// ---------------------------------------------------------------------------

fn int(v: Value) i64 {
    return v.integer;
}

fn field(o: std.json.ObjectMap, k: []const u8) i32 {
    return @intCast(o.get(k).?.integer);
}

fn argDay(v: Value) Day {
    const o = v.object;
    return .{ .year = field(o, "year"), .month = field(o, "month"), .day = field(o, "day") };
}

fn argTime(v: Value) TimeOfDay {
    const o = v.object;
    return .{ .hour = field(o, "hour"), .minute = field(o, "minute"), .second = field(o, "second"), .millis = field(o, "millis") };
}

fn argDuration(v: Value) dt.DayDuration {
    const o = v.object;
    var x: dt.DayDuration = .{};
    if (o.get("years")) |n| x.years = n.integer;
    if (o.get("months")) |n| x.months = n.integer;
    if (o.get("weeks")) |n| x.weeks = n.integer;
    if (o.get("days")) |n| x.days = n.integer;
    return x;
}

fn optArg(args: []const Value, i: usize) ?Value {
    return if (i < args.len) args[i] else null;
}

// ---------------------------------------------------------------------------
// Checking results
// ---------------------------------------------------------------------------

/// A result that may be an error: compare the error with the TypeScript message, or the value
/// with `check`.
fn expect(want: Value, got: anytype, comptime check: anytype) !void {
    const is_error = want == .object and want.object.get("error") != null;
    if (got) |g| {
        if (is_error) return fail("want error \"{s}\", got a value", .{want.object.get("error").?.string});
        return check(want, g);
    } else |err| {
        if (!is_error) return fail("want {f}, got error {s}", .{ std.json.fmt(want, .{}), @errorName(err) });
        const msg = want.object.get("error").?.string;
        if (!std.mem.startsWith(u8, msg, errorPrefix(err))) return fail("want error \"{s}\", got {s}", .{ msg, @errorName(err) });
    }
}

fn checkInt(want: Value, got: anytype) !void {
    if (want != .integer or want.integer != @as(i64, got)) return fail("int: want {f}, got {d}", .{ std.json.fmt(want, .{}), got });
}

fn checkBool(want: Value, got: bool) !void {
    if (want != .bool or want.bool != got) return fail("bool: want {f}, got {}", .{ std.json.fmt(want, .{}), got });
}

fn checkString(want: Value, got: []const u8) !void {
    if (want != .string or !eql(want.string, got)) return fail("string: want {f}, got \"{s}\"", .{ std.json.fmt(want, .{}), got });
}

fn checkDay(want: Value, got: Day) !void {
    if (want != .object) return fail("day: want {f}, got {d}-{d}-{d}", .{ std.json.fmt(want, .{}), got.year, got.month, got.day });
    const w = argDay(want);
    if (w.year != got.year or w.month != got.month or w.day != got.day) {
        return fail("day: want {d}-{d}-{d}, got {d}-{d}-{d}", .{ w.year, w.month, w.day, got.year, got.month, got.day });
    }
}

fn checkOptDay(want: Value, got: ?Day) !void {
    if (got) |g| return checkDay(want, g);
    if (want != .null) return fail("day: want {f}, got null", .{std.json.fmt(want, .{})});
}

fn checkDays(want: Value, got: []const Day) !void {
    const items = want.array.items;
    if (items.len != got.len) return fail("days: want {d}, got {d}", .{ items.len, got.len });
    for (items, got) |w, g| try checkDay(w, g);
}

fn checkTime(want: Value, got: TimeOfDay) !void {
    if (want != .object) return fail("time: want {f}, got a time", .{std.json.fmt(want, .{})});
    const w = argTime(want);
    if (w.hour != got.hour or w.minute != got.minute or w.second != got.second or w.millis != got.millis) {
        return fail("time: want {d}:{d}:{d}.{d}, got {d}:{d}:{d}.{d}", .{ w.hour, w.minute, w.second, w.millis, got.hour, got.minute, got.second, got.millis });
    }
}

fn checkOptTime(want: Value, got: ?TimeOfDay) !void {
    if (got) |g| return checkTime(want, g);
    if (want != .null) return fail("time: want {f}, got null", .{std.json.fmt(want, .{})});
}

fn checkOptInt(want: Value, got: ?i64) !void {
    if (got) |g| return checkInt(want, g);
    if (want != .null) return fail("want {f}, got null", .{std.json.fmt(want, .{})});
}

// ---------------------------------------------------------------------------
// dtSweep: every transition of a zone, hashed (see sweep in the generator)
// ---------------------------------------------------------------------------

const DAY = 86400000;

const Hash = struct {
    h: u32 = 2166136261,
    count: i64 = 0,
    a: Allocator,

    fn put(self: *Hash, comptime f: []const u8, args: anytype) !void {
        const s = try std.fmt.allocPrint(self.a, f ++ ";", args);
        for (s) |c| self.h = (self.h ^ c) *% 16777619;
        self.count += 1;
    }

    /// The result as the generator's `token`: the value, or `!ErrorName`.
    fn token(self: *Hash, r: anytype) ![]const u8 {
        if (r) |v| {
            return if (@TypeOf(v) == []u8) v else std.fmt.allocPrint(self.a, "{d}", .{v});
        } else |err| {
            return std.fmt.allocPrint(self.a, "!{s}", .{@errorName(err)});
        }
    }
};

fn sweep(a: Allocator, zone: []const u8) !Hash {
    var hash: Hash = .{ .a = a };
    const ref = tz.defaultDatabase.find(zone) orelse return hash;
    for (ref.zone.untils) |u| {
        const off_a = tz.fromUTC(zone, u - 1).?.offset;
        const off_b = tz.fromUTC(zone, u).?.offset;
        try hash.put("S|{d}|{s}", .{ u - 1, try hash.token(dt.instant.toString(a, u - 1, zone)) });
        try hash.put("S|{d}|{s}", .{ u, try hash.token(dt.instant.toString(a, u, zone)) });
        const walls = [_]i64{ u + off_a - 1, u + off_a, u + off_b - 1, u + off_b, @divFloor(2 * u + off_a + off_b, 2) };
        for (walls) |w| {
            const d = try dt.Day.fromEpochDay(@divFloor(w, DAY));
            const t = try dt.TimeOfDay.fromMillis(@mod(w, DAY));
            for ([_]dt.Disambiguation{ .compatible, .earlier, .later, .reject }) |mode| {
                const r = dt.Day.atTime(d, t, zone, .{ .disambiguation = mode });
                try hash.put("A|{d}|{s}|{s}", .{ w, @tagName(mode), try hash.token(r) });
            }
        }
        const n0 = @divFloor(u + off_a, DAY);
        const n1 = @divFloor(u + off_b, DAY);
        for ([_]i64{ n0, n1 }, 0..) |n, k| {
            if (k == 1 and n1 == n0) break;
            for ([_]i64{ n, n + 1 }) |m| {
                const r = dt.Day.startInstant(try dt.Day.fromEpochDay(m), zone);
                try hash.put("B|{d}|{s}", .{ m, try hash.token(r) });
            }
        }
    }
    return hash;
}

// ---------------------------------------------------------------------------
// Running a case
// ---------------------------------------------------------------------------

fn run(a: Allocator, fname: []const u8, args: []const Value, want: Value) !void {
    if (eql(fname, "dayStartInstantCustom")) {
        const raw = args[0].object;
        const values = raw.get("zoneinfo").?.array.items;
        const records = try a.alloc([]const u8, values.len);
        for (values, records) |v, *record| record.* = v.string;
        const db = try tz.Database.decode(a, .{ .zoneids = raw.get("zoneids").?.string, .links = raw.get("links").?.string, .index = raw.get("index").?.string, .zoneinfo = records });
        defer db.deinit(a);
        const context: dt.ZoneContext = .{ .database = &db };
        return expect(want, context.dayStartInstant(argDay(args[1]), args[2].string), checkInt);
    }
    // Days
    if (eql(fname, "day")) return expect(want, dt.Day.init(int(args[0]), int(args[1]), int(args[2])), checkDay);
    if (eql(fname, "isDay")) return checkBool(want, dt.isDay(argDay(args[0])));
    if (eql(fname, "isLeapYear")) return checkBool(want, dt.isLeapYear(int(args[0])));
    if (eql(fname, "daysInMonth")) return checkInt(want, dt.daysInMonth(int(args[0]), int(args[1])));
    if (eql(fname, "dayFromEpochDay")) return expect(want, dt.Day.fromEpochDay(int(args[0])), checkDay);
    if (eql(fname, "dayParse")) return checkOptDay(want, dt.Day.parse(args[0].string));
    if (eql(fname, "dayFromString")) return expect(want, dt.Day.fromString(args[0].string), checkDay);
    if (eql(fname, "timeOfDayParse")) return checkOptTime(want, dt.TimeOfDay.parse(args[0].string));
    if (eql(fname, "timeOfDayFromString")) return expect(want, dt.TimeOfDay.fromString(args[0].string), checkTime);
    if (eql(fname, "timeOfDayFromMillis")) return expect(want, dt.TimeOfDay.fromMillis(int(args[0])), checkTime);
    if (eql(fname, "timeOfDay")) {
        var f = [_]i64{ 0, 0, 0, 0 };
        for (args, 0..) |x, i| f[i] = int(x);
        return expect(want, dt.TimeOfDay.init(f[0], f[1], f[2], f[3]), checkTime);
    }
    if (eql(fname, "isTimeOfDay")) return checkBool(want, dt.isTimeOfDay(argTime(args[0])));
    if (eql(fname, "timeOfDayToMillis")) return expect(want, dt.TimeOfDay.toMillis(argTime(args[0])), checkInt);
    if (eql(fname, "timeOfDayToString")) return expect(want, dt.TimeOfDay.toString(argTime(args[0]), a), checkString);
    if (eql(fname, "timeOfDayCompare")) return expect(want, dt.TimeOfDay.compare(argTime(args[0]), argTime(args[1])), checkInt);

    // Zones and instants
    if (eql(fname, "timeZoneId")) return expect(want, dt.timeZoneId(args[0].string), checkString);
    if (eql(fname, "timeZoneOffset")) return expect(want, dt.timeZoneOffset(args[0].string, int(args[1])), checkInt);
    if (eql(fname, "dayFromInstant")) return expect(want, dt.Day.fromInstant(int(args[0]), args[1].string), checkDay);
    if (eql(fname, "timeOfDayFromInstant")) return expect(want, dt.TimeOfDay.fromInstant(int(args[0]), args[1].string), checkTime);
    if (eql(fname, "dayToday")) return expect(want, dt.Day.today(args[0].string, int(args[1])), checkDay);
    if (eql(fname, "instantParse")) {
        const zone = if (optArg(args, 1)) |z| z.string else null;
        return expect(want, dt.instant.parse(args[0].string, zone), checkOptInt);
    }
    if (eql(fname, "instantToString")) {
        const zone = if (optArg(args, 1)) |z| z.string else null;
        return expect(want, dt.instant.toString(a, int(args[0]), zone), checkString);
    }
    if (eql(fname, "dtSweep")) {
        const s = try sweep(a, args[0].string);
        try checkInt(want.object.get("count").?, s.count);
        return checkInt(want.object.get("hash").?, s.h);
    }

    // Functions of a day
    const d = argDay(args[0]);
    if (eql(fname, "dayToEpochDay")) return expect(want, dt.Day.toEpochDay(d), checkInt);
    if (eql(fname, "dayToString")) return expect(want, dt.Day.toString(d, a), checkString);
    if (eql(fname, "dayOfWeek")) return expect(want, dt.Day.ofWeek(d), checkInt);
    if (eql(fname, "dayOfYear")) return expect(want, dt.Day.ofYear(d), checkInt);
    if (eql(fname, "dayDaysInMonth")) return expect(want, dt.Day.daysInMonth(d), checkInt);
    if (eql(fname, "dayIsLeapYear")) return expect(want, dt.Day.isLeapYear(d), checkBool);
    if (eql(fname, "dayAdd")) return expect(want, dt.Day.add(d, argDuration(args[1])), checkDay);
    if (eql(fname, "daySubtract")) return expect(want, dt.Day.subtract(d, argDuration(args[1])), checkDay);
    if (eql(fname, "dayStartOfWeek")) return expect(want, dt.Day.startOfWeek(d, int(args[1])), checkDay);
    if (eql(fname, "dayEndOfWeek")) return expect(want, dt.Day.endOfWeek(d, int(args[1])), checkDay);
    if (eql(fname, "dayStartOf")) return expect(want, dt.Day.startOf(d, dt.DayPeriod.fromString(args[1].string).?), checkDay);
    if (eql(fname, "dayEndOf")) return expect(want, dt.Day.endOf(d, dt.DayPeriod.fromString(args[1].string).?), checkDay);
    if (eql(fname, "dayStartInstant")) return expect(want, dt.Day.startInstant(d, args[1].string), checkInt);
    if (eql(fname, "dayAtTime")) {
        var options: dt.DayAtTimeOptions = .{};
        if (optArg(args, 3)) |o| options.disambiguation = dt.Disambiguation.fromString(o.object.get("disambiguation").?.string).?;
        return expect(want, dt.Day.atTime(d, argTime(args[1]), args[2].string, options), checkInt);
    }

    // Functions of two days
    const e = argDay(args[1]);
    if (eql(fname, "dayCompare")) return expect(want, dt.Day.compare(d, e), checkInt);
    if (eql(fname, "dayEquals")) return expect(want, dt.Day.equals(d, e), checkBool);
    if (eql(fname, "dayIsBefore")) return expect(want, dt.Day.isBefore(d, e), checkBool);
    if (eql(fname, "dayIsAfter")) return expect(want, dt.Day.isAfter(d, e), checkBool);
    if (eql(fname, "dayUntil")) {
        const unit = if (optArg(args, 2)) |u| dt.DayUnit.fromString(u.string).? else .days;
        return expect(want, dt.Day.until(d, e, unit), checkInt);
    }
    if (eql(fname, "dayRange")) {
        const step = if (optArg(args, 2)) |s| argDuration(s) else dt.DayDuration{ .days = 1 };
        return expect(want, dt.Day.range(d, a, e, step), checkDays);
    }

    return fail("unknown function {s}", .{fname});
}

test "datetime conformance" {
    const gpa = std.testing.allocator;
    const parsed = try std.json.parseFromSlice(Value, gpa, cases.json, .{});
    defer parsed.deinit();

    var failures: usize = 0;
    const all = parsed.value.array.items;
    for (all, 0..) |c, i| {
        var arena = std.heap.ArenaAllocator.init(gpa);
        defer arena.deinit();
        const o = c.object;
        run(arena.allocator(), o.get("fn").?.string, o.get("args").?.array.items, o.get("result").?) catch |err| {
            failures += 1;
            if (failures <= 25) {
                var buf: [1024]u8 = undefined;
                const line = std.fmt.bufPrint(&buf, "{f}", .{std.json.fmt(c, .{})}) catch "(case too long to show)";
                std.debug.print("case {d} failed ({s}): {s}\n", .{ i, @errorName(err), line });
            }
        };
    }
    if (failures > 0) {
        std.debug.print("{d} of {d} cases failed\n", .{ failures, all.len });
        return error.TestFailed;
    }
}

test "replacement time zone data applies to datetime" {
    const gpa = std.testing.allocator;
    const db = try tz.Database.decode(gpa, .{
        .zoneids = "Etc/UTC|Foo/Bar",
        .links = "Zulu:0|Foo/Baz:1",
        .index = "",
        .zoneinfo = &.{ "0_0_0__UTC:0:0__", "2s0_0_0_XX_FOO:0:2s0__" },
    });
    defer db.deinit(gpa);
    const context: dt.ZoneContext = .{ .database = &db };
    try std.testing.expectEqualStrings("Foo/Bar", try context.timeZoneId("FOO/BAZ"));
    try std.testing.expectEqual(@as(i64, 3600000), try context.timeZoneOffset("foo/bar", 0));
    try std.testing.expectError(error.UnknownTimeZone, context.timeZoneOffset("America/New_York", 0));
}

test "system time zone and now" {
    // Host-dependent, so not in the shared cases: check only that the answer is a known zone.
    if (dt.systemTimeZone(std.testing.io, std.testing.environ)) |id| {
        try std.testing.expectEqualStrings(id, tz.resolveId(id).?);
    }
    const t = dt.now(std.testing.io);
    try std.testing.expect(t > 1_700_000_000_000);
    _ = try dt.Day.today("UTC", t);
}

test "no leaks" {
    const gpa = std.testing.allocator;
    const s = try dt.Day.toString(try dt.Day.init(2026, 1, 31), gpa);
    defer gpa.free(s);
    try std.testing.expectEqualStrings("2026-01-31", s);
    const ts = try dt.TimeOfDay.toString(try dt.TimeOfDay.init(6, 30, 0, 5), gpa);
    defer gpa.free(ts);
    try std.testing.expectEqualStrings("06:30:00.005", ts);
    const is = try dt.instant.toString(gpa, 1769878800005, "America/Vancouver");
    defer gpa.free(is);
    try std.testing.expectEqualStrings("2026-01-31T09:00:00.005-08:00", is);
    const r = try dt.Day.range(try dt.Day.fromString("2026-01-31"), gpa, try dt.Day.fromString("2026-05-31"), .{ .months = 1 });
    defer gpa.free(r);
    try std.testing.expectEqual(@as(usize, 5), r.len);
    try std.testing.expectEqual(@as(i64, 1769817600000), try dt.Day.atTime(try dt.Day.init(2026, 1, 31), try dt.TimeOfDay.init(9, 0, 0, 0), "Asia/Tokyo", .{}));
    // A failing call frees what it allocated.
    try std.testing.expectError(error.InvalidDay, dt.Day.range(.{ .year = 2026, .month = 2, .day = 30 }, gpa, try dt.Day.init(2026, 3, 1), .{ .days = 1 }));
    try std.testing.expectError(error.DayOutOfRange, dt.instant.toString(gpa, -8_640_000_000_000_000, "America/New_York"));
}
