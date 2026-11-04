//! Bound locale function groups (`api/api.ts`). Values borrow their locale data.
const std = @import("std");
const Allocator = std.mem.Allocator;
const LocaleData = @import("../locale_data.zig").LocaleData;
const Decimal = @import("../../decimal/decimal.zig").Decimal;
const DecimalError = @import("../../decimal/decimal.zig").Error;
const Part = @import("../../decimal/decimal.zig").Part;
const gen = @import("general.zig");
const num = @import("numbers.zig");
const uni = @import("units.zig");
const mf = @import("../../messageformat/messageformat.zig");
const DecimalFormatOptions = num.DecimalFormatOptions;
const CurrencyFormatOptions = num.CurrencyFormatOptions;
const DecimalAdjustOptions = num.DecimalAdjustOptions;
const CurrencyDisplayNameOptions = num.CurrencyDisplayNameOptions;
const CurrencySymbolWidth = num.CurrencySymbolWidth;
const UnitFormatOptions = uni.UnitFormatOptions;
const Quantity = uni.Quantity;
const UnitLength = uni.UnitLength;
const DisplayNameOptions = gen.DisplayNameOptions;
const ListPatternType = gen.ListPatternType;
const NameInput = gen.NameInput;
const gen_options = gen.options;

pub const General = struct {
    data: *const LocaleData,
    pub fn bundle(self: General) *const LocaleData {
        return self.data;
    }
    pub fn locale(self: General) @import("../../locale/locale.zig").Locale {
        return self.data.locale;
    }
    pub fn resolveLocale(_: General, gpa: Allocator, id: []const u8) Allocator.Error!@import("../../locale/locale.zig").Locale {
        return @import("../framework.zig").resolveLocale(gpa, id);
    }
    pub fn resolveLocaleTag(_: General, gpa: Allocator, tag: @import("../../language_tag/language_tag.zig").LanguageTag) Allocator.Error!@import("../../locale/locale.zig").Locale {
        return @import("../framework.zig").resolveLocaleTag(gpa, tag);
    }
    pub fn parseLanguageTag(_: General, gpa: Allocator, code: []const u8) Allocator.Error!@import("../../language_tag/language_tag.zig").LanguageTag {
        return @import("../../language_tag/language_tag.zig").parseLanguageTag(gpa, code);
    }
    pub fn characterOrder(self: General) gen_options.CharacterOrder {
        return gen.characterOrder(self.data);
    }
    pub fn lineOrder(self: General) gen_options.LineOrder {
        return gen.lineOrder(self.data);
    }
    pub fn measurementSystem(self: General, category: ?gen_options.MeasurementCategory) gen_options.MeasurementSystem {
        return gen.measurementSystem(self.data, category);
    }
    pub fn messageFormatter(self: General) Allocator.Error!*mf.MessageFormatter {
        return gen.messageFormatter(self.data);
    }
    pub fn createMessageFormatter(self: General, gpa: Allocator, opts: mf.MessageFormatterOptions) Allocator.Error!mf.MessageFormatter {
        return gen.createMessageFormatter(gpa, self.data, opts);
    }
    pub fn formatList(self: General, gpa: Allocator, items: []const []const u8, t: ?ListPatternType) Allocator.Error![]u8 {
        return gen.formatList(gpa, self.data, items, t);
    }
    pub fn formatListToParts(self: General, gpa: Allocator, items: []const []const u8, t: ?ListPatternType) Allocator.Error![]Part {
        return gen.formatListToParts(gpa, self.data, items, t);
    }
    pub fn getLanguageDisplayName(self: General, gpa: Allocator, input: NameInput, o: DisplayNameOptions) Allocator.Error![]u8 {
        return gen.getLanguageDisplayName(gpa, self.data, input, o);
    }
    pub fn getScriptDisplayName(self: General, gpa: Allocator, input: NameInput, o: DisplayNameOptions) Allocator.Error![]u8 {
        return gen.getScriptDisplayName(gpa, self.data, input, o);
    }
    pub fn getRegionDisplayName(self: General, gpa: Allocator, input: NameInput, o: DisplayNameOptions) Allocator.Error![]u8 {
        return gen.getRegionDisplayName(gpa, self.data, input, o);
    }
};

