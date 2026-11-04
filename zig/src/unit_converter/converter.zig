//! Port of `packages/hereabouts/src/unit-converter/converter.ts`.

const std = @import("std");
const Allocator = std.mem.Allocator;
const ArenaAllocator = std.heap.ArenaAllocator;

const D = @import("../decimal/decimal.zig");
const R = @import("../decimal/rational.zig");
const Decimal = D.Decimal;
const MathContext = D.MathContext;
const fm = @import("factormap.zig");
const UnitFactors = fm.UnitFactors;
const UnitConversion = fm.UnitConversion;
const strings = @import("strings.zig");

pub const Error = error{
    /// `add` was given a category the converter already has.
    CategoryExists,
} || R.Error;

/// Converts between units. Holds a set of unit factors per category name.
///
/// Like the TypeScript, a converter is an immutable value: `add` returns a new one. Each
/// converter owns its category names; the unit factors are borrowed and must outlive it.
pub const UnitConverter = struct {
    entries: []const Entry = &.{},

    pub const Entry = struct {
        category: []const u8,
        factors: *const UnitFactors,
    };

    pub fn deinit(self: UnitConverter, gpa: Allocator) void {
        for (self.entries) |e| gpa.free(e.category);
        gpa.free(self.entries);
    }

    fn find(self: UnitConverter, category: []const u8) ?*const UnitFactors {
        for (self.entries) |e| {
            if (std.mem.eql(u8, e.category, category)) return e.factors;
        }
        return null;
    }

    /// TypeScript `createUnitConverter` (unit-converter/converter.ts).
    pub fn init(gpa: Allocator, categories_: []const UnitConverter.Entry) Error!UnitConverter {
        return @import("converter.zig").create(gpa, categories_);
    }

    /// TypeScript `unitConverterHas` (unit-converter/converter.ts).
    pub fn has(converter: UnitConverter, category: []const u8) bool {
        return @import("converter.zig").has(converter, category);
    }

    /// TypeScript `unitConverterAdd` (unit-converter/converter.ts).
    pub fn add(converter: UnitConverter, gpa: Allocator, category: []const u8, map: *const UnitFactors) Error!UnitConverter {
        return @import("converter.zig").add(gpa, converter, category, map);
    }

    /// TypeScript `unitConverterFactors` (unit-converter/converter.ts).
    pub fn factors(converter: UnitConverter, category: []const u8) ?*const UnitFactors {
        return @import("converter.zig").factors(converter, category);
    }

    /// TypeScript `unitConverterCategories` (unit-converter/converter.ts).
    pub fn categories(converter: UnitConverter, gpa: Allocator) Allocator.Error![]const []const u8 {
        return @import("converter.zig").categories(gpa, converter);
    }

    /// TypeScript `unitConverterGet` (unit-converter/converter.ts).
    pub fn get(converter: UnitConverter, gpa: Allocator, category: []const u8, src: []const u8, dst: []const u8) R.Error!?UnitConversion {
        return @import("converter.zig").get(gpa, converter, category, src, dst);
    }

    /// TypeScript `convertUnits` (unit-converter/converter.ts).
    pub fn convertUnits(converter: UnitConverter, gpa: Allocator, category: []const u8, n: Decimal, src: []const u8, dst: []const u8, ctx: MathContext) R.Error!?Decimal {
        return @import("converter.zig").convertUnits(gpa, converter, category, n, src, dst, ctx);
    }
};

/// Create a unit converter, optionally with an initial set of categories (pass `&.{}` for
/// none). A repeated category is `error.CategoryExists`.
pub fn create(gpa: Allocator, categories_: []const UnitConverter.Entry) Error!UnitConverter {
    var c: UnitConverter = .{};
    errdefer c.deinit(gpa);
    for (categories_) |e| {
        const next = try add(gpa, c, e.category, e.factors);
        c.deinit(gpa);
        c = next;
    }
    return c;
}

/// Return true if the given category is registered.
pub fn has(converter: UnitConverter, category: []const u8) bool {
    return converter.find(category) != null;
}

/// Return a new converter with the set of conversion factors added under the given category
/// name. Returns `error.CategoryExists` if the category is already registered.
pub fn add(gpa: Allocator, converter: UnitConverter, category: []const u8, map: *const UnitFactors) Error!UnitConverter {
    if (has(converter, category)) return error.CategoryExists;
    const entries = try gpa.alloc(UnitConverter.Entry, converter.entries.len + 1);
    var n: usize = 0;
    errdefer {
        for (entries[0..n]) |e| gpa.free(e.category);
        gpa.free(entries);
    }
    for (converter.entries) |e| {
        entries[n] = .{ .category = try gpa.dupe(u8, e.category), .factors = e.factors };
        n += 1;
    }
    entries[n] = .{ .category = try gpa.dupe(u8, category), .factors = map };
    return .{ .entries = entries };
}

/// Returns the unit factors for the given category.
pub fn factors(converter: UnitConverter, category: []const u8) ?*const UnitFactors {
    return converter.find(category);
}

/// Return the sorted categories added to this converter. Free the slice with `gpa.free`; the
/// names belong to the converter.
pub fn categories(gpa: Allocator, converter: UnitConverter) Allocator.Error![]const []const u8 {
    const r = try gpa.alloc([]const u8, converter.entries.len);
    for (converter.entries, r) |e, *x| x.* = e.category;
    strings.sort(r);
    return r;
}

/// Get the unit conversion factor that converts `src` to `dst` for the given category.
pub fn get(gpa: Allocator, converter: UnitConverter, category: []const u8, src: []const u8, dst: []const u8) R.Error!?UnitConversion {
    const map = converter.find(category) orelse return null;
    return fm.unitFactorsGet(gpa, map, src, dst);
}

/// Convert the decimal value from `src` to `dst` units, or null if there is no conversion.
/// Affine conversions (e.g. temperature) apply the combined additive offset after the
/// multiplicative factor. The context also rounds the combined factor. Pass `.{}` for the
/// default context.
pub fn convertUnits(gpa: Allocator, converter: UnitConverter, category: []const u8, n: Decimal, src: []const u8, dst: []const u8, ctx: MathContext) R.Error!?Decimal {
    const conv = try get(gpa, converter, category, src, dst) orelse return null;
    defer conv.deinit(gpa);

    var arena = ArenaAllocator.init(gpa);
    defer arena.deinit();
    const a = arena.allocator();

    var fac = R.ONE;
    for (conv.factors) |f| fac = try R.multiply(a, fac, f, ctx);
    const res = try D.multiply(a, n, try R.toDecimal(a, fac, ctx), ctx);
    if (conv.offset) |o| return try D.add(gpa, res, try R.toDecimal(a, o, ctx));
    return try D.clone(gpa, res);
}
