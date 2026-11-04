//! Bound locale function groups (`api/api.ts`). Values borrow their locale data.
const std = @import("std");
const Allocator = std.mem.Allocator;
const LocaleData = @import("../locale_data.zig").LocaleData;
const Decimal = @import("../../decimal/decimal.zig").Decimal;
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
        return @import("../../language_tag/language_tag.zig").parse(gpa, code);
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
    pub fn adjustDecimal(self: Numbers, gpa: Allocator, n: Decimal, options: DecimalAdjustOptions) Allocator.Error!Decimal {
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
    pub fn getPluralCardinal(self: Numbers, gpa: Allocator, n: Decimal, options: ?DecimalAdjustOptions) Allocator.Error![]const u8 {
        return num.getPluralCardinal(gpa, self.data, n, options);
    }
    pub fn getPluralOrdinal(self: Numbers, gpa: Allocator, n: Decimal, options: ?DecimalAdjustOptions) Allocator.Error![]const u8 {
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
    pub fn formatQuantity(self: Units, gpa: Allocator, q: Quantity, options: UnitFormatOptions) Allocator.Error![]u8 {
        return uni.formatQuantity(gpa, self.data, q, options);
    }
    pub fn formatQuantityToParts(self: Units, gpa: Allocator, q: Quantity, options: UnitFormatOptions) Allocator.Error![]Part {
        return uni.formatQuantityToParts(gpa, self.data, q, options);
    }
    pub fn formatQuantitySequence(self: Units, gpa: Allocator, qs: []const Quantity, options: UnitFormatOptions) Allocator.Error![]u8 {
        return uni.formatQuantitySequence(gpa, self.data, qs, options);
    }
    pub fn formatQuantitySequenceToParts(self: Units, gpa: Allocator, qs: []const Quantity, options: UnitFormatOptions) Allocator.Error![]Part {
        return uni.formatQuantitySequenceToParts(gpa, self.data, qs, options);
    }
};
