//! Exact conversion between CLDR units, with factors kept as rationals.
//! Port of `packages/hereabouts/src/unit-converter`.
//!
//! ```zig
//! var length = try uc.UnitFactors.init(gpa, &uc.LENGTH);
//! defer length.deinit(gpa);
//! const c = try uc.UnitConverter.init(gpa, &.{.{ .category = "length", .factors = &length }});
//! defer c.deinit(gpa);
//! const v = (try c.convertUnits(gpa, "length", n, "mile", "yard", .{})).?;
//! defer v.deinit(gpa);
//! ```

const std = @import("std");

pub const Decimal = @import("../decimal/decimal.zig").Decimal;
pub const MathContext = @import("../decimal/decimal.zig").MathContext;
pub const Rational = @import("../decimal/rational.zig").Rational;

const types = @import("types.zig");
pub const FactorDef = types.FactorDef;
pub const FactorValue = types.FactorValue;

const factormap = @import("factormap.zig");
pub const UnitConversion = factormap.UnitConversion;
pub const UnitFactors = factormap.UnitFactors;

const converter = @import("converter.zig");
pub const Error = converter.Error;
pub const UnitConverter = converter.UnitConverter;

const tables = @import("autogen.factors.zig");
pub const ACCELERATION = tables.ACCELERATION;
pub const ANGLE = tables.ANGLE;
pub const AREA = tables.AREA;
pub const CONSUMPTION = tables.CONSUMPTION;
pub const DIGITAL = tables.DIGITAL;
/// Digital units where 1 kilobyte is 1000 bytes.
pub const DIGITAL_DECIMAL = tables.DIGITAL_DECIMAL;
/// Values for month, year and century are approximate. For accurate durations from a given
/// date, use calendar math.
pub const DURATION = tables.DURATION;
pub const ELECTRIC = tables.ELECTRIC;
pub const ENERGY = tables.ENERGY;
pub const FORCE = tables.FORCE;
pub const FREQUENCY = tables.FREQUENCY;
pub const GRAPHICS_PER = tables.GRAPHICS_PER;
pub const GRAPHICS_PIXEL = tables.GRAPHICS_PIXEL;
/// Candela, lumen and lux are different dimensions and are not mutually convertible.
pub const ILLUMINANCE = tables.ILLUMINANCE;
pub const LENGTH = tables.LENGTH;
pub const MASS = tables.MASS;
pub const POWER = tables.POWER;
pub const PRESSURE = tables.PRESSURE;
pub const RADIATION = tables.RADIATION;
pub const RADIOACTIVITY = tables.RADIOACTIVITY;
pub const RATIO = tables.RATIO;
pub const SPEED = tables.SPEED;
pub const SUBSTANCE = tables.SUBSTANCE;
/// Affine: the offset is in kelvin, so `kelvin = unit × factor + offset`.
pub const TEMPERATURE = tables.TEMPERATURE;
pub const TORQUE = tables.TORQUE;
/// US units.
pub const VOLUME = tables.VOLUME;
/// UK units: gallon, pint, ... are imperial.
pub const VOLUME_UK = tables.VOLUME_UK;

test {
    std.testing.refAllDecls(@This());
    _ = @import("heap.zig");
    _ = @import("strings.zig");
}
