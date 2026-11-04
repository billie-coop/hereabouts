//! Port of `packages/hereabouts/src/unit-converter/factormap.ts`.

const std = @import("std");
const Allocator = std.mem.Allocator;
const ArenaAllocator = std.heap.ArenaAllocator;

const D = @import("../decimal/decimal.zig");
const R = @import("../decimal/rational.zig");
const Rational = R.Rational;
const FactorDef = @import("types.zig").FactorDef;
const FactorValue = @import("types.zig").FactorValue;
const Heap = @import("heap.zig").Heap;
const strings = @import("strings.zig");

pub const Error = R.Error;

/// Represents a conversion path from source to destination unit, the rational conversion
/// factors, and the combined additive offset.
///
/// A value `v` in the source unit converts to the destination unit as
/// `v × (factors[0] × factors[1] × ...) + offset`. The offset is only present for affine
/// conversions, e.g. temperature. Owned by the caller: free with `deinit`.
pub const UnitConversion = struct {
    path: []const []const u8,
    factors: []const Rational,
    offset: ?Rational = null,

    pub fn deinit(self: UnitConversion, gpa: Allocator) void {
        for (self.path) |p| gpa.free(p);
        gpa.free(self.path);
        for (self.factors) |f| f.deinit(gpa);
        gpa.free(self.factors);
        if (self.offset) |o| o.deinit(gpa);
    }
};

// An edge converts `src` to `to` as `to = src × factor + offset`.
const Edge = struct {
    to: u32,
    factor: Rational,
    offset: Rational,
    /// Digit cost of the factor, for the shortest path search.
    cost: i64,
};

/// A closed set of conversion factors between units, e.g. any unit in the set must be
/// convertable into any other unit in the set. There must be a connected path of length 1 or
/// greater between any two units.
///
/// Gaps in the graph represent conversion factors that are unknown at the time of graph
/// construction. These are filled in on demand by finding the shortest and lowest-cost
/// conversion path between two units with no direct conversion factor. The path is
/// transformed into a direct conversion factor by multiplying all factors along the path.
///
/// The factor graph is built by `unitFactors`; the set is read-only afterwards, so it can be
/// shared between threads. Free with `deinit`.
pub const UnitFactors = struct {
    /// The conversion factors the set was built from (borrowed: they must outlive the set).
    factors: []const FactorDef,
    /// Sorted array of all units in the set.
    units: []const []const u8,

    arena: ArenaAllocator.State,
    /// Graph nodes: unit name to index, in the order the factors name them.
    index: std.StringArrayHashMapUnmanaged(u32),
    /// Edges of each node, in the order JavaScript enumerates the TypeScript's object keys.
    edges: []const []const Edge,
    /// A factor that did not parse. The TypeScript builds the graph on first use and throws
    /// then, so this is returned by the first lookup that needs the graph.
    graph_error: ?R.Error,

    /// True if the unit is in the set.
    pub fn has(self: *const UnitFactors, unit: []const u8) bool {
        return self.index.contains(unit);
    }

    pub fn deinit(self: *UnitFactors, gpa: Allocator) void {
        self.arena.promote(gpa).deinit();
        self.* = undefined;
    }

    fn node(self: *const UnitFactors, unit: []const u8) ?u32 {
        return self.index.get(unit);
    }

    fn name(self: *const UnitFactors, i: u32) []const u8 {
        return self.index.keys()[i];
    }

    fn edge(self: *const UnitFactors, from: u32, to: u32) ?*const Edge {
        for (self.edges[from]) |*e| {
            if (e.to == to) return e;
        }
        return null;
    }

    /// TypeScript `unitFactors` (unit-converter/factormap.ts).
    pub fn init(gpa: Allocator, factors: []const FactorDef) D.Error!UnitFactors {
        return @import("factormap.zig").unitFactors(gpa, factors);
    }

    /// TypeScript `unitFactorsGet` (unit-converter/factormap.ts).
    pub fn get(map: *const UnitFactors, gpa: Allocator, src: []const u8, dst: []const u8) Error!?UnitConversion {
        return @import("factormap.zig").unitFactorsGet(gpa, map, src, dst);
    }
};

fn value(a: Allocator, v: FactorValue) Error!Rational {
    return switch (v) {
        .string => |s| R.parse(a, s),
        .rational => |r| R.init(a, r.numerator, r.denominator),
    };
}

/// Edges of one node while building, keyed by destination in insertion order.
const EdgeList = std.ArrayList(Edge);

fn setEdge(a: Allocator, list: *EdgeList, e: Edge, overwrite: bool) Allocator.Error!void {
    for (list.items) |*x| {
        if (x.to == e.to) {
            if (overwrite) x.* = e;
            return;
        }
    }
    try list.append(a, e);
}

