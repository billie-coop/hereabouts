const std = @import("std");
const h = @import("hereabouts");
const cases = @import("cases");
const packs = @import("packs");

test "embedded locale packs" {
    _ = h;
    _ = cases.json;
    try std.testing.expect(packs.get("en") != null);
}

const core = h.core;
const api = core.dates;
const opt = core.date_options;
const V = std.json.Value;
const A = std.mem.Allocator;
fn eq(a: []const u8, b: []const u8) bool {
    return std.mem.eql(u8, a, b);
}
fn val(a: A, v: anytype) !V {
    return (try std.json.parseFromSlice(V, a, try std.json.Stringify.valueAlloc(a, v, .{}), .{})).value;
}
fn string(s: []const u8) V {
    return .{ .string = s };
}
fn number(v: V) f64 {
    return switch (v) {
        .integer => |n| @floatFromInt(n),
        .float => |n| n,
        else => unreachable,
    };
}
fn int(v: V) i64 {
    return @intFromFloat(number(v));
}
fn get(v: V, key: []const u8) ?V {
    return if (v == .object) v.object.get(key) else null;
}
fn snake(key: []const u8) []const u8 {
    const table = std.StaticStringMap([]const u8).initComptime(.{
        .{ "atTime", "at_time" },                                .{ "dayPeriod", "day_period" },                                .{ "numericOnly", "numeric_only" },                            .{ "alwaysNow", "always_now" },
        .{ "dayOfWeek", "day_of_week" },                         .{ "allowWeeks", "allow_weeks" },                              .{ "minimumIntegerDigits", "minimum_integer_digits" },         .{ "maximumFractionDigits", "maximum_fraction_digits" },
        .{ "minimumFractionDigits", "minimum_fraction_digits" }, .{ "maximumSignificantDigits", "maximum_significant_digits" }, .{ "minimumSignificantDigits", "minimum_significant_digits" },
    });
    return table.get(key) orelse key;
}
fn fill(comptime T: type, v: V) T {
    var o: T = .{};
    if (v != .object) return o;
    var it = v.object.iterator();
    while (it.next()) |e| {
        const key = snake(e.key_ptr.*);
        const x = e.value_ptr.*;
        if (x == .null) continue;
        inline for (std.meta.fields(T)) |f| if (eq(key, f.name)) {
            const C = switch (@typeInfo(f.type)) {
                .optional => |c| c.child,
                else => f.type,
            };
            switch (@typeInfo(C)) {
                .bool => @field(o, f.name) = x.bool,
                .int => @field(o, f.name) = @intCast(int(x)),
                .pointer => @field(o, f.name) = x.string,
                .@"enum" => {
                    if (C == core.types.general.ContextType) @field(o, f.name) = C.fromString(x.string) orelse unreachable else @field(o, f.name) = std.meta.stringToEnum(C, x.string) orelse unreachable;
                },
                .@"struct" => @field(o, f.name) = fill(C, x),
                else => unreachable,
            }
        };
    }
    return o;
}
fn input(data: *const core.LocaleData, v: V) api.DateInput {
    const c = get(v, "cal");
    const d: api.DateInput = .{ .zoned = .{ .date = number(get(v, "epoch").?), .zone_id = get(v, "zone").?.string } };
    return if (c) |cval| .{ .calendar = api.toCalendarDate(data, core.calendars.CalendarType.fromString(cval.string).?, d) } else d;
}
fn day(v: V) h.datetime.Day {
    return .{ .year = @intCast(int(get(v, "year").?)), .month = @intCast(int(get(v, "month").?)), .day = @intCast(int(get(v, "day").?)) };
}
fn time(v: V) h.datetime.TimeOfDay {
    return .{ .hour = @intCast(int(get(v, "hour").?)), .minute = @intCast(int(get(v, "minute").?)), .second = @intCast(int(get(v, "second").?)), .millis = @intCast(int(get(v, "millis").?)) };
}
fn parts(a: A, v: V) ![]h.decimal.Part {
    const out = try a.alloc(h.decimal.Part, v.array.items.len);
    for (out, v.array.items) |*p, x| p.* = .{ .type = get(x, "type").?.string, .value = get(x, "value").?.string };
    return out;
}
fn nodes(a: A, pattern: []const core.parsing.date.DateTimeNode) !V {
    var out: std.array_list.Managed(V) = .init(a);
    for (pattern) |n| switch (n) {
        .text => |s| try out.append(string(s)),
        .field => |f| {
            const ch = try a.dupe(u8, &.{f.char});
            var pair: std.array_list.Managed(V) = .init(a);
            try pair.append(string(ch));
            try pair.append(.{ .integer = @intCast(f.width) });
            try out.append(.{ .array = pair });
        },
    };
    return .{ .array = out };
}
fn run(a: A, fw: *core.Framework, name: []const u8, args: []const V) !V {
    if (eq(name, "resolveZone")) return if (api.resolveTimeZoneId(h.timezone.defaultDatabase, args[0].string)) |s| string(s) else .null;
    if (eq(name, "zoneUTC")) return val(a, api.timeZoneFromUTC(h.timezone.defaultDatabase, int(args[0]), args[1].string));
    if (eq(name, "zoneWall")) {
        const r = api.timeZoneFromWall(h.timezone.defaultDatabase, int(args[0]), args[1].string) orelse return .null;
        var array: std.array_list.Managed(V) = .init(a);
        try array.append(try val(a, r.utc));
        try array.append(try val(a, r.info));
        return .{ .array = array };
    }
    if (eq(name, "zoneIds")) return val(a, api.timeZoneIds(h.timezone.defaultDatabase));
    if (eq(name, "quantity")) {
        var p: core.calendars.TimePeriod = .{};
        inline for (std.meta.fields(@TypeOf(p))) |f| {
            if (get(args[0], f.name)) |v| @field(p, f.name) = number(v);
        }
        var array: std.array_list.Managed(V) = .init(a);
        for (try api.timePeriodToQuantity(a, p)) |q| try array.append(try val(a, .{ .unit = q.unit, .value = try h.decimal.toString(a, q.value) }));
        return .{ .array = array };
    }
    if (eq(name, "parse")) {
        const pattern = try core.parsing.date.parseDatePattern(a, args[0].string);
        var out: std.json.ObjectMap = .empty;
        try out.put(a, "nodes", try nodes(a, pattern));
        try out.put(a, "boundary", .{ .integer = if (core.parsing.date.intervalPatternBoundary(pattern)) |i| @intCast(i) else -1 });
        return .{ .object = out };
    }
    if (eq(name, "fieldType")) {
        const row = core.internals.calendars.fields.getFieldType(args[0].string[0], @intCast(int(args[1]))) orelse return .null;
        var out: std.array_list.Managed(V) = .init(a);
        try out.append(string(try a.dupe(u8, &.{row.char})));
        for ([_]i64{ @intCast(row.field), row.sub, @intCast(row.repeat), @intCast(row.width) }) |n| try out.append(.{ .integer = n });
        return .{ .array = out };
    }
    const data_handle = try fw.loadLocale(.{ .id = args[0].string });

    defer data_handle.deinit();

    const data = data_handle.data();
    if (eq(name, "convert") or eq(name, "newDate") or eq(name, "now")) {
        const c = core.calendars.CalendarType.fromString(args[1].string).?;
        const d: core.calendars.CalendarDate = if (eq(name, "convert")) blk: {
            const in = input(data, args[2]);
            break :blk switch (c) {
                .gregory => api.toGregorianDate(data, in),
                .buddhist => api.toBuddhistDate(data, in),
                .iso8601 => api.toISO8601Date(data, in),
                .japanese => api.toJapaneseDate(data, in),
                .persian => api.toPersianDate(data, in),
            };
        } else if (eq(name, "newDate")) blk: {
            var f = fill(core.calendars.CalendarDateFields, args[2]);
            if (get(args[2], "zoneId")) |z| f.zone_id = z.string;
            break :blk try switch (c) {
                .gregory => api.newGregorianDate(data, f),
                .buddhist => api.newBuddhistDate(data, f),
                .iso8601 => api.newISO8601Date(data, f),
                .japanese => api.newJapaneseDate(data, f),
                .persian => api.newPersianDate(data, f),
            };
        } else switch (c) {
            .gregory => api.nowGregorian(std.testing.io, data, args[2].string),
            .buddhist => api.nowBuddhist(std.testing.io, data, args[2].string),
            .iso8601 => api.nowISO8601(std.testing.io, data, args[2].string),
            .japanese => api.nowJapanese(std.testing.io, data, args[2].string),
            .persian => api.nowPersian(std.testing.io, data, args[2].string),
        };
        if (eq(name, "now")) return val(a, .{ .type = @tagName(core.calendars.CalendarDate.type(&d)), .first = d.first_day, .min = d.min_days, .zone = d.zone_info.zoneid });
        return val(a, .{ .type = @tagName(core.calendars.CalendarDate.type(&d)), .fields = d.field_values, .first = d.first_day, .min = d.min_days, .zone = d.zone_info.zoneid });
    }
    if (eq(name, "fovd")) return if (api.fieldOfVisualDifference(data, input(data, args[1]), input(data, args[2]))) |ch| string(try a.dupe(u8, &.{ch})) else .null;
    if (eq(name, "maskedFovd")) {
        const p = try core.internals.calendars.patterns.getCalendarPatterns(data, .gregory);
        const sk = try core.internals.calendars.patterns.patternsParseSkeleton(a, p, args[3].string);
        const start = api.toGregorianDate(data, input(data, args[1]));
        const end = api.toGregorianDate(data, input(data, args[2]));
        return val(a, .{ .largest = try a.dupe(u8, &.{core.internals.calendars.manager.largestSkeletonField(sk)}), .field = try a.dupe(u8, &.{core.internals.calendars.manager.maskedFOVD(data, start, end, sk)}) });
    }
    if (eq(name, "settings")) return val(a, .{ .first = api.firstDayOfWeek(data), .min = api.minDaysInFirstWeek(data), .calendar = @tagName(core.internals.calendars.internal.selectCalendar(data, null)), .time = try api.timeData(a, data) });
    if (eq(name, "skeleton")) {
        const p = try core.internals.calendars.patterns.getCalendarPatterns(data, .gregory);
        var sk = try core.internals.calendars.skeletons.skeletonParse(a, p.skeleton_parser, args[1].string, args[2].bool);
        const canon = try core.internals.calendars.skeletons.skeletonCanonical(a, sk);
        const match = core.internals.calendars.patterns.patternsMatchAvailable(p, sk).skeleton;
        const interval = core.internals.calendars.patterns.patternsMatchInterval(p, sk).skeleton;
        const ts = try core.internals.calendars.skeletons.skeletonSplit(a, &sk);
        return val(a, .{ .canonical = canon, .match = match, .interval = interval, .date = sk.skeleton, .time = ts.skeleton, .dateType = sk.type, .timeType = ts.type });
    }
    if (eq(name, "format")) return string(try api.formatDate(a, data, input(data, args[1]), fill(opt.DateFormatOptions, args[2])));
    if (eq(name, "parts")) return val(a, try api.formatDateToParts(a, data, input(data, args[1]), fill(opt.DateFormatOptions, args[2])));
    if (eq(name, "raw")) return string(try api.formatDateRaw(a, data, input(data, args[1]), fill(opt.DateRawFormatOptions, args[2])));
    if (eq(name, "rawParts")) return val(a, try api.formatDateRawToParts(a, data, input(data, args[1]), fill(opt.DateRawFormatOptions, args[2])));
    if (eq(name, "interval")) return string(try api.formatDateInterval(a, data, input(data, args[1]), input(data, args[2]), fill(opt.DateIntervalFormatOptions, args[3])));
    if (eq(name, "intervalParts")) return val(a, try api.formatDateIntervalToParts(a, data, input(data, args[1]), input(data, args[2]), fill(opt.DateIntervalFormatOptions, args[3])));
    if (eq(name, "relativeField")) return string(try api.formatRelativeTimeField(a, data, try h.decimal.parse(a, args[1].string), args[2].string, fill(opt.RelativeTimeFieldFormatOptions, args[3])));
    if (eq(name, "relative")) return string(try api.formatRelativeTime(a, data, input(data, args[1]), input(data, args[2]), fill(opt.RelativeTimeFormatOptions, args[3])));
    if (eq(name, "months")) return (try api.months(a, data, fill(opt.CalendarFieldsOptions, args[1]))).value;
    if (eq(name, "weekdays")) return (try api.weekdays(a, data, fill(opt.CalendarFieldsOptions, args[1]))).value;
    if (eq(name, "quarters")) return (try api.quarters(a, data, fill(opt.CalendarFieldsOptions, args[1]))).value;
    if (eq(name, "dayPeriods")) return (try api.dayPeriods(a, data, fill(opt.CalendarFieldsOptions, args[1]))).value;
    if (eq(name, "eras")) return (try api.eras(a, data, fill(opt.EraFieldOptions, args[1]))).value;
    if (eq(name, "zoneInfo")) return val(a, api.timeZoneInfo(data, args[1].string));
    if (eq(name, "wrapper")) return string(try api.formatDateWrapper(a, data, args[1].string, args[2].string, fill(opt.DateWrapperFormatOptions, args[3])));
    if (eq(name, "wrapperParts")) return val(a, try api.formatDateWrapperToParts(a, data, try parts(a, args[1]), try parts(a, args[2]), fill(opt.DateWrapperFormatOptions, args[3])));
    if (eq(name, "dateField")) return string(try api.dateField(a, data, args[1].string, fill(opt.DateFieldFormatOptions, args[2])));
    if (eq(name, "dayPeriodRule")) return if (core.internals.calendars.internal.flexDayPeriod(&data.bundle, int(args[1]))) |s| string(s) else .null;
    const days = core.days;
    if (eq(name, "day")) return string(try days.formatDay(a, data, day(args[1]), fill(days.DayFormatOptions, args[2])));
    if (eq(name, "dayParts")) return val(a, try days.formatDayToParts(a, data, day(args[1]), fill(days.DayFormatOptions, args[2])));
    if (eq(name, "dayInterval")) return string(try days.formatDayInterval(a, data, day(args[1]), day(args[2]), fill(days.DayIntervalFormatOptions, args[3])));
    if (eq(name, "dayIntervalParts")) return val(a, try days.formatDayIntervalToParts(a, data, day(args[1]), day(args[2]), fill(days.DayIntervalFormatOptions, args[3])));
    if (eq(name, "tod")) return string(try days.formatTimeOfDay(a, data, time(args[1]), fill(days.TimeOfDayFormatOptions, args[2])));
    if (eq(name, "todParts")) return val(a, try days.formatTimeOfDayToParts(a, data, time(args[1]), fill(days.TimeOfDayFormatOptions, args[2])));
    if (eq(name, "dayRelative")) return string(try days.formatDayRelative(a, data, day(args[1]), day(args[2]), fill(opt.RelativeTimeFieldFormatOptions, args[3])));
    if (eq(name, "instant")) return string(try days.formatInstant(a, data, int(args[1]), args[2].string, fill(opt.DateFormatOptions, args[3])));
    if (eq(name, "instantParts")) return val(a, try days.formatInstantToParts(a, data, int(args[1]), args[2].string, fill(opt.DateFormatOptions, args[3])));
    if (eq(name, "instantRelative")) return string(try days.formatInstantRelative(a, data, int(args[1]), int(args[2]), args[3].string, fill(opt.RelativeTimeFormatOptions, args[4])));
    return error.UnknownFunction;
}
fn jsonEql(a: V, b: V) bool {
    return switch (a) {
        .object => |o| blk: {
            if (b != .object or o.count() != b.object.count()) break :blk false;
            var it = o.iterator();
            while (it.next()) |e| if (!jsonEql(e.value_ptr.*, b.object.get(e.key_ptr.*) orelse break :blk false)) {
                break :blk false;
            };
            break :blk true;
        },
        .array => |o| blk: {
            if (b != .array or o.items.len != b.array.items.len) break :blk false;
            for (o.items, b.array.items) |x, y| if (!jsonEql(x, y)) {
                break :blk false;
            };
            break :blk true;
        },
        .string => |s| b == .string and eq(s, b.string),
        .integer, .float => (b == .integer or b == .float) and number(a) == number(b),
        .bool => |x| b == .bool and x == b.bool,
        .null => b == .null,
        else => false,
    };
}
test "all shared date cases" {
    const a = std.testing.allocator;
    var fw = core.Framework.init(a, .{ .loader = .{ .load = struct {
        fn load(_: ?*anyopaque, language: []const u8) ?[]const u8 {
            return packs.get(language);
        }
    }.load } });
    defer fw.deinit();
    const parsed = try std.json.parseFromSlice(V, a, cases.json, .{});
    defer parsed.deinit();
    var failures: usize = 0;
    for (parsed.value.array.items, 0..) |c, i| {
        var arena: std.heap.ArenaAllocator = .init(a);
        defer arena.deinit();
        const temp = arena.allocator();
        const name = get(c, "fn").?.string;
        const want = get(c, "result").?;
        const args = get(c, "args").?;
        const got = run(temp, &fw, name, args.array.items) catch |err| {
            if (get(want, "error") != null) continue;
            if (failures < 25) std.debug.print("case {d} {s}: error {s}\n", .{ i, name, @errorName(err) });
            failures += 1;
            continue;
        };
        if (!jsonEql(want, got)) {
            if (failures < 25) std.debug.print("case {d} {s} args {s}\n want {s}\n got  {s}\n", .{ i, name, try std.json.Stringify.valueAlloc(temp, args, .{}), try std.json.Stringify.valueAlloc(temp, want, .{}), try std.json.Stringify.valueAlloc(temp, got, .{}) });
            failures += 1;
        }
    }
    if (failures > 0) std.debug.print("{d}/{d} date cases failed\n", .{ failures, parsed.value.array.items.len });
    try std.testing.expectEqual(@as(usize, 0), failures);
}

