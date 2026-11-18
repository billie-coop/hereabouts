//! Port of `packages/hereabouts/src/unit-converter/types.ts`.

const R = @import("../decimal/rational.zig");

/// A factor or offset: a rational string ("5 / 9", "273.15", "pi") or a rational.
pub const FactorValue = union(enum) {
    string: []const u8,
    rational: R.Rational,
};

/// Definition of a single conversion factor. The factor converts a value in `src` units to
/// `dst` units: `dst = src × factor + offset`. The offset is additive and expressed in `dst`
/// units; it defaults to zero, so most conversions are pure ratios. Affine (offset) factors
/// are used for temperature, where the scales share a ratio but not a zero point.
pub const FactorDef = struct {
    src: []const u8,
    factor: FactorValue,
    dst: []const u8,
    offset: ?FactorValue = null,
};
