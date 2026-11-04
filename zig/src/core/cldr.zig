//! Convenience layer (`cldr.ts`). The bound groups are small values borrowing LocaleData.
//! `var fw = CLDRFramework.init(gpa, options); const en = try fw.get(.{ .id = "en" });`
//! `const s = try en.formatDecimal(gpa, n, .{});`
const std = @import("std");
const framework = @import("framework.zig");
const LocaleData = @import("locale_data.zig").LocaleData;
const api = @import("api/api.zig");

/// A borrowed binding. It stays valid while its owning handle or standalone LocaleData lives.
pub const CLDRView = struct {
    data: *const LocaleData,
    schema: *const @import("types/schema.zig").Schema,
    calendars: api.Calendars,
    general: api.General,
    numbers: api.Numbers,
    units: api.Units,

    /// TypeScript `bundle`, bound to this locale.
    pub fn bundle(self: CLDRView) *const LocaleData {
        return self.general.bundle();
    }

    /// TypeScript `locale`, bound to this locale.
    pub fn locale(self: CLDRView) @import("../locale/locale.zig").Locale {
        return self.general.locale();
    }

    /// TypeScript `resolveLocale`, bound to this locale.
    pub fn resolveLocale(self: CLDRView, gpa: Allocator, id: []const u8) Allocator.Error!@import("../locale/locale.zig").Locale {
        return self.general.resolveLocale(gpa, id);
    }

    /// TypeScript `resolveLocaleTag`, bound to this locale.
    pub fn resolveLocaleTag(self: CLDRView, gpa: Allocator, tag: @import("../language_tag/language_tag.zig").LanguageTag) Allocator.Error!@import("../locale/locale.zig").Locale {
        return self.general.resolveLocaleTag(gpa, tag);
    }

    /// TypeScript `parseLanguageTag`, bound to this locale.
    pub fn parseLanguageTag(self: CLDRView, gpa: Allocator, code: []const u8) Allocator.Error!@import("../language_tag/language_tag.zig").LanguageTag {
        return self.general.parseLanguageTag(gpa, code);
    }

    /// TypeScript `characterOrder`, bound to this locale.
    pub fn characterOrder(self: CLDRView) gen_options.CharacterOrder {
        return self.general.characterOrder();
    }

    /// TypeScript `lineOrder`, bound to this locale.
    pub fn lineOrder(self: CLDRView) gen_options.LineOrder {
        return self.general.lineOrder();
    }

    /// TypeScript `measurementSystem`, bound to this locale.
    pub fn measurementSystem(self: CLDRView, category: ?gen_options.MeasurementCategory) gen_options.MeasurementSystem {
        return self.general.measurementSystem(category);
    }

    /// TypeScript `messageFormatter`, bound to this locale.
    pub fn messageFormatter(self: CLDRView) Allocator.Error!*mf.MessageFormatter {
        return self.general.messageFormatter();
    }

    /// TypeScript `createMessageFormatter`, bound to this locale.
    pub fn createMessageFormatter(self: CLDRView, gpa: Allocator, opts: mf.MessageFormatterOptions) Allocator.Error!mf.MessageFormatter {
        return self.general.createMessageFormatter(gpa, opts);
    }

    /// TypeScript `formatList`, bound to this locale.
    pub fn formatList(self: CLDRView, gpa: Allocator, items: []const []const u8, t: ?ListPatternType) Allocator.Error![]u8 {
        return self.general.formatList(gpa, items, t);
    }

    /// TypeScript `formatListToParts`, bound to this locale.
    pub fn formatListToParts(self: CLDRView, gpa: Allocator, items: []const []const u8, t: ?ListPatternType) Allocator.Error![]Part {
        return self.general.formatListToParts(gpa, items, t);
    }

    /// TypeScript `getLanguageDisplayName`, bound to this locale.
    pub fn getLanguageDisplayName(self: CLDRView, gpa: Allocator, input: NameInput, o: DisplayNameOptions) Allocator.Error![]u8 {
        return self.general.getLanguageDisplayName(gpa, input, o);
    }

    /// TypeScript `getScriptDisplayName`, bound to this locale.
    pub fn getScriptDisplayName(self: CLDRView, gpa: Allocator, input: NameInput, o: DisplayNameOptions) Allocator.Error![]u8 {
        return self.general.getScriptDisplayName(gpa, input, o);
    }

    /// TypeScript `getRegionDisplayName`, bound to this locale.
    pub fn getRegionDisplayName(self: CLDRView, gpa: Allocator, input: NameInput, o: DisplayNameOptions) Allocator.Error![]u8 {
        return self.general.getRegionDisplayName(gpa, input, o);
    }

    /// TypeScript `parseDecimal`, bound to this locale.
    pub fn parseDecimal(self: CLDRView, gpa: Allocator, value: []const u8) (@import("../decimal/decimal.zig").ParseError || Allocator.Error)!Decimal {
        return self.numbers.parseDecimal(gpa, value);
    }

    /// TypeScript `getCurrencyFractions`, bound to this locale.
    pub fn getCurrencyFractions(self: CLDRView, code: []const u8) num.CurrencyFractions {
        return self.numbers.getCurrencyFractions(code);
    }

    /// TypeScript `getCurrencyForRegion`, bound to this locale.
    pub fn getCurrencyForRegion(self: CLDRView, region: []const u8) []const u8 {
        return self.numbers.getCurrencyForRegion(region);
    }

    /// TypeScript `adjustDecimal`, bound to this locale.
    pub fn adjustDecimal(self: CLDRView, gpa: Allocator, n: Decimal, options: DecimalAdjustOptions) DecimalError!Decimal {
        return self.numbers.adjustDecimal(gpa, n, options);
    }

    /// TypeScript `getCurrencySymbol`, bound to this locale.
    pub fn getCurrencySymbol(self: CLDRView, code: []const u8, width: CurrencySymbolWidth) []const u8 {
        return self.numbers.getCurrencySymbol(code, width);
    }

    /// TypeScript `getCurrencyDisplayName`, bound to this locale.
    pub fn getCurrencyDisplayName(self: CLDRView, gpa: Allocator, code: []const u8, options: CurrencyDisplayNameOptions) Allocator.Error![]u8 {
        return self.numbers.getCurrencyDisplayName(gpa, code, options);
    }

    /// TypeScript `getCurrencyPluralName`, bound to this locale.
    pub fn getCurrencyPluralName(self: CLDRView, gpa: Allocator, n: Decimal, code: []const u8, options: CurrencyDisplayNameOptions) Allocator.Error![]u8 {
        return self.numbers.getCurrencyPluralName(gpa, n, code, options);
    }

    /// TypeScript `getPluralCardinal`, bound to this locale.
    pub fn getPluralCardinal(self: CLDRView, gpa: Allocator, n: Decimal, options: ?DecimalAdjustOptions) DecimalError![]const u8 {
        return self.numbers.getPluralCardinal(gpa, n, options);
    }

    /// TypeScript `getPluralOrdinal`, bound to this locale.
    pub fn getPluralOrdinal(self: CLDRView, gpa: Allocator, n: Decimal, options: ?DecimalAdjustOptions) DecimalError![]const u8 {
        return self.numbers.getPluralOrdinal(gpa, n, options);
    }

    /// TypeScript `formatDecimal`, bound to this locale.
    pub fn formatDecimal(self: CLDRView, gpa: Allocator, n: Decimal, options: DecimalFormatOptions) num.Error![]u8 {
        return self.numbers.formatDecimal(gpa, n, options);
    }

    /// TypeScript `formatDecimalToParts`, bound to this locale.
    pub fn formatDecimalToParts(self: CLDRView, gpa: Allocator, n: Decimal, options: DecimalFormatOptions) num.Error![]Part {
        return self.numbers.formatDecimalToParts(gpa, n, options);
    }

    /// TypeScript `formatCurrency`, bound to this locale.
    pub fn formatCurrency(self: CLDRView, gpa: Allocator, n: Decimal, code: []const u8, options: CurrencyFormatOptions) num.Error![]u8 {
        return self.numbers.formatCurrency(gpa, n, code, options);
    }

    /// TypeScript `formatCurrencyToParts`, bound to this locale.
    pub fn formatCurrencyToParts(self: CLDRView, gpa: Allocator, n: Decimal, code: []const u8, options: CurrencyFormatOptions) num.Error![]Part {
        return self.numbers.formatCurrencyToParts(gpa, n, code, options);
    }

    /// TypeScript `availableUnits`, bound to this locale.
    pub fn availableUnits(self: CLDRView) []const []const u8 {
        return self.units.availableUnits();
    }

    /// TypeScript `getUnitDisplayName`, bound to this locale.
    pub fn getUnitDisplayName(self: CLDRView, name: []const u8, length: ?UnitLength) []const u8 {
        return self.units.getUnitDisplayName(name, length);
    }

    /// TypeScript `formatQuantity`, bound to this locale.
    pub fn formatQuantity(self: CLDRView, gpa: Allocator, q: Quantity, options: UnitFormatOptions) DecimalError![]u8 {
        return self.units.formatQuantity(gpa, q, options);
    }

    /// TypeScript `formatQuantityToParts`, bound to this locale.
    pub fn formatQuantityToParts(self: CLDRView, gpa: Allocator, q: Quantity, options: UnitFormatOptions) DecimalError![]Part {
        return self.units.formatQuantityToParts(gpa, q, options);
    }

    /// TypeScript `formatQuantitySequence`, bound to this locale.
    pub fn formatQuantitySequence(self: CLDRView, gpa: Allocator, qs: []const Quantity, options: UnitFormatOptions) DecimalError![]u8 {
        return self.units.formatQuantitySequence(gpa, qs, options);
    }

    /// TypeScript `formatQuantitySequenceToParts`, bound to this locale.
    pub fn formatQuantitySequenceToParts(self: CLDRView, gpa: Allocator, qs: []const Quantity, options: UnitFormatOptions) DecimalError![]Part {
        return self.units.formatQuantitySequenceToParts(gpa, qs, options);
    }

    /// TypeScript `timeZoneIds`, bound to this locale.
    pub fn timeZoneIds(self: CLDRView) []const []const u8 {
        return self.calendars.timeZoneIds();
    }

    /// TypeScript `firstDayOfWeek`, bound to this locale.
    pub fn firstDayOfWeek(self: CLDRView) i64 {
        return self.calendars.firstDayOfWeek();
    }

    /// TypeScript `minDaysInFirstWeek`, bound to this locale.
    pub fn minDaysInFirstWeek(self: CLDRView) i64 {
        return self.calendars.minDaysInFirstWeek();
    }

    /// TypeScript `toBuddhistDate`, bound to this locale.
    pub fn toBuddhistDate(self: CLDRView, date: dates.DateInput) calendar_systems.CalendarDate {
        return self.calendars.toBuddhistDate(date);
    }

    /// TypeScript `toGregorianDate`, bound to this locale.
    pub fn toGregorianDate(self: CLDRView, date: dates.DateInput) calendar_systems.CalendarDate {
        return self.calendars.toGregorianDate(date);
    }

    /// TypeScript `toISO8601Date`, bound to this locale.
    pub fn toISO8601Date(self: CLDRView, date: dates.DateInput) calendar_systems.CalendarDate {
        return self.calendars.toISO8601Date(date);
    }

    /// TypeScript `toJapaneseDate`, bound to this locale.
    pub fn toJapaneseDate(self: CLDRView, date: dates.DateInput) calendar_systems.CalendarDate {
        return self.calendars.toJapaneseDate(date);
    }

    /// TypeScript `toPersianDate`, bound to this locale.
    pub fn toPersianDate(self: CLDRView, date: dates.DateInput) calendar_systems.CalendarDate {
        return self.calendars.toPersianDate(date);
    }

    /// TypeScript `newBuddhistDate`, bound to this locale.
    pub fn newBuddhistDate(self: CLDRView, fields: calendar_systems.CalendarDateFields) calendar_systems.Error!calendar_systems.CalendarDate {
        return self.calendars.newBuddhistDate(fields);
    }

    /// TypeScript `newGregorianDate`, bound to this locale.
    pub fn newGregorianDate(self: CLDRView, fields: calendar_systems.CalendarDateFields) calendar_systems.Error!calendar_systems.CalendarDate {
        return self.calendars.newGregorianDate(fields);
    }

    /// TypeScript `newISO8601Date`, bound to this locale.
    pub fn newISO8601Date(self: CLDRView, fields: calendar_systems.CalendarDateFields) calendar_systems.Error!calendar_systems.CalendarDate {
        return self.calendars.newISO8601Date(fields);
    }

    /// TypeScript `newJapaneseDate`, bound to this locale.
    pub fn newJapaneseDate(self: CLDRView, fields: calendar_systems.CalendarDateFields) calendar_systems.Error!calendar_systems.CalendarDate {
        return self.calendars.newJapaneseDate(fields);
    }

    /// TypeScript `newPersianDate`, bound to this locale.
    pub fn newPersianDate(self: CLDRView, fields: calendar_systems.CalendarDateFields) calendar_systems.Error!calendar_systems.CalendarDate {
        return self.calendars.newPersianDate(fields);
    }

    /// TypeScript `now`, bound to this locale.
    pub fn now(self: CLDRView, io: std.Io, zone: []const u8) calendar_systems.CalendarDate {
        return self.calendars.now(io, zone);
    }

    /// TypeScript `nowGregorian`, bound to this locale.
    pub fn nowGregorian(self: CLDRView, io: std.Io, zone: []const u8) calendar_systems.CalendarDate {
        return self.calendars.nowGregorian(io, zone);
    }

    /// TypeScript `nowBuddhist`, bound to this locale.
    pub fn nowBuddhist(self: CLDRView, io: std.Io, zone: []const u8) calendar_systems.CalendarDate {
        return self.calendars.nowBuddhist(io, zone);
    }

    /// TypeScript `nowISO8601`, bound to this locale.
    pub fn nowISO8601(self: CLDRView, io: std.Io, zone: []const u8) calendar_systems.CalendarDate {
        return self.calendars.nowISO8601(io, zone);
    }

    /// TypeScript `nowJapanese`, bound to this locale.
    pub fn nowJapanese(self: CLDRView, io: std.Io, zone: []const u8) calendar_systems.CalendarDate {
        return self.calendars.nowJapanese(io, zone);
    }

    /// TypeScript `nowPersian`, bound to this locale.
    pub fn nowPersian(self: CLDRView, io: std.Io, zone: []const u8) calendar_systems.CalendarDate {
        return self.calendars.nowPersian(io, zone);
    }

    /// TypeScript `fieldOfVisualDifference`, bound to this locale.
    pub fn fieldOfVisualDifference(self: CLDRView, a: dates.DateInput, b: dates.DateInput) ?u8 {
        return self.calendars.fieldOfVisualDifference(a, b);
    }

    /// TypeScript `formatDate`, bound to this locale.
    pub fn formatDate(self: CLDRView, gpa: Allocator, date: dates.DateInput, options: ?dates.DateFormatOptions) Allocator.Error![]u8 {
        return self.calendars.formatDate(gpa, date, options);
    }

    /// TypeScript `formatDateToParts`, bound to this locale.
    pub fn formatDateToParts(self: CLDRView, gpa: Allocator, date: dates.DateInput, options: ?dates.DateFormatOptions) Allocator.Error![]Part {
        return self.calendars.formatDateToParts(gpa, date, options);
    }

    /// TypeScript `formatDateRaw`, bound to this locale.
    pub fn formatDateRaw(self: CLDRView, gpa: Allocator, date: dates.DateInput, options: ?dates.DateRawFormatOptions) Allocator.Error![]u8 {
        return self.calendars.formatDateRaw(gpa, date, options);
    }

    /// TypeScript `formatDateRawToParts`, bound to this locale.
    pub fn formatDateRawToParts(self: CLDRView, gpa: Allocator, date: dates.DateInput, options: ?dates.DateRawFormatOptions) Allocator.Error![]Part {
        return self.calendars.formatDateRawToParts(gpa, date, options);
    }

    /// TypeScript `formatDateInterval`, bound to this locale.
    pub fn formatDateInterval(self: CLDRView, gpa: Allocator, start: dates.DateInput, end: dates.DateInput, options: ?dates.DateIntervalFormatOptions) Allocator.Error![]u8 {
        return self.calendars.formatDateInterval(gpa, start, end, options);
    }

    /// TypeScript `formatDateIntervalToParts`, bound to this locale.
    pub fn formatDateIntervalToParts(self: CLDRView, gpa: Allocator, start: dates.DateInput, end: dates.DateInput, options: ?dates.DateIntervalFormatOptions) Allocator.Error![]Part {
        return self.calendars.formatDateIntervalToParts(gpa, start, end, options);
    }

    /// TypeScript `formatDateWrapper`, bound to this locale.
    pub fn formatDateWrapper(self: CLDRView, gpa: Allocator, date: []const u8, time: []const u8, options: ?dates.DateWrapperFormatOptions) Allocator.Error![]u8 {
        return self.calendars.formatDateWrapper(gpa, date, time, options);
    }

    /// TypeScript `formatDateWrapperToParts`, bound to this locale.
    pub fn formatDateWrapperToParts(self: CLDRView, gpa: Allocator, date: []const Part, time: []const Part, options: ?dates.DateWrapperFormatOptions) Allocator.Error![]Part {
        return self.calendars.formatDateWrapperToParts(gpa, date, time, options);
    }

    /// TypeScript `formatRelativeTimeField`, bound to this locale.
    pub fn formatRelativeTimeField(self: CLDRView, gpa: Allocator, value: Decimal, field: []const u8, options: ?dates.RelativeTimeFieldFormatOptions) DecimalError![]u8 {
        return self.calendars.formatRelativeTimeField(gpa, value, field, options);
    }

    /// TypeScript `formatRelativeTime`, bound to this locale.
    pub fn formatRelativeTime(self: CLDRView, gpa: Allocator, start: dates.DateInput, end: dates.DateInput, options: ?dates.RelativeTimeFormatOptions) DecimalError![]u8 {
        return self.calendars.formatRelativeTime(gpa, start, end, options);
    }

    /// TypeScript `dateField`, bound to this locale.
    pub fn dateField(self: CLDRView, gpa: Allocator, field: []const u8, options: ?dates.DateFieldFormatOptions) Allocator.Error![]u8 {
        return self.calendars.dateField(gpa, field, options);
    }

    /// TypeScript `months`, bound to this locale.
    pub fn months(self: CLDRView, gpa: Allocator, options: ?dates.CalendarFieldsOptions) Allocator.Error!dates.FieldMap {
        return self.calendars.months(gpa, options);
    }

    /// TypeScript `weekdays`, bound to this locale.
    pub fn weekdays(self: CLDRView, gpa: Allocator, options: ?dates.CalendarFieldsOptions) Allocator.Error!dates.FieldMap {
        return self.calendars.weekdays(gpa, options);
    }

    /// TypeScript `quarters`, bound to this locale.
    pub fn quarters(self: CLDRView, gpa: Allocator, options: ?dates.CalendarFieldsOptions) Allocator.Error!dates.FieldMap {
        return self.calendars.quarters(gpa, options);
    }

    /// TypeScript `dayPeriods`, bound to this locale.
    pub fn dayPeriods(self: CLDRView, gpa: Allocator, options: ?dates.CalendarFieldsOptions) Allocator.Error!dates.FieldMap {
        return self.calendars.dayPeriods(gpa, options);
    }

    /// TypeScript `eras`, bound to this locale.
    pub fn eras(self: CLDRView, gpa: Allocator, options: ?dates.EraFieldOptions) Allocator.Error!dates.FieldMap {
        return self.calendars.eras(gpa, options);
    }

    /// TypeScript `timeData`, bound to this locale.
    pub fn timeData(self: CLDRView, gpa: Allocator) Allocator.Error!date_options.TimeData {
        return self.calendars.timeData(gpa);
    }

    /// TypeScript `resolveTimeZoneId`, bound to this locale.
    pub fn resolveTimeZoneId(self: CLDRView, id: []const u8) ?[]const u8 {
        return self.calendars.resolveTimeZoneId(id);
    }

    /// TypeScript `timeZoneFromUTC`, bound to this locale.
    pub fn timeZoneFromUTC(self: CLDRView, utc: i64, id: []const u8) ?timezones.ZoneInfo {
        return self.calendars.timeZoneFromUTC(utc, id);
    }

    /// TypeScript `timeZoneFromWall`, bound to this locale.
    pub fn timeZoneFromWall(self: CLDRView, wall: i64, id: []const u8) ?timezones.WallResult {
        return self.calendars.timeZoneFromWall(wall, id);
    }

    /// TypeScript `timeZoneInfo`, bound to this locale.
    pub fn timeZoneInfo(self: CLDRView, zone: []const u8) date_options.TimeZoneInfo {
        return self.calendars.timeZoneInfo(zone);
    }

    /// TypeScript `timePeriodToQuantity`, bound to this locale.
    pub fn timePeriodToQuantity(self: CLDRView, a: Allocator, period: calendar_systems.TimePeriod) Allocator.Error![]@import("common/units.zig").Quantity {
        return self.calendars.timePeriodToQuantity(a, period);
    }

    /// TypeScript `formatDay`, bound to this locale.
    pub fn formatDay(self: CLDRView, a: Allocator, d: datetime.Day, options: ?days.DayFormatOptions) days.Error![]u8 {
        return self.calendars.formatDay(a, d, options);
    }

    /// TypeScript `formatDayToParts`, bound to this locale.
    pub fn formatDayToParts(self: CLDRView, a: Allocator, d: datetime.Day, options: ?days.DayFormatOptions) days.Error![]Part {
        return self.calendars.formatDayToParts(a, d, options);
    }

    /// TypeScript `formatDayInterval`, bound to this locale.
    pub fn formatDayInterval(self: CLDRView, a: Allocator, start: datetime.Day, end: datetime.Day, options: ?days.DayIntervalFormatOptions) days.Error![]u8 {
        return self.calendars.formatDayInterval(a, start, end, options);
    }

    /// TypeScript `formatDayIntervalToParts`, bound to this locale.
    pub fn formatDayIntervalToParts(self: CLDRView, a: Allocator, start: datetime.Day, end: datetime.Day, options: ?days.DayIntervalFormatOptions) days.Error![]Part {
        return self.calendars.formatDayIntervalToParts(a, start, end, options);
    }

    /// TypeScript `formatTimeOfDay`, bound to this locale.
    pub fn formatTimeOfDay(self: CLDRView, a: Allocator, t: datetime.TimeOfDay, options: ?days.TimeOfDayFormatOptions) days.Error![]u8 {
        return self.calendars.formatTimeOfDay(a, t, options);
    }

    /// TypeScript `formatTimeOfDayToParts`, bound to this locale.
    pub fn formatTimeOfDayToParts(self: CLDRView, a: Allocator, t: datetime.TimeOfDay, options: ?days.TimeOfDayFormatOptions) days.Error![]Part {
        return self.calendars.formatTimeOfDayToParts(a, t, options);
    }

    /// TypeScript `formatDayRelative`, bound to this locale.
    pub fn formatDayRelative(self: CLDRView, a: Allocator, d: datetime.Day, relative_to: datetime.Day, options: ?date_options.RelativeTimeFieldFormatOptions) days.Error![]u8 {
        return self.calendars.formatDayRelative(a, d, relative_to, options);
    }

    /// TypeScript `formatInstant`, bound to this locale.
    pub fn formatInstant(self: CLDRView, a: Allocator, instant: datetime.Instant, zone: []const u8, options: ?date_options.DateFormatOptions) days.Error![]u8 {
        return self.calendars.formatInstant(a, instant, zone, options);
    }

    /// TypeScript `formatInstantToParts`, bound to this locale.
    pub fn formatInstantToParts(self: CLDRView, a: Allocator, instant: datetime.Instant, zone: []const u8, options: ?date_options.DateFormatOptions) days.Error![]Part {
        return self.calendars.formatInstantToParts(a, instant, zone, options);
    }

    /// TypeScript `formatInstantRelative`, bound to this locale.
    pub fn formatInstantRelative(self: CLDRView, a: Allocator, instant: datetime.Instant, relative_to: datetime.Instant, zone: []const u8, options: ?date_options.RelativeTimeFormatOptions) days.Error![]u8 {
        return self.calendars.formatInstantRelative(a, instant, relative_to, zone, options);
    }
};
/// Owning locale convenience object (`CLDR`). Single-threaded lazy caches. The groups
/// borrow this owner's data. Clone explicitly for an independent owner; deinit once.
pub const CLDR = struct {
    handle: framework.LocaleHandle,
    data: *const LocaleData,
    schema: *const @import("types/schema.zig").Schema,
    calendars: api.Calendars,
    general: api.General,
    numbers: api.Numbers,
    units: api.Units,
    pub fn deinit(self: CLDR) void {
        self.handle.deinit();
    }
    pub fn clone(self: CLDR) CLDR {
        var result = self;
        result.handle = self.handle.clone();
        return result;
    }

    /// TypeScript `bundle`, bound to this locale.
    pub fn bundle(self: CLDR) *const LocaleData {
        return self.general.bundle();
    }

    /// TypeScript `locale`, bound to this locale.
    pub fn locale(self: CLDR) @import("../locale/locale.zig").Locale {
        return self.general.locale();
    }

    /// TypeScript `resolveLocale`, bound to this locale.
    pub fn resolveLocale(self: CLDR, gpa: Allocator, id: []const u8) Allocator.Error!@import("../locale/locale.zig").Locale {
        return self.general.resolveLocale(gpa, id);
    }

    /// TypeScript `resolveLocaleTag`, bound to this locale.
    pub fn resolveLocaleTag(self: CLDR, gpa: Allocator, tag: @import("../language_tag/language_tag.zig").LanguageTag) Allocator.Error!@import("../locale/locale.zig").Locale {
        return self.general.resolveLocaleTag(gpa, tag);
    }

    /// TypeScript `parseLanguageTag`, bound to this locale.
    pub fn parseLanguageTag(self: CLDR, gpa: Allocator, code: []const u8) Allocator.Error!@import("../language_tag/language_tag.zig").LanguageTag {
        return self.general.parseLanguageTag(gpa, code);
    }

    /// TypeScript `characterOrder`, bound to this locale.
    pub fn characterOrder(self: CLDR) gen_options.CharacterOrder {
        return self.general.characterOrder();
    }

    /// TypeScript `lineOrder`, bound to this locale.
    pub fn lineOrder(self: CLDR) gen_options.LineOrder {
        return self.general.lineOrder();
    }

    /// TypeScript `measurementSystem`, bound to this locale.
    pub fn measurementSystem(self: CLDR, category: ?gen_options.MeasurementCategory) gen_options.MeasurementSystem {
        return self.general.measurementSystem(category);
    }

    /// TypeScript `messageFormatter`, bound to this locale.
    pub fn messageFormatter(self: CLDR) Allocator.Error!*mf.MessageFormatter {
        return self.general.messageFormatter();
    }

    /// TypeScript `createMessageFormatter`, bound to this locale.
    pub fn createMessageFormatter(self: CLDR, gpa: Allocator, opts: mf.MessageFormatterOptions) Allocator.Error!mf.MessageFormatter {
        return self.general.createMessageFormatter(gpa, opts);
    }

    /// TypeScript `formatList`, bound to this locale.
    pub fn formatList(self: CLDR, gpa: Allocator, items: []const []const u8, t: ?ListPatternType) Allocator.Error![]u8 {
        return self.general.formatList(gpa, items, t);
    }

    /// TypeScript `formatListToParts`, bound to this locale.
    pub fn formatListToParts(self: CLDR, gpa: Allocator, items: []const []const u8, t: ?ListPatternType) Allocator.Error![]Part {
        return self.general.formatListToParts(gpa, items, t);
    }

    /// TypeScript `getLanguageDisplayName`, bound to this locale.
    pub fn getLanguageDisplayName(self: CLDR, gpa: Allocator, input: NameInput, o: DisplayNameOptions) Allocator.Error![]u8 {
        return self.general.getLanguageDisplayName(gpa, input, o);
    }

    /// TypeScript `getScriptDisplayName`, bound to this locale.
    pub fn getScriptDisplayName(self: CLDR, gpa: Allocator, input: NameInput, o: DisplayNameOptions) Allocator.Error![]u8 {
        return self.general.getScriptDisplayName(gpa, input, o);
    }

    /// TypeScript `getRegionDisplayName`, bound to this locale.
    pub fn getRegionDisplayName(self: CLDR, gpa: Allocator, input: NameInput, o: DisplayNameOptions) Allocator.Error![]u8 {
        return self.general.getRegionDisplayName(gpa, input, o);
    }

    /// TypeScript `parseDecimal`, bound to this locale.
    pub fn parseDecimal(self: CLDR, gpa: Allocator, value: []const u8) (@import("../decimal/decimal.zig").ParseError || Allocator.Error)!Decimal {
        return self.numbers.parseDecimal(gpa, value);
    }

    /// TypeScript `getCurrencyFractions`, bound to this locale.
    pub fn getCurrencyFractions(self: CLDR, code: []const u8) num.CurrencyFractions {
        return self.numbers.getCurrencyFractions(code);
    }

    /// TypeScript `getCurrencyForRegion`, bound to this locale.
    pub fn getCurrencyForRegion(self: CLDR, region: []const u8) []const u8 {
        return self.numbers.getCurrencyForRegion(region);
    }

    /// TypeScript `adjustDecimal`, bound to this locale.
    pub fn adjustDecimal(self: CLDR, gpa: Allocator, n: Decimal, options: DecimalAdjustOptions) DecimalError!Decimal {
        return self.numbers.adjustDecimal(gpa, n, options);
    }

    /// TypeScript `getCurrencySymbol`, bound to this locale.
    pub fn getCurrencySymbol(self: CLDR, code: []const u8, width: CurrencySymbolWidth) []const u8 {
        return self.numbers.getCurrencySymbol(code, width);
    }

    /// TypeScript `getCurrencyDisplayName`, bound to this locale.
    pub fn getCurrencyDisplayName(self: CLDR, gpa: Allocator, code: []const u8, options: CurrencyDisplayNameOptions) Allocator.Error![]u8 {
        return self.numbers.getCurrencyDisplayName(gpa, code, options);
    }

    /// TypeScript `getCurrencyPluralName`, bound to this locale.
    pub fn getCurrencyPluralName(self: CLDR, gpa: Allocator, n: Decimal, code: []const u8, options: CurrencyDisplayNameOptions) Allocator.Error![]u8 {
        return self.numbers.getCurrencyPluralName(gpa, n, code, options);
    }

    /// TypeScript `getPluralCardinal`, bound to this locale.
    pub fn getPluralCardinal(self: CLDR, gpa: Allocator, n: Decimal, options: ?DecimalAdjustOptions) DecimalError![]const u8 {
        return self.numbers.getPluralCardinal(gpa, n, options);
    }

    /// TypeScript `getPluralOrdinal`, bound to this locale.
    pub fn getPluralOrdinal(self: CLDR, gpa: Allocator, n: Decimal, options: ?DecimalAdjustOptions) DecimalError![]const u8 {
        return self.numbers.getPluralOrdinal(gpa, n, options);
    }

    /// TypeScript `formatDecimal`, bound to this locale.
    pub fn formatDecimal(self: CLDR, gpa: Allocator, n: Decimal, options: DecimalFormatOptions) num.Error![]u8 {
        return self.numbers.formatDecimal(gpa, n, options);
    }

    /// TypeScript `formatDecimalToParts`, bound to this locale.
    pub fn formatDecimalToParts(self: CLDR, gpa: Allocator, n: Decimal, options: DecimalFormatOptions) num.Error![]Part {
        return self.numbers.formatDecimalToParts(gpa, n, options);
    }

    /// TypeScript `formatCurrency`, bound to this locale.
    pub fn formatCurrency(self: CLDR, gpa: Allocator, n: Decimal, code: []const u8, options: CurrencyFormatOptions) num.Error![]u8 {
        return self.numbers.formatCurrency(gpa, n, code, options);
    }

    /// TypeScript `formatCurrencyToParts`, bound to this locale.
    pub fn formatCurrencyToParts(self: CLDR, gpa: Allocator, n: Decimal, code: []const u8, options: CurrencyFormatOptions) num.Error![]Part {
        return self.numbers.formatCurrencyToParts(gpa, n, code, options);
    }

    /// TypeScript `availableUnits`, bound to this locale.
    pub fn availableUnits(self: CLDR) []const []const u8 {
        return self.units.availableUnits();
    }

    /// TypeScript `getUnitDisplayName`, bound to this locale.
    pub fn getUnitDisplayName(self: CLDR, name: []const u8, length: ?UnitLength) []const u8 {
        return self.units.getUnitDisplayName(name, length);
    }

    /// TypeScript `formatQuantity`, bound to this locale.
    pub fn formatQuantity(self: CLDR, gpa: Allocator, q: Quantity, options: UnitFormatOptions) DecimalError![]u8 {
        return self.units.formatQuantity(gpa, q, options);
    }

    /// TypeScript `formatQuantityToParts`, bound to this locale.
    pub fn formatQuantityToParts(self: CLDR, gpa: Allocator, q: Quantity, options: UnitFormatOptions) DecimalError![]Part {
        return self.units.formatQuantityToParts(gpa, q, options);
    }

    /// TypeScript `formatQuantitySequence`, bound to this locale.
    pub fn formatQuantitySequence(self: CLDR, gpa: Allocator, qs: []const Quantity, options: UnitFormatOptions) DecimalError![]u8 {
        return self.units.formatQuantitySequence(gpa, qs, options);
    }

    /// TypeScript `formatQuantitySequenceToParts`, bound to this locale.
    pub fn formatQuantitySequenceToParts(self: CLDR, gpa: Allocator, qs: []const Quantity, options: UnitFormatOptions) DecimalError![]Part {
        return self.units.formatQuantitySequenceToParts(gpa, qs, options);
    }

    /// TypeScript `timeZoneIds`, bound to this locale.
    pub fn timeZoneIds(self: CLDR) []const []const u8 {
        return self.calendars.timeZoneIds();
    }

    /// TypeScript `firstDayOfWeek`, bound to this locale.
    pub fn firstDayOfWeek(self: CLDR) i64 {
        return self.calendars.firstDayOfWeek();
    }

    /// TypeScript `minDaysInFirstWeek`, bound to this locale.
    pub fn minDaysInFirstWeek(self: CLDR) i64 {
        return self.calendars.minDaysInFirstWeek();
    }

    /// TypeScript `toBuddhistDate`, bound to this locale.
    pub fn toBuddhistDate(self: CLDR, date: dates.DateInput) calendar_systems.CalendarDate {
        return self.calendars.toBuddhistDate(date);
    }

    /// TypeScript `toGregorianDate`, bound to this locale.
    pub fn toGregorianDate(self: CLDR, date: dates.DateInput) calendar_systems.CalendarDate {
        return self.calendars.toGregorianDate(date);
    }

    /// TypeScript `toISO8601Date`, bound to this locale.
    pub fn toISO8601Date(self: CLDR, date: dates.DateInput) calendar_systems.CalendarDate {
        return self.calendars.toISO8601Date(date);
    }

    /// TypeScript `toJapaneseDate`, bound to this locale.
    pub fn toJapaneseDate(self: CLDR, date: dates.DateInput) calendar_systems.CalendarDate {
        return self.calendars.toJapaneseDate(date);
    }

    /// TypeScript `toPersianDate`, bound to this locale.
    pub fn toPersianDate(self: CLDR, date: dates.DateInput) calendar_systems.CalendarDate {
        return self.calendars.toPersianDate(date);
    }

    /// TypeScript `newBuddhistDate`, bound to this locale.
    pub fn newBuddhistDate(self: CLDR, fields: calendar_systems.CalendarDateFields) calendar_systems.Error!calendar_systems.CalendarDate {
        return self.calendars.newBuddhistDate(fields);
    }

    /// TypeScript `newGregorianDate`, bound to this locale.
    pub fn newGregorianDate(self: CLDR, fields: calendar_systems.CalendarDateFields) calendar_systems.Error!calendar_systems.CalendarDate {
        return self.calendars.newGregorianDate(fields);
    }

    /// TypeScript `newISO8601Date`, bound to this locale.
    pub fn newISO8601Date(self: CLDR, fields: calendar_systems.CalendarDateFields) calendar_systems.Error!calendar_systems.CalendarDate {
        return self.calendars.newISO8601Date(fields);
    }

    /// TypeScript `newJapaneseDate`, bound to this locale.
    pub fn newJapaneseDate(self: CLDR, fields: calendar_systems.CalendarDateFields) calendar_systems.Error!calendar_systems.CalendarDate {
        return self.calendars.newJapaneseDate(fields);
    }

    /// TypeScript `newPersianDate`, bound to this locale.
    pub fn newPersianDate(self: CLDR, fields: calendar_systems.CalendarDateFields) calendar_systems.Error!calendar_systems.CalendarDate {
        return self.calendars.newPersianDate(fields);
    }

    /// TypeScript `now`, bound to this locale.
    pub fn now(self: CLDR, io: std.Io, zone: []const u8) calendar_systems.CalendarDate {
        return self.calendars.now(io, zone);
    }

    /// TypeScript `nowGregorian`, bound to this locale.
    pub fn nowGregorian(self: CLDR, io: std.Io, zone: []const u8) calendar_systems.CalendarDate {
        return self.calendars.nowGregorian(io, zone);
    }

    /// TypeScript `nowBuddhist`, bound to this locale.
    pub fn nowBuddhist(self: CLDR, io: std.Io, zone: []const u8) calendar_systems.CalendarDate {
        return self.calendars.nowBuddhist(io, zone);
    }

    /// TypeScript `nowISO8601`, bound to this locale.
    pub fn nowISO8601(self: CLDR, io: std.Io, zone: []const u8) calendar_systems.CalendarDate {
        return self.calendars.nowISO8601(io, zone);
    }

    /// TypeScript `nowJapanese`, bound to this locale.
    pub fn nowJapanese(self: CLDR, io: std.Io, zone: []const u8) calendar_systems.CalendarDate {
        return self.calendars.nowJapanese(io, zone);
    }

    /// TypeScript `nowPersian`, bound to this locale.
    pub fn nowPersian(self: CLDR, io: std.Io, zone: []const u8) calendar_systems.CalendarDate {
        return self.calendars.nowPersian(io, zone);
    }

    /// TypeScript `fieldOfVisualDifference`, bound to this locale.
    pub fn fieldOfVisualDifference(self: CLDR, a: dates.DateInput, b: dates.DateInput) ?u8 {
        return self.calendars.fieldOfVisualDifference(a, b);
    }

    /// TypeScript `formatDate`, bound to this locale.
    pub fn formatDate(self: CLDR, gpa: Allocator, date: dates.DateInput, options: ?dates.DateFormatOptions) Allocator.Error![]u8 {
        return self.calendars.formatDate(gpa, date, options);
    }

    /// TypeScript `formatDateToParts`, bound to this locale.
    pub fn formatDateToParts(self: CLDR, gpa: Allocator, date: dates.DateInput, options: ?dates.DateFormatOptions) Allocator.Error![]Part {
        return self.calendars.formatDateToParts(gpa, date, options);
    }

    /// TypeScript `formatDateRaw`, bound to this locale.
    pub fn formatDateRaw(self: CLDR, gpa: Allocator, date: dates.DateInput, options: ?dates.DateRawFormatOptions) Allocator.Error![]u8 {
        return self.calendars.formatDateRaw(gpa, date, options);
    }

    /// TypeScript `formatDateRawToParts`, bound to this locale.
    pub fn formatDateRawToParts(self: CLDR, gpa: Allocator, date: dates.DateInput, options: ?dates.DateRawFormatOptions) Allocator.Error![]Part {
        return self.calendars.formatDateRawToParts(gpa, date, options);
    }

    /// TypeScript `formatDateInterval`, bound to this locale.
    pub fn formatDateInterval(self: CLDR, gpa: Allocator, start: dates.DateInput, end: dates.DateInput, options: ?dates.DateIntervalFormatOptions) Allocator.Error![]u8 {
        return self.calendars.formatDateInterval(gpa, start, end, options);
    }

    /// TypeScript `formatDateIntervalToParts`, bound to this locale.
    pub fn formatDateIntervalToParts(self: CLDR, gpa: Allocator, start: dates.DateInput, end: dates.DateInput, options: ?dates.DateIntervalFormatOptions) Allocator.Error![]Part {
        return self.calendars.formatDateIntervalToParts(gpa, start, end, options);
    }

    /// TypeScript `formatDateWrapper`, bound to this locale.
    pub fn formatDateWrapper(self: CLDR, gpa: Allocator, date: []const u8, time: []const u8, options: ?dates.DateWrapperFormatOptions) Allocator.Error![]u8 {
        return self.calendars.formatDateWrapper(gpa, date, time, options);
    }

    /// TypeScript `formatDateWrapperToParts`, bound to this locale.
    pub fn formatDateWrapperToParts(self: CLDR, gpa: Allocator, date: []const Part, time: []const Part, options: ?dates.DateWrapperFormatOptions) Allocator.Error![]Part {
        return self.calendars.formatDateWrapperToParts(gpa, date, time, options);
    }

    /// TypeScript `formatRelativeTimeField`, bound to this locale.
    pub fn formatRelativeTimeField(self: CLDR, gpa: Allocator, value: Decimal, field: []const u8, options: ?dates.RelativeTimeFieldFormatOptions) DecimalError![]u8 {
        return self.calendars.formatRelativeTimeField(gpa, value, field, options);
    }

    /// TypeScript `formatRelativeTime`, bound to this locale.
    pub fn formatRelativeTime(self: CLDR, gpa: Allocator, start: dates.DateInput, end: dates.DateInput, options: ?dates.RelativeTimeFormatOptions) DecimalError![]u8 {
        return self.calendars.formatRelativeTime(gpa, start, end, options);
    }

    /// TypeScript `dateField`, bound to this locale.
    pub fn dateField(self: CLDR, gpa: Allocator, field: []const u8, options: ?dates.DateFieldFormatOptions) Allocator.Error![]u8 {
        return self.calendars.dateField(gpa, field, options);
    }

    /// TypeScript `months`, bound to this locale.
    pub fn months(self: CLDR, gpa: Allocator, options: ?dates.CalendarFieldsOptions) Allocator.Error!dates.FieldMap {
        return self.calendars.months(gpa, options);
    }

    /// TypeScript `weekdays`, bound to this locale.
    pub fn weekdays(self: CLDR, gpa: Allocator, options: ?dates.CalendarFieldsOptions) Allocator.Error!dates.FieldMap {
        return self.calendars.weekdays(gpa, options);
    }

    /// TypeScript `quarters`, bound to this locale.
    pub fn quarters(self: CLDR, gpa: Allocator, options: ?dates.CalendarFieldsOptions) Allocator.Error!dates.FieldMap {
        return self.calendars.quarters(gpa, options);
    }

    /// TypeScript `dayPeriods`, bound to this locale.
    pub fn dayPeriods(self: CLDR, gpa: Allocator, options: ?dates.CalendarFieldsOptions) Allocator.Error!dates.FieldMap {
        return self.calendars.dayPeriods(gpa, options);
    }

    /// TypeScript `eras`, bound to this locale.
    pub fn eras(self: CLDR, gpa: Allocator, options: ?dates.EraFieldOptions) Allocator.Error!dates.FieldMap {
        return self.calendars.eras(gpa, options);
    }

    /// TypeScript `timeData`, bound to this locale.
    pub fn timeData(self: CLDR, gpa: Allocator) Allocator.Error!date_options.TimeData {
        return self.calendars.timeData(gpa);
    }

    /// TypeScript `resolveTimeZoneId`, bound to this locale.
    pub fn resolveTimeZoneId(self: CLDR, id: []const u8) ?[]const u8 {
        return self.calendars.resolveTimeZoneId(id);
    }

    /// TypeScript `timeZoneFromUTC`, bound to this locale.
    pub fn timeZoneFromUTC(self: CLDR, utc: i64, id: []const u8) ?timezones.ZoneInfo {
        return self.calendars.timeZoneFromUTC(utc, id);
    }

    /// TypeScript `timeZoneFromWall`, bound to this locale.
    pub fn timeZoneFromWall(self: CLDR, wall: i64, id: []const u8) ?timezones.WallResult {
        return self.calendars.timeZoneFromWall(wall, id);
    }

    /// TypeScript `timeZoneInfo`, bound to this locale.
    pub fn timeZoneInfo(self: CLDR, zone: []const u8) date_options.TimeZoneInfo {
        return self.calendars.timeZoneInfo(zone);
    }

    /// TypeScript `timePeriodToQuantity`, bound to this locale.
    pub fn timePeriodToQuantity(self: CLDR, a: Allocator, period: calendar_systems.TimePeriod) Allocator.Error![]@import("common/units.zig").Quantity {
        return self.calendars.timePeriodToQuantity(a, period);
    }

    /// TypeScript `formatDay`, bound to this locale.
    pub fn formatDay(self: CLDR, a: Allocator, d: datetime.Day, options: ?days.DayFormatOptions) days.Error![]u8 {
        return self.calendars.formatDay(a, d, options);
    }

    /// TypeScript `formatDayToParts`, bound to this locale.
    pub fn formatDayToParts(self: CLDR, a: Allocator, d: datetime.Day, options: ?days.DayFormatOptions) days.Error![]Part {
        return self.calendars.formatDayToParts(a, d, options);
    }

    /// TypeScript `formatDayInterval`, bound to this locale.
    pub fn formatDayInterval(self: CLDR, a: Allocator, start: datetime.Day, end: datetime.Day, options: ?days.DayIntervalFormatOptions) days.Error![]u8 {
        return self.calendars.formatDayInterval(a, start, end, options);
    }

    /// TypeScript `formatDayIntervalToParts`, bound to this locale.
    pub fn formatDayIntervalToParts(self: CLDR, a: Allocator, start: datetime.Day, end: datetime.Day, options: ?days.DayIntervalFormatOptions) days.Error![]Part {
        return self.calendars.formatDayIntervalToParts(a, start, end, options);
    }

    /// TypeScript `formatTimeOfDay`, bound to this locale.
    pub fn formatTimeOfDay(self: CLDR, a: Allocator, t: datetime.TimeOfDay, options: ?days.TimeOfDayFormatOptions) days.Error![]u8 {
        return self.calendars.formatTimeOfDay(a, t, options);
    }

    /// TypeScript `formatTimeOfDayToParts`, bound to this locale.
    pub fn formatTimeOfDayToParts(self: CLDR, a: Allocator, t: datetime.TimeOfDay, options: ?days.TimeOfDayFormatOptions) days.Error![]Part {
        return self.calendars.formatTimeOfDayToParts(a, t, options);
    }

    /// TypeScript `formatDayRelative`, bound to this locale.
    pub fn formatDayRelative(self: CLDR, a: Allocator, d: datetime.Day, relative_to: datetime.Day, options: ?date_options.RelativeTimeFieldFormatOptions) days.Error![]u8 {
        return self.calendars.formatDayRelative(a, d, relative_to, options);
    }

    /// TypeScript `formatInstant`, bound to this locale.
    pub fn formatInstant(self: CLDR, a: Allocator, instant: datetime.Instant, zone: []const u8, options: ?date_options.DateFormatOptions) days.Error![]u8 {
        return self.calendars.formatInstant(a, instant, zone, options);
    }

    /// TypeScript `formatInstantToParts`, bound to this locale.
    pub fn formatInstantToParts(self: CLDR, a: Allocator, instant: datetime.Instant, zone: []const u8, options: ?date_options.DateFormatOptions) days.Error![]Part {
        return self.calendars.formatInstantToParts(a, instant, zone, options);
    }

    /// TypeScript `formatInstantRelative`, bound to this locale.
    pub fn formatInstantRelative(self: CLDR, a: Allocator, instant: datetime.Instant, relative_to: datetime.Instant, zone: []const u8, options: ?date_options.RelativeTimeFormatOptions) days.Error![]u8 {
        return self.calendars.formatInstantRelative(a, instant, relative_to, zone, options);
    }
};
fn own(handle: framework.LocaleHandle) CLDR {
    const data = handle.data();
    return .{ .handle = handle, .data = data, .schema = data.schema, .calendars = bindCalendars(data), .general = bindGeneral(data), .numbers = bindNumbers(data), .units = bindUnits(data) };
}
pub fn bindCalendars(data: *const LocaleData) api.Calendars {
    return .{ .data = data };
}
pub fn bindGeneral(data: *const LocaleData) api.General {
    return .{ .data = data };
}
pub fn bindNumbers(data: *const LocaleData) api.Numbers {
    return .{ .data = data };
}
pub fn bindUnits(data: *const LocaleData) api.Units {
    return .{ .data = data };
}
pub fn bindCLDR(data: *const LocaleData) CLDRView {
    return .{ .data = data, .schema = data.schema, .calendars = bindCalendars(data), .general = bindGeneral(data), .numbers = bindNumbers(data), .units = bindUnits(data) };
}