/// Return the digit cost of a rational: the number of decimal digits its numerator and
/// denominator contribute. Uses absolute magnitudes so the cost is always positive
/// (Dijkstra's algorithm requires non-negative edge costs; e.g. `0.001` must not cost less
/// than `1000`).
fn precision(r: Rational) i64 {
    const n = r.numerator;
    const d = r.denominator;
    return @intCast(@abs(D.precision(n) + D.alignExp(n)) + @abs(D.precision(d) + D.alignExp(d)));
}

/// Build a set of unit conversion factors. `factors` is borrowed and must outlive the set.
pub fn unitFactors(gpa: Allocator, factors: []const FactorDef) D.Error!UnitFactors {
    var arena = ArenaAllocator.init(gpa);
    errdefer arena.deinit();
    const a = arena.allocator();

    var index: std.StringArrayHashMapUnmanaged(u32) = .empty;
    for (factors) |f| {
        for ([_][]const u8{ f.src, f.dst }) |u| {
            const gop = try index.getOrPut(a, u);
            if (!gop.found_existing) gop.value_ptr.* = @intCast(gop.index);
        }
    }

    const units = try a.dupe([]const u8, index.keys());
    strings.sort(units);

    var graph_error: ?R.Error = null;
    const lists = try a.alloc(EdgeList, index.count());
    for (lists) |*l| l.* = .empty;

    for (factors) |f| {
        const rat = value(a, f.factor) catch |err| {
            if (err == error.OutOfMemory) return error.OutOfMemory;
            graph_error = err;
            break;
        };
        const off = if (f.offset) |o| value(a, o) catch |err| {
            if (err == error.OutOfMemory) return error.OutOfMemory;
            graph_error = err;
            break;
        } else R.ZERO;
        const s = index.get(f.src).?;
        const d = index.get(f.dst).?;

        // Convert src -> dst
        try setEdge(a, &lists[s], .{ .to = d, .factor = rat, .offset = off, .cost = precision(rat) }, true);

        // Convert dst -> src, if an explicit mapping does not already exist.
        // Inverting `dst = src × r + a` gives `src = dst × (1/r) − a/r`.
        const inv = try R.inverse(a, rat);
        const inv_off = try R.negate(a, try R.divide(a, off, rat, .{}));
        try setEdge(a, &lists[d], .{ .to = s, .factor = inv, .offset = inv_off, .cost = precision(inv) }, false);
    }

    // JavaScript enumerates array-index keys ("0", "1", ...) first, in numeric order, then the
    // other keys in insertion order. The search visits neighbors in that order.
    const edges = try a.alloc([]const Edge, lists.len);
    for (lists, 0..) |l, i| {
        std.mem.sort(Edge, l.items, index.keys(), edgeKeyLess);
        edges[i] = l.items;
    }

    return .{
        .factors = factors,
        .units = units,
        .arena = arena.state,
        .index = index,
        .edges = edges,
        .graph_error = graph_error,
    };
}

fn edgeKeyLess(keys: []const []const u8, x: Edge, y: Edge) bool {
    const ix = strings.arrayIndex(keys[x.to]) orelse return false;
    const iy = strings.arrayIndex(keys[y.to]) orelse return true;
    return ix < iy;
}

fn dupePath(gpa: Allocator, names: []const []const u8) Allocator.Error![]const []const u8 {
    const path = try gpa.alloc([]const u8, names.len);
    var n: usize = 0;
    errdefer {
        for (path[0..n]) |p| gpa.free(p);
        gpa.free(path);
    }
    for (names) |s| {
        path[n] = try gpa.dupe(u8, s);
        n += 1;
    }
    return path;
}

fn freeRationals(gpa: Allocator, rs: []Rational, n: usize) void {
    for (rs[0..n]) |r| r.deinit(gpa);
    gpa.free(rs);
}

/// A conversion owned by gpa, copied from parts that may be temporary.
fn makeConversion(gpa: Allocator, names: []const []const u8, factors: []const Rational, offset: ?Rational) Allocator.Error!UnitConversion {
    const path = try dupePath(gpa, names);
    errdefer (UnitConversion{ .path = path, .factors = &.{} }).deinit(gpa);
    const fs = try gpa.alloc(Rational, factors.len);
    var n: usize = 0;
    errdefer freeRationals(gpa, fs, n);
    for (factors) |f| {
        fs[n] = try R.init(gpa, f.numerator, f.denominator);
        n += 1;
    }
    const off = if (offset) |o| try R.init(gpa, o.numerator, o.denominator) else null;
    return .{ .path = path, .factors = fs, .offset = off };
}

