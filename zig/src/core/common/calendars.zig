const cal = @import("../systems/calendars/types.zig");
const ContextType = @import("../types/general.zig").ContextType;
const RoundingMode = @import("../../decimal/decimal.zig").RoundingMode;
pub const CalendarType = cal.CalendarType;
pub const ZonedDateTime = struct { date: f64, zone_id: []const u8 = "UTC" };
pub const DateInput = union(enum) { calendar: cal.CalendarDate, zoned: ZonedDateTime };
pub const CalendarFieldsOptions = struct { ca: ?CalendarType = null, width: []const u8 = "wide", context: ?ContextType = null };
pub const EraFieldOptions = struct { ca: ?CalendarType = null, width: []const u8 = "names", context: ?ContextType = null };
pub const DateFieldFormatOptions = CalendarFieldsOptions;
pub const DateFormatAltOptions = struct { era: []const u8 = "none", day_period: []const u8 = "none" };
pub const DateFormatOptions = struct {
    datetime: ?[]const u8 = null,
    date: ?[]const u8 = null,
    time: ?[]const u8 = null,
    wrap: ?[]const u8 = null,
    skeleton: ?[]const u8 = null,
    ca: ?CalendarType = null,
    nu: ?[]const u8 = null,
    context: ?ContextType = null,
    alt: DateFormatAltOptions = .{},
    at_time: bool = true,
};
pub const DateRawFormatOptions = struct { pattern: []const u8 = "", ca: ?CalendarType = null, nu: ?[]const u8 = null, context: ?ContextType = null, alt: DateFormatAltOptions = .{} };
pub const DateIntervalFormatOptions = struct {
    strict: bool = false,
    skeleton: ?[]const u8 = null,
    date: ?[]const u8 = null,
    time: ?[]const u8 = null,
    ca: ?CalendarType = null,
    nu: ?[]const u8 = null,
    context: ?ContextType = null,
    alt: DateFormatAltOptions = .{},
    wrap: ?[]const u8 = null,
    at_time: bool = true,
};
pub const RelativeTimeFieldFormatOptions = struct {
    width: []const u8 = "wide",
    context: ?ContextType = null,
    numeric_only: bool = false,
    always_now: bool = false,
    nu: ?[]const u8 = null,
    round: ?RoundingMode = null,
    group: ?bool = null,
    minimum_integer_digits: ?i64 = null,
    maximum_fraction_digits: ?i64 = null,
    minimum_fraction_digits: ?i64 = null,
    maximum_significant_digits: ?i64 = null,
    minimum_significant_digits: ?i64 = null,
    ca: ?CalendarType = null,
    day_of_week: bool = false,
    allow_weeks: bool = false,
    field: ?@import("../systems/calendars/interval.zig").TimePeriodField = null,
};
pub const RelativeTimeFormatOptions = RelativeTimeFieldFormatOptions;
pub const DateWrapperFormatOptions = struct { ca: ?CalendarType = null, width: []const u8 = "medium", at_time: bool = true };
pub const TimeData = struct { preferred: []const u8, allowed: []const []const u8 };
pub const ExemplarCity = struct { name: []const u8 };
pub const MetazoneName = struct { generic: []const u8 = "", standard: []const u8 = "", daylight: []const u8 = "" };
pub const MetazoneNames = struct { long: MetazoneName = .{}, short: MetazoneName = .{} };
pub const TimeZoneInfo = struct { id: []const u8, city: ExemplarCity, countries: []const []const u8, latitude: f64, longitude: f64, stdoffset: i64, metazone: []const u8, names: MetazoneNames };
