//! Port of `binarySearch` from `packages/hereabouts/src/utils/search.ts`.

/// Binary search a sorted slice. When `n` is not found, `less_than` decides which index is
/// returned:
///
///    true  - index of the element less than `n` (-1 if there is none)
///    false - index of the element greater than `n` (`elems.len` if there is none)
pub fn binarySearch(elems: []const i64, less_than: bool, n: i64) isize {
    var lo: isize = 0;
    var hi: isize = @as(isize, @intCast(elems.len)) - 1;
    while (lo <= hi) {
        const mid = lo + ((hi - lo) >> 1);
        const e = elems[@intCast(mid)];
        if (e < n) {
            lo = mid + 1;
        } else if (e > n) {
            hi = mid - 1;
        } else {
            return mid;
        }
    }
    return if (less_than) lo - 1 else lo;
}

test binarySearch {
    const t = @import("std").testing;
    const xs = [_]i64{ 10, 20, 30 };
    try t.expectEqual(@as(isize, -1), binarySearch(&xs, true, 5));
    try t.expectEqual(@as(isize, 0), binarySearch(&xs, false, 5));
    try t.expectEqual(@as(isize, 1), binarySearch(&xs, true, 20));
    try t.expectEqual(@as(isize, 1), binarySearch(&xs, true, 25));
    try t.expectEqual(@as(isize, 2), binarySearch(&xs, false, 25));
    try t.expectEqual(@as(isize, 2), binarySearch(&xs, true, 99));
    try t.expectEqual(@as(isize, 3), binarySearch(&xs, false, 99));
    try t.expectEqual(@as(isize, -1), binarySearch(&.{}, true, 1));
}
