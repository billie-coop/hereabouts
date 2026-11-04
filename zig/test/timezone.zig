//! Runs the shared cases in `conformance/timezone.json` against the Zig port.
//!
//! Each case names a TypeScript function, its arguments and the TypeScript result. `tzSweep`
//! and `tzCustom` are composite cases; see `scripts/conformance/timezone.ts`.

const std = @import("std");
const h = @import("hereabouts");
const cases = @import("cases");

const tz = h.timezone;
const Value = std.json.Value;
const Allocator = std.mem.Allocator;

test {
    std.testing.refAllDecls(tz);
}

const Mismatch = error{Mismatch};

fn fail(comptime f: []const u8, args: anytype) Mismatch {
    std.debug.print("    " ++ f ++ "\n", args);
    return error.Mismatch;
}

fn eql(a: []const u8, b: []const u8) bool {
    return std.mem.eql(u8, a, b);
}

fn expectInt(want: Value, got: i64) !void {
    if (want != .integer or want.integer != got) return fail("int: want {f}, got {d}", .{ std.json.fmt(want, .{}), got });
}

fn expectFloat(want: Value, got: f64) !void {
    const w: f64 = switch (want) {
        .integer => |i| @floatFromInt(i),
        .float => |f| f,
        else => return fail("float: want {f}, got {d}", .{ std.json.fmt(want, .{}), got }),
    };
    if (w != got) return fail("float: want {d}, got {d}", .{ w, got });
}

fn expectString(want: Value, got: []const u8) !void {
    if (want != .string or !eql(want.string, got)) return fail("string: want {f}, got \"{s}\"", .{ std.json.fmt(want, .{}), got });
}

fn expectOptString(want: Value, got: ?[]const u8) !void {
    if (got) |g| return expectString(want, g);
    if (want != .null) return fail("want {f}, got null", .{std.json.fmt(want, .{})});
}

fn expectStrings(want: Value, got: []const []const u8) !void {
    const items = want.array.items;
    if (items.len != got.len) return fail("list: want {d} items, got {d}", .{ items.len, got.len });
    for (items, got) |w, g| try expectString(w, g);
}

fn expectInfo(want: Value, got: ?tz.ZoneInfo) !void {
    const g = got orelse {
        if (want == .null) return;
        return fail("info: want {f}, got null", .{std.json.fmt(want, .{})});
    };
    if (want == .null) return fail("info: want null, got {s} {s}", .{ g.zoneid, g.abbr });
    const o = want.object;
    try expectString(o.get("zoneid").?, g.zoneid);
    try expectString(o.get("abbr").?, g.abbr);
    try expectInt(o.get("dst").?, g.dst);
    try expectInt(o.get("offset").?, g.offset);
}

fn expectWall(want: Value, got: ?tz.WallResult) !void {
    const g = got orelse {
        if (want == .null) return;
        return fail("wall: want {f}, got null", .{std.json.fmt(want, .{})});
    };
    if (want == .null) return fail("wall: want null, got {d}", .{g.utc});
    try expectInt(want.array.items[0], g.utc);
    try expectInfo(want.array.items[1], g.info);
}

fn expectMeta(want: Value, got: ?tz.ZoneMeta) !void {
    const g = got orelse {
        if (want == .null) return;
        return fail("meta: want {f}, got null", .{std.json.fmt(want, .{})});
    };
    if (want == .null) return fail("meta: want null, got {s}", .{g.zoneid});
    const o = want.object;
    try expectString(o.get("zoneid").?, g.zoneid);
    try expectInt(o.get("stdoffset").?, g.stdoffset);
    try expectFloat(o.get("latitude").?, g.latitude);
    try expectFloat(o.get("longitude").?, g.longitude);
    try expectStrings(o.get("countries").?, g.countries);
}

// ---------------------------------------------------------------------------
// tzSweep: every transition of a zone, hashed (see sweepPoints in the generator)
// ---------------------------------------------------------------------------

const DAY = 86400000;

