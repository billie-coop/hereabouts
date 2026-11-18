//! Region partitions for the region level of the distance tree (`partition.ts`).

const std = @import("std");
const data = @import("autogen.partition.zig");

fn find(table: []const data.Partition, region: []const u8) ?[]const []const u8 {
    const i = std.sort.binarySearch(data.Partition, table, region, struct {
        fn cmp(k: []const u8, e: data.Partition) std.math.Order {
            return std.mem.order(u8, k, e.region);
        }
    }.cmp) orelse return null;
    return table[i].partitions;
}

/// The partitions of a region or macro-region, e.g. `.{ "δ" }` for 'US'; empty if unknown.
pub fn getRegionPartition(region: []const u8) []const []const u8 {
    return find(&data.regions, region) orelse find(&data.macro_regions, region) orelse &.{};
}

test "partitions" {
    // Partition identifiers are auto-generated greek letters so may change as partition
    // composition changes.
    try std.testing.expectEqual(@as(usize, 1), getRegionPartition("US").len);
    try std.testing.expectEqualStrings("δ", getRegionPartition("US")[0]);
    try std.testing.expectEqual(@as(usize, 0), getRegionPartition("ZZ").len);
}
