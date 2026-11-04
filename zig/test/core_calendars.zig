//! Shared TypeScript calendar cases; every operation and snapshot is checked.
const std = @import("std");
const C = @import("hereabouts").core.calendars;
const Z = @import("hereabouts").core.zoneutil;
const tz = @import("hereabouts").timezone;
const cases = @import("cases");
const Value = std.json.Value;
const Allocator = std.mem.Allocator;

test {
    std.testing.refAllDecls(C);
}

fn eql(a: []const u8, b: []const u8) bool {
    return std.mem.eql(u8, a, b);
}
fn num(v: Value) f64 {
    return switch (v) {
        .integer => |n| @floatFromInt(n),
        .float => |n| n,
        else => unreachable,
    };
}
fn int(v: Value) i64 {
    return @intFromFloat(num(v));
}
fn get(v: Value, key: []const u8) Value {
    return v.object.get(key).?;
}
fn defaultInt(v: Value, key: []const u8, fallback: i64) i64 {
    return if (v.object.get(key)) |x| int(x) else fallback;
}
fn flag(v: Value, key: []const u8) bool {
    return if (v.object.get(key)) |x| x.bool else false;
}
fn fields(v: Value) C.CalendarDateFields {
    var f: C.CalendarDateFields = .{};
    inline for (std.meta.fields(C.CalendarDateFields)) |s| {
        if (v.object.get(if (comptime eql(s.name, "zone_id")) "zoneId" else s.name)) |x| {
            @field(f, s.name) = if (comptime eql(s.name, "zone_id")) x.string else int(x);
        }
    }
    return f;
}
fn make(v: Value) !C.CalendarDate {
    const cal = C.CalendarType.fromString(get(v, "cal").string).?;
    const sys = C.calendarSystem(cal);
    const fd = defaultInt(v, "fd", 1);
    const md = defaultInt(v, "md", 1);
    var generic: C.CalendarDate = undefined;
    var specific: C.CalendarDate = undefined;
    if (v.object.get("fields")) |f| {
        const fs = fields(f);
        generic = try C.CalendarDate.fromFields(tz.defaultDatabase, sys, fs, fd, md);
        specific = try switch (cal) {
            .gregory => C.gregorianDateFromFields(tz.defaultDatabase, fs, fd, md),
            .iso8601 => C.iso8601DateFromFields(tz.defaultDatabase, fs, fd, md),
            .buddhist => C.buddhistDateFromFields(tz.defaultDatabase, fs, fd, md),
            .japanese => C.japaneseDateFromFields(tz.defaultDatabase, fs, fd, md),
            .persian => C.persianDateFromFields(tz.defaultDatabase, fs, fd, md),
        };
    } else {
        const epoch = int(get(v, "epoch"));
        const z = if (v.object.get("zone")) |x| x.string else "UTC";
        generic = C.CalendarDate.fromUnixEpoch(tz.defaultDatabase, sys, epoch, z, fd, md);
        specific = switch (cal) {
            .gregory => C.gregorianDateFromUnixEpoch(tz.defaultDatabase, epoch, z, fd, md),
            .iso8601 => C.iso8601DateFromUnixEpoch(tz.defaultDatabase, epoch, z, fd, md),
            .buddhist => C.buddhistDateFromUnixEpoch(tz.defaultDatabase, epoch, z, fd, md),
            .japanese => C.japaneseDateFromUnixEpoch(tz.defaultDatabase, epoch, z, fd, md),
            .persian => C.persianDateFromUnixEpoch(tz.defaultDatabase, epoch, z, fd, md),
        };
    }
    try std.testing.expectEqualSlices(f64, &generic.field_values, &specific.field_values);
    try std.testing.expectEqual(generic.first_day, specific.first_day);
    try std.testing.expectEqual(generic.min_days, specific.min_days);
    try std.testing.expectEqualStrings(generic.zone_info.zoneid, specific.zone_info.zoneid);
    return generic;
}
fn json(a: Allocator, v: anytype) !Value {
    const s = try std.json.Stringify.valueAlloc(a, v, .{});
    return (try std.json.parseFromSlice(Value, a, s, .{})).value;
}
fn zone(a: Allocator, z: C.DateZoneInfo) !Value {
    return json(a, .{ z.zoneid, z.stableid, z.abbr, z.dst, z.offset, z.metazoneid });
}
fn weeks(d: *const C.CalendarDate) [8]i64 {
    return .{ C.CalendarDate.weekOfYear(d), C.CalendarDate.yearOfWeekOfYear(d), C.CalendarDate.weekOfYearISO(d), C.CalendarDate.yearOfWeekOfYearISO(d), C.CalendarDate.weekOfMonth(d), C.CalendarDate.ordinalDayOfWeek(d), C.CalendarDate.dayOfWeekInMonth(d), C.CalendarDate.relatedYear(d) };
}
fn snapshot(a: Allocator, d: *const C.CalendarDate) !Value {
    // Public field accessors are independently checked against the reference field array.
    inline for (.{
        .{ "dateModifiedJulianDay", C.DateField.JULIAN_DAY },
        .{ "dateEra", C.DateField.ERA },
        .{ "dateExtendedYear", C.DateField.EXTENDED_YEAR },
        .{ "dateYear", C.DateField.YEAR },
        .{ "dateMonth", C.DateField.MONTH },
        .{ "dateDayOfYear", C.DateField.DAY_OF_YEAR },
        .{ "dateDayOfMonth", C.DateField.DAY_OF_MONTH },
        .{ "dateDayOfWeek", C.DateField.DAY_OF_WEEK },
        .{ "dateHour", C.DateField.HOUR },
        .{ "dateHourOfDay", C.DateField.HOUR_OF_DAY },
        .{ "dateMinute", C.DateField.MINUTE },
        .{ "dateSecond", C.DateField.SECOND },
        .{ "dateMilliseconds", C.DateField.MILLIS },
        .{ "dateMillisecondsInDay", C.DateField.MILLIS_IN_DAY },
    }) |entry| {
        try std.testing.expectEqual(d.field_values[entry[1]], @as(f64, @floatFromInt(@field(C.CalendarDate, dateMethodName(entry[0]))(d))));
    }
    try std.testing.expectEqualStrings(d.zone_info.zoneid, C.CalendarDate.timeZoneId(d));
    try std.testing.expectEqualStrings(d.zone_info.stableid, C.CalendarDate.timeZoneStableId(d));
    try std.testing.expectEqualStrings(d.zone_info.metazoneid, C.CalendarDate.metaZoneId(d));
    try std.testing.expectEqual(d.zone_info.offset, C.CalendarDate.timeZoneOffset(d));
    return json(a, .{
        .f = d.field_values,
        .z = .{ d.zone_info.zoneid, d.zone_info.stableid, d.zone_info.abbr, d.zone_info.dst, d.zone_info.offset, d.zone_info.metazoneid },
        .fd = C.CalendarDate.firstDayOfWeek(d),
        .md = C.CalendarDate.minDaysInFirstWeek(d),
        .e = C.CalendarDate.unixEpoch(d),
        .jd = C.CalendarDate.julianDay(d),
        .type = @tagName(C.CalendarDate.type(d)),
        .df = try fieldsJson(a, C.CalendarDate.fields(d)),
        .w = weeks(d),
        .b = [8]bool{ C.CalendarDate.isAM(d), C.CalendarDate.isLeapYear(d), C.CalendarDate.isDaylightSavings(d), C.isGregorianDate(d), C.isISO8601Date(d), C.isBuddhistDate(d), C.isJapaneseDate(d), C.isPersianDate(d) },
        .s = [5][]const u8{ try C.CalendarDate.toString(d, a), try C.CalendarDate.toISOString(d, a), try C.CalendarDate.toLocalISOString(d, a), try C.CalendarDate.toDateString(d, a), try C.CalendarDate.toDateTimeString(d, a, .{ .include_zone_offset = true, .optional_milliseconds = true }) },
    });
}
fn period(v: Value) C.TimePeriod {
    var p = C.TimePeriod.init();
    for (C.TIME_PERIOD_FIELDS) |f| {
        if (v.object.get(@tagName(f))) |x| p.set(f, num(x));
    }
    return p;
}
fn periodJSON(a: Allocator, p: C.TimePeriod) !Value {
    var values: [8]f64 = undefined;
    for (C.TIME_PERIOD_FIELDS, &values) |f, *v| v.* = p.get(f);
    return json(a, values);
}
fn options(a: Allocator, v: Value) !C.DateDiffOptions {
    var o: C.DateDiffOptions = .{ .include_weeks = flag(v, "includeWeeks"), .rollup_fractional = flag(v, "rollupFractional") };
    if (v.object.get("fields")) |fs| {
        const values = try a.alloc(C.TimePeriodField, fs.array.items.len);
        for (fs.array.items, values) |x, *f| f.* = C.TimePeriodField.fromString(x.string).?;
        o.fields = values;
    }
    return o;
}
fn run(a: Allocator, name: []const u8, args: []const Value) !Value {
    if (eql(name, "zoneDatabase")) {
        const raw = args[0];
        const records = get(raw, "zoneinfo").array.items;
        const info = try a.alloc([]const u8, records.len);
        for (records, info) |v, *s| s.* = v.string;
        const db = try tz.Database.decode(a, .{ .zoneids = get(raw, "zoneids").string, .links = get(raw, "links").string, .index = get(raw, "index").string, .zoneinfo = info });
        const ids = args[1].array.items;
        const result = try a.alloc(Value, ids.len);
        for (ids, result) |id, *out| {
            const d = C.gregorianDateFromUnixEpoch(&db, 1706621400000, id.string, 1, 1);
            const values = try a.alloc(Value, 3);
            values[0] = try snapshot(a, &d);
            values[1] = try json(a, C.getStableTimeZoneId(&db, id.string));
            values[2] = try json(a, C.currentMetazone(id.string));
            out.* = .{ .array = try std.array_list.Managed(Value).initCapacity(a, 3) };
            try out.array.appendSlice(values);
        }
        return .{ .array = std.array_list.Managed(Value).fromOwnedSlice(a, result) };
    }
    if (eql(name, "timePeriod")) return periodJSON(a, C.TimePeriod.init());
    if (eql(name, "getTZC")) {
        const t = Z.getTZC(int(args[0]));
        return json(a, .{ t.offset, t.negative, t.hours, t.minutes });
    }
    if (eql(name, "zoneIds")) return json(a, .{ C.getStableTimeZoneId(tz.defaultDatabase, args[0].string), C.currentMetazone(args[0].string), C.substituteZoneAlias(args[0].string) });
    if (eql(name, "zoneInfoFromUTC")) return zone(a, C.zoneInfoFromUTC(tz.defaultDatabase, args[0].string, num(args[1])));
    if (eql(name, "era")) {
        const d = C.japaneseDateFromUnixEpoch(tz.defaultDatabase, int(args[0]), "UTC", 1, 1);
        return json(a, [3]i64{ C.CalendarDate.era(&d), C.CalendarDate.year(&d), C.CalendarDate.extendedYear(&d) });
    }
    if (eql(name, "calendarMath")) {
        const sys = C.calendarSystem(C.CalendarType.fromString(args[0].string).?);
        const y = int(args[1]);
        var days: [12]i64 = undefined;
        var starts: [12]f64 = undefined;
        for (0..12) |m| {
            days[m] = sys.days_in_month(y, @intCast(m));
            starts[m] = sys.month_start(@floatFromInt(y), @floatFromInt(m), true);
        }
        return json(a, .{ sys.days_in_year(y), days, starts, sys.month_start(@floatFromInt(y), 4.5, false) });
    }
    if (eql(name, "invalidFields")) {
        _ = make(args[0]) catch |err| return json(a, .{ .@"error" = @errorName(err) });
        return json(a, "valid");
    }
    const d = try make(args[0]);
    if (eql(name, "date")) return snapshot(a, &d);
    if (eql(name, "weeks")) return json(a, weeks(&d));
    if (eql(name, "dateAdd") or eql(name, "dateSubtract")) {
        const p = period(args[1]);
        const added = if (eql(name, "dateAdd")) try C.CalendarDate.add(&d, p) else try C.CalendarDate.subtract(&d, p);
        return snapshot(a, &added);
    }
    if (eql(name, "dateSet")) {
        const n = C.CalendarDate.set(&d, fields(args[1]));
        return snapshot(a, &n);
    }
    if (eql(name, "dateWithZone")) {
        const n = C.CalendarDate.withZone(&d, args[1].string);
        return snapshot(a, &n);
    }
    if (eql(name, "dateStartOf") or eql(name, "dateEndOf")) {
        const f = C.CalendarDateModField.fromString(args[1].string).?;
        const n = if (eql(name, "dateStartOf")) C.CalendarDate.startOf(&d, f) else C.CalendarDate.endOf(&d, f);
        return snapshot(a, &n);
    }
    if (eql(name, "dateToTimeString")) {
        return json(a, try C.CalendarDate.toTimeString(&d, a, .{
            .include_zone_id = flag(args[1], "includeZoneId"),
            .include_zone_offset = flag(args[1], "includeZoneOffset"),
            .optional_milliseconds = flag(args[1], "optionalMilliseconds"),
        }));
    }
    const other = try make(args[1]);
    if (eql(name, "dateCompare")) return json(a, C.CalendarDate.compare(&d, &other));
    if (eql(name, "dateFieldOfVisualDifference")) {
        if (C.CalendarDate.fieldOfVisualDifference(&d, &other)) |ch| return json(a, &[_]u8{ch});
        return .null;
    }
    if (eql(name, "dateRelativeTime")) {
        const f = if (args[2] == .null) null else C.TimePeriodField.fromString(args[2].string);
        const rel = C.CalendarDate.relativeTime(&d, &other, f, try options(a, args[3]));
        return json(a, .{ @tagName(rel.field), rel.value });
    }
    const o = try options(a, args[2]);
    inline for (.{ "dateUntil", "dateSince", "dateDifference", "dateDifferenceSigned" }) |fn_name| {
        if (eql(name, fn_name)) return periodJSON(a, @field(C.CalendarDate, dateMethodName(fn_name))(&d, &other, o));
    }
    std.debug.print("unknown operation {s}\n", .{name});
    return error.UnknownOperation;
}
fn check(want: Value, got: Value) error{Mismatch}!void {
    if ((want == .integer or want == .float) and (got == .integer or got == .float)) {
        if (num(want) == num(got)) return;
    } else if (want == .array and got == .array) {
        if (want.array.items.len == got.array.items.len) {
            for (want.array.items, got.array.items, 0..) |w, g, i| {
                check(w, g) catch |err| {
                    std.debug.print(" at [{d}]", .{i});
                    return err;
                };
            }
            return;
        }
    } else if (want == .object and got == .object) {
        if (want.object.count() == got.object.count()) {
            var it = want.object.iterator();
            while (it.next()) |e| {
                const g = got.object.get(e.key_ptr.*) orelse break;
                check(e.value_ptr.*, g) catch |err| {
                    std.debug.print(" at .{s}", .{e.key_ptr.*});
                    return err;
                };
            } else return;
        }
    } else if (want == .string and got == .string and eql(want.string, got.string)) return else if (want == .bool and got == .bool and want.bool == got.bool) return else if (want == .null and got == .null) return;
    std.debug.print("\n    want {f}, got {f}", .{ std.json.fmt(want, .{}), std.json.fmt(got, .{}) });
    return error.Mismatch;
}