const Hash = struct {
    h: u32 = 2166136261,
    count: i64 = 0,

    fn add(self: *Hash, comptime f: []const u8, args: anytype) void {
        var buf: [256]u8 = undefined;
        const s = std.fmt.bufPrint(&buf, f, args) catch unreachable;
        for (s) |c| self.h = (self.h ^ c) *% 16777619;
        self.count += 1;
    }

    fn info(self: *Hash, tag: u8, t: i64, utc: ?i64, i: tz.ZoneInfo) void {
        if (utc) |u| {
            self.add("{c}{d}|{d}|{s}|{s}|{d}|{d};", .{ tag, t, u, i.zoneid, i.abbr, i.dst, i.offset });
        } else {
            self.add("{c}{d}|{s}|{s}|{d}|{d};", .{ tag, t, i.zoneid, i.abbr, i.dst, i.offset });
        }
    }
};

fn sweep(db: *const tz.Database, id: []const u8) Hash {
    var hash: Hash = .{};
    const ref = db.find(id) orelse return hash;
    for (ref.zone.untils) |u| {
        const a = db.fromUTC(id, u - 1).?.offset;
        const b = db.fromUTC(id, u).?.offset;
        for ([_]i64{ u - 1, u, u + 1 }) |t| hash.info('U', t, null, db.fromUTC(id, t).?);
        const walls = [_]i64{ u + a - 1, u + a, u + b - 1, u + b, @divFloor(2 * u + a + b, 2), u + a - DAY, u + b + DAY };
        for (walls) |t| {
            const r = db.fromWall(id, t).?;
            hash.info('W', t, r.utc, r.info);
        }
    }
    return hash;
}

// ---------------------------------------------------------------------------
// tzCustom: replacement data, built as the generator builds it
// ---------------------------------------------------------------------------

fn customData(a: Allocator, name: []const u8) !tz.RawData {
    if (eql(name, "custom")) {
        return .{
            .zoneids = "Etc/UTC|Foo/Bar",
            .links = "Zulu:0|Foo/Baz:1",
            .index = "",
            .zoneinfo = &.{ "0_0_0__UTC:0:0__", "2s0_0_0_XX_FOO:0:2s0__" },
        };
    }
    // Two real zones under other names (one of them twice).
    const raw = tz.defaultTimeZoneData;
    var ny: usize = 0;
    var lh: usize = 0;
    var it = std.mem.splitScalar(u8, raw.zoneids, '|');
    var i: usize = 0;
    while (it.next()) |id| : (i += 1) {
        if (eql(id, "America/New_York")) ny = i;
        if (eql(id, "Australia/Lord_Howe")) lh = i;
    }
    const infos = try a.dupe([]const u8, &.{ raw.zoneinfo[ny], raw.zoneinfo[lh], raw.zoneinfo[lh] });
    return .{
        .zoneids = "Test/East|Test/Howe|Test/East",
        .links = "Alias/One:0|ALIAS/TWO:1|Test/Howe:0|Alias/Last:2",
        .index = raw.index,
        .zoneinfo = infos,
    };
}

// ---------------------------------------------------------------------------
// Running a case
// ---------------------------------------------------------------------------

fn run(db: *const tz.Database, a: Allocator, fname: []const u8, args: []const Value, want: Value) !void {
    if (eql(fname, "tzCustom")) {
        const custom_db = try tz.Database.decode(a, try customData(a, args[0].string));
        return run(&custom_db, a, args[1].string, args[2..], want);
    }
    if (eql(fname, "tzUtcZone")) return expectInfo(want, tz.utcZone());
    if (eql(fname, "tzZoneIds")) return expectStrings(want, db.zoneIds());
    const id = args[0].string;
    if (eql(fname, "tzResolveId")) return expectOptString(want, db.resolveId(id));
    if (eql(fname, "tzZoneMeta")) return expectMeta(want, db.zoneMeta(id));
    if (eql(fname, "tzSweep")) {
        const s = sweep(db, id);
        try expectInt(want.object.get("count").?, s.count);
        return expectInt(want.object.get("hash").?, s.h);
    }
    const t = args[1].integer;
    if (eql(fname, "tzFromUTC")) return expectInfo(want, db.fromUTC(id, t));
    if (eql(fname, "tzFromWall")) return expectWall(want, db.fromWall(id, t));
    return fail("unknown function {s}", .{fname});
}

