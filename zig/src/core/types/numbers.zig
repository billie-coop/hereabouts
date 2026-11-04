//! Number types (`src/types/numbers.ts`). Currency codes, number system names and unit ids
//! stay strings: the TypeScript's large string unions are checked against the schema's key
//! indices at runtime instead.

/// Number symbol names, in the order of the schema's 'number-symbol' index.
pub const number_symbol_names = [_][]const u8{
    "approximatelySign", "currencyDecimal", "currencyGroup", "decimal",  "exponential",
    "group",             "infinity",        "list",          "minusSign", "nan",
    "perMille",          "percentSign",     "plusSign",      "superscriptingExponent",
    "timeSeparator",
};

/// Number system categories ('default', 'native', 'finance', 'traditional').
pub const number_system_categories = [_][]const u8{ "default", "native", "finance", "traditional" };
