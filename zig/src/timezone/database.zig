//! Port of `packages/hereabouts/src/timezone/database.ts`: the decoded time zone database and
//! the lookups on a single zone.
//!
//! The TypeScript decodes zone records lazily and caches them. Here a `Database` is decoded
//! whole: the bundled one at build time (`autogen.zonedata.zig`), replacement data with
//! `Database.decode`. Lookups never allocate.

const std = @import("std");
const Allocator = std.mem.Allocator;
const binarySearch = @import("search.zig").binarySearch;

/// Raw time zone data, as generated from the tz database. See `Database.decode`.
pub const RawData = struct {
    /// Compressed index of until deltas.
    index: []const u8,
    /// Time zone ids.
    zoneids: []const u8,
    /// Time zone links.
    links: []const u8,
    /// Packed zone infos, in the order of the zone ids.
    zoneinfo: []const []const u8,
};

/// Abbreviation, daylight saving flag and UTC offset (milliseconds) of a time zone.
pub const ZoneInfo = struct {
    /// Canonical time zone id.
    zoneid: []const u8,
    /// Time zone abbreviation.
    abbr: []const u8,
    /// 1 if the zone is in daylight saving time, else 0.
    dst: u8,
    /// Offset from UTC, in milliseconds.
    offset: i64,
};

/// Metadata for a time zone.
pub const ZoneMeta = struct {
    /// Canonical time zone id, corrected if the metadata was looked up using an alias.
    zoneid: []const u8,
    /// Current standard offset from UTC, in milliseconds.
    stdoffset: i64,
    /// Latitude of the zone's "principal location".
    latitude: f64,
    /// Longitude of the zone's "principal location".
    longitude: f64,
    /// ISO 3166 2-character codes of the countries that overlap the zone.
    countries: []const []const u8,
};

/// A single local time type of a zone.
pub const LocalTime = struct {
    abbr: []const u8,
    dst: u8,
    offset: i64,
};

/// Decoded data for a single zone.
pub const Zone = struct {
    /// Current standard offset, in milliseconds.
    stdoff: i64,
    /// Latitude and longitude in millionths of a degree.
    latitude: i64,
    longitude: i64,
    countries: []const []const u8,
    localtime: []const LocalTime,
    /// Index into `localtime` for the time from each until onwards.
    types: []const u8,
    /// Transition instants, in milliseconds, ascending.
    untils: []const i64,
};

/// An id or alias, as given or in lower case, and the zone it names.
pub const Link = struct {
    key: []const u8,
    zone: u32,
};

/// A zone found by id or alias.
pub const ZoneRef = struct {
    /// Canonical id.
    id: []const u8,
    zone: *const Zone,
};

pub const Error = error{InvalidTimeZoneData} || Allocator.Error;

pub const WallResult = struct { utc: i64, info: ZoneInfo };
fn makeZoneInfo(zoneid: []const u8, rec: LocalTime) ZoneInfo {
    return .{ .zoneid = zoneid, .abbr = rec.abbr, .dst = rec.dst, .offset = rec.offset };
}