test "timezone conformance" {
    const gpa = std.testing.allocator;
    const parsed = try std.json.parseFromSlice(Value, gpa, cases.json, .{});
    defer parsed.deinit();

    var failures: usize = 0;
    const all = parsed.value.array.items;
    for (all, 0..) |c, i| {
        var arena = std.heap.ArenaAllocator.init(gpa);
        defer arena.deinit();
        const o = c.object;
        run(tz.defaultDatabase, arena.allocator(), o.get("fn").?.string, o.get("args").?.array.items, o.get("result").?) catch |err| {
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

test "the bundled data decodes to the generated tables" {
    const gpa = std.testing.allocator;
    const db = try tz.Database.decode(gpa, tz.defaultTimeZoneData);
    defer db.deinit(gpa);
    const d = tz.defaultDatabase;
    const t = std.testing;
    try t.expectEqual(d.zoneids.len, db.zoneids.len);
    for (d.zoneids, db.zoneids) |x, y| try t.expectEqualStrings(x, y);
    try t.expectEqual(d.links.len, db.links.len);
    for (d.links, db.links) |x, y| {
        try t.expectEqualStrings(x.key, y.key);
        try t.expectEqual(x.zone, y.zone);
    }
    for (d.zones, db.zones) |x, y| {
        try t.expectEqual(x.stdoff, y.stdoff);
        try t.expectEqual(x.latitude, y.latitude);
        try t.expectEqual(x.longitude, y.longitude);
        try t.expectEqual(x.countries.len, y.countries.len);
        for (x.countries, y.countries) |p, q| try t.expectEqualStrings(p, q);
        try t.expectEqual(x.localtime.len, y.localtime.len);
        for (x.localtime, y.localtime) |p, q| {
            try t.expectEqualStrings(p.abbr, q.abbr);
            try t.expectEqual(p.dst, q.dst);
            try t.expectEqual(p.offset, q.offset);
        }
        try t.expectEqualSlices(u8, x.types, y.types);
        try t.expectEqualSlices(i64, x.untils, y.untils);
    }
}

test "malformed data is an error" {
    const gpa = std.testing.allocator;
    const bad = [_][]const u8{
        "0_0_0__UTC:0:0_1_", // type past the local times
        "0_0_0__UTC:0:0_0_5", // until index past the table
        "0_0_0__UTC:0:0_0_", // a type without an until
        "0_0_0__UTC:x:0__", // dst not a number
        "0_0_0__UTC:0__", // no offset
        "0_0_0", // too few fields
    };
    for (bad) |info| {
        const r = tz.Database.decode(gpa, .{ .zoneids = "A", .links = "", .index = "1", .zoneinfo = &.{info} });
        try std.testing.expectError(error.InvalidTimeZoneData, r);
    }
    const r = tz.Database.decode(gpa, .{ .zoneids = "A", .links = "B:1", .index = "", .zoneinfo = &.{"0_0_0__UTC:0:0__"} });
    try std.testing.expectError(error.InvalidTimeZoneData, r);
}

test "no leaks" {
    const gpa = std.testing.allocator;
    const db = try tz.Database.decode(gpa, tz.defaultTimeZoneData);
    defer db.deinit(gpa);
    try std.testing.expectEqualStrings("EDT", db.fromUTC("America/New_York", 1584549000000).?.abbr);
    try std.testing.expectEqual(@as(i64, 1583651400000), db.fromWall("America/New_York", 1583633400000).?.utc);
    try std.testing.expectEqualStrings("Pacific/Pago_Pago", db.resolveId("Pacific/Samoa").?);
    try std.testing.expectEqualStrings("Europe/Brussels", db.zoneMeta("CET").?.zoneid);
    // Decoding fails cleanly part way through.
    const bad = tz.Database.decode(gpa, .{ .zoneids = "A|B", .links = "", .index = "1", .zoneinfo = &.{ "0_0_0_X,Y_UTC:0:0_0_0", "0_0_0" } });
    try std.testing.expectError(error.InvalidTimeZoneData, bad);
}