pub const Numbers = struct {
    data: *const LocaleData,
    pub fn parseDecimal(_: Numbers, gpa: Allocator, value: []const u8) (@import("../../decimal/decimal.zig").ParseError || Allocator.Error)!Decimal {
        return @import("../../decimal/decimal.zig").parse(gpa, value);
    }
    pub fn getCurrencyFractions(_: Numbers, code: []const u8) num.CurrencyFractions {
        return num.getCurrencyFractions(code);
    }
    pub fn getCurrencyForRegion(_: Numbers, region: []const u8) []const u8 {
        return num.getCurrencyForRegion(region);
    }
    pub fn adjustDecimal(self: Numbers, gpa: Allocator, n: Decimal, options: DecimalAdjustOptions) DecimalError!Decimal {
        return num.adjustDecimal(gpa, self.data, n, options);
    }
    pub fn getCurrencySymbol(self: Numbers, code: []const u8, width: CurrencySymbolWidth) []const u8 {
        return num.getCurrencySymbol(self.data, code, width);
    }
    pub fn getCurrencyDisplayName(self: Numbers, gpa: Allocator, code: []const u8, options: CurrencyDisplayNameOptions) Allocator.Error![]u8 {
        return num.getCurrencyDisplayName(gpa, self.data, code, options);
    }
    pub fn getCurrencyPluralName(self: Numbers, gpa: Allocator, n: Decimal, code: []const u8, options: CurrencyDisplayNameOptions) Allocator.Error![]u8 {
        return num.getCurrencyPluralName(gpa, self.data, n, code, options);
    }
    pub fn getPluralCardinal(self: Numbers, gpa: Allocator, n: Decimal, options: ?DecimalAdjustOptions) DecimalError![]const u8 {
        return num.getPluralCardinal(gpa, self.data, n, options);
    }
    pub fn getPluralOrdinal(self: Numbers, gpa: Allocator, n: Decimal, options: ?DecimalAdjustOptions) DecimalError![]const u8 {
        return num.getPluralOrdinal(gpa, self.data, n, options);
    }
    pub fn formatDecimal(self: Numbers, gpa: Allocator, n: Decimal, options: DecimalFormatOptions) num.Error![]u8 {
        return num.formatDecimal(gpa, self.data, n, options);
    }
    pub fn formatDecimalToParts(self: Numbers, gpa: Allocator, n: Decimal, options: DecimalFormatOptions) num.Error![]Part {
        return num.formatDecimalToParts(gpa, self.data, n, options);
    }
    pub fn formatCurrency(self: Numbers, gpa: Allocator, n: Decimal, code: []const u8, options: CurrencyFormatOptions) num.Error![]u8 {
        return num.formatCurrency(gpa, self.data, n, code, options);
    }
    pub fn formatCurrencyToParts(self: Numbers, gpa: Allocator, n: Decimal, code: []const u8, options: CurrencyFormatOptions) num.Error![]Part {
        return num.formatCurrencyToParts(gpa, self.data, n, code, options);
    }
};

pub const Units = struct {
    data: *const LocaleData,
    pub fn availableUnits(self: Units) []const []const u8 {
        return uni.availableUnits(self.data);
    }
    pub fn getUnitDisplayName(self: Units, name: []const u8, length: ?UnitLength) []const u8 {
        return uni.getUnitDisplayName(self.data, name, length);
    }
    pub fn formatQuantity(self: Units, gpa: Allocator, q: Quantity, options: UnitFormatOptions) DecimalError![]u8 {
        return uni.formatQuantity(gpa, self.data, q, options);
    }
    pub fn formatQuantityToParts(self: Units, gpa: Allocator, q: Quantity, options: UnitFormatOptions) DecimalError![]Part {
        return uni.formatQuantityToParts(gpa, self.data, q, options);
    }
    pub fn formatQuantitySequence(self: Units, gpa: Allocator, qs: []const Quantity, options: UnitFormatOptions) DecimalError![]u8 {
        return uni.formatQuantitySequence(gpa, self.data, qs, options);
    }
    pub fn formatQuantitySequenceToParts(self: Units, gpa: Allocator, qs: []const Quantity, options: UnitFormatOptions) DecimalError![]Part {
        return uni.formatQuantitySequenceToParts(gpa, self.data, qs, options);
    }
};

