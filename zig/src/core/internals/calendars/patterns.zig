//! Locale calendar patterns and the two best-fit matchers. Cached for the locale's lifetime.
const std = @import("std");
const A = std.mem.Allocator;
const LocaleData = @import("../../locale_data.zig").LocaleData;
const CalendarType = @import("../../systems/calendars/types.zig").CalendarType;
const CalendarSchema = @import("../../types/schema.zig").CalendarSchema;
const cal = @import("../../systems/calendars/calendars.zig");
const decimal = @import("../../../decimal/decimal.zig");
const plurals = @import("../../../plurals/plurals.zig");
const dates = @import("../../parsing/date.zig");
const s = @import("skeleton.zig");
const internal = @import("internal.zig");
pub const CalendarPatterns = struct {
    data: *const LocaleData,
    schema: *const CalendarSchema,
    gregorian: bool,
    skeletonParser: s.DateSkeletonParser,
    availableMatcher: s.DatePatternMatcher,
    intervalMatcher: s.DatePatternMatcher,
};
fn eq(a: []const u8, b: []const u8) bool {
    return std.mem.eql(u8, a, b);
}
pub fn timeDataFor(a: A, language: []const u8, region: []const u8) A.Error![2][]const u8 {
    const table = @import("autogen.dates.zig").time_data;
    const key = try std.fmt.allocPrint(a, "{s}:{s}", .{ language, region });
    const region_key = try std.fmt.allocPrint(a, ":{s}", .{region});
    const raw = table.get(key) orelse table.get(region_key) orelse table.get(":001").?;
    const i = std.mem.indexOfScalar(u8, raw, '|').?;
    return .{ raw[0..i], raw[i + 1 ..] };
}
pub fn buildSkeletonParser(a: A, language: []const u8, region: []const u8) A.Error!s.DateSkeletonParser {
    const pair = try timeDataFor(a, language, region);
    const end = std.mem.indexOfScalar(u8, pair[0], ' ') orelse pair[0].len;
    return .{ .preferredFlex = try dates.parseDatePattern(a, pair[1]), .allowedFlex = try dates.parseDatePattern(a, pair[0][0..end]) };
}
fn build(c: CalendarType, data: *const LocaleData, a: A) A.Error!CalendarPatterns {
    return calendarPatterns(a, data, internal.calendarSchema(data, c), c == .gregory);
}
/// Build patterns for an explicit calendar schema. `a` must be an arena.
pub fn calendarPatterns(a: A, data: *const LocaleData, schema: *const CalendarSchema, gregorian: bool) A.Error!CalendarPatterns {
    var p: CalendarPatterns = .{ .data = data, .schema = schema, .gregorian = gregorian, .skeletonParser = try buildSkeletonParser(a, data.bundle.language, data.bundle.region), .availableMatcher = .{}, .intervalMatcher = .{} };
    const b = &data.bundle;
    // Key order comes from the schema (matching JS vectorMapping's insertion order).
    for (p.schema.dateFormats.keysets[0].keys) |w| {
        if (p.schema.dateFormats.get(b, &.{w}).len == 0) continue;
        var ds = try s.skeletonParse(a, p.skeletonParser, p.schema.dateFormats.get(b, &.{w}), true);
        const dk = p.schema.dateSkeletons.get(b, &.{w});
        if (dk.len > 0) ds.skeleton = dk;
        try s.matcherAdd(a, &p.availableMatcher, ds);
        var ts = try s.skeletonParse(a, p.skeletonParser, p.schema.timeFormats.get(b, &.{w}), true);
        const tk = p.schema.timeSkeletons.get(b, &.{w});
        if (tk.len > 0) ts.skeleton = tk;
        try s.matcherAdd(a, &p.availableMatcher, ts);
    }
    for (p.schema.availableFormats.keysets[0].keys) |k| {
        if (p.schema.availableFormats.get(b, &.{k}).len > 0) try s.matcherAdd(a, &p.availableMatcher, try s.skeletonParse(a, p.skeletonParser, k, false));
    }
    for (p.schema.pluralFormats.keysets[1].keys) |k| {
        if (p.schema.pluralFormats.get(b, &.{ "other", k }).len > 0) try s.matcherAdd(a, &p.availableMatcher, try s.skeletonParse(a, p.skeletonParser, k, false));
    }
    s.matcherSort(&p.availableMatcher);
    for (p.schema.intervalFormats.keysets[0].keys) |k| {
        var exists = false;
        for (p.schema.intervalFormats.keysets[1].keys) |f| if (p.schema.intervalFormats.get(b, &.{ k, f }).len > 0) {
            exists = true;
            break;
        };
        if (exists) try s.matcherAdd(a, &p.intervalMatcher, try s.skeletonParse(a, p.skeletonParser, k, false));
    }
    s.matcherSort(&p.intervalMatcher);
    return p;
}
pub fn getCalendarPatterns(data: *const LocaleData, c: CalendarType) A.Error!*const CalendarPatterns {
    const calendar: CalendarType = switch (c) {
        .iso8601 => .gregory,
        else => c,
    };
    return data.cached(CalendarPatterns, .{ .calendar = calendar }, c, build);
}
pub fn patternsDatePattern(a: A, p: *const CalendarPatterns, width: []const u8) A.Error![]const dates.DateTimeNode {
    return dates.parseDatePattern(a, p.schema.dateFormats.get(&p.data.bundle, &.{width}));
}
pub fn patternsTimePattern(a: A, p: *const CalendarPatterns, width: []const u8) A.Error![]const dates.DateTimeNode {
    return dates.parseDatePattern(a, p.schema.timeFormats.get(&p.data.bundle, &.{width}));
}
pub fn patternsWrapperPattern(p: *const CalendarPatterns, width: []const u8, at_time: bool) []const u8 {
    const w = p.schema.dateTimeFormatsAt.get(&p.data.bundle, &.{width});
    return if (at_time and w.len > 0) w else p.schema.dateTimeFormats.get(&p.data.bundle, &.{width});
}
pub fn patternsAvailablePattern(a: A, p: *const CalendarPatterns, d: cal.CalendarDate, sk: s.DateSkeleton) A.Error![]const dates.DateTimeNode {
    var raw = sk.pattern orelse "";
    if (raw.len == 0) {
        if (p.gregorian and (eq(sk.skeleton, "MMMMW") or eq(sk.skeleton, "yw"))) {
            const n = try decimal.fromInt(a, if (eq(sk.skeleton, "yw")) cal.dateWeekOfYear(&d) else cal.dateWeekOfMonth(&d));
            const plural = plurals.cardinal(p.data.bundle.plurals, n, 0).name();
            raw = p.schema.pluralFormats.get(&p.data.bundle, &.{ plural, sk.skeleton });
        } else {
            raw = p.schema.availableFormats.get(&p.data.bundle, &.{sk.skeleton});
            if (raw.len == 0 and !p.gregorian) raw = p.schema.pluralFormats.get(&p.data.bundle, &.{ "other", sk.skeleton });
        }
    }
    return dates.parseDatePattern(a, raw);
}
pub const patternsAdjust = s.matcherAdjust;
pub fn patternsMatchAvailable(p: *const CalendarPatterns, sk: s.DateSkeleton) s.DateSkeleton {
    return s.matcherMatch(p.availableMatcher, sk);
}
pub fn patternsMatchInterval(p: *const CalendarPatterns, sk: s.DateSkeleton) s.DateSkeleton {
    return s.matcherMatch(p.intervalMatcher, sk);
}
pub fn patternsParseSkeleton(a: A, p: *const CalendarPatterns, raw: []const u8) A.Error!s.DateSkeleton {
    return s.skeletonParse(a, p.skeletonParser, raw, false);
}
pub fn patternsDayPeriods(a: A, p: *const CalendarPatterns) A.Error!std.json.Value {
    return p.schema.standAlone.dayPeriods.mapping(a, &p.data.bundle);
}
pub fn patternsEras(a: A, p: *const CalendarPatterns) A.Error!std.json.Value {
    return p.schema.eras.mapping(a, &p.data.bundle);
}
pub fn patternsMonths(a: A, p: *const CalendarPatterns) A.Error!std.json.Value {
    return p.schema.standAlone.months.mapping(a, &p.data.bundle);
}
pub fn patternsWeekdays(a: A, p: *const CalendarPatterns) A.Error!std.json.Value {
    return p.schema.standAlone.weekdays.mapping(a, &p.data.bundle);
}
pub fn patternsQuarters(a: A, p: *const CalendarPatterns) A.Error!std.json.Value {
    return p.schema.standAlone.quarters.mapping(a, &p.data.bundle);
}
/// This helper preserves the TypeScript's argument order, despite the interval schema's order.
pub fn patternsIntervalPattern(a: A, p: *const CalendarPatterns, field: []const u8, skeleton: []const u8) A.Error![]const dates.DateTimeNode {
    return dates.parseDatePattern(a, p.schema.intervalFormats.get(&p.data.bundle, &.{ field, skeleton }));
}
pub fn patternsIntervalFallback(p: *const CalendarPatterns) []const u8 {
    return p.schema.intervalFormatFallback.get(&p.data.bundle);
}
pub fn patternsTimeData(a: A, p: *const CalendarPatterns) A.Error![2][]const u8 {
    return timeDataFor(a, p.data.bundle.language, p.data.bundle.region);
}
