//! Loader state: the schema, a cache of resource packs and a cache of loaded locales
//! (`framework.ts`).
//!
//! ```zig
//! var fw = core.Framework.init(gpa, .{ .loader = .{ .load = myLoad } });
//! defer fw.deinit();
//! const en = try fw.loadLocale(.{ .id = "en-US" });
//! defer en.deinit();
//! const s = try en.formatDecimal(gpa, n, .{});
//! ```
//!
//! Only the shipped schema config (`src/config.ts`) is supported: its schema is generated at
//! build time (`schema/autogen.schema.zig`), so there are no custom configs.

const std = @import("std");
const Allocator = std.mem.Allocator;
const locale_mod = @import("../locale/locale.zig");
const Locale = locale_mod.Locale;
const LanguageTag = locale_mod.LanguageTag;
const pack_mod = @import("resource/pack.zig");
const Pack = pack_mod.Pack;
const LocaleData = @import("locale_data.zig").LocaleData;
const autogen = @import("schema/autogen.schema.zig");
const Schema = @import("types/schema.zig").Schema;

pub const Error = error{
    /// 'A synchronous resource loader is not defined'
    NoLoader,
    /// The loader has no pack for the language.
    PackNotFound,
    /// 'Checksum mismatch on resource pack! The schema config used to generate the resource
    /// pack must be identical to the one used at runtime.'
    ChecksumMismatch,
    /// The data does not look like a valid resource pack.
    InvalidPack,
} || Allocator.Error;

/// Supplies the JSON text of resource packs.
pub const Loader = struct {
    context: ?*anyopaque = null,
    /// The pack's JSON text for a language ('en'), or null if there is none. The framework
    /// copies what it needs before calling `free`.
    load: *const fn (context: ?*anyopaque, language: []const u8) ?[]const u8,
    /// Called with the bytes `load` returned once they are parsed, if set.
    free: ?*const fn (context: ?*anyopaque, bytes: []const u8) void = null,
};

/// Options to initialize the library (`CLDROptions`). Cache capacities count resident
/// entries, excluding caller-owned handles. Zero disables retention.
pub const Options = struct {
    loader: ?Loader = null,
    timezone_database: *const @import("../timezone/timezone.zig").Database = @import("../timezone/timezone.zig").defaultDatabase,
    skip_checksum: bool = false,
    pack_cache_size: usize = 2,
    locale_cache_size: usize = 64,
};

/// A locale id to resolve, or a locale already resolved.
pub const LocaleInput = union(enum) {
    id: []const u8,
    locale: Locale,
};

// Small bounded LRUs. The most recently used entry is last. Nodes own their allocator
// and can survive removal from either cache and destruction of the framework.
fn Cache(comptime T: type) type {
    return struct {
        const Self = @This();
        const Entry = struct { key: []u8, node: *T };
        entries: std.ArrayList(Entry) = .empty,
        capacity: usize,

        fn get(self: *Self, key: []const u8) ?*T {
            for (self.entries.items, 0..) |e, i| {
                if (std.mem.eql(u8, e.key, key)) {
                    _ = self.entries.orderedRemove(i);
                    self.entries.appendAssumeCapacity(e);
                    return e.node;
                }
            }
            return null;
        }
        fn put(self: *Self, gpa: Allocator, key: []const u8, node: *T) Allocator.Error!void {
            if (self.capacity == 0) return;
            const k = try gpa.dupe(u8, key);
            errdefer gpa.free(k);
            // Reserve before evicting, so OOM leaves existing entries intact.
            if (self.entries.items.len < self.capacity) try self.entries.ensureUnusedCapacity(gpa, 1);
            if (self.get(key)) |_| {
                const old = self.entries.pop().?;
                gpa.free(old.key);
                old.node.release();
            } else if (self.entries.items.len == self.capacity) {
                const old = self.entries.orderedRemove(0);
                gpa.free(old.key);
                old.node.release();
            }
            node.retain();
            self.entries.appendAssumeCapacity(.{ .key = k, .node = node });
        }
        fn deinit(self: *Self, gpa: Allocator) void {
            for (self.entries.items) |e| {
                gpa.free(e.key);
                e.node.release();
            }
            self.entries.deinit(gpa);
        }
        pub fn count(self: *const Self) usize {
            return self.entries.items.len;
        }
    };
}

const PackNode = struct {
    gpa: Allocator,
    pack: *Pack,
    refs: usize = 1,
    fn retain(self: *PackNode) void {
        self.refs += 1;
    }
    fn release(self: *PackNode) void {
        self.refs -= 1;
        if (self.refs == 0) {
            self.pack.deinit();
            self.gpa.destroy(self);
        }
    }
};
const LocaleNode = struct {
    gpa: Allocator,
    value: LocaleData,
    pack: *PackNode,
    refs: usize = 1,
    fn retain(self: *LocaleNode) void {
        self.refs += 1;
    }
    fn release(self: *LocaleNode) void {
        self.refs -= 1;
        if (self.refs == 0) {
            self.value.deinit();
            self.pack.release();
            self.gpa.destroy(self);
        }
    }
};

