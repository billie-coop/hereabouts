//! The IANA time zone database.
//! Port of `packages/hereabouts/src/timezone`.
//!
//! The `tz*` functions of the TypeScript drop their prefix: `tzFromUTC` is `timezone.fromUTC`.
//! Instants are milliseconds since 1970-01-01T00:00:00Z. Ids and abbreviations returned point
//! into an immutable database. Namespace convenience functions use bundled data;
//! call Database methods for custom data, keeping that database alive for all returned borrows.

const std = @import("std");
const database = @import("database.zig");

pub const RawData = database.RawData;
pub const ZoneInfo = database.ZoneInfo;
pub const ZoneMeta = database.ZoneMeta;
pub const Database = database.Database;
pub const Error = database.Error;

/// The time zone data bundled with this package, generated from the tz database, in its packed
/// form. Decode it with `Database.decode`; the bundled data is already available decoded as
/// `defaultDatabase`.
pub const defaultTimeZoneData: RawData = @import("autogen.rawdata.zig").data;

/// The immutable bundled data, decoded at build time.
pub const defaultDatabase: *const Database = &@import("autogen.zonedata.zig").data;

const UTC_INFO: ZoneInfo = .{ .zoneid = "Etc/UTC", .abbr = "UTC", .dst = 0, .offset = 0 };

/// The info for a time zone at a UTC instant, or null if the zone is unknown.
pub fn fromUTC(zoneid: []const u8, utc: i64) ?ZoneInfo {
    return defaultDatabase.fromUTC(zoneid, utc);
}

/// A wall clock time resolved in a zone: the UTC instant and the zone info.
pub const WallResult = database.WallResult;

/// The UTC instant and zone info for a wall clock time in a zone (milliseconds as if the zone
/// were UTC), or null if the zone is unknown.
///
/// Since daylight saving time can move a clock backwards, a wall clock time can be ambiguous.
/// For example, on November 8 2020 in New York, 1:30 AM occurs twice: once before the boundary
/// of 2:00 AM is reached, and again after the clock is set back 1 hour to 1:00 AM. This resolves
/// the ambiguity in the most intuitive way.
pub fn fromWall(zoneid: []const u8, wall: i64) ?WallResult {
    return defaultDatabase.fromWall(zoneid, wall);
}

/// Resolve a time zone id or alias, exactly as given or in lower case, into the canonical
/// proper-cased id.
pub fn resolveId(id: []const u8) ?[]const u8 {
    return defaultDatabase.resolveId(id);
}

/// UTC zone info.
pub fn utcZone() ZoneInfo {
    return UTC_INFO;
}

/// Metadata for a zone: the countries that overlap it, the latitude and longitude, and the
/// current standard offset in milliseconds. Null if the id is not a known zone or alias.
pub fn zoneMeta(id: []const u8) ?ZoneMeta {
    return defaultDatabase.zoneMeta(id);
}

/// The canonical time zone ids.
pub fn zoneIds() []const []const u8 {
    return defaultDatabase.zoneIds();
}

test {
    _ = database;
    _ = @import("search.zig");
}
