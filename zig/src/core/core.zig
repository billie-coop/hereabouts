//! Port of `packages/hereabouts/src/core`: resource packs, number, currency, unit, date and
//! list formatting, display names, calendars. Several areas are ported separately; each adds
//! its exports in its own block below.

// ---------------------------------------------------------------------------------------------
// Foundation, numbers, currencies and units
// ---------------------------------------------------------------------------------------------

const framework_mod = @import("framework.zig");

/// Loads resource packs and locales (`createFramework`, `loadLocale`).
pub const Framework = framework_mod.Framework;
pub const FrameworkOptions = framework_mod.Options;
pub const FrameworkError = framework_mod.Error;
pub const Loader = framework_mod.Loader;
pub const LocaleInput = framework_mod.LocaleInput;
pub const resolveLocale = framework_mod.resolveLocale;
pub const resolveLocaleTag = framework_mod.resolveLocaleTag;
pub const cldrVersion = framework_mod.cldrVersion;

/// Everything the locale functions need for one locale.
pub const LocaleData = @import("locale_data.zig").LocaleData;
pub const availableLocales = @import("locale/locale.zig").availableLocales;

/// Resource packs and bundles (`resource/`).
pub const Bundle = @import("resource/bundle.zig").Bundle;
pub const ExceptionIndex = @import("resource/bundle.zig").ExceptionIndex;
pub const stringBundle = @import("resource/bundle.zig").stringBundle;
pub const Pack = @import("resource/pack.zig").Pack;
pub const loadPack = @import("resource/pack.zig").loadPack;
pub const packGet = @import("resource/pack.zig").packGet;
pub const checksum = @import("resource/checksum.zig");

/// The schema of the shipped config: `schema.schema` (the accessor tree), `schema.indices`,
/// `schema.index(name)`, `schema.checksum`, `schema.version`.
pub const schema = @import("schema/autogen.schema.zig");
/// Schema tree types (`Schema`, `NumberSystemInfo`, `CalendarSchema`, ...).
pub const schema_types = @import("types/schema.zig");
pub const Schema = schema_types.Schema;
pub const KeyIndex = @import("schema/instructions.zig").KeyIndex;
/// FieldArrow, VectorArrow, DigitsArrow, ScopeArrow and the TypeScript-named functions.
pub const arrows = @import("schema/schema/arrows.zig");

/// Small types: ContextType, ListPatternType, number symbol names.
pub const types = struct {
    pub const general = @import("types/general.zig");
    pub const numbers = @import("types/numbers.zig");
};

/// NumberSymbols, NumberingSystem, NumberParams, CurrencySpacing.
pub const private = @import("common/private.zig");
/// Number and currency format options.
pub const number_options = @import("common/numbers.zig");
/// Unit format options and Quantity.
pub const unit_options = @import("common/units.zig");

/// Pattern parsers.
pub const parsing = struct {
    pub const number = @import("parsing/number.zig");
    pub const wrapper = @import("parsing/wrapper.zig");
};

/// Decimal numbering systems: digits by name, `formatString`, `formatInt`, `fastFormatDecimal`.
pub const numbering = @import("systems/numbering/decimal.zig");

/// Value builder (parts, joined for strings) and upper-casing.
pub const utils = struct {
    pub const render = @import("utils/render.zig");
    pub const case = @import("utils/case.zig");
};

/// Number and currency formatting (`api/numbers.ts`).
pub const numbers = @import("api/numbers.zig");
/// Unit quantity formatting (`api/units.ts`).
pub const units = @import("api/units.zig");
/// Number params per locale and number system (`getNumberParams`).
pub const getNumberParams = @import("api/private/numbers.zig").getNumberParams;

/// Internals other areas build on.
pub const internals = struct {
    /// Number rendering: renderDecimal, renderCurrency, currency names and symbols.
    pub const numbers = @import("internals/numbers/internal.zig");
    pub const number_context = @import("internals/numbers/context.zig");
    pub const number_renderer = @import("internals/numbers/render.zig");
    /// parseWrapper, contextTransform, formatListValue, formatWrapper.
    pub const general = @import("internals/general/internal.zig");
    pub const units = @import("internals/units/internal.zig");
};

// ---------------------------------------------------------------------------------------------
// Calendar systems
// ---------------------------------------------------------------------------------------------
pub const calendars = @import("systems/calendars/calendars.zig");
pub const zoneutil = @import("internals/calendars/zoneutil.zig");

test {
    _ = calendars;
    _ = @import("schema/instructions.zig");
    _ = @import("resource/checksum.zig");
    _ = @import("utils/case.zig");
    _ = @import("parsing/wrapper.zig");
    _ = @import("parsing/number.zig");
    _ = @import("systems/numbering/decimal.zig");
}

// ---------------------------------------------------------------------------------------------
// General formatting and bound convenience API
// ---------------------------------------------------------------------------------------------
pub const general = @import("api/general.zig");
pub const general_options = @import("common/general.zig");
pub const bound_api = @import("api/api.zig");
pub const getContextTransformInfo = @import("api/private/api.zig").getContextTransformInfo;
pub const cldr = @import("cldr.zig");
pub const CLDR = cldr.CLDR;
pub const CLDRFramework = cldr.CLDRFramework;
pub const bindCLDR = cldr.bindCLDR;
pub const bindCalendars = cldr.bindCalendars;
pub const bindGeneral = cldr.bindGeneral;
pub const bindNumbers = cldr.bindNumbers;
pub const bindUnits = cldr.bindUnits;
pub const cldrFramework = cldr.cldrFramework;

// ---------------------------------------------------------------------------------------------
// Date formatting, skeletons, relative time and plain-day formatting
// ---------------------------------------------------------------------------------------------
pub const dates = @import("api/calendars.zig");
pub const days = @import("api/days.zig");
pub const date_options = @import("common/calendars.zig");
pub const date_parsing = @import("parsing/date.zig");
pub const date_skeletons = @import("internals/calendars/skeleton.zig");
pub const date_patterns = @import("internals/calendars/patterns.zig");
pub const date_manager = @import("internals/calendars/manager.zig");
pub const date_internal = @import("internals/calendars/internal.zig");
pub const date_formatter = @import("internals/calendars/formatter.zig");
pub const date_fields = @import("internals/calendars/fields.zig");
pub const relative_time = @import("internals/datefields/internal.zig");