/// An owning locale reference (`loadLocale`). Single-threaded, including its lazy caches.
/// Move by convention; ordinary copies do not retain. Use clone for another owner, and
/// deinit once per owner. Its allocator must outlive it; its framework need not.
pub const LocaleHandle = struct {
    node: *LocaleNode,
    pub fn data(self: LocaleHandle) *const LocaleData {
        return &self.node.value;
    }
    pub fn clone(self: LocaleHandle) LocaleHandle {
        self.node.retain();
        return self;
    }
    pub fn deinit(self: LocaleHandle) void {
        self.node.release();
    }

    /// TypeScript `bundle`, bound to this locale.
    pub fn bundle(self: LocaleHandle) *const LocaleData {
        return (api.General{ .data = self.data() }).bundle();
    }

    /// TypeScript `locale`, bound to this locale.
    pub fn locale(self: LocaleHandle) @import("../locale/locale.zig").Locale {
        return (api.General{ .data = self.data() }).locale();
    }

    /// TypeScript `resolveLocale`, bound to this locale.
    pub fn resolveLocale(self: LocaleHandle, gpa: Allocator, id: []const u8) Allocator.Error!@import("../locale/locale.zig").Locale {
        return (api.General{ .data = self.data() }).resolveLocale(gpa, id);
    }

    /// TypeScript `resolveLocaleTag`, bound to this locale.
    pub fn resolveLocaleTag(self: LocaleHandle, gpa: Allocator, tag: @import("../language_tag/language_tag.zig").LanguageTag) Allocator.Error!@import("../locale/locale.zig").Locale {
        return (api.General{ .data = self.data() }).resolveLocaleTag(gpa, tag);
    }

    /// TypeScript `parseLanguageTag`, bound to this locale.
    pub fn parseLanguageTag(self: LocaleHandle, gpa: Allocator, code: []const u8) Allocator.Error!@import("../language_tag/language_tag.zig").LanguageTag {
        return (api.General{ .data = self.data() }).parseLanguageTag(gpa, code);
    }

    /// TypeScript `characterOrder`, bound to this locale.
    pub fn characterOrder(self: LocaleHandle) gen_options.CharacterOrder {
        return (api.General{ .data = self.data() }).characterOrder();
    }

    /// TypeScript `lineOrder`, bound to this locale.
    pub fn lineOrder(self: LocaleHandle) gen_options.LineOrder {
        return (api.General{ .data = self.data() }).lineOrder();
    }

    /// TypeScript `measurementSystem`, bound to this locale.
    pub fn measurementSystem(self: LocaleHandle, category: ?gen_options.MeasurementCategory) gen_options.MeasurementSystem {
        return (api.General{ .data = self.data() }).measurementSystem(category);
    }

    /// TypeScript `messageFormatter`, bound to this locale.
    pub fn messageFormatter(self: LocaleHandle) Allocator.Error!*mf.MessageFormatter {
        return (api.General{ .data = self.data() }).messageFormatter();
    }

    /// TypeScript `createMessageFormatter`, bound to this locale.
    pub fn createMessageFormatter(self: LocaleHandle, gpa: Allocator, opts: mf.MessageFormatterOptions) Allocator.Error!mf.MessageFormatter {
        return (api.General{ .data = self.data() }).createMessageFormatter(gpa, opts);
    }

    /// TypeScript `formatList`, bound to this locale.
    pub fn formatList(self: LocaleHandle, gpa: Allocator, items: []const []const u8, t: ?ListPatternType) Allocator.Error![]u8 {
        return (api.General{ .data = self.data() }).formatList(gpa, items, t);
    }

    /// TypeScript `formatListToParts`, bound to this locale.
    pub fn formatListToParts(self: LocaleHandle, gpa: Allocator, items: []const []const u8, t: ?ListPatternType) Allocator.Error![]Part {
        return (api.General{ .data = self.data() }).formatListToParts(gpa, items, t);
    }

    /// TypeScript `getLanguageDisplayName`, bound to this locale.
    pub fn getLanguageDisplayName(self: LocaleHandle, gpa: Allocator, input: NameInput, o: DisplayNameOptions) Allocator.Error![]u8 {
        return (api.General{ .data = self.data() }).getLanguageDisplayName(gpa, input, o);
    }

    /// TypeScript `getScriptDisplayName`, bound to this locale.
    pub fn getScriptDisplayName(self: LocaleHandle, gpa: Allocator, input: NameInput, o: DisplayNameOptions) Allocator.Error![]u8 {
        return (api.General{ .data = self.data() }).getScriptDisplayName(gpa, input, o);
    }

    /// TypeScript `getRegionDisplayName`, bound to this locale.
    pub fn getRegionDisplayName(self: LocaleHandle, gpa: Allocator, input: NameInput, o: DisplayNameOptions) Allocator.Error![]u8 {
        return (api.General{ .data = self.data() }).getRegionDisplayName(gpa, input, o);
    }

    /// TypeScript `parseDecimal`, bound to this locale.
    pub fn parseDecimal(self: LocaleHandle, gpa: Allocator, value: []const u8) (@import("../decimal/decimal.zig").ParseError || Allocator.Error)!Decimal {
        return (api.Numbers{ .data = self.data() }).parseDecimal(gpa, value);
    }

    /// TypeScript `getCurrencyFractions`, bound to this locale.
    pub fn getCurrencyFractions(self: LocaleHandle, code: []const u8) num.CurrencyFractions {
        return (api.Numbers{ .data = self.data() }).getCurrencyFractions(code);
    }

    /// TypeScript `getCurrencyForRegion`, bound to this locale.
    pub fn getCurrencyForRegion(self: LocaleHandle, region: []const u8) []const u8 {
        return (api.Numbers{ .data = self.data() }).getCurrencyForRegion(region);
    }

    /// TypeScript `adjustDecimal`, bound to this locale.
    pub fn adjustDecimal(self: LocaleHandle, gpa: Allocator, n: Decimal, options: DecimalAdjustOptions) DecimalError!Decimal {
        return (api.Numbers{ .data = self.data() }).adjustDecimal(gpa, n, options);
    }

    /// TypeScript `getCurrencySymbol`, bound to this locale.
    pub fn getCurrencySymbol(self: LocaleHandle, code: []const u8, width: CurrencySymbolWidth) []const u8 {
        return (api.Numbers{ .data = self.data() }).getCurrencySymbol(code, width);
    }

    /// TypeScript `getCurrencyDisplayName`, bound to this locale.
    pub fn getCurrencyDisplayName(self: LocaleHandle, gpa: Allocator, code: []const u8, options: CurrencyDisplayNameOptions) Allocator.Error![]u8 {
        return (api.Numbers{ .data = self.data() }).getCurrencyDisplayName(gpa, code, options);
    }

    /// TypeScript `getCurrencyPluralName`, bound to this locale.
    pub fn getCurrencyPluralName(self: LocaleHandle, gpa: Allocator, n: Decimal, code: []const u8, options: CurrencyDisplayNameOptions) Allocator.Error![]u8 {
        return (api.Numbers{ .data = self.data() }).getCurrencyPluralName(gpa, n, code, options);
    }

    /// TypeScript `getPluralCardinal`, bound to this locale.
    pub fn getPluralCardinal(self: LocaleHandle, gpa: Allocator, n: Decimal, options: ?DecimalAdjustOptions) DecimalError![]const u8 {
        return (api.Numbers{ .data = self.data() }).getPluralCardinal(gpa, n, options);
    }

    /// TypeScript `getPluralOrdinal`, bound to this locale.
    pub fn getPluralOrdinal(self: LocaleHandle, gpa: Allocator, n: Decimal, options: ?DecimalAdjustOptions) DecimalError![]const u8 {
        return (api.Numbers{ .data = self.data() }).getPluralOrdinal(gpa, n, options);
    }

    /// TypeScript `formatDecimal`, bound to this locale.
    pub fn formatDecimal(self: LocaleHandle, gpa: Allocator, n: Decimal, options: DecimalFormatOptions) num.Error![]u8 {
        return (api.Numbers{ .data = self.data() }).formatDecimal(gpa, n, options);
    }

    /// TypeScript `formatDecimalToParts`, bound to this locale.
    pub fn formatDecimalToParts(self: LocaleHandle, gpa: Allocator, n: Decimal, options: DecimalFormatOptions) num.Error![]Part {
        return (api.Numbers{ .data = self.data() }).formatDecimalToParts(gpa, n, options);
    }

    /// TypeScript `formatCurrency`, bound to this locale.
    pub fn formatCurrency(self: LocaleHandle, gpa: Allocator, n: Decimal, code: []const u8, options: CurrencyFormatOptions) num.Error![]u8 {
        return (api.Numbers{ .data = self.data() }).formatCurrency(gpa, n, code, options);
    }

    /// TypeScript `formatCurrencyToParts`, bound to this locale.
    pub fn formatCurrencyToParts(self: LocaleHandle, gpa: Allocator, n: Decimal, code: []const u8, options: CurrencyFormatOptions) num.Error![]Part {
        return (api.Numbers{ .data = self.data() }).formatCurrencyToParts(gpa, n, code, options);
    }

    /// TypeScript `availableUnits`, bound to this locale.
    pub fn availableUnits(self: LocaleHandle) []const []const u8 {
        return (api.Units{ .data = self.data() }).availableUnits();
    }

    /// TypeScript `getUnitDisplayName`, bound to this locale.
    pub fn getUnitDisplayName(self: LocaleHandle, name: []const u8, length: ?UnitLength) []const u8 {
        return (api.Units{ .data = self.data() }).getUnitDisplayName(name, length);
    }

    /// TypeScript `formatQuantity`, bound to this locale.
    pub fn formatQuantity(self: LocaleHandle, gpa: Allocator, q: Quantity, options: UnitFormatOptions) DecimalError![]u8 {
        return (api.Units{ .data = self.data() }).formatQuantity(gpa, q, options);
    }

    /// TypeScript `formatQuantityToParts`, bound to this locale.
    pub fn formatQuantityToParts(self: LocaleHandle, gpa: Allocator, q: Quantity, options: UnitFormatOptions) DecimalError![]Part {
        return (api.Units{ .data = self.data() }).formatQuantityToParts(gpa, q, options);
    }

    /// TypeScript `formatQuantitySequence`, bound to this locale.
    pub fn formatQuantitySequence(self: LocaleHandle, gpa: Allocator, qs: []const Quantity, options: UnitFormatOptions) DecimalError![]u8 {
        return (api.Units{ .data = self.data() }).formatQuantitySequence(gpa, qs, options);
    }

    /// TypeScript `formatQuantitySequenceToParts`, bound to this locale.
    pub fn formatQuantitySequenceToParts(self: LocaleHandle, gpa: Allocator, qs: []const Quantity, options: UnitFormatOptions) DecimalError![]Part {
        return (api.Units{ .data = self.data() }).formatQuantitySequenceToParts(gpa, qs, options);
    }

    /// TypeScript `timeZoneIds`, bound to this locale.
    pub fn timeZoneIds(self: LocaleHandle) []const []const u8 {
        return (api.Calendars{ .data = self.data() }).timeZoneIds();
    }

    /// TypeScript `firstDayOfWeek`, bound to this locale.
    pub fn firstDayOfWeek(self: LocaleHandle) i64 {
        return (api.Calendars{ .data = self.data() }).firstDayOfWeek();
    }

    /// TypeScript `minDaysInFirstWeek`, bound to this locale.
    pub fn minDaysInFirstWeek(self: LocaleHandle) i64 {
        return (api.Calendars{ .data = self.data() }).minDaysInFirstWeek();
    }

    /// TypeScript `toBuddhistDate`, bound to this locale.
    pub fn toBuddhistDate(self: LocaleHandle, date: dates.DateInput) calendar_systems.CalendarDate {
        return (api.Calendars{ .data = self.data() }).toBuddhistDate(date);
    }

    /// TypeScript `toGregorianDate`, bound to this locale.
    pub fn toGregorianDate(self: LocaleHandle, date: dates.DateInput) calendar_systems.CalendarDate {
        return (api.Calendars{ .data = self.data() }).toGregorianDate(date);
    }

    /// TypeScript `toISO8601Date`, bound to this locale.
    pub fn toISO8601Date(self: LocaleHandle, date: dates.DateInput) calendar_systems.CalendarDate {
        return (api.Calendars{ .data = self.data() }).toISO8601Date(date);
    }

    /// TypeScript `toJapaneseDate`, bound to this locale.
    pub fn toJapaneseDate(self: LocaleHandle, date: dates.DateInput) calendar_systems.CalendarDate {
        return (api.Calendars{ .data = self.data() }).toJapaneseDate(date);
    }

    /// TypeScript `toPersianDate`, bound to this locale.
    pub fn toPersianDate(self: LocaleHandle, date: dates.DateInput) calendar_systems.CalendarDate {
        return (api.Calendars{ .data = self.data() }).toPersianDate(date);
    }

    /// TypeScript `newBuddhistDate`, bound to this locale.
    pub fn newBuddhistDate(self: LocaleHandle, fields: calendar_systems.CalendarDateFields) calendar_systems.Error!calendar_systems.CalendarDate {
        return (api.Calendars{ .data = self.data() }).newBuddhistDate(fields);
    }

    /// TypeScript `newGregorianDate`, bound to this locale.
    pub fn newGregorianDate(self: LocaleHandle, fields: calendar_systems.CalendarDateFields) calendar_systems.Error!calendar_systems.CalendarDate {
        return (api.Calendars{ .data = self.data() }).newGregorianDate(fields);
    }

    /// TypeScript `newISO8601Date`, bound to this locale.
    pub fn newISO8601Date(self: LocaleHandle, fields: calendar_systems.CalendarDateFields) calendar_systems.Error!calendar_systems.CalendarDate {
        return (api.Calendars{ .data = self.data() }).newISO8601Date(fields);
    }

    /// TypeScript `newJapaneseDate`, bound to this locale.
    pub fn newJapaneseDate(self: LocaleHandle, fields: calendar_systems.CalendarDateFields) calendar_systems.Error!calendar_systems.CalendarDate {
        return (api.Calendars{ .data = self.data() }).newJapaneseDate(fields);
    }

    /// TypeScript `newPersianDate`, bound to this locale.
    pub fn newPersianDate(self: LocaleHandle, fields: calendar_systems.CalendarDateFields) calendar_systems.Error!calendar_systems.CalendarDate {
        return (api.Calendars{ .data = self.data() }).newPersianDate(fields);
    }

    /// TypeScript `now`, bound to this locale.
    pub fn now(self: LocaleHandle, io: std.Io, zone: []const u8) calendar_systems.CalendarDate {
        return (api.Calendars{ .data = self.data() }).now(io, zone);
    }

    /// TypeScript `nowGregorian`, bound to this locale.
    pub fn nowGregorian(self: LocaleHandle, io: std.Io, zone: []const u8) calendar_systems.CalendarDate {
        return (api.Calendars{ .data = self.data() }).nowGregorian(io, zone);
    }

    /// TypeScript `nowBuddhist`, bound to this locale.
    pub fn nowBuddhist(self: LocaleHandle, io: std.Io, zone: []const u8) calendar_systems.CalendarDate {
        return (api.Calendars{ .data = self.data() }).nowBuddhist(io, zone);
    }

    /// TypeScript `nowISO8601`, bound to this locale.
    pub fn nowISO8601(self: LocaleHandle, io: std.Io, zone: []const u8) calendar_systems.CalendarDate {
        return (api.Calendars{ .data = self.data() }).nowISO8601(io, zone);
    }

    /// TypeScript `nowJapanese`, bound to this locale.
    pub fn nowJapanese(self: LocaleHandle, io: std.Io, zone: []const u8) calendar_systems.CalendarDate {
        return (api.Calendars{ .data = self.data() }).nowJapanese(io, zone);
    }

    /// TypeScript `nowPersian`, bound to this locale.
    pub fn nowPersian(self: LocaleHandle, io: std.Io, zone: []const u8) calendar_systems.CalendarDate {
        return (api.Calendars{ .data = self.data() }).nowPersian(io, zone);
    }

    /// TypeScript `fieldOfVisualDifference`, bound to this locale.
    pub fn fieldOfVisualDifference(self: LocaleHandle, a: dates.DateInput, b: dates.DateInput) ?u8 {
        return (api.Calendars{ .data = self.data() }).fieldOfVisualDifference(a, b);
    }

    /// TypeScript `formatDate`, bound to this locale.
    pub fn formatDate(self: LocaleHandle, gpa: Allocator, date: dates.DateInput, options: ?dates.DateFormatOptions) Allocator.Error![]u8 {
        return (api.Calendars{ .data = self.data() }).formatDate(gpa, date, options);
    }

    /// TypeScript `formatDateToParts`, bound to this locale.
    pub fn formatDateToParts(self: LocaleHandle, gpa: Allocator, date: dates.DateInput, options: ?dates.DateFormatOptions) Allocator.Error![]Part {
        return (api.Calendars{ .data = self.data() }).formatDateToParts(gpa, date, options);
    }

    /// TypeScript `formatDateRaw`, bound to this locale.
    pub fn formatDateRaw(self: LocaleHandle, gpa: Allocator, date: dates.DateInput, options: ?dates.DateRawFormatOptions) Allocator.Error![]u8 {
        return (api.Calendars{ .data = self.data() }).formatDateRaw(gpa, date, options);
    }

    /// TypeScript `formatDateRawToParts`, bound to this locale.
    pub fn formatDateRawToParts(self: LocaleHandle, gpa: Allocator, date: dates.DateInput, options: ?dates.DateRawFormatOptions) Allocator.Error![]Part {
        return (api.Calendars{ .data = self.data() }).formatDateRawToParts(gpa, date, options);
    }

    /// TypeScript `formatDateInterval`, bound to this locale.
    pub fn formatDateInterval(self: LocaleHandle, gpa: Allocator, start: dates.DateInput, end: dates.DateInput, options: ?dates.DateIntervalFormatOptions) Allocator.Error![]u8 {
        return (api.Calendars{ .data = self.data() }).formatDateInterval(gpa, start, end, options);
    }

    /// TypeScript `formatDateIntervalToParts`, bound to this locale.
    pub fn formatDateIntervalToParts(self: LocaleHandle, gpa: Allocator, start: dates.DateInput, end: dates.DateInput, options: ?dates.DateIntervalFormatOptions) Allocator.Error![]Part {
        return (api.Calendars{ .data = self.data() }).formatDateIntervalToParts(gpa, start, end, options);
    }

    /// TypeScript `formatDateWrapper`, bound to this locale.
    pub fn formatDateWrapper(self: LocaleHandle, gpa: Allocator, date: []const u8, time: []const u8, options: ?dates.DateWrapperFormatOptions) Allocator.Error![]u8 {
        return (api.Calendars{ .data = self.data() }).formatDateWrapper(gpa, date, time, options);
    }

    /// TypeScript `formatDateWrapperToParts`, bound to this locale.
    pub fn formatDateWrapperToParts(self: LocaleHandle, gpa: Allocator, date: []const Part, time: []const Part, options: ?dates.DateWrapperFormatOptions) Allocator.Error![]Part {
        return (api.Calendars{ .data = self.data() }).formatDateWrapperToParts(gpa, date, time, options);
    }

    /// TypeScript `formatRelativeTimeField`, bound to this locale.
    pub fn formatRelativeTimeField(self: LocaleHandle, gpa: Allocator, value: Decimal, field: []const u8, options: ?dates.RelativeTimeFieldFormatOptions) DecimalError![]u8 {
        return (api.Calendars{ .data = self.data() }).formatRelativeTimeField(gpa, value, field, options);
    }

    /// TypeScript `formatRelativeTime`, bound to this locale.
    pub fn formatRelativeTime(self: LocaleHandle, gpa: Allocator, start: dates.DateInput, end: dates.DateInput, options: ?dates.RelativeTimeFormatOptions) DecimalError![]u8 {
        return (api.Calendars{ .data = self.data() }).formatRelativeTime(gpa, start, end, options);
    }

    /// TypeScript `dateField`, bound to this locale.
    pub fn dateField(self: LocaleHandle, gpa: Allocator, field: []const u8, options: ?dates.DateFieldFormatOptions) Allocator.Error![]u8 {
        return (api.Calendars{ .data = self.data() }).dateField(gpa, field, options);
    }

    /// TypeScript `months`, bound to this locale.
    pub fn months(self: LocaleHandle, gpa: Allocator, options: ?dates.CalendarFieldsOptions) Allocator.Error!dates.FieldMap {
        return (api.Calendars{ .data = self.data() }).months(gpa, options);
    }

    /// TypeScript `weekdays`, bound to this locale.
    pub fn weekdays(self: LocaleHandle, gpa: Allocator, options: ?dates.CalendarFieldsOptions) Allocator.Error!dates.FieldMap {
        return (api.Calendars{ .data = self.data() }).weekdays(gpa, options);
    }

    /// TypeScript `quarters`, bound to this locale.
    pub fn quarters(self: LocaleHandle, gpa: Allocator, options: ?dates.CalendarFieldsOptions) Allocator.Error!dates.FieldMap {
        return (api.Calendars{ .data = self.data() }).quarters(gpa, options);
    }

    /// TypeScript `dayPeriods`, bound to this locale.
    pub fn dayPeriods(self: LocaleHandle, gpa: Allocator, options: ?dates.CalendarFieldsOptions) Allocator.Error!dates.FieldMap {
        return (api.Calendars{ .data = self.data() }).dayPeriods(gpa, options);
    }

    /// TypeScript `eras`, bound to this locale.
    pub fn eras(self: LocaleHandle, gpa: Allocator, options: ?dates.EraFieldOptions) Allocator.Error!dates.FieldMap {
        return (api.Calendars{ .data = self.data() }).eras(gpa, options);
    }

    /// TypeScript `timeData`, bound to this locale.
    pub fn timeData(self: LocaleHandle, gpa: Allocator) Allocator.Error!date_options.TimeData {
        return (api.Calendars{ .data = self.data() }).timeData(gpa);
    }

    /// TypeScript `resolveTimeZoneId`, bound to this locale.
    pub fn resolveTimeZoneId(self: LocaleHandle, id: []const u8) ?[]const u8 {
        return (api.Calendars{ .data = self.data() }).resolveTimeZoneId(id);
    }

    /// TypeScript `timeZoneFromUTC`, bound to this locale.
    pub fn timeZoneFromUTC(self: LocaleHandle, utc: i64, id: []const u8) ?timezones.ZoneInfo {
        return (api.Calendars{ .data = self.data() }).timeZoneFromUTC(utc, id);
    }

    /// TypeScript `timeZoneFromWall`, bound to this locale.
    pub fn timeZoneFromWall(self: LocaleHandle, wall: i64, id: []const u8) ?timezones.WallResult {
        return (api.Calendars{ .data = self.data() }).timeZoneFromWall(wall, id);
    }

    /// TypeScript `timeZoneInfo`, bound to this locale.
    pub fn timeZoneInfo(self: LocaleHandle, zone: []const u8) date_options.TimeZoneInfo {
        return (api.Calendars{ .data = self.data() }).timeZoneInfo(zone);
    }

    /// TypeScript `timePeriodToQuantity`, bound to this locale.
    pub fn timePeriodToQuantity(self: LocaleHandle, a: Allocator, period: calendar_systems.TimePeriod) Allocator.Error![]@import("common/units.zig").Quantity {
        return (api.Calendars{ .data = self.data() }).timePeriodToQuantity(a, period);
    }

    /// TypeScript `formatDay`, bound to this locale.
    pub fn formatDay(self: LocaleHandle, a: Allocator, d: datetime.Day, options: ?days.DayFormatOptions) days.Error![]u8 {
        return (api.Calendars{ .data = self.data() }).formatDay(a, d, options);
    }

    /// TypeScript `formatDayToParts`, bound to this locale.
    pub fn formatDayToParts(self: LocaleHandle, a: Allocator, d: datetime.Day, options: ?days.DayFormatOptions) days.Error![]Part {
        return (api.Calendars{ .data = self.data() }).formatDayToParts(a, d, options);
    }

    /// TypeScript `formatDayInterval`, bound to this locale.
    pub fn formatDayInterval(self: LocaleHandle, a: Allocator, start: datetime.Day, end: datetime.Day, options: ?days.DayIntervalFormatOptions) days.Error![]u8 {
        return (api.Calendars{ .data = self.data() }).formatDayInterval(a, start, end, options);
    }

    /// TypeScript `formatDayIntervalToParts`, bound to this locale.
    pub fn formatDayIntervalToParts(self: LocaleHandle, a: Allocator, start: datetime.Day, end: datetime.Day, options: ?days.DayIntervalFormatOptions) days.Error![]Part {
        return (api.Calendars{ .data = self.data() }).formatDayIntervalToParts(a, start, end, options);
    }

    /// TypeScript `formatTimeOfDay`, bound to this locale.
    pub fn formatTimeOfDay(self: LocaleHandle, a: Allocator, t: datetime.TimeOfDay, options: ?days.TimeOfDayFormatOptions) days.Error![]u8 {
        return (api.Calendars{ .data = self.data() }).formatTimeOfDay(a, t, options);
    }

    /// TypeScript `formatTimeOfDayToParts`, bound to this locale.
    pub fn formatTimeOfDayToParts(self: LocaleHandle, a: Allocator, t: datetime.TimeOfDay, options: ?days.TimeOfDayFormatOptions) days.Error![]Part {
        return (api.Calendars{ .data = self.data() }).formatTimeOfDayToParts(a, t, options);
    }

    /// TypeScript `formatDayRelative`, bound to this locale.
    pub fn formatDayRelative(self: LocaleHandle, a: Allocator, d: datetime.Day, relative_to: datetime.Day, options: ?date_options.RelativeTimeFieldFormatOptions) days.Error![]u8 {
        return (api.Calendars{ .data = self.data() }).formatDayRelative(a, d, relative_to, options);
    }

    /// TypeScript `formatInstant`, bound to this locale.
    pub fn formatInstant(self: LocaleHandle, a: Allocator, instant: datetime.Instant, zone: []const u8, options: ?date_options.DateFormatOptions) days.Error![]u8 {
        return (api.Calendars{ .data = self.data() }).formatInstant(a, instant, zone, options);
    }

    /// TypeScript `formatInstantToParts`, bound to this locale.
    pub fn formatInstantToParts(self: LocaleHandle, a: Allocator, instant: datetime.Instant, zone: []const u8, options: ?date_options.DateFormatOptions) days.Error![]Part {
        return (api.Calendars{ .data = self.data() }).formatInstantToParts(a, instant, zone, options);
    }

    /// TypeScript `formatInstantRelative`, bound to this locale.
    pub fn formatInstantRelative(self: LocaleHandle, a: Allocator, instant: datetime.Instant, relative_to: datetime.Instant, zone: []const u8, options: ?date_options.RelativeTimeFormatOptions) days.Error![]u8 {
        return (api.Calendars{ .data = self.data() }).formatInstantRelative(a, instant, relative_to, zone, options);
    }
};

