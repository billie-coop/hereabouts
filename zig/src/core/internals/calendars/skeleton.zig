//! Skeleton parsing and ICU best-fit matching. Strings allocate in a caller arena.
const std = @import("std");
const A = std.mem.Allocator;
const dates = @import("../../parsing/date.zig");
const f = @import("fields.zig");
const F = f.Field;
pub const SkeletonField = struct { input: u8, field: u8, type: usize, width: usize, repeat: usize };
pub const DateSkeleton = struct {
    type: [16]i32 = @splat(0),
    info: [16]?SkeletonField = @splat(null),
    skeleton: []const u8 = "",
    pattern: ?[]const u8 = null,
    is_date: bool = false,
    is_time: bool = false,
};
pub const DateSkeletonParser = struct { preferred_flex: []const dates.DateTimeNode, allowed_flex: []const dates.DateTimeNode };
pub fn dateSkeleton() DateSkeleton {
    return .{};
}
pub fn dateSkeletonParser(preferred: []const dates.DateTimeNode, allowed: []const dates.DateTimeNode) DateSkeletonParser {
    return .{ .preferred_flex = preferred, .allowed_flex = allowed };
}
pub fn skeletonCompound(s: DateSkeleton) bool {
    return s.is_date and s.is_time;
}
pub fn skeletonHas(s: DateSkeleton, field: usize) bool {
    return s.type[field] != 0;
}
pub fn skeletonMonthWidth(s: DateSkeleton) usize {
    return if (s.info[F.MONTH]) |m| m.width else 0;
}
pub fn skeletonCanonical(a: A, s: DateSkeleton) A.Error![]const u8 {
    var r: std.ArrayList(u8) = .empty;
    for (s.info) |info| if (info) |v| {
        const n = if (std.mem.indexOfScalar(u8, "GEzvQ", v.field) != null) 1 else v.repeat;
        try r.appendNTimes(a, v.field, n);
    };
    return r.toOwnedSlice(a);
}
pub fn skeletonSplit(a: A, s: *DateSkeleton) A.Error!DateSkeleton {
    var r: DateSkeleton = .{};
    for (F.DAYPERIOD..F.MAX_TYPE) |i| if (s.type[i] != 0) {
        r.type[i] = s.type[i];
        r.info[i] = s.info[i];
        s.type[i] = 0;
        s.info[i] = null;
    };
    s.is_time = false;
    s.skeleton = try skeletonCanonical(a, s.*);
    r.is_time = true;
    r.skeleton = try skeletonCanonical(a, r);
    return r;
}
fn setField(s: *DateSkeleton, input: u8, field: u8, width: usize) void {
    const row = f.getFieldType(field, width) orelse return;
    const idx = row.field;
    s.type[idx] = row.sub + if (row.sub > 0) @as(i32, @intCast(width)) else @as(i32, 0);
    s.info[idx] = .{ .input = input, .field = field, .type = idx, .width = width, .repeat = row.repeat };
    s.is_date = s.is_date or idx < F.DAYPERIOD;
    s.is_time = s.is_time or idx >= F.DAYPERIOD;
}
fn setPeriod(p: DateSkeletonParser, s: *DateSkeleton, ch: u8, width: usize, no: bool) bool {
    if (std.mem.indexOfScalar(u8, "jJC", ch) != null) {
        for (if (ch == 'C') p.allowed_flex else p.preferred_flex) |n| if (n == .field) {
            setField(s, ch, n.field.char, n.field.width);
        };
        return ch == 'J';
    }
    setField(s, ch, ch, width);
    return no;
}
pub fn skeletonParse(a: A, p: DateSkeletonParser, raw: []const u8, isPattern: bool) A.Error!DateSkeleton {
    var s: DateSkeleton = .{};
    var no = false;
    var ch: u8 = 0;
    var width: usize = 0;
    var quote = false;
    for (raw) |c| {
        if (quote) {
            if (c == '\'') quote = false;
            continue;
        }
        if (c == '\'') {
            quote = true;
        } else if (dates.patternChar(c)) {
            if (c != ch) {
                if (ch != 0) no = setPeriod(p, &s, ch, width, no);
                ch = c;
                width = 1;
            } else width += 1;
        }
    }
    if (width > 0 and ch != 0) no = setPeriod(p, &s, ch, width, no);
    if (no) {
        s.type[F.DAYPERIOD] = 0;
        s.info[F.DAYPERIOD] = null;
    } else if (s.info[F.HOUR]) |h| {
        if (h.field == 'h' or h.field == 'K') {
            if (s.info[F.DAYPERIOD] == null) {
                s.type[F.DAYPERIOD] = -259;
                s.info[F.DAYPERIOD] = .{ .input = 'a', .field = 'a', .type = F.DAYPERIOD, .width = 1, .repeat = 1 };
            }
        } else if (s.info[F.DAYPERIOD] != null) {
            s.type[F.DAYPERIOD] = 0;
            s.info[F.DAYPERIOD] = null;
        }
    }
    s.skeleton = if (isPattern) try skeletonCanonical(a, s) else raw;
    if (isPattern) s.pattern = raw;
    return s;
}
pub const Entry = struct { skeleton: DateSkeleton };
pub const DatePatternMatcher = struct { entries: std.ArrayList(Entry) = .empty };
pub fn datePatternMatcher() DatePatternMatcher {
    return .{};
}
pub fn matcherAdd(a: A, m: *DatePatternMatcher, s: DateSkeleton) A.Error!void {
    for (m.entries.items) |e| if (std.mem.eql(u8, e.skeleton.skeleton, s.skeleton)) return;
    try m.entries.append(a, .{ .skeleton = s });
}
pub fn matcherSort(m: *DatePatternMatcher) void {
    std.mem.sort(Entry, m.entries.items, {}, struct {
        fn less(_: void, a: Entry, b: Entry) bool {
            return a.skeleton.skeleton.len < b.skeleton.skeleton.len;
        }
    }.less);
}
pub fn getDistance(a: DateSkeleton, b: DateSkeleton) i64 {
    var result: i64 = 0;
    for (a.type, b.type) |at, bt| {
        if (at == bt) continue;
        result += if (at == 0) f.EXTRA_FIELD else if (bt == 0) f.MISSING_FIELD else @as(i64, @intCast(@abs(at - bt)));
    }
    return result;
}
fn kindDistance(a: DateSkeleton, b: DateSkeleton) i64 {
    var n: i64 = 0;
    for ([_]usize{ F.MONTH, F.YEAR, F.DAY }) |i| if (a.type[i] != 0 and b.type[i] != 0) {
        n += @intCast(@abs(a.type[i] - b.type[i]));
    };
    return n;
}
pub fn matcherMatch(m: DatePatternMatcher, input: DateSkeleton) DateSkeleton {
    for (m.entries.items) |e| if (std.mem.eql(u8, e.skeleton.skeleton, input.skeleton)) return e.skeleton;
    var best: DateSkeleton = .{};
    var dist: i64 = std.math.maxInt(i64);
    var kind: i64 = 0;
    for (m.entries.items) |e| {
        const d = getDistance(e.skeleton, input);
        if (d < dist) {
            best = e.skeleton;
            dist = d;
            kind = kindDistance(e.skeleton, input);
            if (d == 0) break;
        } else if (d == dist) {
            const k = kindDistance(e.skeleton, input);
            if (k < kind) {
                best = e.skeleton;
                kind = k;
            }
        }
    }
    return best;
}
pub fn matcherAdjust(a: A, pattern: []const dates.DateTimeNode, s: DateSkeleton, matched: DateSkeleton, decimal: []const u8) A.Error![]const dates.DateTimeNode {
    var r: std.ArrayList(dates.DateTimeNode) = .empty;
    for (pattern) |n| {
        if (n == .text) {
            try r.append(a, n);
            continue;
        }
        const p = f.getFieldType(n.field.char, n.field.width) orelse {
            try r.append(a, n);
            continue;
        };
        const i = p.field;
        if (i == F.HOUR or i == F.MINUTE or i == F.SECOND) {
            try r.append(a, n);
            if (i == F.SECOND) {
                if (s.info[F.FRACTIONAL_SECOND]) |info| {
                    try r.append(a, .{ .text = decimal });
                    try r.append(a, .{ .field = .{ .char = info.field, .width = info.width } });
                }
            }
            continue;
        }
        const st = s.type[i];
        if (st != 0 and matched.type[i] == st) {
            try r.append(a, n);
            continue;
        }
        if ((p.sub < 0 and st < 0) or (p.sub > 0 and st > 0)) {
            if (s.info[i]) |info| {
                try r.append(a, .{ .field = .{ .char = info.field, .width = info.width } });
                continue;
            }
        }
        try r.append(a, n);
    }
    return r.toOwnedSlice(a);
}
