//! The IANA time zone database.
//! Port of `packages/hereabouts/src/timezone`.
//!
//! The `tz*` functions of the TypeScript drop their prefix: `tzFromUTC` is `timezone.fromUTC`.
//! Instants are milliseconds since 1970-01-01T00:00:00Z. Ids and abbreviations returned point
//! into the active database: static for the bundled data, owned by the caller for data
//! activated with `setTimeZoneData`.

const std = @import("std");
const database = @import("database.zig");

pub const RawData = database.RawData;
pub const ZoneInfo = database.ZoneInfo;
pub const ZoneMeta = database.ZoneMeta;
pub const Database = database.Database;
pub const DecodeError = database.DecodeError;

/// The time zone data bundled with this package, generated from the tz database, in its packed
/// form. Decode it with `Database.decode`; the bundled data is already available decoded as
/// `defaultDatabase`.
pub const defaultTimeZoneData: RawData = @import("autogen.rawdata.zig").data;

/// The bundled data, decoded at build time. Active unless replaced with `setTimeZoneData`.
pub const defaultDatabase: *const Database = &@import("autogen.zonedata.zig").data;

var active: *const Database = defaultDatabase;

/// Replace the database used by every function that takes a time zone, in this module and in
/// `datetime`. Decode raw data with `Database.decode` first; it must stay alive while active.
/// Pass `defaultDatabase` to restore the bundled data. Not thread-safe: set it before other
/// threads look up zones.
pub fn setTimeZoneData(db: *const Database) void {
    active = db;
}

/// The active database.
pub fn activeDatabase() *const Database {
    return active;
}

const UTC_INFO: ZoneInfo = .{ .zoneid = "Etc/UTC", .abbr = "UTC", .dst = 0, .offset = 0 };

/// The info for a time zone at a UTC instant, or null if the zone is unknown.
pub fn fromUTC(zoneid: []const u8, utc: i64) ?ZoneInfo {
    const r = active.find(zoneid) orelse return null;
    return info(r.id, database.recordFromUTC(r.zone, utc));
}

/// A wall clock time resolved in a zone: the UTC instant and the zone info.
pub const WallResult = struct {
    utc: i64,
    info: ZoneInfo,
};

/// The UTC instant and zone info for a wall clock time in a zone (milliseconds as if the zone
/// were UTC), or null if the zone is unknown.
///
/// Since daylight saving time can move a clock backwards, a wall clock time can be ambiguous.
/// For example, on November 8 2020 in New York, 1:30 AM occurs twice: once before the boundary
/// of 2:00 AM is reached, and again after the clock is set back 1 hour to 1:00 AM. This resolves
/// the ambiguity in the most intuitive way.
pub fn fromWall(zoneid: []const u8, wall: i64) ?WallResult {
    const r = active.find(zoneid) orelse return null;
    const utc, const rec = database.recordFromWall(r.zone, wall);
    return .{ .utc = utc, .info = info(r.id, rec) };
}

/// Resolve a time zone id or alias, exactly as given or in lower case, into the canonical
/// proper-cased id.
pub fn resolveId(id: []const u8) ?[]const u8 {
    const r = active.find(id) orelse return null;
    return r.id;
}

/// UTC zone info.
pub fn utcZone() ZoneInfo {
    return UTC_INFO;
}

/// Metadata for a zone: the countries that overlap it, the latitude and longitude, and the
/// current standard offset in milliseconds. Null if the id is not a known zone or alias.
pub fn zoneMeta(id: []const u8) ?ZoneMeta {
    const r = active.find(id) orelse return null;
    return .{
        .zoneid = r.id,
        .stdoffset = r.zone.stdoff,
        .latitude = @as(f64, @floatFromInt(r.zone.latitude)) / 1e6,
        .longitude = @as(f64, @floatFromInt(r.zone.longitude)) / 1e6,
        .countries = r.zone.countries,
    };
}

/// The canonical time zone ids.
pub fn zoneIds() []const []const u8 {
    return active.zoneids;
}

fn info(zoneid: []const u8, rec: database.LocalTime) ZoneInfo {
    return .{ .zoneid = zoneid, .abbr = rec.abbr, .dst = rec.dst, .offset = rec.offset };
}

test {
    _ = database;
    _ = @import("search.zig");
}