/// An immutable decoded time zone database, safe to share while its storage is alive.
/// No operation may run concurrently with deinit.
pub const Database = struct {
    zoneids: []const []const u8,
    zones: []const Zone,
    /// Sorted by key.
    links: []const Link,
    /// Owns the memory of a decoded database; null for the bundled one.
    arena: ?std.heap.ArenaAllocator.State = null,

    /// Look up UTC zone information (`tzFromUTC`). Returned strings borrow this database.
    pub fn fromUTC(self: *const Database, zoneid: []const u8, utc: i64) ?ZoneInfo {
        const r = self.find(zoneid) orelse return null;
        return makeZoneInfo(r.id, recordFromUTC(r.zone, utc));
    }
    /// Resolve wall time in this database (`tzFromWall`).
    pub fn fromWall(self: *const Database, zoneid: []const u8, wall: i64) ?WallResult {
        const r = self.find(zoneid) orelse return null;
        const utc, const rec = recordFromWall(r.zone, wall);
        return .{ .utc = utc, .info = makeZoneInfo(r.id, rec) };
    }
    /// Resolve a canonical id (`tzResolveId`). The result borrows this database.
    pub fn resolveId(self: *const Database, id: []const u8) ?[]const u8 {
        return (self.find(id) orelse return null).id;
    }
    /// Zone metadata (`tzZoneMeta`). Returned strings borrow this database.
    pub fn zoneMeta(self: *const Database, id: []const u8) ?ZoneMeta {
        const r = self.find(id) orelse return null;
        return .{ .zoneid = r.id, .stdoffset = r.zone.stdoff, .latitude = @as(f64, @floatFromInt(r.zone.latitude)) / 1e6, .longitude = @as(f64, @floatFromInt(r.zone.longitude)) / 1e6, .countries = r.zone.countries };
    }
    /// Canonical ids (`tzZoneIds`). The slice borrows this database.
    pub fn zoneIds(self: *const Database) []const []const u8 {
        return self.zoneids;
    }

    /// Decode raw data. The raw data is copied, so it need not outlive the result. Free the
    /// result with `deinit`. Malformed data is an error (the TypeScript decodes it into
    /// garbage records instead).
    pub fn decode(gpa: Allocator, raw: RawData) Error!Database {
        var arena = std.heap.ArenaAllocator.init(gpa);
        errdefer arena.deinit();
        const a = arena.allocator();

        const index = try numarray(a, raw.index);

        // Zone ids and records.
        const ids_src = try a.dupe(u8, raw.zoneids);
        var ids: std.ArrayList([]const u8) = .empty;
        var it = std.mem.splitScalar(u8, ids_src, '|');
        while (it.next()) |id| try ids.append(a, id);
        if (ids.items.len != raw.zoneinfo.len) return error.InvalidTimeZoneData;

        const zones = try a.alloc(Zone, raw.zoneinfo.len);
        for (raw.zoneinfo, zones) |info, *z| z.* = try decodeZone(a, try a.dupe(u8, info), index);

        // Zone id -> index; a repeated id maps to its last index, like the TypeScript Map.
        const by_id = try a.alloc(Link, ids.items.len);
        for (ids.items, 0..) |id, i| by_id[i] = .{ .key = id, .zone = @intCast(i) };
        const id_index = sortKeepLast(by_id);

        // Index the ids and aliases as given and in lower case.
        var entries: std.ArrayList(Link) = .empty;
        for (ids.items) |id| {
            const z = lookup(id_index, id).?;
            try entries.append(a, .{ .key = id, .zone = z });
            try entries.append(a, .{ .key = try lower(a, id), .zone = z });
        }
        if (raw.links.len > 0) {
            var lit = std.mem.splitScalar(u8, try a.dupe(u8, raw.links), '|');
            while (lit.next()) |e| {
                const colon = std.mem.indexOfScalar(u8, e, ':') orelse return error.InvalidTimeZoneData;
                const alias = e[0..colon];
                const j = std.fmt.parseInt(usize, e[colon + 1 ..], 10) catch return error.InvalidTimeZoneData;
                if (j >= ids.items.len) return error.InvalidTimeZoneData;
                const z = lookup(id_index, ids.items[j]).?;
                try entries.append(a, .{ .key = alias, .zone = z });
                try entries.append(a, .{ .key = try lower(a, alias), .zone = z });
            }
        }
        const links = sortKeepLast(entries.items);

        return .{ .zoneids = ids.items, .zones = zones, .links = links, .arena = arena.state };
    }

    pub fn deinit(self: Database, gpa: Allocator) void {
        if (self.arena) |state| state.promote(gpa).deinit();
    }

    /// Find a zone by its id or alias, exactly as given or in lower case.
    pub fn find(self: *const Database, id: []const u8) ?ZoneRef {
        const i = lookup(self.links, id) orelse return null;
        return .{ .id = self.zoneids[i], .zone = &self.zones[i] };
    }
};

fn linkLess(_: void, x: Link, y: Link) bool {
    return std.mem.order(u8, x.key, y.key) == .lt;
}

/// Stable sort by key, then keep the last entry for each key (a Map's last `set` wins).
fn sortKeepLast(items: []Link) []Link {
    std.mem.sort(Link, items, {}, linkLess);
    var n: usize = 0;
    for (items, 0..) |e, i| {
        if (i + 1 < items.len and std.mem.eql(u8, items[i + 1].key, e.key)) continue;
        items[n] = e;
        n += 1;
    }
    return items[0..n];
}

fn lookup(links: []const Link, key: []const u8) ?u32 {
    var lo: usize = 0;
    var hi: usize = links.len;
    while (lo < hi) {
        const mid = lo + (hi - lo) / 2;
        switch (std.mem.order(u8, links[mid].key, key)) {
            .lt => lo = mid + 1,
            .gt => hi = mid,
            .eq => return links[mid].zone,
        }
    }
    return null;
}

fn lower(a: Allocator, s: []const u8) Allocator.Error![]const u8 {
    const out = try a.alloc(u8, s.len);
    return std.ascii.lowerString(out, s);
}