/// Single-threaded loader and bounded caches. Each returned handle owns its lifetime;
/// eviction and framework destruction release cache ownership without invalidating handles.
/// Loader callbacks may reenter, but must not destroy this framework during an operation.
pub const Framework = struct {
    gpa: Allocator,
    options: Options,
    schema: *const Schema = &autogen.schema,
    checksum: []const u8,
    packs: Cache(PackNode),
    locales: Cache(LocaleNode),

    /// Initialize the framework (`createFramework`).
    pub fn init(gpa: Allocator, options: Options) Framework {
        return .{
            .gpa = gpa,
            .options = options,
            .checksum = if (options.skip_checksum) "" else autogen.checksum,
            .packs = .{ .capacity = options.pack_cache_size },
            .locales = .{ .capacity = options.locale_cache_size },
        };
    }
    pub fn deinit(self: *Framework) void {
        self.locales.deinit(self.gpa);
        self.packs.deinit(self.gpa);
    }

    /// Load a locale, returning an owning handle. Call handle.deinit (`loadLocale`).
    pub fn loadLocale(self: *Framework, input: LocaleInput) Error!LocaleHandle {
        const loader = self.options.loader orelse return error.NoLoader;
        const gpa = self.gpa;
        var resolved = switch (input) {
            .id => |id| try resolveLocale(gpa, id),
            .locale => |l| try cloneLocale(gpa, l),
        };
        var owned = true;
        defer if (owned) resolved.deinit(gpa);
        const key = try cacheKey(gpa, resolved);
        defer gpa.free(key);
        if (self.locales.get(key)) |node| {
            node.retain();
            return .{ .node = node };
        }

        const language = resolved.tag.tagLanguage();
        const pack_node = if (self.packs.get(language)) |node| blk: {
            node.retain();
            break :blk node;
        } else blk: {
            const bytes = loader.load(loader.context, language) orelse return error.PackNotFound;
            const result = pack_mod.loadPack(gpa, bytes);
            if (loader.free) |free| free(loader.context, bytes);
            const pack = try result;
            errdefer pack.deinit();
            if (!self.options.skip_checksum and !std.mem.eql(u8, pack.checksum, self.checksum)) return error.ChecksumMismatch;
            const node = try gpa.create(PackNode);
            errdefer gpa.destroy(node);
            node.* = .{ .gpa = gpa, .pack = pack };
            try self.packs.put(gpa, language, node);
            break :blk node;
        };
        defer pack_node.release();

        const bundle = try pack_mod.packGet(gpa, pack_node.pack, resolved.tag);
        var value = LocaleData.init(gpa, resolved, bundle, self.schema, autogen.index) catch |err| {
            bundle.deinit(gpa);
            return err;
        };
        value.timezone_database = self.options.timezone_database;
        owned = false;
        const node = gpa.create(LocaleNode) catch |err| {
            var cleanup = value;
            cleanup.deinit();
            return err;
        };
        pack_node.retain();
        node.* = .{ .gpa = gpa, .value = value, .pack = pack_node };
        errdefer node.release();
        try self.locales.put(gpa, key, node);
        return .{ .node = node };
    }

    /// Resident pack count (`frameworkInfo`). The caller owns the returned string.
    pub fn info(self: *const Framework, gpa: Allocator) Allocator.Error![]u8 {
        return std.fmt.allocPrint(gpa, "packs loaded: {d}", .{self.packs.count()});
    }
};

