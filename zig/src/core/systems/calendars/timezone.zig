//! Time zone information of calendar dates: metazones and CLDR stable ids (`timezone.ts`).

const std = @import("std");
const tz = @import("../../../timezone/timezone.zig");
const instructions = @import("../../schema/instructions.zig");
const schema = @import("../../schema/autogen.schema.zig");
const zonedata = @import("autogen.zonedata.zig");
const zonealiases = @import("autogen.aliases.zig");
const types = @import("types.zig");
const util = @import("util.zig");

const DateZoneInfo = types.DateZoneInfo;

/// The CLDR stable zone ids of the schema (`TimeZoneStableIdIndex`, the `timezone-id` index).
const stable_index = &schema.indices.@"timezone-id";

/// The id, if it is one of the CLDR stable zone ids (static copy).
fn stableKey(zoneid: []const u8) ?[]const u8 {
    const i = instructions.keyIndexGet(stable_index, zoneid) orelse return null;
    return stable_index.keys[i];
}

/// Time zone info of a zone at a UTC instant (milliseconds). An unknown zone is UTC.
pub fn zoneInfoFromUTC(zoneid: []const u8, utc: f64) DateZoneInfo {
    const info = tz.fromUTC(zoneid, util.toInstant(utc)) orelse tz.utcZone();

    // For the purposes of CLDR stable timezone ids, check if the passed-in id is an alias to a
    // current/valid tzdb id. Use the passed-in id as the stable id if it is one, otherwise look
    // up the corrected id in the stable map.
    const stableid = stableKey(zoneid) orelse getStableId(info.zoneid);

    // Use the corrected zone id to look up the metazone.
    const metazoneid = getMetazone(info.zoneid, utc) orelse "";
    return .{
        .zoneid = info.zoneid,
        .stableid = stableid,
        .abbr = info.abbr,
        .dst = info.dst,
        .offset = info.offset,
        .metazoneid = metazoneid,
    };
}

/// The UTC epoch of a wall clock time (milliseconds as if the zone were UTC) in a zone, or null
/// if the zone is unknown (`tzFromWall`, keeping a fractional or huge wall time as it is).
pub fn utcFromWall(zoneid: []const u8, wall: f64) ?f64 {
    const instant = util.toInstant(wall);
    const r = tz.fromWall(zoneid, instant) orelse return null;
    // In a spring gap, the resolved UTC instant uses the pre-transition offset while
    // the returned info describes the post-transition zone. Preserve that resolution,
    // and keep the caller's fractional or huge wall value.
    const adjustment: f64 = @floatFromInt(r.utc - instant);
    return wall + adjustment;
}

/// The zone's current metazone, if it has one.
pub fn currentMetazone(id: []const u8) ?[]const u8 {
    return getMetazone(id, 9007199254740991);
}

/// Map a time zone id to a CLDR stable time zone id, or "" if it is not a known zone. Lighter
/// than `zoneInfoFromUTC`.
pub fn getStableTimeZoneId(zoneid: []const u8) []const u8 {
    // Already a CLDR stable timezone id?
    if (stableKey(zoneid)) |k| return k;
    // Resolve the string to a real tzdb zone id, and map that to a CLDR stable id.
    const realid = tz.resolveId(zoneid) orelse return "";
    return getStableId(realid);
}

/// The id that replaces a zone alias, or the id itself.
pub fn substituteZoneAlias(id: []const u8) []const u8 {
    return zonealiases.aliases.get(id) orelse id;
}

/// Value for a zone id, falling back to the bundled canonical id if it is a bundled alias.
/// Replacement tz data may make a bundled alias canonical (e.g. Asia/Calcutta instead of
/// Asia/Kolkata); with the bundled data the fallback is never taken.
fn byZone(comptime T: type, map: anytype, zoneid: []const u8) ?T {
    if (map.get(zoneid)) |v| return v;
    const canonical = zonedata.tz_aliases.get(zoneid) orelse return null;
    return map.get(canonical);
}

fn getMetazone(zoneid: []const u8, utc: f64) ?[]const u8 {
    const i = byZone(u16, zonedata.zone_metazone, zoneid) orelse return null;
    const rec = zonedata.metazones[i];
    var j = rec.untils.len - 1;
    while (j > 0) : (j -= 1) {
        if (@as(f64, @floatFromInt(rec.untils[j])) <= utc) return zonedata.metazoneids[rec.offsets[j]];
    }
    // Hit the end: the initial metazone id.
    return zonedata.metazoneids[rec.offsets[0]];
}

fn getStableId(zoneid: []const u8) []const u8 {
    return byZone([]const u8, zonedata.stable_ids, zoneid) orelse zoneid;
}

test "zone info" {
    const utc: f64 = 1554263155000;
    var info = zoneInfoFromUTC("America/New_York", utc);
    try std.testing.expectEqualStrings("EDT", info.abbr);
    try std.testing.expectEqualStrings("America_Eastern", info.metazoneid);
    try std.testing.expectEqual(@as(i64, -14400000), info.offset);
    info = zoneInfoFromUTC("Etc/GMT+1", utc);
    try std.testing.expectEqualStrings("", info.metazoneid);
    info = zoneInfoFromUTC("MissingZone", utc);
    try std.testing.expectEqualStrings("GMT", info.metazoneid);
    try std.testing.expectEqualStrings("Africa/Bamako", getStableTimeZoneId("Africa/Bamako"));
    try std.testing.expectEqualStrings("Asia/Shanghai", getStableTimeZoneId("Asia/Harbin"));
    try std.testing.expectEqualStrings("", getStableTimeZoneId("Foo/Bar"));
}