test "core-calendars conformance" {
    const gpa = std.testing.allocator;
    const parsed = try std.json.parseFromSlice(Value, gpa, cases.json, .{});
    defer parsed.deinit();
    var failures: usize = 0;
    const all = parsed.value.array.items;
    for (all, 0..) |c, i| {
        var arena = std.heap.ArenaAllocator.init(gpa);
        defer arena.deinit();
        const name = get(c, "fn").string;
        const args = get(c, "args");
        const got = run(arena.allocator(), name, args.array.items) catch |err| {
            failures += 1;
            if (failures <= 25) std.debug.print("\ncase {d} {s}: {s}, args {f}\n", .{ i, name, @errorName(err), std.json.fmt(args, .{}) });
            continue;
        };
        // After 25 failures remain strict, but keep output compact.
        if (failures < 25) {
            check(get(c, "result"), got) catch {
                failures += 1;
                std.debug.print("\ncase {d} {s}, args {f}\n", .{ i, name, std.json.fmt(args, .{}) });
            };
        } else {
            if (!same(get(c, "result"), got)) failures += 1;
        }
    }
    std.debug.print("\ncore-calendars: {d}/{d} cases passed\n", .{ all.len - failures, all.len });
    try std.testing.expectEqual(@as(usize, 0), failures);
}
fn same(w: Value, g: Value) bool {
    if ((w == .integer or w == .float) and (g == .integer or g == .float)) return num(w) == num(g);
    if (w == .null and g == .null) return true;
    if (w == .bool and g == .bool) return w.bool == g.bool;
    if (w == .string and g == .string) return eql(w.string, g.string);
    if (w == .array and g == .array and w.array.items.len == g.array.items.len) {
        for (w.array.items, g.array.items) |a, b| if (!same(a, b)) return false;
        return true;
    }
    if (w == .object and g == .object and w.object.count() == g.object.count()) {
        var it = w.object.iterator();
        while (it.next()) |e| if (!same(e.value_ptr.*, g.object.get(e.key_ptr.*) orelse return false)) return false;
        return true;
    }
    return false;
}

