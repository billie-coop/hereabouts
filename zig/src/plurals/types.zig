//! Shapes of the generated plural rule tables. Port of `packages/hereabouts/src/plurals/types.ts`.

/// A plural operand. See `NumberOperands`.
pub const Operand = enum { n, i, v, w, f, t, c };

/// One relation of a plural rule, e.g. `i % 10 = 2..4`: the operand, an optional modulus (0 for
/// none), whether it tests `=` (true) or `!=` (false), and the values and ranges it matches,
/// each `.{ lo, hi }` inclusive (a single value has lo == hi).
pub const Expr = struct {
    operand: Operand,
    mod: u32,
    eq: bool,
    ranges: []const [2]u32,
};

/// A plural rule: a category index and the conditions it ORs together, each a list of indices
/// into `expressions` that it ANDs together.
pub const Rule = struct {
    category: u8,
    conditions: []const []const u16,
};

/// Plural range rules for a language: either a single category index that applies to every
/// range, or entries mapping `((1 << start) << 5) + (1 << end)` to a category index.
pub const RangeMap = union(enum) {
    all: u8,
    map: []const struct { u16, u8 },
};
