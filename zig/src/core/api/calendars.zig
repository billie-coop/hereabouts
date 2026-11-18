//! Locale-aware calendar formatting. Allocated strings and parts belong to the caller.
const std = @import("std");
const A = std.mem.Allocator;
const LocaleData = @import("../locale_data.zig").LocaleData;
const cal = @import("../systems/calendars/calendars.zig");
const o = @import("../common/calendars.zig");
const internal = @import("../internals/calendars/internal.zig");
const manager = @import("../internals/calendars/manager.zig");
const patterns = @import("../internals/calendars/patterns.zig");
const render = @import("../internals/calendars/formatter.zig");
const utils = @import("../utils/render.zig");
const general = @import("../internals/general/internal.zig");
const D = @import("../../decimal/decimal.zig");
const tz = @import("../../timezone/timezone.zig");
const numbers = @import("private/numbers.zig");
pub const DateInput = o.DateInput;
pub const ZonedDateTime = o.ZonedDateTime;
pub const DateFormatOptions = o.DateFormatOptions;
pub const DateRawFormatOptions = o.DateRawFormatOptions;
pub const DateIntervalFormatOptions = o.DateIntervalFormatOptions;
pub const RelativeTimeFieldFormatOptions = o.RelativeTimeFieldFormatOptions;
pub const RelativeTimeFormatOptions = o.RelativeTimeFormatOptions;
pub const DateWrapperFormatOptions = o.DateWrapperFormatOptions;
pub const CalendarFieldsOptions = o.CalendarFieldsOptions;
pub const EraFieldOptions = o.EraFieldOptions;
pub const DateFieldFormatOptions = o.DateFieldFormatOptions;
pub const CalendarType = cal.CalendarType;
pub const Part = D.Part;
pub fn firstDayOfWeek(data: *const LocaleData) i64 {
    return internal.weekFirstDay(data.bundle.region);
}
pub fn minDaysInFirstWeek(data: *const LocaleData) i64 {
    return internal.weekMinDays(data.bundle.region);
}
fn epoch(input: DateInput) f64 {
    return switch (input) {
        .calendar => |d| @import("../systems/calendars/calendar.zig").unixEpoch(&d),
        .zoned => |d| if (std.math.isFinite(d.date)) d.date else 0,
    };
}
fn zoneId(input: DateInput) []const u8 {
    return switch (input) {
        .calendar => |d| cal.CalendarDate.timeZoneId(&d),
        .zoned => |d| if (d.zone_id.len > 0) d.zone_id else "UTC",
    };
}
pub fn toCalendarDate(data: *const LocaleData, c: CalendarType, input: DateInput) cal.CalendarDate {
    return @import("../systems/calendars/core.zig").newDate(if (input == .calendar) input.calendar.database else data.timezone_database, cal.calendarSystem(c), epoch(input), zoneId(input), firstDayOfWeek(data), minDaysInFirstWeek(data));
}
pub fn convertDateTo(data: *const LocaleData, c: CalendarType, input: DateInput) cal.CalendarDate {
    if (input == .calendar and cal.CalendarDate.type(&input.calendar) == c) return input.calendar;
    return toCalendarDate(data, if (c == .iso8601) .gregory else c, input);
}
pub fn newCalendarDate(data: *const LocaleData, c: CalendarType, fields: cal.CalendarDateFields) cal.Error!cal.CalendarDate {
    return cal.CalendarDate.fromFields(data.timezone_database, cal.calendarSystem(c), fields, firstDayOfWeek(data), minDaysInFirstWeek(data));
}
pub fn toBuddhistDate(data: *const LocaleData, date: DateInput) cal.CalendarDate {
    return toCalendarDate(data, .buddhist, date);
}
pub fn toGregorianDate(data: *const LocaleData, date: DateInput) cal.CalendarDate {
    return toCalendarDate(data, .gregory, date);
}
pub fn toISO8601Date(data: *const LocaleData, date: DateInput) cal.CalendarDate {
    return toCalendarDate(data, .iso8601, date);
}
pub fn toJapaneseDate(data: *const LocaleData, date: DateInput) cal.CalendarDate {
    return toCalendarDate(data, .japanese, date);
}
pub fn toPersianDate(data: *const LocaleData, date: DateInput) cal.CalendarDate {
    return toCalendarDate(data, .persian, date);
}
pub fn newBuddhistDate(data: *const LocaleData, fields: cal.CalendarDateFields) cal.Error!cal.CalendarDate {
    return newCalendarDate(data, .buddhist, fields);
}
pub fn newGregorianDate(data: *const LocaleData, fields: cal.CalendarDateFields) cal.Error!cal.CalendarDate {
    return newCalendarDate(data, .gregory, fields);
}
pub fn newISO8601Date(data: *const LocaleData, fields: cal.CalendarDateFields) cal.Error!cal.CalendarDate {
    return newCalendarDate(data, .iso8601, fields);
}
pub fn newJapaneseDate(data: *const LocaleData, fields: cal.CalendarDateFields) cal.Error!cal.CalendarDate {
    return newCalendarDate(data, .japanese, fields);
}
pub fn newPersianDate(data: *const LocaleData, fields: cal.CalendarDateFields) cal.Error!cal.CalendarDate {
    return newCalendarDate(data, .persian, fields);
}
pub fn nowCalendar(io: std.Io, data: *const LocaleData, c: CalendarType, zone: []const u8) cal.CalendarDate {
    return toCalendarDate(data, c, .{ .zoned = .{ .date = @floatFromInt(@import("../../datetime/datetime.zig").now(io)), .zone_id = zone } });
}
pub fn now(io: std.Io, data: *const LocaleData, zone: []const u8) cal.CalendarDate {
    return nowGregorian(io, data, zone);
}
pub fn nowGregorian(io: std.Io, data: *const LocaleData, zone: []const u8) cal.CalendarDate {
    return nowCalendar(io, data, .gregory, zone);
}
pub fn nowBuddhist(io: std.Io, data: *const LocaleData, zone: []const u8) cal.CalendarDate {
    return nowCalendar(io, data, .buddhist, zone);
}
pub fn nowISO8601(io: std.Io, data: *const LocaleData, zone: []const u8) cal.CalendarDate {
    return nowCalendar(io, data, .iso8601, zone);
}
pub fn nowJapanese(io: std.Io, data: *const LocaleData, zone: []const u8) cal.CalendarDate {
    return nowCalendar(io, data, .japanese, zone);
}
pub fn nowPersian(io: std.Io, data: *const LocaleData, zone: []const u8) cal.CalendarDate {
    return nowCalendar(io, data, .persian, zone);
}
pub fn fieldOfVisualDifference(data: *const LocaleData, a: DateInput, b: DateInput) ?u8 {
    const c = if (a == .calendar) cal.CalendarDate.type(&a.calendar) else if (b == .calendar) cal.CalendarDate.type(&b.calendar) else internal.selectCalendar(data, null);
    const start = convertDateTo(data, c, a);
    var end = convertDateTo(data, c, b);
    // The TypeScript conversion ignores the zone override when rebuilding a different zone.
    if (!std.mem.eql(u8, cal.CalendarDate.timeZoneId(&start), cal.CalendarDate.timeZoneId(&end))) end = toCalendarDate(data, c, b);
    return cal.CalendarDate.fieldOfVisualDifference(&start, &end);
}
fn dateParts(a: A, data: *const LocaleData, input: DateInput, opt: ?DateFormatOptions) A.Error![]Part {
    const options: DateFormatOptions = opt orelse .{ .date = "full" };
    const c = internal.selectCalendar(data, options.ca);
    const d = convertDateTo(data, c, input);
    const params = try numbers.getNumberParams(data, options.nu, "default");
    const req = try manager.getDateFormatRequest(a, data, d, options, params);
    return render.renderDateTime(a, c, .{ .data = data, .date = d, .params = params, .context = options.context, .alt = options.alt }, true, req.date, req.time, req.wrapper);
}
pub fn formatDate(gpa: A, data: *const LocaleData, date: DateInput, options: ?DateFormatOptions) A.Error![]u8 {
    var arena: std.heap.ArenaAllocator = .init(gpa);
    defer arena.deinit();
    return utils.joinParts(gpa, try dateParts(arena.allocator(), data, date, options));
}
pub fn formatDateToParts(gpa: A, data: *const LocaleData, date: DateInput, options: ?DateFormatOptions) A.Error![]Part {
    var arena: std.heap.ArenaAllocator = .init(gpa);
    defer arena.deinit();
    return utils.copyParts(gpa, try dateParts(arena.allocator(), data, date, options));
}
fn rawParts(a: A, data: *const LocaleData, input: DateInput, options: DateRawFormatOptions) A.Error![]Part {
    if (options.pattern.len == 0) return a.alloc(Part, 0);
    const c = internal.selectCalendar(data, options.ca);
    const d = convertDateTo(data, c, input);
    const params = try numbers.getNumberParams(data, options.nu, "default");
    return render.renderDateTime(a, c, .{ .data = data, .date = d, .params = params, .context = options.context, .alt = options.alt }, true, try internal.parseDatePattern(a, options.pattern), null, "");
}
pub fn formatDateRaw(gpa: A, data: *const LocaleData, date: DateInput, options: ?DateRawFormatOptions) A.Error![]u8 {
    var arena: std.heap.ArenaAllocator = .init(gpa);
    defer arena.deinit();
    return utils.joinParts(gpa, try rawParts(arena.allocator(), data, date, options orelse .{}));
}
pub fn formatDateRawToParts(gpa: A, data: *const LocaleData, date: DateInput, options: ?DateRawFormatOptions) A.Error![]Part {
    var arena: std.heap.ArenaAllocator = .init(gpa);
    defer arena.deinit();
    return utils.copyParts(gpa, try rawParts(arena.allocator(), data, date, options orelse .{}));
}
fn intervalParts(a: A, data: *const LocaleData, start: DateInput, end: DateInput, options: DateIntervalFormatOptions) A.Error![]Part {
    const c = internal.selectCalendar(data, options.ca);
    const d = convertDateTo(data, c, start);
    const e = convertDateTo(data, c, end);
    const params = try numbers.getNumberParams(data, options.nu, "default");
    const req = try manager.getDateIntervalFormatRequest(a, data, c, d, e, options, params);
    var ctx: render.CalendarContext = .{ .data = data, .date = d, .params = params, .context = options.context, .alt = options.alt };
    if (req.skeleton) |sk| {
        const r = try manager.getDateFormatRequest(a, data, d, .{ .ca = options.ca, .nu = options.nu, .skeleton = sk, .wrap = options.wrap, .at_time = options.at_time }, params);
        const first = try render.renderDateTime(a, c, ctx, true, r.date, r.time, r.wrapper);
        ctx.date = e;
        const last = try render.renderDateTime(a, c, ctx, false, r.date, r.time, r.wrapper);
        return render.wrap(a, req.wrapper, &.{ first, last });
    }
    const p = try patterns.getCalendarPatterns(data, c);
    const wrapper = patterns.patternsWrapperPattern(p, options.wrap orelse "medium", options.at_time);
    const dp = if (req.date) |nodes| try render.renderDateTime(a, c, ctx, true, nodes, null, "") else null;
    if (req.time) |nodes| {
        const tp = try render.renderDateTime(a, c, ctx, true, nodes, null, "");
        return render.wrap(a, wrapper, &.{ tp, dp orelse &.{} });
    }
    if (req.range) |nodes| {
        const rp = try render.renderDateInterval(a, c, ctx, dp == null, e, nodes);
        return if (dp) |part| render.wrap(a, wrapper, &.{ rp, part }) else rp;
    }
    return dp orelse try a.alloc(Part, 0);
}
pub fn formatDateInterval(gpa: A, data: *const LocaleData, start: DateInput, end: DateInput, options: ?DateIntervalFormatOptions) A.Error![]u8 {
    var arena: std.heap.ArenaAllocator = .init(gpa);
    defer arena.deinit();
    return utils.joinParts(gpa, try intervalParts(arena.allocator(), data, start, end, options orelse .{}));
}
pub fn formatDateIntervalToParts(gpa: A, data: *const LocaleData, start: DateInput, end: DateInput, options: ?DateIntervalFormatOptions) A.Error![]Part {
    var arena: std.heap.ArenaAllocator = .init(gpa);
    defer arena.deinit();
    return utils.copyParts(gpa, try intervalParts(arena.allocator(), data, start, end, options orelse .{}));
}
pub fn formatDateWrapper(gpa: A, data: *const LocaleData, date: []const u8, time: []const u8, options: ?DateWrapperFormatOptions) A.Error![]u8 {
    const opt: DateWrapperFormatOptions = options orelse .{};
    const c = internal.selectCalendar(data, opt.ca);
    const p = try patterns.getCalendarPatterns(data, c);
    return general.formatWrapper(gpa, patterns.patternsWrapperPattern(p, opt.width, opt.at_time), &.{ time, date });
}
pub fn formatDateWrapperToParts(gpa: A, data: *const LocaleData, date: []const Part, time: []const Part, options: ?DateWrapperFormatOptions) A.Error![]Part {
    var arena: std.heap.ArenaAllocator = .init(gpa);
    defer arena.deinit();
    const opt: DateWrapperFormatOptions = options orelse .{};
    const c = internal.selectCalendar(data, opt.ca);
    const p = try patterns.getCalendarPatterns(data, c);
    return utils.copyParts(gpa, try render.wrap(arena.allocator(), patterns.patternsWrapperPattern(p, opt.width, opt.at_time), &.{ time, date }));
}
pub fn formatRelativeTimeField(gpa: A, data: *const LocaleData, value: D.Decimal, field: []const u8, options: ?RelativeTimeFieldFormatOptions) D.Error![]u8 {
    var arena: std.heap.ArenaAllocator = .init(gpa);
    defer arena.deinit();
    const a = arena.allocator();
    const opt: RelativeTimeFieldFormatOptions = options orelse .{};
    const params = try numbers.getNumberParams(data, opt.nu, null);
    return gpa.dupe(u8, try @import("../internals/datefields/internal.zig").renderRelativeTimeField(a, data, value, field, opt, params));
}
pub fn formatRelativeTime(gpa: A, data: *const LocaleData, start: DateInput, end: DateInput, options: ?RelativeTimeFormatOptions) D.Error![]u8 {
    var arena: std.heap.ArenaAllocator = .init(gpa);
    defer arena.deinit();
    const a = arena.allocator();
    const opt: RelativeTimeFormatOptions = options orelse .{ .maximum_fraction_digits = 0, .group = true };
    const c = internal.selectCalendar(data, opt.ca);
    const d = convertDateTo(data, c, start);
    const e = convertDateTo(data, c, end);
    var r = cal.CalendarDate.relativeTime(&d, &e, opt.field, .{ .rollup_fractional = true, .include_weeks = opt.allow_weeks });
    if (r.field == .millis) {
        r.field = .second;
        r.value /= 1000;
    }
    var field: []const u8 = @tagName(r.field);
    if (opt.day_of_week and r.field == .week and cal.CalendarDate.dayOfWeek(&d) == cal.CalendarDate.dayOfWeek(&e)) field = ([_][]const u8{ "sun", "mon", "tue", "wed", "thu", "fri", "sat" })[@intCast(cal.CalendarDate.dayOfWeek(&e) - 1)];
    const num = try decimalFromFloat(a, r.value);
    return formatRelativeTimeField(gpa, data, num, field, opt);
}
pub fn dateField(gpa: A, data: *const LocaleData, field: []const u8, options: ?DateFieldFormatOptions) A.Error![]u8 {
    const opt: DateFieldFormatOptions = options orelse .{};
    return general.contextTransform(gpa, data.schema.DateFields.displayName.get(&data.bundle, &.{ field, opt.width }), data, opt.context, "calendar-field");
}
/// Field maps own an arena; free with `.deinit()`.
pub const FieldMap = std.json.Parsed(std.json.Value);
fn transform(a: A, data: *const LocaleData, v: std.json.Value, context: ?@import("../types/general.zig").ContextType, field: ?[]const u8) A.Error!std.json.Value {
    if (v == .string) return .{ .string = try general.contextTransform(a, v.string, data, context, field) };
    var r: std.json.ObjectMap = .empty;
    if (v == .object) {
        var it = v.object.iterator();
        while (it.next()) |e| try r.put(a, e.key_ptr.*, try transform(a, data, e.value_ptr.*, context, field));
    }
    return .{ .object = r };
}
fn fieldMap(gpa: A, data: *const LocaleData, arrow: @import("../schema/schema/arrows.zig").VectorArrow, width: []const u8, context: ?@import("../types/general.zig").ContextType, tx: ?[]const u8) A.Error!FieldMap {
    const arena = try gpa.create(std.heap.ArenaAllocator);
    arena.* = .init(gpa);
    errdefer {
        arena.deinit();
        gpa.destroy(arena);
    }
    const a = arena.allocator();
    const mapping = try arrow.mapping(a, &data.bundle);
    const selected = if (mapping == .object) mapping.object.get(width) orelse .null else .null;
    return .{ .arena = arena, .value = try transform(a, data, selected, context, tx) };
}
pub fn months(gpa: A, data: *const LocaleData, options: ?CalendarFieldsOptions) A.Error!FieldMap {
    const opt: CalendarFieldsOptions = options orelse .{};
    const width = if (std.mem.eql(u8, opt.width, "short")) "narrow" else opt.width;
    return fieldMap(gpa, data, internal.calendarSchema(data, internal.selectCalendar(data, opt.ca)).standAlone.months, width, opt.context, if (std.mem.eql(u8, width, "narrow")) null else "month-standalone-except-narrow");
}
pub fn weekdays(gpa: A, data: *const LocaleData, options: ?CalendarFieldsOptions) A.Error!FieldMap {
    const opt: CalendarFieldsOptions = options orelse .{};
    return fieldMap(gpa, data, internal.calendarSchema(data, internal.selectCalendar(data, opt.ca)).standAlone.weekdays, opt.width, opt.context, if (std.mem.eql(u8, opt.width, "narrow")) null else "day-standalone-except-narrow");
}
pub fn quarters(gpa: A, data: *const LocaleData, options: ?CalendarFieldsOptions) A.Error!FieldMap {
    const opt: CalendarFieldsOptions = options orelse .{};
    return fieldMap(gpa, data, internal.calendarSchema(data, internal.selectCalendar(data, opt.ca)).standAlone.quarters, opt.width, opt.context, null);
}
pub fn dayPeriods(gpa: A, data: *const LocaleData, options: ?CalendarFieldsOptions) A.Error!FieldMap {
    const opt: CalendarFieldsOptions = options orelse .{};
    return fieldMap(gpa, data, internal.calendarSchema(data, internal.selectCalendar(data, opt.ca)).standAlone.dayPeriods, opt.width, opt.context, null);
}
pub fn eras(gpa: A, data: *const LocaleData, options: ?EraFieldOptions) A.Error!FieldMap {
    const opt: EraFieldOptions = options orelse .{};
    const tx: ?[]const u8 = if (std.mem.eql(u8, opt.width, "abbr")) "era-abbr" else if (std.mem.eql(u8, opt.width, "names")) "era-name" else null;
    return fieldMap(gpa, data, internal.calendarSchema(data, internal.selectCalendar(data, opt.ca)).eras, opt.width, opt.context, tx);
}
/// Time data borrows static strings; only its allowed slice belongs to gpa.
pub fn timeData(gpa: A, data: *const LocaleData) A.Error!o.TimeData {
    var arena: std.heap.ArenaAllocator = .init(gpa);
    defer arena.deinit();
    const pair = try patterns.timeDataFor(arena.allocator(), data.bundle.language, data.bundle.region);
    var list: std.ArrayList([]const u8) = .empty;
    errdefer list.deinit(gpa);
    var it = std.mem.splitScalar(u8, pair[0], ' ');
    while (it.next()) |s| try list.append(gpa, s);
    return .{ .preferred = pair[1], .allowed = try list.toOwnedSlice(gpa) };
}
pub fn timeZoneIds(db: *const tz.Database) []const []const u8 {
    return db.zoneIds();
}
pub fn resolveTimeZoneId(db: *const tz.Database, id: []const u8) ?[]const u8 {
    return db.resolveId(cal.substituteZoneAlias(id));
}
pub fn timeZoneFromUTC(db: *const tz.Database, utc: i64, id: []const u8) ?tz.ZoneInfo {
    return db.fromUTC(id, utc);
}
pub fn timeZoneFromWall(db: *const tz.Database, wall: i64, id: []const u8) ?tz.WallResult {
    return db.fromWall(id, wall);
}
pub fn timeZoneInfo(data: *const LocaleData, zone: []const u8) o.TimeZoneInfo {
    const id = resolveTimeZoneId(data.timezone_database, zone) orelse "Factory";
    const stable = cal.getStableTimeZoneId(data.timezone_database, id);
    const meta = cal.currentMetazone(id) orelse "";
    const schema = data.schema.TimeZones;
    const b = &data.bundle;
    const city = schema.exemplarCity.get(b, &.{stable});
    const loc = data.timezone_database.zoneMeta(id) orelse tz.defaultDatabase.zoneMeta("Factory").?;
    var names: o.MetazoneNames = .{};
    inline for (.{ "long", "short" }) |width| inline for (.{ "generic", "standard", "daylight" }) |key| {
        @field(@field(names, width), key) = @field(schema.metaZones, width).get(b, &.{ key, meta });
    };
    return .{ .id = id, .city = .{ .name = if (city.len > 0) city else schema.exemplarCity.get(b, &.{"Etc/Unknown"}) }, .countries = loc.countries, .latitude = loc.latitude, .longitude = loc.longitude, .stdoffset = loc.stdoffset, .metazone = meta, .names = names };
}
/// Caller-owned quantities and Decimal values (`timePeriodToQuantity`). Unit strings are
/// static. Free with unit_options.freeQuantities.
pub fn timePeriodToQuantity(gpa: A, period: cal.TimePeriod) A.Error![]@import("../common/units.zig").Quantity {
    const Q = @import("../common/units.zig").Quantity;
    var arena = std.heap.ArenaAllocator.init(gpa);
    defer arena.deinit();
    const values = try timePeriodToQuantityArena(arena.allocator(), period);
    const out = try gpa.alloc(Q, values.len);
    var n: usize = 0;
    errdefer {
        for (out[0..n]) |q| q.value.deinit(gpa);
        gpa.free(out);
    }
    for (values, out) |q, *dest| {
        dest.* = q;
        dest.value = try D.clone(gpa, q.value);
        n += 1;
    }
    return out;
}

/// Internal arena variant, including conversion temporaries (`timePeriodToQuantity`).
pub fn timePeriodToQuantityArena(a: A, period: cal.TimePeriod) A.Error![]@import("../common/units.zig").Quantity {
    const Q = @import("../common/units.zig").Quantity;
    var out: std.ArrayList(Q) = .empty;
    for (cal.TIME_PERIOD_FIELDS) |f| {
        const n = period.get(f);
        if (n != 0) try out.append(a, .{ .unit = if (f == .millis) "millisecond" else @tagName(f), .value = try decimalFromFloat(a, n) });
    }
    return out.toOwnedSlice(a);
}

fn decimalFromFloat(a: A, n: f64) A.Error!D.Decimal {
    const js = @import("../../messageformat/js.zig");
    var buf: [js.NUMBER_BUF]u8 = undefined;
    return D.parse(a, js.numberToString(&buf, n)) catch |err| switch (err) {
        error.OutOfMemory => return error.OutOfMemory,
        else => unreachable,
    };
}
