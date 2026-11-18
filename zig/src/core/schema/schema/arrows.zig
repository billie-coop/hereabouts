//! Schema accessors ("arrows"): plain data describing where a value lives in a bundle's string
//! table, and the functions that read values through them (`schema/schema/arrows.ts`).
//!
//! The arrows of the shipped schema config are generated constants
//! (`schema/autogen.schema.zig`), e.g. `schema.Numbers.minimumGroupingDigits.get(&bundle)`.

const std = @import("std");
const Allocator = std.mem.Allocator;
const KeyIndex = @import("../instructions.zig").KeyIndex;
const Bundle = @import("../../resource/bundle.zig").Bundle;

/// A single field.
pub const FieldArrow = struct {
    offset: u32,

    /// Read the field (`fieldGet`).
    pub fn get(self: FieldArrow, bundle: *const Bundle) []const u8 {
        return bundle.get(self.offset);
    }
};

/// Read a single field.
pub fn fieldGet(arrow: FieldArrow, bundle: *const Bundle) []const u8 {
    return arrow.get(bundle);
}

/// A child scope per key, e.g. the number system info per number system name.
pub fn ScopeArrow(comptime T: type) type {
    return struct {
        keys: *const KeyIndex,
        /// One per key, in key order.
        values: []const T,

        /// Select a child scope by key (`scopeGet`).
        pub fn get(self: @This(), key: []const u8) ?*const T {
            const i = self.keys.get(key) orelse return null;
            return &self.values[i];
        }
    };
}

/// Pattern and divisor read from a digits arrow.
pub const DigitsValue = struct {
    pattern: []const u8,
    divisor: i64,
};

/// Special vector to store a pluralized number pattern and its divisor together, per number of
/// integer digits (1 to `len`).
pub const DigitsArrow = struct {
    offset: u32,
    index: *const KeyIndex,
    /// Number of digit counts stored (the TypeScript's `values.length`).
    len: u32,

    /// Read the pattern and divisor for a key and number of integer digits (`digitsGet`).
    /// `digits` is a float since the TypeScript may compute a fractional count (`log10` of a
    /// divisor); a fractional offset reads nothing, giving `{ "", 0 }`.
    pub fn get(self: DigitsArrow, bundle: *const Bundle, key: []const u8, digits_in: f64) DigitsValue {
        var digits = digits_in;
        const max: f64 = @floatFromInt(self.len);
        if (digits > max) digits = max;
        if (digits > 0) {
            if (self.index.get(key)) |i| {
                // The offset is computed in floating point: it may still be whole when the
                // digit count is not (2.5 reads the divisor of 2 and the pattern of 3).
                const kf = @as(f64, @floatFromInt(self.offset + i * self.len * 2)) + (digits - 1) * 2;
                if (@floor(kf) == kf) {
                    const k: usize = @intFromFloat(kf);
                    return .{ .pattern = bundle.get(k), .divisor = jsNumber(bundle.get(k + 1)) };
                }
            }
        }
        return .{ .pattern = "", .divisor = 0 };
    }
};

/// Read the pattern and divisor for a key and number of integer digits.
pub fn digitsGet(arrow: DigitsArrow, bundle: *const Bundle, key: []const u8, digits: f64) DigitsValue {
    return arrow.get(bundle, key, digits);
}

/// `Number(s)` for the divisor strings of a resource pack: '' is 0.
fn jsNumber(s: []const u8) i64 {
    const t = std.mem.trim(u8, s, " \t\r\n");
    return std.fmt.parseInt(i64, t, 10) catch 0;
}