/// Return the library version (`cldrVersion`).
pub fn cldrVersion() []const u8 {
    return autogen.version;
}

/// Parse a locale identifier and resolve it. The Locale keeps the original id string and a
/// resolved LanguageTag. Free with `locale.deinit(gpa)`. (`resolveLocale`)
pub fn resolveLocale(gpa: Allocator, id: []const u8) Allocator.Error!Locale {
    const tag = try locale_mod.resolveLanguageTag(gpa, .{ .id = id });
    errdefer tag.deinit(gpa);
    return .{ .id = try gpa.dupe(u8, id), .tag = tag };
}

/// Resolve a language tag into a Locale whose id is the tag's compact form.
pub fn resolveLocaleTag(gpa: Allocator, tag: LanguageTag) Allocator.Error!Locale {
    const id = try tag.compact(gpa);
    errdefer gpa.free(id);
    return .{ .id = id, .tag = try locale_mod.resolveLanguageTag(gpa, .{ .tag = tag }) };
}

fn cloneLocale(gpa: Allocator, l: Locale) Allocator.Error!Locale {
    const id = try gpa.dupe(u8, l.id);
    errdefer gpa.free(id);
    return .{ .id = id, .tag = try l.tag.clone(gpa) };
}

// The id as given ('en_CA' and 'en-CA' are different ids) and the tag it resolved to.
fn cacheKey(gpa: Allocator, l: Locale) Allocator.Error![]u8 {
    const c = try l.tag.compact(gpa);
    defer gpa.free(c);
    return std.fmt.allocPrint(gpa, "{s}\x00{s}", .{ l.id, c });
}

const api = @import("api/api.zig");
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