/// Return the factor that converts units of `src` into `dst`, or null if there is none.
/// The result is owned by gpa.
pub fn unitFactorsGet(gpa: Allocator, map: *const UnitFactors, src: []const u8, dst: []const u8) Error!?UnitConversion {
    // Units are the same, conversion is 1
    if (std.mem.eql(u8, src, dst)) {
        return try makeConversion(gpa, &.{ src, dst }, &.{R.ONE}, null);
    }

    if (map.graph_error) |err| return err;

    var arena = ArenaAllocator.init(gpa);
    defer arena.deinit();
    const a = arena.allocator();

    const s = map.node(src) orelse return null;
    const d = map.node(dst) orelse return null;

    // See if a direct conversion exists
    if (map.edge(s, d)) |e| {
        const zero = try R.compare(a, e.offset, R.ZERO, .{}) == 0;
        return try makeConversion(gpa, &.{ src, dst }, &.{e.factor}, if (zero) null else e.offset);
    }

    // Find the shortest, lowest-cost conversion path between the two factors
    const path = try shortestPath(a, map, s, d) orelse return null;

    // Collect the conversion factors, composing the additive offset: after each step
    // `offset = offset × factor + a`
    const names = try a.alloc([]const u8, path.len);
    const factors = try a.alloc(Rational, if (path.len > 0) path.len - 1 else 0);
    var offset = R.ZERO;
    for (path, 0..) |p, i| {
        names[i] = map.name(p);
        if (i == 0) continue;
        const e = map.edge(path[i - 1], p).?;
        factors[i - 1] = e.factor;
        offset = try R.add(a, try R.multiply(a, offset, e.factor, .{}), e.offset, .{});
    }

    // The offset is only present for affine conversions
    const affine = try R.compare(a, offset, R.ZERO, .{}) != 0;
    return try makeConversion(gpa, names, factors, if (affine) offset else null);
}

/// Cost so far and the previous node on the cheapest path.
const C = struct { cost: i64, prev: ?u32 };

/// A heap entry: node and cost.
const E = struct { node: u32, cost: i64 };

/// Compare edge cost
fn cmp(x: E, y: E) i32 {
    return if (x.cost < y.cost) -1 else if (x.cost > y.cost) 1 else 0;
}

/// Calculates the shortest path between a source and destination factor using Dijkstra's
/// algorithm. The cost of a path is the minimized precision of the conversion factors.
fn shortestPath(a: Allocator, map: *const UnitFactors, src: u32, dst: u32) Allocator.Error!?[]const u32 {
    var heap = try Heap(E, cmp).init(a, &.{.{ .node = src, .cost = 0 }});
    const edges = try a.alloc(?C, map.edges.len);
    @memset(edges, null);
    edges[src] = .{ .cost = 0, .prev = null };

    while (heap.pop()) |item| {
        if (item.node == dst) break;
        for (map.edges[item.node]) |e| {
            const newcost = item.cost + e.cost;
            const path = edges[e.to];
            if (path == null or newcost < path.?.cost) {
                edges[e.to] = .{ .cost = newcost, .prev = item.node };
                try heap.push(a, .{ .node = e.to, .cost = newcost });
            }
        }
    }

    if (edges[dst] == null) return null;
    return try extractpath(a, map, edges, dst);
}

/// Extract the path from the edges, tracking backwards from the destination node to the
/// source. Like the TypeScript, the walk stops at a unit named "" (a falsy string).
fn extractpath(a: Allocator, map: *const UnitFactors, edges: []const ?C, dst: u32) Allocator.Error![]const u32 {
    var r: std.ArrayList(u32) = .empty;
    var c: ?u32 = dst;
    while (c) |i| {
        if (map.name(i).len == 0) break;
        try r.append(a, i);
        c = edges[i].?.prev;
    }
    std.mem.reverse(u32, r.items);
    return r.items;
}

test "direct, inverse and composed factors" {
    const gpa = std.testing.allocator;
    const defs = [_]FactorDef{
        .{ .src = "foo", .factor = .{ .string = "2" }, .dst = "bar" },
        .{ .src = "bar", .factor = .{ .string = "3" }, .dst = "baz" },
    };
    var map = try unitFactors(gpa, &defs);
    defer map.deinit(gpa);

    const c = (try unitFactorsGet(gpa, &map, "baz", "foo")).?;
    defer c.deinit(gpa);
    try std.testing.expectEqual(@as(usize, 3), c.path.len);
    try std.testing.expectEqualStrings("baz", c.path[0]);
    try std.testing.expectEqualStrings("foo", c.path[2]);
    try std.testing.expect(c.offset == null);
    try std.testing.expect((try unitFactorsGet(gpa, &map, "foo", "nope")) == null);
}