test "calendar strings have caller ownership; invalid fields return errors" {
    const gpa = std.testing.allocator;
    for (std.enums.values(C.CalendarType)) |t| {
        const d = C.CalendarDate.fromUnixEpoch(tz.defaultDatabase, C.calendarSystem(t), 1762074000123, "America/Vancouver", 1, 1);
        const changed = try C.CalendarDate.add(&d, .{ .month = 1, .day = -2, .hour = 3 });
        _ = try C.CalendarDate.subtract(&changed, .{ .millis = 0.7 });
        const one = try C.CalendarDate.toString(&d, gpa);
        defer gpa.free(one);
        const two = try C.CalendarDate.toISOString(&d, gpa);
        defer gpa.free(two);
        const three = try C.CalendarDate.toLocalISOString(&d, gpa);
        defer gpa.free(three);
        const four = try C.CalendarDate.toDateString(&d, gpa);
        defer gpa.free(four);
        const five = try C.CalendarDate.toTimeString(&d, gpa, .{});
        defer gpa.free(five);
        const six = try C.CalendarDate.toDateTimeString(&d, gpa, .{});
        defer gpa.free(six);
        _ = C.CalendarDate.until(&d, &changed, .{});
    }
    try std.testing.expectError(error.InvalidFields, C.japaneseDateFromFields(tz.defaultDatabase, .{}, 1, 1));
    try std.testing.expectError(error.InvalidFields, C.iso8601DateFromFields(tz.defaultDatabase, .{ .month = 1 }, 1, 1));
    const d = C.gregorianDateFromUnixEpoch(tz.defaultDatabase, 0, "UTC", 1, 1);
    try std.testing.expectError(error.InvalidDate, C.CalendarDate.add(&d, .{ .hour = std.math.inf(f64) }));
}

fn dateMethodName(comptime name: []const u8) []const u8 {
    return std.fmt.comptimePrint("{c}{s}", .{ std.ascii.toLower(name[4]), name[5..] });
}

fn fieldsJson(a: Allocator, f: C.CalendarDateFields) !Value {
    return json(a, .{ .year = f.year, .month = f.month, .day = f.day, .hour = f.hour, .minute = f.minute, .second = f.second, .millis = f.millis, .zoneId = f.zone_id });
}
