# hereabouts for Zig

A port of [hereabouts](../README.md) to Zig, with no dependencies beyond the standard library.
Work in progress: so far it has the exact decimal math (`decimal`, `rational`). Needs Zig 0.16.

The TypeScript in `packages/hereabouts` is the reference. Both test suites run the shared cases
in [`conformance/`](../conformance), so the two give the same answers.

## Example

```zig
const std = @import("std");
const hereabouts = @import("hereabouts");
const decimal = hereabouts.decimal;

pub fn main() !void {
    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();
    const a = arena.allocator();

    const price = try decimal.parse(a, "19.99");
    const qty = try decimal.parse(a, "3");
    const total = try decimal.multiply(a, price, qty, .{});
    const rounded = try decimal.setScale(a, total, 1, .half_even);
    std.debug.print("{s}\n", .{try decimal.toString(a, rounded)}); // 60.0
}
```

## Memory

Functions that return a `Decimal`, string or parts take an allocator, and the caller owns the
result: `d.deinit(gpa)`, `gpa.free(s)`, `decimal.freeParts(gpa, parts)`. An arena is the easy
way to skip that. Temporary memory inside an operation is freed before it returns. The
constants (`decimal.ONE`, `decimal.PI`, ...) are static: don't free them.

## Differences from the TypeScript

- Functions take a `Decimal`, not a number or string. Use `decimal.parse` or `decimal.fromInt`.
- Names drop the prefix: `decimalAdd` is `decimal.add`, `rationalToString` is
  `rational.toString`. Rounding modes are enum values: `'half-even'` is `.half_even`.
- Parse errors are Zig errors (`error.ExponentTooLarge`, ...) rather than thrown messages.
- Optional arguments are explicit: `decimal.multiply(gpa, u, v, .{})` uses the default context,
  `decimal.compare(gpa, u, v, false)` compares signed values.

## Tests

```sh
cd zig
zig build test
```

This runs the unit tests and every case in `conformance/decimal.json`.