/// Owns the loader and caches. get returns a small bound value; repeated calls share data.
pub const CLDRFramework = struct {
    framework: framework.Framework,
    pub fn init(gpa: std.mem.Allocator, options: framework.Options) CLDRFramework {
        return .{ .framework = framework.Framework.init(gpa, options) };
    }
    pub fn deinit(self: *CLDRFramework) void {
        self.framework.deinit();
    }
    pub fn get(self: *CLDRFramework, input: framework.LocaleInput) framework.Error!CLDR {
        return own(try self.framework.loadLocale(input));
    }
    /// The generated schema represents the shipped config. Custom configs aren't supported.
    pub fn config(self: *const CLDRFramework) *const @import("types/schema.zig").Schema {
        return self.framework.schema;
    }
    pub fn info(self: *const CLDRFramework, gpa: std.mem.Allocator) std.mem.Allocator.Error![]u8 {
        return self.framework.info(gpa);
    }
};

const Allocator = std.mem.Allocator;
const Decimal = @import("../decimal/decimal.zig").Decimal;
const DecimalError = @import("../decimal/decimal.zig").Error;
const Part = @import("../decimal/decimal.zig").Part;
const gen = @import("api/general.zig");
const num = @import("api/numbers.zig");
const uni = @import("api/units.zig");
const mf = @import("../messageformat/messageformat.zig");
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
const dates = @import("api/calendars.zig");
const days = @import("api/days.zig");
const calendar_systems = @import("systems/calendars/calendars.zig");
const date_options = @import("common/calendars.zig");
const datetime = @import("../datetime/datetime.zig");
const timezones = @import("../timezone/timezone.zig");