test "date API compilation and ownership" {
    const a = std.testing.allocator;
    var fw = h.core.Framework.init(a, .{ .loader = .{ .load = struct {
        fn load(_: ?*anyopaque, language: []const u8) ?[]const u8 {
            return packs.get(language);
        }
    }.load } });
    defer fw.deinit();
    const data_handle = try fw.loadLocale(.{ .id = "en" });

    defer data_handle.deinit();

    const data = data_handle.data();
    const d: h.core.dates.DateInput = .{ .zoned = .{ .date = 1554263155123, .zone_id = "America/New_York" } };
    const text = try h.core.dates.formatDate(a, data, d, null);
    defer a.free(text);
    try std.testing.expect(text.len > 0);
    const raw = try h.core.dates.formatDateRawToParts(a, data, d, .{ .pattern = "G y Y u U r Q q M L w W d D F g E e c a b B h H K k m s S A z Z O v V X x" });
    defer h.decimal.freeParts(a, raw);
    const interval = try h.core.dates.formatDateInterval(a, data, d, .{ .zoned = .{ .date = 1554597755123 } }, null);
    defer a.free(interval);
    var arena: std.heap.ArenaAllocator = .init(a);
    defer arena.deinit();
    const relative = try h.core.dates.formatRelativeTimeField(a, data, try h.decimal.parse(arena.allocator(), "-2"), "day", null);
    defer a.free(relative);
    const rt = try h.core.dates.formatRelativeTime(a, data, d, .{ .zoned = .{ .date = 1554597755123 } }, null);
    defer a.free(rt);
    var months = try h.core.dates.months(a, data, null);
    defer months.deinit();
    var eras = try h.core.dates.eras(a, data, null);
    defer eras.deinit();
    const day_text = try h.core.days.formatDay(a, data, .{ .year = 2026, .month = 1, .day = 31 }, null);
    defer a.free(day_text);
    const tod = try h.core.days.formatTimeOfDay(a, data, .{ .hour = 18, .minute = 30, .second = 0, .millis = 0 }, null);
    defer a.free(tod);
    _ = h.core.dates.timeZoneInfo(data, "America/New_York");
    _ = try h.core.dates.timePeriodToQuantity(arena.allocator(), .{ .year = 1, .millis = 2 });
    const parsed = try core.parsing.date.parseDatePattern(a, "yyyy 'o''clock' '' MM");
    defer core.parsing.date.freePattern(a, parsed);
    const time_data = try api.timeData(a, data);
    defer a.free(time_data.allowed);
    const default_text = try api.formatDate(a, data, d, null);
    defer a.free(default_text);
    const empty_options = try api.formatDate(a, data, d, .{});
    defer a.free(empty_options);
    try std.testing.expectEqualStrings("Tuesday, April 2, 2019", default_text);
    try std.testing.expectEqualStrings("April 2, 2019", empty_options);
    const clock = api.now(std.testing.io, data, "UTC");
    try std.testing.expectEqual(.gregory, core.calendars.CalendarDate.type(&clock));
    const p = try core.internals.calendars.patterns.calendarPatterns(arena.allocator(), data, &data.schema.Buddhist, false);
    try std.testing.expect((try core.internals.calendars.patterns.patternsMonths(arena.allocator(), &p)) == .object);
    try std.testing.expect((try core.internals.calendars.patterns.patternsWeekdays(arena.allocator(), &p)) == .object);
    try std.testing.expect((try core.internals.calendars.patterns.patternsQuarters(arena.allocator(), &p)) == .object);
    try std.testing.expect((try core.internals.calendars.patterns.patternsEras(arena.allocator(), &p)) == .object);
    try std.testing.expect((try core.internals.calendars.patterns.patternsDayPeriods(arena.allocator(), &p)) == .object);
    try std.testing.expectEqual(@as(usize, 0), (try core.internals.calendars.patterns.patternsIntervalPattern(arena.allocator(), &p, "x", "xyz")).len);
    try std.testing.expect(core.internals.calendars.patterns.patternsIntervalFallback(&p).len > 0);
    try std.testing.expect((try core.internals.calendars.patterns.patternsTimeData(arena.allocator(), &p))[0].len > 0);
    try std.testing.expect(core.internals.calendars.internal.getCalendarFormatter(data, .buddhist).cal == &data.schema.Buddhist);
}