/// Generalized multi-dimensional vector accessor. The header field at `offset - 1` marks
/// whether the vector exists in the bundle; values start at `offset`.
pub const VectorArrow = struct {
    offset: u32,
    keysets: []const *const KeyIndex,
    /// Address factor of each dimension: the product of the sizes of the later dimensions.
    factors: []const u32,

    /// Number of dimensions.
    pub fn len(self: VectorArrow) usize {
        return self.keysets.len;
    }

    /// True if the vector has data in this bundle (`vectorExists`).
    pub fn exists(self: VectorArrow, bundle: *const Bundle) bool {
        return std.mem.eql(u8, bundle.get(self.offset - 1), "E");
    }

    /// Read a field, one key per dimension (`vectorGet` with plain keys). Returns '' when the
    /// vector is missing or a key is unknown. `keys.len` must equal the number of dimensions.
    pub fn get(self: VectorArrow, bundle: *const Bundle, keys: []const []const u8) []const u8 {
        std.debug.assert(keys.len == self.keysets.len);
        if (!self.exists(bundle)) return "";
        var k: usize = self.offset;
        for (keys, self.keysets, self.factors) |key, ks, f| {
            const j = ks.get(key) orelse return "";
            k += j * f;
        }
        return bundle.get(k);
    }

    /// Read a field where each dimension lists keys to try in order (`vectorGet` with arrays
    /// of keys): the first combination with a non-empty value wins.
    pub fn getAlt(self: VectorArrow, bundle: *const Bundle, keys: []const []const []const u8) []const u8 {
        std.debug.assert(keys.len == self.keysets.len);
        if (!self.exists(bundle)) return "";
        return self.lookup(bundle, keys, 0, self.offset);
    }

    /// Read a field by key positions, without checking that the vector exists.
    pub fn getIndex(self: VectorArrow, bundle: *const Bundle, positions: []const usize) []const u8 {
        std.debug.assert(positions.len == self.keysets.len);
        var k: usize = self.offset;
        for (positions, self.factors) |p, f| k += p * f;
        return bundle.get(k);
    }

    /// True if the keys address a valid field of the vector (`vectorValid`).
    pub fn valid(self: VectorArrow, keys: []const []const []const u8) bool {
        return self.index(keys, 0, self.offset) != null;
    }

    fn index(self: VectorArrow, keys: []const []const []const u8, ix: usize, k: usize) ?usize {
        const args = keys[ix];
        for (args, 0..) |arg, i| {
            const j = self.keysets[ix].get(arg) orelse {
                if (i != args.len - 1) continue;
                return null;
            };
            const kk = k + j * self.factors[ix];
            if (ix == self.keysets.len - 1) return kk;
            if (self.index(keys, ix + 1, kk)) |r| return r;
        }
        return null;
    }

    fn lookup(self: VectorArrow, bundle: *const Bundle, keys: []const []const []const u8, ix: usize, k: usize) []const u8 {
        const args = keys[ix];
        for (args, 0..) |arg, i| {
            const j = self.keysets[ix].get(arg) orelse {
                if (i != args.len - 1) continue;
                return "";
            };
            const kk = k + j * self.factors[ix];
            const val = if (ix == self.keysets.len - 1) bundle.get(kk) else self.lookup(bundle, keys, ix + 1, kk);
            if (val.len > 0) return val;
        }
        return "";
    }

    /// Read the whole vector into nested JSON objects, omitting empty values (`vectorMapping`).
    /// The strings are borrowed from the bundle; the objects are allocated with `gpa` (an arena
    /// is the easy way to free them).
    pub fn mapping(self: VectorArrow, gpa: Allocator, bundle: *const Bundle) Allocator.Error!std.json.Value {
        if (!self.exists(bundle)) return .{ .object = .empty };
        return self.mappingAt(gpa, bundle, 0, 0);
    }

    fn mappingAt(self: VectorArrow, gpa: Allocator, bundle: *const Bundle, k: usize, ix: usize) Allocator.Error!std.json.Value {
        var o: std.json.ObjectMap = .empty;
        const keys = self.keysets[k].keys;
        const last = k == self.keysets.len - 1;
        for (keys, 0..) |key, i| {
            if (last) {
                // We're at the value level of the map, so lookup the corresponding string
                const val = bundle.get(self.offset + i + ix);
                if (val.len > 0) try o.put(gpa, key, .{ .string = val });
            } else {
                // Drill one level deeper
                try o.put(gpa, key, try self.mappingAt(gpa, bundle, k + 1, ix + i * self.factors[k]));
            }
        }
        return .{ .object = o };
    }
};

/// True if the vector has data in this bundle.
pub fn vectorExists(arrow: VectorArrow, bundle: *const Bundle) bool {
    return arrow.exists(bundle);
}

/// Read a field of the vector; each key is a list of fallback keys tried in order.
pub fn vectorGet(arrow: VectorArrow, bundle: *const Bundle, keys: []const []const []const u8) []const u8 {
    return arrow.getAlt(bundle, keys);
}

/// True if the keys address a valid field of the vector.
pub fn vectorValid(arrow: VectorArrow, keys: []const []const []const u8) bool {
    return arrow.valid(keys);
}

/// Read the whole vector into nested JSON objects, omitting empty values.
pub fn vectorMapping(gpa: Allocator, arrow: VectorArrow, bundle: *const Bundle) Allocator.Error!std.json.Value {
    return arrow.mapping(gpa, bundle);
}
