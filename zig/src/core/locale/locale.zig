//! Locales with data (`core/locale/index.ts`).

const Locale = @import("../../locale/locale.zig").Locale;
const autogen = @import("autogen.locales.zig");

/// Every locale with data in the resource packs. The locales are static: do not free them.
/// (`availableLocales`)
pub fn availableLocales() []const Locale {
    return &autogen.available_locales;
}