/// `parseInt(s, 36)` for well-formed input: an optional sign and base-36 digits.
fn parse36(s: []const u8) Error!i64 {
    return std.fmt.parseInt(i64, s, 36) catch error.InvalidTimeZoneData;
}

/// Space-separated base-36 numbers; empty text is an empty list.
fn numarray(a: Allocator, s: []const u8) Error![]i64 {
    var out: std.ArrayList(i64) = .empty;
    if (s.len == 0) return out.items;
    var it = std.mem.splitScalar(u8, s, ' ');
    while (it.next()) |n| try out.append(a, try parse36(n));
    return out.items;
}

fn decodeInfo(raw: []const u8) Error!LocalTime {
    var it = std.mem.splitScalar(u8, raw, ':');
    const abbr = it.next().?;
    const dst = std.fmt.parseInt(u8, it.next() orelse return error.InvalidTimeZoneData, 10) catch
        return error.InvalidTimeZoneData;
    const offset = try parse36(it.next() orelse return error.InvalidTimeZoneData);
    return .{ .abbr = abbr, .dst = dst, .offset = std.math.mul(i64, offset, 1000) catch return error.InvalidTimeZoneData };
}

/// Decode the packed data for a single zone.
fn decodeZone(a: Allocator, raw: []const u8, index: []const i64) Error!Zone {
    var fields: [7][]const u8 = undefined;
    var it = std.mem.splitScalar(u8, raw, '_');
    for (&fields) |*f| f.* = it.next() orelse return error.InvalidTimeZoneData;

    var countries: std.ArrayList([]const u8) = .empty;
    if (fields[3].len > 0) {
        var cit = std.mem.splitScalar(u8, fields[3], ',');
        while (cit.next()) |c| try countries.append(a, c);
    }

    var localtime: std.ArrayList(LocalTime) = .empty;
    var lit = std.mem.splitScalar(u8, fields[4], '|');
    while (lit.next()) |info| try localtime.append(a, try decodeInfo(info));

    // Type indices are single base-36 digits [0-9A-Z]
    const types = try a.alloc(u8, fields[5].len);
    for (fields[5], types) |c, *t| {
        t.* = std.fmt.charToDigit(c, 36) catch return error.InvalidTimeZoneData;
        if (t.* >= localtime.items.len) return error.InvalidTimeZoneData;
    }

    // Decode the initial until and the deltas
    const packed_untils = try numarray(a, fields[6]);
    if (packed_untils.len != types.len) return error.InvalidTimeZoneData;
    var acc: i64 = 0;
    for (packed_untils) |*u| {
        if (u.* < 0 or u.* >= index.len) return error.InvalidTimeZoneData;
        const step = std.math.mul(i64, index[@intCast(u.*)], 1000) catch return error.InvalidTimeZoneData;
        acc = std.math.add(i64, acc, step) catch return error.InvalidTimeZoneData;
        u.* = acc;
    }

    return .{
        .stdoff = std.math.mul(i64, try parse36(fields[0]), 1000) catch return error.InvalidTimeZoneData,
        .latitude = try parse36(fields[1]),
        .longitude = try parse36(fields[2]),
        .countries = countries.items,
        .localtime = localtime.items,
        .types = types,
        .untils = packed_untils,
    };
}

/// Comptime decoding for the generated data: transition instants from indexes into the table of
/// gaps in seconds. The first is from 1970, each later one from the one before.
pub fn untilsFromIndex(comptime index: []const i64, comptime packed_untils: []const u16) [packed_untils.len]i64 {
    @setEvalBranchQuota(10_000_000);
    var out: [packed_untils.len]i64 = undefined;
    var acc: i64 = 0;
    for (packed_untils, 0..) |k, i| {
        acc += index[k] * 1000;
        out[i] = acc;
    }
    return out;
}

/// Comptime decoding for the generated data: type indexes from base-36 digits.
pub fn typesFromString(comptime s: []const u8) [s.len]u8 {
    @setEvalBranchQuota(10_000_000);
    var out: [s.len]u8 = undefined;
    for (s, 0..) |c, i| out[i] = std.fmt.charToDigit(c, 36) catch unreachable;
    return out;
}

/// The local time at a UTC instant.
pub fn recordFromUTC(z: *const Zone, utc: i64) LocalTime {
    const i = binarySearch(z.untils, true, utc);
    const t = if (i == -1) 0 else z.types[@intCast(i)];
    return z.localtime[t];
}

