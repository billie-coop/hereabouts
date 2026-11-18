//! Date field rendering into parts. All temporary values allocate in the caller's arena.
const std = @import("std");
const A = std.mem.Allocator;
const LocaleData = @import("../../locale_data.zig").LocaleData;
const cal = @import("../../systems/calendars/calendars.zig");
const num = @import("../../systems/numbering/decimal.zig");
const NumberParams = @import("../../common/private.zig").NumberParams;
const opts = @import("../../common/calendars.zig");
const ContextType = @import("../../types/general.zig").ContextType;
const dates = @import("../../parsing/date.zig");
const Value = @import("../../utils/render.zig").Value;
const Part = @import("../../../decimal/decimal.zig").Part;
const general = @import("../general/internal.zig");
const internal = @import("internal.zig");
const getTZC = @import("zoneutil.zig").getTZC;
const js = @import("../../../messageformat/js.zig");
pub const CalendarContext = struct { data: *const LocaleData, date: cal.CalendarDate, params: *const NumberParams, context: ?ContextType = null, alt: opts.DateFormatAltOptions = .{} };
fn eq(a: []const u8, b: []const u8) bool {
    return std.mem.eql(u8, a, b);
}
fn widthKey(w: usize) []const u8 {
    return if (w == 5) "narrow" else if (w == 4) "wide" else "abbreviated";
}
fn number(a: A, ctx: CalendarContext, n: i64, w: usize) A.Error![]const u8 {
    return num.formatInt(a, ctx.params.system, n, false, @intCast(w));
}
fn numberFloat(a: A, ctx: CalendarContext, n: f64, w: usize) A.Error![]const u8 {
    var buf: [js.NUMBER_BUF]u8 = undefined;
    const raw = js.numberToString(&buf, n);
    if (std.math.isFinite(n) and @floor(n) == n) return num.fastFormatDecimal(a, raw, ctx.params.system.digits, @intCast(w));
    const value = @import("../../../decimal/decimal.zig").parse(a, raw) catch |err| switch (err) {
        error.OutOfMemory => return error.OutOfMemory,
        else => unreachable,
    };
    return num.formatString(a, ctx.params.system, value, false, @intCast(w));
}
fn year(a: A, ctx: CalendarContext, n: i64, w: usize) A.Error![]const u8 {
    return number(a, ctx, if (w == 2) @rem(n, 100) else n, w);
}
fn str(a: A, n: i64) A.Error![]const u8 {
    return std.fmt.allocPrint(a, "{d}", .{n});
}
fn period(ctx: CalendarContext, c: cal.CalendarType, w: usize, key: []const u8, fallback: []const u8) []const u8 {
    return internal.calendarSchema(ctx.data, c).format.dayPeriods.getAlt(&ctx.data.bundle, &.{ &.{widthKey(w)}, &.{ key, fallback }, &.{ ctx.alt.day_period, "none" } });
}
fn extended(ctx: CalendarContext, c: cal.CalendarType, w: usize) []const u8 {
    const d = &ctx.date;
    const key = if (cal.CalendarDate.isAM(d)) "am" else "pm";
    const ext = if (cal.CalendarDate.minute(d) == 0) (if (cal.CalendarDate.hourOfDay(d) == 0) "midnight" else if (cal.CalendarDate.hourOfDay(d) == 12) "noon" else key) else key;
    return period(ctx, c, w, ext, key);
}
fn zoneGMT(a: A, ctx: CalendarContext, short: bool) A.Error![]const u8 {
    const tz = ctx.data.schema.TimeZones;
    const b = &ctx.data.bundle;
    const offset = cal.CalendarDate.timeZoneOffset(&ctx.date);
    if (offset == 0) return tz.gmtZeroFormat.get(b);
    const t = getTZC(offset);
    const emit = !short or t.minutes > 0;
    const pattern = try internal.getHourPattern(a, tz.hourFormat.get(b), t.negative);
    var value: std.ArrayList(u8) = .empty;
    for (pattern) |n| switch (n) {
        .text => |text| {
            if (!(eq(text, ".") or eq(text, ":")) or emit) try value.appendSlice(a, text);
        },
        .field => |f| {
            if (f.char == 'H') try value.appendSlice(a, try number(a, ctx, t.hours, if (f.width == 1 or short) 1 else f.width)) else if (f.char == 'm' and emit) try value.appendSlice(a, try number(a, ctx, t.minutes, f.width));
        },
    };
    return general.formatWrapper(a, tz.gmtFormat.get(b), &.{value.items});
}
fn zone(a: A, ctx: CalendarContext, ch: u8, w: usize) A.Error![]const u8 {
    const d = &ctx.date;
    const tz = ctx.data.schema.TimeZones;
    const b = &ctx.data.bundle;
    switch (ch) {
        'z', 'v' => {
            if ((ch == 'z' and w > 4) or (ch == 'v' and w != 1 and w != 4)) return "";
            const arrow = if (w == 4) tz.metaZones.long else tz.metaZones.short;
            const key = if (ch == 'v') "generic" else if (cal.CalendarDate.isDaylightSavings(d)) "daylight" else "standard";
            const v = arrow.get(b, &.{ key, cal.CalendarDate.metaZoneId(d) });
            return if (v.len > 0) v else if (w == 1 or w == 4) zoneGMT(a, ctx, w == 1) else "";
        },
        'O' => return if (w == 1 or w == 4) zoneGMT(a, ctx, w == 1) else "",
        'V' => {
            switch (w) {
                1 => return "unk",
                2 => return cal.CalendarDate.timeZoneId(d),
                3, 4 => {
                    const city = tz.exemplarCity.get(b, &.{cal.CalendarDate.timeZoneStableId(d)});
                    if (w == 3) return if (city.len > 0) city else tz.exemplarCity.get(b, &.{"Etc/Unknown"});
                    return if (city.len > 0) general.formatWrapper(a, tz.regionFormat.get(b), &.{city}) else zoneGMT(a, ctx, false);
                },
                else => return "",
            }
        },
        'Z', 'x', 'X' => {
            if (ch == 'Z' and w == 4) return zoneGMT(a, ctx, false);
            if (w < 1 or w > 5) return "";
            const t = getTZC(cal.CalendarDate.timeZoneOffset(d));
            if (ch == 'X' and t.offset == 0) return "Z";
            const colon = if (ch == 'Z') w == 5 else w == 3 or w == 5;
            const mins = ch == 'Z' or w != 1 or t.minutes > 0;
            return std.fmt.allocPrint(a, "{s}{s}{s}{s}", .{ if (t.negative) "-" else "+", try number(a, ctx, t.hours, 2), if (colon) ":" else "", if (mins) try number(a, ctx, t.minutes, 2) else "" });
        },
        else => return "",
    }
}
pub fn calendarFormat(a: A, c: cal.CalendarType, ctx: CalendarContext, nodes: []const dates.DateTimeNode, first: bool) A.Error![]Part {
    var val = Value.init(a);
    const schema = internal.calendarSchema(ctx.data, c);
    const b = &ctx.data.bundle;
    const d = &ctx.date;
    for (nodes, 0..) |node, i| {
        if (node == .text) {
            try val.add("literal", node.text);
            continue;
        }
        const ch = node.field.char;
        const w = node.field.width;
        var field: ?[]const u8 = null;
        var t: []const u8 = "";
        var v: []const u8 = "";
        switch (ch) {
            'G' => {
                t = "era";
                const width = if (w == 5) "narrow" else if (w == 4) "names" else "abbr";
                v = schema.eras.getAlt(b, &.{ &.{width}, &.{try str(a, cal.CalendarDate.era(d))}, &.{ ctx.alt.era, "none" } });
                if (w != 5) field = if (w == 4) "era-name" else "era-abbr";
            },
            'y' => {
                t = "year";
                v = try year(a, ctx, cal.CalendarDate.year(d), w);
            },
            'Y' => {
                t = "year";
                v = try year(a, ctx, cal.CalendarDate.yearOfWeekOfYear(d), w);
            },
            'u' => {
                t = "year";
                v = try number(a, ctx, cal.CalendarDate.extendedYear(d), w);
            },
            'U' => {
                t = "cyclic-year";
            },
            'r' => {
                t = "related-year";
                v = try num.formatInt(a, ctx.params.latn_system, cal.CalendarDate.relatedYear(d), false, @intCast(w));
            },
            'Q', 'q', 'M', 'L' => {
                t = if (ch == 'Q' or ch == 'q') "quarter" else "month";
                const format = if (ch == 'Q' or ch == 'M') schema.format else schema.standAlone;
                const arrow = if (ch == 'Q' or ch == 'q') format.quarters else format.months;
                const n = if (ch == 'Q' or ch == 'q') @divTrunc(cal.CalendarDate.month(d) - 1, 3) + 1 else cal.CalendarDate.month(d);
                v = if (w >= 3) arrow.get(b, &.{ widthKey(w), try str(a, n) }) else try number(a, ctx, n, w);
                if (w == 3 or w == 4) {
                    if (ch == 'M') field = "month-format-except-narrow" else if (ch == 'L') field = "month-standalone-except-narrow";
                }
            },
            'w' => {
                t = "week";
                v = try number(a, ctx, cal.CalendarDate.weekOfYear(d), @min(w, 2));
            },
            'W' => {
                t = "week";
                v = try number(a, ctx, cal.CalendarDate.weekOfMonth(d), 1);
            },
            'd' => {
                t = "day";
                v = try number(a, ctx, cal.CalendarDate.dayOfMonth(d), @min(w, 2));
            },
            'D' => {
                t = "day";
                v = try number(a, ctx, cal.CalendarDate.dayOfYear(d), @min(w, 3));
            },
            'F' => {
                t = "day";
                v = try number(a, ctx, cal.CalendarDate.dayOfWeekInMonth(d), 1);
            },
            'g' => {
                t = "mjulian-day";
                v = try number(a, ctx, cal.CalendarDate.modifiedJulianDay(d), w);
            },
            'E', 'e', 'c' => {
                t = "weekday";
                if (ch != 'E' and w <= 2) v = try number(a, ctx, cal.CalendarDate.ordinalDayOfWeek(d), if (ch == 'c') 1 else w) else {
                    const arrow = if (ch == 'c') schema.standAlone.weekdays else schema.format.weekdays;
                    v = arrow.get(b, &.{ if (w == 6) "short" else widthKey(w), try str(a, cal.CalendarDate.dayOfWeek(d)) });
                }
                if (w != 5) {
                    if (ch == 'E') field = "day-format-except-narrow" else if (ch == 'c') field = "day-standalone-except-narrow";
                }
            },
            'a' => {
                t = "dayperiod";
                const key = if (cal.CalendarDate.hourOfDay(d) < 12) "am" else "pm";
                v = period(ctx, c, w, key, key);
            },
            'b' => {
                t = "dayperiod";
                v = extended(ctx, c, w);
            },
            'B' => {
                t = "dayperiod";
                if (internal.flexDayPeriod(b, cal.CalendarDate.hourOfDay(d) * 60 + cal.CalendarDate.minute(d))) |key| v = period(ctx, c, w, key, key);
                if (v.len == 0) v = extended(ctx, c, w);
            },
            'h', 'H', 'K', 'k' => {
                t = "hour";
                var n = if (ch == 'h' or ch == 'K') cal.CalendarDate.hour(d) else cal.CalendarDate.hourOfDay(d);
                if (n == 0) {
                    if (ch == 'h') n = 12 else if (ch == 'k') n = 24;
                }
                v = try number(a, ctx, n, @min(w, 2));
            },
            'm' => {
                t = "minute";
                v = try number(a, ctx, cal.CalendarDate.minute(d), @min(w, 2));
            },
            's' => {
                t = "second";
                v = try number(a, ctx, cal.CalendarDate.second(d), @min(w, 2));
            },
            'S' => {
                t = "fracsec";
                var m = d.field_values[cal.DateField.MILLIS];
                if (w > 3) m *= if (w - 3 <= 308) @import("autogen.dates.zig").powers_of_ten[w - 3] else std.math.inf(f64);
                const value = if (w >= 3) m else @import("../../systems/calendars/util.zig").toInt32(m / (if (w == 2) @as(f64, 10) else 100));
                v = try numberFloat(a, ctx, value, w);
            },
            'A' => {
                t = "millis-in-day";
                v = try number(a, ctx, cal.CalendarDate.millisecondsInDay(d), w);
            },
            'z', 'Z', 'O', 'v', 'V', 'X', 'x' => {
                t = "timezone";
                v = try zone(a, ctx, ch, w);
            },
            else => continue,
        }
        if (first and i == 0 and ctx.context != null and field != null) v = try general.contextTransform(a, v, ctx.data, ctx.context, field);
        try val.add(t, v);
    }
    return val.render();
}
pub fn wrap(a: A, pattern: []const u8, args: []const []const Part) A.Error![]Part {
    var v = Value.init(a);
    try v.wrap(try general.parseWrapper(a, pattern), args);
    return v.render();
}
pub fn renderDateTime(a: A, c: cal.CalendarType, ctx: CalendarContext, first: bool, date: ?[]const dates.DateTimeNode, time: ?[]const dates.DateTimeNode, wrapper: []const u8) A.Error![]Part {
    const dp = if (date) |d| try calendarFormat(a, c, ctx, d, first) else null;
    const tp = if (time) |t| try calendarFormat(a, c, ctx, t, date != null and first) else null;
    if (dp != null and tp != null and wrapper.len > 0) return wrap(a, wrapper, &.{ tp.?, dp.? });
    return dp orelse tp orelse try a.alloc(Part, 0);
}
pub fn renderDateInterval(a: A, c: cal.CalendarType, ctx: CalendarContext, first: bool, end: cal.CalendarDate, pattern: []const dates.DateTimeNode) A.Error![]Part {
    const idx = dates.intervalPatternBoundary(pattern) orelse (if (pattern.len > 0) pattern.len - 1 else 0);
    const start = try renderDateTime(a, c, ctx, first, pattern[0..idx], null, "");
    var ec = ctx;
    ec.date = end;
    const last = try renderDateTime(a, c, ec, false, pattern[idx..], null, "");
    return std.mem.concat(a, Part, &.{ start, last });
}