// Bound calendar and plain-day methods. Return values keep the underlying API's ownership.
const dates = @import("calendars.zig");
const days = @import("days.zig");
const calendar_systems = @import("../systems/calendars/calendars.zig");
const date_options = @import("../common/calendars.zig");
const datetime = @import("../../datetime/datetime.zig");
const timezones = @import("../../timezone/timezone.zig");

pub const Calendars = struct {
    data: *const LocaleData,
    pub fn timeZoneIds(self: Calendars) []const []const u8 {
        return dates.timeZoneIds(self.data.timezone_database);
    }
    pub fn firstDayOfWeek(self: Calendars) i64 {
        return dates.firstDayOfWeek(self.data);
    }
    pub fn minDaysInFirstWeek(self: Calendars) i64 {
        return dates.minDaysInFirstWeek(self.data);
    }
    pub fn toBuddhistDate(self: Calendars, date: dates.DateInput) calendar_systems.CalendarDate {
        return dates.toBuddhistDate(self.data, date);
    }
    pub fn toGregorianDate(self: Calendars, date: dates.DateInput) calendar_systems.CalendarDate {
        return dates.toGregorianDate(self.data, date);
    }
    pub fn toISO8601Date(self: Calendars, date: dates.DateInput) calendar_systems.CalendarDate {
        return dates.toISO8601Date(self.data, date);
    }
    pub fn toJapaneseDate(self: Calendars, date: dates.DateInput) calendar_systems.CalendarDate {
        return dates.toJapaneseDate(self.data, date);
    }
    pub fn toPersianDate(self: Calendars, date: dates.DateInput) calendar_systems.CalendarDate {
        return dates.toPersianDate(self.data, date);
    }
    pub fn newBuddhistDate(self: Calendars, fields: calendar_systems.CalendarDateFields) calendar_systems.Error!calendar_systems.CalendarDate {
        return dates.newBuddhistDate(self.data, fields);
    }
    pub fn newGregorianDate(self: Calendars, fields: calendar_systems.CalendarDateFields) calendar_systems.Error!calendar_systems.CalendarDate {
        return dates.newGregorianDate(self.data, fields);
    }
    pub fn newISO8601Date(self: Calendars, fields: calendar_systems.CalendarDateFields) calendar_systems.Error!calendar_systems.CalendarDate {
        return dates.newISO8601Date(self.data, fields);
    }
    pub fn newJapaneseDate(self: Calendars, fields: calendar_systems.CalendarDateFields) calendar_systems.Error!calendar_systems.CalendarDate {
        return dates.newJapaneseDate(self.data, fields);
    }
    pub fn newPersianDate(self: Calendars, fields: calendar_systems.CalendarDateFields) calendar_systems.Error!calendar_systems.CalendarDate {
        return dates.newPersianDate(self.data, fields);
    }
    pub fn now(self: Calendars, io: std.Io, zone: []const u8) calendar_systems.CalendarDate {
        return dates.now(io, self.data, zone);
    }
    pub fn nowGregorian(self: Calendars, io: std.Io, zone: []const u8) calendar_systems.CalendarDate {
        return dates.nowGregorian(io, self.data, zone);
    }
    pub fn nowBuddhist(self: Calendars, io: std.Io, zone: []const u8) calendar_systems.CalendarDate {
        return dates.nowBuddhist(io, self.data, zone);
    }
    pub fn nowISO8601(self: Calendars, io: std.Io, zone: []const u8) calendar_systems.CalendarDate {
        return dates.nowISO8601(io, self.data, zone);
    }
    pub fn nowJapanese(self: Calendars, io: std.Io, zone: []const u8) calendar_systems.CalendarDate {
        return dates.nowJapanese(io, self.data, zone);
    }
    pub fn nowPersian(self: Calendars, io: std.Io, zone: []const u8) calendar_systems.CalendarDate {
        return dates.nowPersian(io, self.data, zone);
    }
    pub fn fieldOfVisualDifference(self: Calendars, a: dates.DateInput, b: dates.DateInput) ?u8 {
        return dates.fieldOfVisualDifference(self.data, a, b);
    }
    pub fn formatDate(self: Calendars, gpa: Allocator, date: dates.DateInput, options: ?dates.DateFormatOptions) Allocator.Error![]u8 {
        return dates.formatDate(gpa, self.data, date, options);
    }
    pub fn formatDateToParts(self: Calendars, gpa: Allocator, date: dates.DateInput, options: ?dates.DateFormatOptions) Allocator.Error![]Part {
        return dates.formatDateToParts(gpa, self.data, date, options);
    }
    pub fn formatDateRaw(self: Calendars, gpa: Allocator, date: dates.DateInput, options: ?dates.DateRawFormatOptions) Allocator.Error![]u8 {
        return dates.formatDateRaw(gpa, self.data, date, options);
    }
    pub fn formatDateRawToParts(self: Calendars, gpa: Allocator, date: dates.DateInput, options: ?dates.DateRawFormatOptions) Allocator.Error![]Part {
        return dates.formatDateRawToParts(gpa, self.data, date, options);
    }
    pub fn formatDateInterval(self: Calendars, gpa: Allocator, start: dates.DateInput, end: dates.DateInput, options: ?dates.DateIntervalFormatOptions) Allocator.Error![]u8 {
        return dates.formatDateInterval(gpa, self.data, start, end, options);
    }
    pub fn formatDateIntervalToParts(self: Calendars, gpa: Allocator, start: dates.DateInput, end: dates.DateInput, options: ?dates.DateIntervalFormatOptions) Allocator.Error![]Part {
        return dates.formatDateIntervalToParts(gpa, self.data, start, end, options);
    }
    pub fn formatDateWrapper(self: Calendars, gpa: Allocator, date: []const u8, time: []const u8, options: ?dates.DateWrapperFormatOptions) Allocator.Error![]u8 {
        return dates.formatDateWrapper(gpa, self.data, date, time, options);
    }
    pub fn formatDateWrapperToParts(self: Calendars, gpa: Allocator, date: []const Part, time: []const Part, options: ?dates.DateWrapperFormatOptions) Allocator.Error![]Part {
        return dates.formatDateWrapperToParts(gpa, self.data, date, time, options);
    }
    pub fn formatRelativeTimeField(self: Calendars, gpa: Allocator, value: Decimal, field: []const u8, options: ?dates.RelativeTimeFieldFormatOptions) DecimalError![]u8 {
        return dates.formatRelativeTimeField(gpa, self.data, value, field, options);
    }
    pub fn formatRelativeTime(self: Calendars, gpa: Allocator, start: dates.DateInput, end: dates.DateInput, options: ?dates.RelativeTimeFormatOptions) DecimalError![]u8 {
        return dates.formatRelativeTime(gpa, self.data, start, end, options);
    }
    pub fn dateField(self: Calendars, gpa: Allocator, field: []const u8, options: ?dates.DateFieldFormatOptions) Allocator.Error![]u8 {
        return dates.dateField(gpa, self.data, field, options);
    }
    /// Field maps own an arena; release with .deinit().
    pub fn months(self: Calendars, gpa: Allocator, options: ?dates.CalendarFieldsOptions) Allocator.Error!dates.FieldMap {
        return dates.months(gpa, self.data, options);
    }
    pub fn weekdays(self: Calendars, gpa: Allocator, options: ?dates.CalendarFieldsOptions) Allocator.Error!dates.FieldMap {
        return dates.weekdays(gpa, self.data, options);
    }
    pub fn quarters(self: Calendars, gpa: Allocator, options: ?dates.CalendarFieldsOptions) Allocator.Error!dates.FieldMap {
        return dates.quarters(gpa, self.data, options);
    }
    pub fn dayPeriods(self: Calendars, gpa: Allocator, options: ?dates.CalendarFieldsOptions) Allocator.Error!dates.FieldMap {
        return dates.dayPeriods(gpa, self.data, options);
    }
    pub fn eras(self: Calendars, gpa: Allocator, options: ?dates.EraFieldOptions) Allocator.Error!dates.FieldMap {
        return dates.eras(gpa, self.data, options);
    }
    /// Only the returned allowed slice is owned by gpa; its strings are borrowed.
    pub fn timeData(self: Calendars, gpa: Allocator) Allocator.Error!date_options.TimeData {
        return dates.timeData(gpa, self.data);
    }
    pub fn resolveTimeZoneId(self: Calendars, id: []const u8) ?[]const u8 {
        return dates.resolveTimeZoneId(self.data.timezone_database, id);
    }
    pub fn timeZoneFromUTC(self: Calendars, utc: i64, id: []const u8) ?timezones.ZoneInfo {
        return dates.timeZoneFromUTC(self.data.timezone_database, utc, id);
    }
    pub fn timeZoneFromWall(self: Calendars, wall: i64, id: []const u8) ?timezones.WallResult {
        return dates.timeZoneFromWall(self.data.timezone_database, wall, id);
    }
    pub fn timeZoneInfo(self: Calendars, zone: []const u8) date_options.TimeZoneInfo {
        return dates.timeZoneInfo(self.data, zone);
    }
    /// Owned quantities and Decimals; free with unit_options.freeQuantities.
    pub fn timePeriodToQuantity(_: Calendars, a: Allocator, period: calendar_systems.TimePeriod) Allocator.Error![]@import("../common/units.zig").Quantity {
        return dates.timePeriodToQuantity(a, period);
    }
    pub fn formatDay(self: Calendars, a: Allocator, d: datetime.Day, options: ?days.DayFormatOptions) days.Error![]u8 {
        return days.formatDay(a, self.data, d, options);
    }
    pub fn formatDayToParts(self: Calendars, a: Allocator, d: datetime.Day, options: ?days.DayFormatOptions) days.Error![]Part {
        return days.formatDayToParts(a, self.data, d, options);
    }
    pub fn formatDayInterval(self: Calendars, a: Allocator, start: datetime.Day, end: datetime.Day, options: ?days.DayIntervalFormatOptions) days.Error![]u8 {
        return days.formatDayInterval(a, self.data, start, end, options);
    }
    pub fn formatDayIntervalToParts(self: Calendars, a: Allocator, start: datetime.Day, end: datetime.Day, options: ?days.DayIntervalFormatOptions) days.Error![]Part {
        return days.formatDayIntervalToParts(a, self.data, start, end, options);
    }
    pub fn formatTimeOfDay(self: Calendars, a: Allocator, t: datetime.TimeOfDay, options: ?days.TimeOfDayFormatOptions) days.Error![]u8 {
        return days.formatTimeOfDay(a, self.data, t, options);
    }
    pub fn formatTimeOfDayToParts(self: Calendars, a: Allocator, t: datetime.TimeOfDay, options: ?days.TimeOfDayFormatOptions) days.Error![]Part {
        return days.formatTimeOfDayToParts(a, self.data, t, options);
    }
    pub fn formatDayRelative(self: Calendars, a: Allocator, d: datetime.Day, relative_to: datetime.Day, options: ?date_options.RelativeTimeFieldFormatOptions) days.Error![]u8 {
        return days.formatDayRelative(a, self.data, d, relative_to, options);
    }
    pub fn formatInstant(self: Calendars, a: Allocator, instant: datetime.Instant, zone: []const u8, options: ?date_options.DateFormatOptions) days.Error![]u8 {
        return days.formatInstant(a, self.data, instant, zone, options);
    }
    pub fn formatInstantToParts(self: Calendars, a: Allocator, instant: datetime.Instant, zone: []const u8, options: ?date_options.DateFormatOptions) days.Error![]Part {
        return days.formatInstantToParts(a, self.data, instant, zone, options);
    }
    pub fn formatInstantRelative(self: Calendars, a: Allocator, instant: datetime.Instant, relative_to: datetime.Instant, zone: []const u8, options: ?date_options.RelativeTimeFormatOptions) days.Error![]u8 {
        return days.formatInstantRelative(a, self.data, instant, relative_to, zone, options);
    }
};
