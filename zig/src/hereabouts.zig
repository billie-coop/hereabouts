//! hereabouts for Zig: a port of the TypeScript library in `packages/hereabouts`.
//!
//! The TypeScript is the reference; the shared cases in `conformance/` check that both give the
//! same answers. Each namespace below matches a TypeScript entry point.

pub const decimal = @import("decimal/decimal.zig");
pub const rational = @import("decimal/rational.zig");
pub const timezone = @import("timezone/timezone.zig");
pub const datetime = @import("datetime/datetime.zig");
pub const plurals = @import("plurals/plurals.zig");
pub const messageformat = @import("messageformat/messageformat.zig");
pub const language_tag = @import("language_tag/language_tag.zig");
pub const locale = @import("locale/locale.zig");
pub const locale_matcher = @import("locale_matcher/locale_matcher.zig");
pub const unit_converter = @import("unit_converter/unit_converter.zig");
pub const core = @import("core/core.zig");

test {
    // Runs the inline tests in every file under src/ (`zig build test-unit`).
    @import("std").testing.refAllDecls(@This());
}