/// The UTC instant and local time for a wall clock time in the zone.
///
/// We have to determine the nearest DST transition boundary in wall clock time, and choose one
/// side of the boundary based on whether the clock moved backwards or forwards, and where our
/// wall time falls relative to the boundary, or within the transitional gap.
///
/// Arithmetic saturates at the ends of i64, far outside any instant the TypeScript represents
/// exactly.
pub fn recordFromWall(z: *const Zone, wall: i64) struct { i64, LocalTime } {
    // Find the until one day before our wall time
    var i = binarySearch(z.untils, true, wall -| 86400000);
    const r0 = z.localtime[if (i == -1) 0 else z.types[@intCast(i)]];
    i += 1;

    // Check if we hit the end of the untils array and return
    if (i == z.types.len) return .{ wall -| r0.offset, r0 };

    // Get the next until.
    const r1 = z.localtime[z.types[@intCast(i)]];
    const u_1 = z.untils[@intCast(i)];

    // Adjust the next until using the prior offset to find the wall clock time of the boundary.
    //
    // Example for New York on Mar 8, 2020 with DST boundary at 7:00 AM UTC:
    //   1:59 AM NY time is UTC 6:59 AM minus 5 hours
    //
    // 1 minute later the offset changes to -04:00:
    //   2:00 AM NY time is UTC 7:00 AM minus 5 hours, so local time becomes 3:00 AM
    //
    // Example for New York on Nov 1, 2020 with DST boundary at 7:00 AM UTC:
    //   1:59 AM NY time is UTC 5:59 AM minus 4 hours
    //
    // 1 minute later the offset changes to -05:00:
    //   2:00 AM NY time is UTC 6:00 AM minus 4 hours, so local time becomes 1:00 AM

    // Wall time instantaneously at zone boundary
    const w0 = u_1 + r0.offset;

    // New wall time after boundary is crossed
    const w1 = u_1 + r1.offset;

    // Wall time is before the gap, return pre-boundary offset
    if (wall < w0 and wall < w1) return .{ wall -| r0.offset, r0 };

    // When local time jumps forward, the resulting gap contains many "impossible" times. In our
    // example for New York, Mar 8 2020 at 2:30 AM is invalid. We return a UTC timestamp and
    // offset that will make the local time 3:30 AM.
    if (w0 < w1) {
        // Wall time is either in the gap of impossible times or after the gap.
        return if (wall < w1) .{ wall -| r0.offset, r1 } else .{ wall -| r1.offset, r1 };
    }

    // When local time jumps backwards, many times occur twice. In our example for New York,
    // Nov 1 2020, 1:30 AM occurs once as local time moves towards 2:00 AM, and occurs again
    // after the time has been moved back to 1:00 AM.
    return if (wall < w0) .{ wall -| r0.offset, r0 } else .{ wall -| r1.offset, r1 };
}

test "decode a small data set" {
    const gpa = std.testing.allocator;
    const raw: RawData = .{
        .zoneids = "Etc/UTC|Foo/Bar",
        .links = "Zulu:0|Foo/Baz:1",
        .index = "1 2",
        .zoneinfo = &.{ "0_0_0__UTC:0:0__", "2s0_-a_b_XX,YY_FOO:0:2s0|FDT:1:5k0_10_0 1" },
    };
    const db = try Database.decode(gpa, raw);
    defer db.deinit(gpa);
    try std.testing.expectEqual(@as(usize, 2), db.zoneids.len);
    const r = db.find("foo/baz").?;
    try std.testing.expectEqualStrings("Foo/Bar", r.id);
    try std.testing.expectEqualSlices(i64, &.{ 1000, 3000 }, r.zone.untils);
    try std.testing.expectEqual(@as(i64, -10), r.zone.latitude);
    try std.testing.expectEqualStrings("FDT", recordFromUTC(r.zone, 1000).abbr);
    try std.testing.expectEqualStrings("FOO", recordFromUTC(r.zone, 3000).abbr);
    try std.testing.expect(db.find("FOO/BAZ") == null);
    try std.testing.expectEqualStrings("Etc/UTC", db.find("zulu").?.id);

    const bad = [_][]const u8{ "0_0_0__UTC:0:0_1_", "0_0_0__UTC:0:0_0_5", "0_0_0__UTC:x:0__", "0_0_0" };
    for (bad) |info| {
        const r2 = Database.decode(gpa, .{ .zoneids = "A", .links = "", .index = "1", .zoneinfo = &.{info} });
        try std.testing.expectError(error.InvalidTimeZoneData, r2);
    }
}
