//! hereabouts for Zig: a port of the TypeScript library in `packages/hereabouts`.
//!
//! So far this covers exact decimal math (`decimal`, `rational`). The TypeScript is the
//! reference; the shared cases in `conformance/` check that both give the same answers.

pub const decimal = @import("decimal/decimal.zig");
pub const rational = @import("decimal/rational.zig");

test {
    @import("std").testing.refAllDecls(@This());
    _ = decimal;
    _ = rational;
}
