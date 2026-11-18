//! Pattern requests for dates and intervals. Requests allocate in the caller's arena.
const std = @import("std");
const A = std.mem.Allocator;
const LocaleData = @import("../../locale_data.zig").LocaleData;
const cal = @import("../../systems/calendars/calendars.zig");
const opts = @import("../../common/calendars.zig");
const NumberParams = @import("../../common/private.zig").NumberParams;
const dates = @import("../../parsing/date.zig");
const s = @import("skeleton.zig");
const F = @import("fields.zig").Field;
const p = @import("patterns.zig");
const internal = @import("internal.zig");
pub const getCalendarPatterns = p.getCalendarPatterns;
pub const DateFormatRequest = struct { date: ?[]const dates.DateTimeNode = null, time: ?[]const dates.DateTimeNode = null, wrapper: []const u8 = "" };
pub const DateIntervalFormatRequest = struct { date: ?[]const dates.DateTimeNode = null, time: ?[]const dates.DateTimeNode = null, range: ?[]const dates.DateTimeNode = null, skeleton: ?[]const u8 = null, wrapper: []const u8 = "" };
fn supported(key: ?[]const u8) ?[]const u8 {
    const k = key orelse return null;
    for ([_][]const u8{ "full", "long", "medium", "short" }) |w| if (std.mem.eql(u8, w, k)) return k;
    return null;
}
pub fn managerAvailablePattern(a: A, patterns: *const p.CalendarPatterns, d: cal.CalendarDate, query: s.DateSkeleton, match: s.DateSkeleton, params: *const NumberParams) A.Error!?[]const dates.DateTimeNode {
    const pattern = try p.patternsAvailablePattern(a, patterns, d, match);
    return if (pattern.len > 0) try s.matcherAdjust(a, pattern, query, match, params.symbols.decimal) else null;
}
fn matchAvailable(a: A, patterns: *const p.CalendarPatterns, d: cal.CalendarDate, query: s.DateSkeleton, params: *const NumberParams) A.Error!?[]const dates.DateTimeNode {
    return managerAvailablePattern(a, patterns, d, query, p.patternsMatchAvailable(patterns, query), params);
}
pub fn getDateFormatRequest(a: A, data: *const LocaleData, d: cal.CalendarDate, o: opts.DateFormatOptions, params: *const NumberParams) A.Error!DateFormatRequest {
    const patterns = try getCalendarPatterns(data, internal.selectCalendar(data, o.ca));
    var dk = supported(o.datetime orelse o.date);
    const tk = supported(o.datetime orelse o.time);
    const wk = supported(o.wrap);
    const sk = o.skeleton orelse "";
    if (dk == null and tk == null and sk.len == 0) dk = "long";
    var req: DateFormatRequest = .{};
    if (wk) |w| req.wrapper = p.patternsWrapperPattern(patterns, w, o.at_time) else if (dk != null and tk != null) req.wrapper = p.patternsWrapperPattern(patterns, dk.?, o.at_time);
    if (dk) |w| req.date = try p.patternsDatePattern(a, patterns, w);
    if (tk) |w| req.time = try p.patternsTimePattern(a, patterns, w);
    if (req.date != null and req.time != null) return req;
    if ((req.date != null or req.time != null) and sk.len == 0) return req;
    var query = try p.patternsParseSkeleton(a, patterns, sk);
    if (req.date != null or req.time != null) {
        const time = try s.skeletonSplit(a, &query);
        if (req.date != null) query = time;
    }
    var dateSkel: ?s.DateSkeleton = null;
    var timeQuery: ?s.DateSkeleton = null;
    var timeSkel: ?s.DateSkeleton = null;
    if (s.skeletonCompound(query)) {
        timeQuery = try s.skeletonSplit(a, &query);
        dateSkel = p.patternsMatchAvailable(patterns, query);
        timeSkel = p.patternsMatchAvailable(patterns, timeQuery.?);
    } else if (query.is_date) dateSkel = p.patternsMatchAvailable(patterns, query) else {
        timeQuery = query;
        timeSkel = p.patternsMatchAvailable(patterns, query);
    }
    if (dateSkel) |ds| req.date = try managerAvailablePattern(a, patterns, d, query, ds, params);
    if (timeQuery != null and timeSkel != null) req.time = try managerAvailablePattern(a, patterns, d, timeQuery.?, timeSkel.?, params);
    if (wk == null) {
        if (dateSkel != null and req.date != null and req.time != null) {
            const month = s.skeletonMonthWidth(dateSkel.?);
            const key = if (month == 4) (if (s.skeletonHas(dateSkel.?, F.WEEKDAY)) "full" else "long") else if (month == 3) "medium" else "short";
            req.wrapper = p.patternsWrapperPattern(patterns, key, o.at_time);
        } else req.wrapper = p.patternsWrapperPattern(patterns, dk orelse "short", o.at_time);
    }
    return req;
}
const masked = [_]usize{ F.ERA, F.YEAR, F.MONTH, F.DAY, F.DAYPERIOD, F.HOUR, F.MINUTE, F.SECOND };
pub fn largestSkeletonField(sk: s.DateSkeleton) u8 {
    for (masked) |i| if (sk.info[i]) |info| return info.field;
    return 's';
}
pub fn maskedFOVD(data: *const LocaleData, start: cal.CalendarDate, end: cal.CalendarDate, sk: s.DateSkeleton) u8 {
    var smallest: ?s.SkeletonField = null;
    const a = &start;
    const b = &end;
    for (masked) |i| {
        const info = sk.info[i] orelse continue;
        smallest = info;
        switch (i) {
            F.ERA => if (cal.CalendarDate.era(a) != cal.CalendarDate.era(b)) {
                return 'G';
            },
            F.YEAR => if (cal.CalendarDate.year(a) != cal.CalendarDate.year(b)) {
                return 'y';
            },
            F.MONTH => if (cal.CalendarDate.month(a) != cal.CalendarDate.month(b)) {
                return 'M';
            },
            F.DAY => if (cal.CalendarDate.dayOfMonth(a) != cal.CalendarDate.dayOfMonth(b)) {
                return 'd';
            },
            F.DAYPERIOD => {
                if (info.field == 'a' or info.field == 'b') {
                    if (cal.CalendarDate.isAM(a) != cal.CalendarDate.isAM(b)) return 'a';
                } else if (info.field == 'B') {
                    const x = internal.flexDayPeriod(&data.bundle, cal.CalendarDate.hourOfDay(a) * 60 + cal.CalendarDate.minute(a)) orelse "";
                    const y = internal.flexDayPeriod(&data.bundle, cal.CalendarDate.hourOfDay(b) * 60 + cal.CalendarDate.minute(b)) orelse "";
                    if (!std.mem.eql(u8, x, y)) return 'B';
                }
            },
            F.HOUR => {
                if (info.field == 'h' or info.field == 'K') {
                    if (cal.CalendarDate.hour(a) != cal.CalendarDate.hour(b)) return 'h';
                } else if (info.field == 'H' or info.field == 'k') {
                    if (cal.CalendarDate.hourOfDay(a) != cal.CalendarDate.hourOfDay(b)) return 'H';
                }
            },
            F.MINUTE, F.SECOND => if (cal.CalendarDate.minute(a) != cal.CalendarDate.minute(b)) {
                return 'm';
            },
            else => {},
        }
    }
    return if (smallest) |v| v.field else 'm';
}
pub fn getDateIntervalFormatRequest(a: A, data: *const LocaleData, c: cal.CalendarType, start: cal.CalendarDate, end: cal.CalendarDate, o: opts.DateIntervalFormatOptions, params: *const NumberParams) A.Error!DateIntervalFormatRequest {
    const patterns = try getCalendarPatterns(data, c);
    var req: DateIntervalFormatRequest = .{ .wrapper = patterns.schema.intervalFormatFallback.get(&data.bundle) };
    const fovd = cal.CalendarDate.fieldOfVisualDifference(&start, &end) orelse 's';
    const dateDiff = std.mem.indexOfScalar(u8, "GyMd", fovd) != null;
    const timeDiff = std.mem.indexOfScalar(u8, "BahHm", fovd) != null;
    var sk = o.skeleton orelse "";
    if (sk.len == 0) sk = if (dateDiff and (o.date != null and o.date.?.len > 0)) o.date.? else o.time orelse "";
    var defaulted = false;
    if (sk.len == 0) {
        sk = if (dateDiff) "yMMMd" else "jm";
        defaulted = true;
    }
    var query = try p.patternsParseSkeleton(a, patterns, sk);
    if (!defaulted) {
        if (!o.strict and dateDiff and !query.is_date) {
            sk = try std.mem.concat(a, u8, &.{ "yMMMd", sk });
            query = try p.patternsParseSkeleton(a, patterns, sk);
        }
        const largest = largestSkeletonField(query);
        if (largest == 's' or largest == 'm') {
            sk = try std.mem.concat(a, u8, &.{ if (largest == 's') "jm" else "j", sk });
            query = try p.patternsParseSkeleton(a, patterns, sk);
        }
    }
    if (s.skeletonCompound(query)) {
        if (timeDiff) {
            const tq = try s.skeletonSplit(a, &query);
            req.date = try matchAvailable(a, patterns, start, query, params);
            query = tq;
        } else if (dateDiff) {
            req.skeleton = sk;
            return req;
        } else {
            const tq = try s.skeletonSplit(a, &query);
            req.date = try matchAvailable(a, patterns, start, query, params);
            req.time = try matchAvailable(a, patterns, start, tq, params);
            return req;
        }
    }
    if (!dateDiff and !query.is_time) {
        req.date = try matchAvailable(a, patterns, start, query, params);
        return req;
    }
    if (fovd != 's') {
        const match = p.patternsMatchInterval(patterns, query);
        if (match.skeleton.len > 0) {
            const field = maskedFOVD(data, start, end, match);
            const key = [_]u8{field};
            const raw = patterns.schema.intervalFormats.get(&data.bundle, &.{ match.skeleton, &key });
            const parsed = try dates.parseDatePattern(a, raw);
            if (parsed.len > 0) req.range = try s.matcherAdjust(a, parsed, query, match, params.symbols.decimal);
        }
    } else req.date = try matchAvailable(a, patterns, start, query, params);
    return req;
}
