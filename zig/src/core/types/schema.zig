//! Types of the schema accessor tree (`src/types/schema.ts`). The field names are the
//! TypeScript's, so a path like `Numbers.numberSystem.latn.decimalFormats.standard` reads the
//! same in both. The tree itself is generated: `core/schema/autogen.schema.zig`.

const arrows = @import("../schema/schema/arrows.zig");

pub const FieldArrow = arrows.FieldArrow;
pub const VectorArrow = arrows.VectorArrow;
pub const DigitsArrow = arrows.DigitsArrow;
pub const ScopeArrow = arrows.ScopeArrow;

// CALENDARS

pub const CalendarFields = struct {
    /// [field-width, weekday]
    weekdays: VectorArrow,
    /// [field-width, <calendar>-month]
    months: VectorArrow,
    /// [field-width, quarter]
    quarters: VectorArrow,
    /// [field-width, day-period, day-period-alt-key]
    dayPeriods: VectorArrow,
};

/// Same layout for every calendar (Buddhist, Gregorian, Japanese, Persian).
pub const CalendarSchema = struct {
    /// [era-type, <calendar>-era, era-alt-key]
    eras: VectorArrow,
    format: CalendarFields,
    standAlone: CalendarFields,
    /// [<calendar>-available-format]
    availableFormats: VectorArrow,
    /// [plural-key, <calendar>-plural-format]
    pluralFormats: VectorArrow,
    /// [<calendar>-interval-format, date-time-pattern-field]
    intervalFormats: VectorArrow,
    /// [format-width]
    dateFormats: VectorArrow,
    timeFormats: VectorArrow,
    dateSkeletons: VectorArrow,
    timeSkeletons: VectorArrow,
    dateTimeFormats: VectorArrow,
    dateTimeFormatsAt: VectorArrow,
    intervalFormatFallback: FieldArrow,
};

// CURRENCIES

pub const CurrenciesSchema = struct {
    /// [currency-id]
    displayName: VectorArrow,
    /// [currency-id]
    decimal: VectorArrow,
    /// [plural-key, currency-id]
    pluralName: VectorArrow,
    /// [alt-key, currency-id]
    symbol: VectorArrow,
};

// DATEFIELDS

pub const RelativeTimeFields = struct {
    /// [relative-time-field]
    previous2: VectorArrow,
    previous: VectorArrow,
    current: VectorArrow,
    next: VectorArrow,
    next2: VectorArrow,
    /// [plural-key, relative-time-field]
    future: VectorArrow,
    past: VectorArrow,
};

pub const RelativeTimes = struct {
    wide: RelativeTimeFields,
    short: RelativeTimeFields,
    narrow: RelativeTimeFields,
};

pub const DateFieldsSchema = struct {
    relativeTimes: RelativeTimes,
    /// [date-field, date-field-width]
    displayName: VectorArrow,
};

// GENERAL

pub const LayoutSchema = struct {
    characterOrder: FieldArrow,
    lineOrder: FieldArrow,
};

/// Each is [list-pattern-position].
pub const ListPatternsSchema = struct {
    @"and": VectorArrow,
    andShort: VectorArrow,
    @"or": VectorArrow,
    unitLong: VectorArrow,
    unitNarrow: VectorArrow,
    unitShort: VectorArrow,
};

pub const ContextTransformsSchema = struct {
    /// [context-transform-field]
    contextTransforms: VectorArrow,
};

// NAMES

/// [alt-key, language-id / script-id / region-id]
pub const NameInfo = struct {
    displayName: VectorArrow,
};

pub const NamesSchema = struct {
    languages: NameInfo,
    scripts: NameInfo,
    regions: NameInfo,
};

// NUMBERS

pub const CurrencyFormats = struct {
    standard: FieldArrow,
    accounting: FieldArrow,
    /// [plural-key] x digits
    short: DigitsArrow,
    /// [currency-spacing-pos, currency-spacing-pattern]
    spacing: VectorArrow,
    /// [plural-key]
    unitPattern: VectorArrow,
};

pub const DecimalFormats = struct {
    standard: FieldArrow,
    short: DigitsArrow,
    long: DigitsArrow,
};

pub const NumberSystemInfo = struct {
    /// [number-symbol]
    symbols: VectorArrow,
    currencyFormats: CurrencyFormats,
    decimalFormats: DecimalFormats,
    percentFormat: FieldArrow,
    scientificFormat: FieldArrow,
    /// [number-misc-pattern]
    miscPatterns: VectorArrow,
};

pub const NumbersSchema = struct {
    minimumGroupingDigits: FieldArrow,
    /// [number-system] ('default', 'native', 'finance', 'traditional')
    numberSystems: VectorArrow,
    /// By number system name ('latn', 'arab', ...).
    numberSystem: ScopeArrow(NumberSystemInfo),
};

// TIMEZONES

pub const MetaZoneInfo = struct {
    /// [timezone-type, metazone]
    short: VectorArrow,
    long: VectorArrow,
};

pub const TimeZoneSchema = struct {
    metaZones: MetaZoneInfo,
    /// [timezone-id]
    exemplarCity: VectorArrow,
    gmtFormat: FieldArrow,
    hourFormat: FieldArrow,
    gmtZeroFormat: FieldArrow,
    regionFormat: FieldArrow,
};

// UNITS

pub const UnitInfo = struct {
    /// [plural-key, unit-id]
    unitPattern: VectorArrow,
    /// [unit-id]
    displayName: VectorArrow,
    /// [unit-id]
    perUnitPattern: VectorArrow,
    perPattern: FieldArrow,
    timesPattern: FieldArrow,
};

pub const UnitsSchema = struct {
    long: UnitInfo,
    narrow: UnitInfo,
    short: UnitInfo,
};

// ROOT SCHEMA

pub const Schema = struct {
    Names: NamesSchema,
    Numbers: NumbersSchema,
    DateFields: DateFieldsSchema,
    Layout: LayoutSchema,
    ListPatterns: ListPatternsSchema,
    Buddhist: CalendarSchema,
    Gregorian: CalendarSchema,
    Japanese: CalendarSchema,
    Persian: CalendarSchema,
    TimeZones: TimeZoneSchema,
    Currencies: CurrenciesSchema,
    Units: UnitsSchema,
    ContextTransforms: ContextTransformsSchema,
};
