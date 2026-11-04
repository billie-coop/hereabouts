//! Distance between language tags, from CLDR's language matching data (`distance.ts`).

const std = @import("std");
const lt = @import("../language_tag/language_tag.zig");
const data = @import("autogen.distance.zig");
const partition = @import("partition.zig");

const LanguageTag = lt.LanguageTag;
const Entry = data.Entry;
const Node = data.Node;

/// Default distance threshold.
pub const DEFAULT_THRESHOLD: i32 = 50;

/// Maximum possible distance between two language tags.
pub const MAX_DISTANCE: i32 = 100;

const Key = struct { want: []const u8, have: []const u8 };

fn order(k: Key, e: Entry) std.math.Order {
    const o = std.mem.order(u8, k.want, e.want);
    return if (o != .eq) o else std.mem.order(u8, k.have, e.have);
}

fn get(map: []const Entry, want: []const u8, have: []const u8) ?Node {
    const i = std.sort.binarySearch(Entry, map, Key{ .want = want, .have = have }, order) orelse return null;
    return map[i].node;
}

fn getany(map: []const Entry) Node {
    // Every level of the tree has the wildcard entry.
    return get(map, "$", "$").?;
}

/// Return the distance between the desired and supported locale, stopping once the given
/// threshold is exceeded.
pub fn getDistance(desired: LanguageTag, supported: LanguageTag, threshold: i32) i32 {
    // Compare the LANGUAGE subtag.
    var wildcard = false;
    var map: []const Entry = &data.distance_map;
    var want = desired.tagLanguage();
    var have = supported.tagLanguage();

    var node = get(map, want, have) orelse blk: {
        wildcard = true;
        break :blk getany(map);
    };

    // Calculate LANGUAGE distance.
    var distance = if (wildcard and std.mem.eql(u8, want, have)) 0 else node.distance;
    if (distance >= threshold) return MAX_DISTANCE;

    // Move to compare the SCRIPT subtag.
    map = node.next;
    want = desired.tagScript();
    have = supported.tagScript();

    if (get(map, want, have)) |n| {
        node = n;
        wildcard = false;
    } else {
        node = getany(map);
        wildcard = true;
    }

    // Update with SCRIPT distance.
    distance += if (wildcard and std.mem.eql(u8, want, have)) 0 else node.distance;
    if (distance >= threshold) return MAX_DISTANCE;

    // Move to compare the REGION subtag.
    want = desired.tagRegion();
    have = supported.tagRegion();

    // If regions are equal, we're done.
    if (std.mem.eql(u8, want, have)) return distance;

    const want_partitions = partition.getRegionPartition(want);
    const have_partitions = partition.getRegionPartition(have);

    map = node.next;
    // There are currently no region -> region distances, so this usually falls through to
    // comparing the desired region against supported partitions, and vice-versa.
    const found = get(map, want, have) orelse scanRegion(map, want, want_partitions, have, have_partitions);

    // If we found something, we're done.
    if (found) |n| {
        distance += n.distance;
        return if (distance < threshold) distance else MAX_DISTANCE;
    }

    // Try permutations of desired and supported partitions to find the maximum distance.
    var max_distance: i32 = 0;
    var matched = false;
    for (want_partitions) |dp| {
        for (have_partitions) |sp| {
            if (get(map, dp, sp)) |n| {
                max_distance = @max(max_distance, n.distance);
                matched = true;
            }
        }
    }
    if (!matched) {
        // The 'any' lookup always succeeds here.
        max_distance = @max(max_distance, getany(map).distance);
    }

    distance += max_distance;
    return if (distance < threshold) distance else MAX_DISTANCE;
}

/// Find the distance between sets of partitions.
fn scanRegion(
    map: []const Entry,
    want: []const u8,
    want_partitions: []const []const u8,
    have: []const u8,
    have_partitions: []const []const u8,
) ?Node {
    for (want_partitions) |v| {
        if (get(map, v, have)) |n| return n;
    }
    for (have_partitions) |v| {
        if (get(map, want, v)) |n| return n;
    }
    return null;
}

test "distance" {
    const en_us: LanguageTag = .{ .language = "en", .script = "Latn", .region = "US" };
    const en_gb: LanguageTag = .{ .language = "en", .script = "Latn", .region = "GB" };
    const en_au: LanguageTag = .{ .language = "en", .script = "Latn", .region = "AU" };
    try std.testing.expectEqual(@as(i32, 0), getDistance(en_us, en_us, DEFAULT_THRESHOLD));
    try std.testing.expectEqual(@as(i32, 3), getDistance(en_au, en_gb, DEFAULT_THRESHOLD));
    try std.testing.expectEqual(@as(i32, 5), getDistance(en_gb, en_us, DEFAULT_THRESHOLD));
}
