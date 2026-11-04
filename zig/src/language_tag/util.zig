//! Territory alias lookups shared by the parser and the locale resolver.

const std = @import("std");
const aliases = @import("autogen.aliases.zig");

/// The core subtags of a tag, for fast comparisons. A null field is undefined (the TypeScript
/// uses the field's index number for that).
pub const FastTag = struct {
    language: ?[]const u8 = null,
    script: ?[]const u8 = null,
    region: ?[]const u8 = null,

    pub fn eql(a: FastTag, b: FastTag) bool {
        return optEql(a.language, b.language) and optEql(a.script, b.script) and
            optEql(a.region, b.region);
    }
};

pub fn optEql(a: ?[]const u8, b: ?[]const u8) bool {
    if (a == null or b == null) return a == null and b == null;
    return std.mem.eql(u8, a.?, b.?);
}

fn cmpKey(key: []const u8, e: aliases.TerritoryAlias) std.math.Order {
    return std.mem.order(u8, key, e.key);
}

/// The replacement regions for an old region code, if it has any.
pub fn territoryAlias(region: []const u8) ?[]const []const u8 {
    const i = std.sort.binarySearch(aliases.TerritoryAlias, &aliases.territory_aliases, region, cmpKey) orelse
        return null;
    return aliases.territory_aliases[i].regions;
}

/// Helper for the language tag parser to fix overlong region fields that may or may not be
/// variants.
pub fn replaceRegion(region: []const u8) ?[]const u8 {
    const r = territoryAlias(region) orelse return null;
    return r[0];
}

/// Substitute territory subtag aliases, if any.
pub fn substituteRegionAliases(dst: *FastTag) void {
    const region = dst.region orelse return;
    const replacement = territoryAlias(region) orelse return;
    // Hack: for now we just use the first region in the list.
    dst.region = replacement[0];
    // TODO: get the best regions for this language / script combination, and if one is
    // found in the replacement set, use it. Otherwise use the first in the list.
}

test "region aliases" {
    var t: FastTag = .{};
    substituteRegionAliases(&t);
    try std.testing.expect(t.region == null);
    t.region = "ARG";
    substituteRegionAliases(&t);
    try std.testing.expectEqualStrings("AR", t.region.?);
    t.region = "US";
    substituteRegionAliases(&t);
    try std.testing.expectEqualStrings("US", t.region.?);
}
