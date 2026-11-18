# Zig port review

Reviewed `main..zig-port` through `d0fc7b7` on 2026-11-04. Read-only review of the
implementation, public ownership contracts, release behavior, shared state, tests, and data
generators. No implementation or generated files were changed. Temporary reproduction files
under `/tmp` were explicitly authorized by the supervisor.

Seven findings follow, ranked by severity. All are reproduced, with high confidence.

## 1. P1 — Reentrant custom formatters can free the message being evaluated

**Location:** `zig/src/messageformat/formatter.zig:112–113`; eviction frees code in
`zig/src/messageformat/lru.zig:87`. The outer evaluation walks borrowed block/choice storage
in `zig/src/messageformat/evaluation.zig:240`.

`formatMessage` borrows its code from the LRU and invokes user converters/formatters while
that borrow is live. A callback can legitimately format another message with the same
formatter. If this evicts the outer message, the outer evaluator resumes walking freed
memory. This does not require threads. With `cache_size = 1`, formatting
`"{x, nested} tail"` with a `nested` callback that formats `"inner"` reliably panics with
**“switch on corrupt value”** in both Debug and ReleaseSafe. ReleaseFast removes this tag
check, leaving a use-after-free. The default capacity is also vulnerable when enough nested
messages fill it.

**Fix direction:** pin entries throughout evaluation, reference-count code, or evaluate an
owned copy whose lifetime covers callbacks. A thread-safety warning does not address
same-thread reentrancy. Add a custom formatter/converter reentrancy test.

**Repro below:** `--test-filter 'reentrant formatter'`.

## 2. P2 — The locale's default message formatter retains every cache miss

**Location:** `zig/src/core/api/general.zig:38–39`, using the cache arena supplied by
`zig/src/core/locale_data.zig:82–85`.

The default formatter's LRU, parsed code, and parse temporaries all use the locale's
lifetime arena. Eviction calls `free`, but this cannot reclaim the older arena allocations.
The 100-entry capacity therefore fails to bound retained memory. With one synthetic locale,
formatting 2,000 distinct 1,024-byte text messages and freeing every returned string left
**9,318,912 live allocated bytes after 1,000 messages and 21,415,310 after 2,000**, while
`cache.size()` stayed at 100. All memory is eventually freed at locale deinit; the problem is
unbounded retention in a normally long-lived locale/framework.

The general report already discloses this tradeoff, but the reproduction demonstrates its
practical cost. Ordinary output and end-of-lifetime leak tests cannot detect it.

**Fix direction:** use reclaimable storage for the formatter's cache, register its destructor
with the locale, and reclaim each entry's code on eviction. Keep temporary parsing arenas
independent of the locale lifetime arena. Test retained bytes after more than one cache's
worth of distinct messages.

**Repro below:** `--test-filter 'default formatter bounded memory'` (Debug, measuring live
requested bytes with `DebugAllocator`).

## 3. P2 — Allocation-failure cleanup frees partial slices as whole allocations

**Locations:**

- `zig/src/messageformat/types.zig:140`: `freeArgs(gpa, out[0..n])`.
- `zig/src/messageformat/translator.zig:293`: `freeStrings(gpa, out[0..n])`.
- `zig/src/messageformat/translator.zig:462`: `freeCatalogIssues(gpa, c.issues.items)`.

The first two helpers free both initialized elements and their outer slice. The cleanup
passes an initialized prefix rather than the full allocation. If no elements were
initialized, `free` sees an empty slice and leaks the outer allocation; after partial
initialization, its size is wrong and the allocator contract is violated. The third case
passes an ArrayList's used slice rather than its full capacity allocation, with the same
problem.

`checkAllAllocationFailures` reproduces leaks in `cloneMessageCode`, `messageArgNames`, and
`checkCatalogs` in both Debug and ReleaseSafe. The clone fails at allocation index 2/4,
leaking its 48-byte Argument array. Failing allocation index 3, after one argument was
cloned, instead aborts inside `freeArgs` with **“Invalid free”**.

**Fix direction:** free initialized children separately, then free the original full slice;
for the list, free initialized issue fields and call `c.issues.deinit(gpa)`. Do not hand a
prefix/capacity-mismatched slice to a helper that also frees its backing allocation.

**Repros below:** filters `clone allocation failures`, `names allocation failures`,
`catalog allocation failures`, and `partial clone cleanup`.

## 4. P2 — Integer formatting turns OutOfMemory into unreachable

**Location:** `zig/src/core/systems/numbering/decimal.zig:68`.

The grouped branch of public `core.numbering.formatInt` calls allocating `D.parse` with
`catch unreachable`. The formatted integer is syntactically valid, but parsing can still
return `OutOfMemory`. A failing allocator on `formatInt(..., 42, true, 1)` aborts in
ReleaseSafe with **“attempt to unwrap error: OutOfMemory”**, despite the public return type
promising `Allocator.Error![]u8`. In ReleaseFast this reachable `unreachable` is undefined
behavior.

**Fix direction:** propagate `OutOfMemory`, handling only the impossible parse syntax
errors as unreachable, or use `D.fromInt` with `try`.

**Repro below:** `--test-filter 'integer allocation failures'`.

## 5. P2 — The timezone decoder can overflow instead of rejecting invalid data

**Locations:** `zig/src/timezone/database.zig:211` and `:249`.

Both local offsets and standard offsets parse into `i64` and then multiply by 1,000 with
unchecked arithmetic. The base-36 string `1y2p0ij32e8e7` is a valid representation of
`maxInt(i64)`, so parsing succeeds and the multiplication overflows. Supplying either
`"0_0_0__A:0:1y2p0ij32e8e7__"` or `"1y2p0ij32e8e7_0_0__A:0:0__"` as a zone record
aborts in ReleaseSafe. ReleaseFast permits undefined behavior. This contradicts
`Database.decode`'s explicit contract that malformed data returns `InvalidTimeZoneData`.
The transition decoder already uses checked `std.math.mul`/`add` at lines 243–244.

**Fix direction:** apply checked multiplication to both offset conversions and return
`InvalidTimeZoneData` on overflow; add boundary records to decoder tests.

**Repros below:** filters `timezone offset overflow` and `timezone standard offset overflow`.

## 6. P2 — Public decimal scale/exponent inputs admit integer overflow

**Locations:** `zig/src/decimal/decimal.zig:1178–1184`, plus `:737–740` and `:334`.

`setScale(ONE, minInt(i64), .half_even)` reaches `-diff` with `diff == minInt(i64)` and
aborts with **“integer overflow”** in ReleaseSafe. There is also an invalid state reachable
using only public constructors/operations: `movePoint(ONE, maxInt(i64))` succeeds, then
`integerDigits` overflows at `precision(d) + d.exp`. Calling `movePoint` again can overflow
the exponent addition itself. The APIs accept `i64` without a documented restricted domain
or a range error, so ordinary valid Decimal inputs can trigger these failures. No huge
coefficient allocation is needed.

**Fix direction:** define and enforce an exponent/scale domain that preserves arithmetic
invariants, and use checked/wider intermediate arithmetic. Include MathContext scales and
other exponent-changing operations in the same audit; merely guarding this one negation
would leave public operations able to construct unsafe Decimals. Return a defined error or
result rather than relying on Debug/ReleaseSafe checks.

**Repros below:** filters `scale minimum overflow` (ReleaseSafe) and `moved exponent overflow`
(Debug).

## 7. P2 — Date pattern parsing loses a literal if appending its node fails

**Locations:** `zig/src/core/parsing/date.zig:41` and `:58`.

`nodes.append(gpa, .{ .text = try buf.toOwnedSlice(gpa) })` transfers the literal out of
`buf` before the fallible node append. If append fails, the literal belongs to neither
`buf` nor `nodes`; neither existing cleanup frees it. Public `parseDatePattern` supports a
general allocator and has `freePattern`, so this is an ownership failure even though the
high-level date formatters happen to pass temporary arenas.

`checkAllAllocationFailures` on `parseDatePattern(gpa, "literal y")` reports
**MemoryLeakDetected**, failing allocation index 5/7 in ReleaseSafe (one literal byte leaked
in this specific path).

**Fix direction:** reserve node capacity before taking ownership of the literal, or hold
the returned slice in a local with an `errdefer` until append succeeds. Apply it to both
literal append sites.

**Repro below:** `--test-filter 'date pattern allocation failures'`.

## Validation and scope notes

- `cd zig && zig build test -Doptimize=ReleaseSafe --summary all`: **46/46 steps,
  96/96 tests passed**, including all conformance suites. The findings above require inputs
  or allocator/callback behavior outside those cases.
- `yarn exec vitest run packages/hereabouts/__tests__/conformance`: **15/15 passed**,
  including generated Zig data freshness and all 14 conformance freshness checks.
- Targeted probes ran in visible herdr terminals with the requested login-shell/direnv
  wrapper. Failures described above are actual test results, not hypothetical paths.
- The exact combined reproduction source below was extracted and compiled successfully
  with `zig test --test-no-exec` after writing this report.
- The timezone active database is the sole module-global mutable variable found. Its setter
  explicitly requires setup before concurrent lookup. Framework and LocaleData caches also
  explicitly say they are not thread-safe; immutable UnitFactors lookups allocate only in
  the caller's allocator. Those documented synchronization requirements are not separate
  findings. Reentrancy in finding 1 remains unsafe even with external thread serialization.
- Read the port reports before evaluating deviations. The recorded TypeScript quirks,
  shipped-schema limitation, and deliberate allocator/name conventions were not treated as
  new bugs. No additional concrete generator defect was established; freshness passing
  alone does not prove all future data transformations correct.

## Reproduction source

Save the following as `/tmp/hereabouts-review.zig`. From the repository root, run each
test separately, since several deliberately trigger a process abort:

```sh
zig test -O ReleaseSafe --dep hereabouts \
  -Mroot=/tmp/hereabouts-review.zig -Mhereabouts=zig/src/hereabouts.zig \
  --test-filter 'reentrant formatter'
```

Use Debug (omit `-O ReleaseSafe`) for `default formatter bounded memory`,
`moved exponent overflow`, and `partial clone cleanup`. An arena is not substituted for
`std.testing.allocator`: that would hide the individual-allocation cleanup bugs.

```zig
const std = @import("std");
const h = @import("hereabouts");
const M = h.messageformat;
const a = std.testing.allocator;

fn cloneFail(gpa: std.mem.Allocator) !void {
    const code: M.MessageCode = .{ .simple = .{ .name = "foo", .args = &.{ .{ .name = "first" }, .{ .name = "second" } }, .options = &.{} } };
    const c = try M.cloneMessageCode(gpa, code);
    defer c.deinit(gpa);
}
test "clone allocation failures" {
    try std.testing.checkAllAllocationFailures(a, cloneFail, .{});
}
fn namesFail(gpa: std.mem.Allocator) !void {
    const names = try M.messageArgNames(gpa, "{first} {second}", .{});
    defer M.freeStrings(gpa, names);
}
test "names allocation failures" {
    try std.testing.checkAllAllocationFailures(a, namesFail, .{});
}
fn catalogFail(gpa: std.mem.Allocator) !void {
    var t = try M.createTranslator(gpa, .{ .source = &.{.{ .key = "x", .message = "{" }}, .catalogs = &.{.{ .id = "de", .messages = &.{} }} });
    defer t.deinit();
    const issues = try M.checkCatalogs(gpa, &t, .{});
    defer M.freeCatalogIssues(gpa, issues);
}
test "catalog allocation failures" {
    try std.testing.checkAllAllocationFailures(a, catalogFail, .{});
}
fn intFail(gpa: std.mem.Allocator) !void {
    const s = try h.core.numbering.formatInt(gpa, h.core.numbering.INTERNAL_NUMBERING, 42, true, 1);
    defer gpa.free(s);
}
test "integer allocation failures" {
    try std.testing.checkAllAllocationFailures(a, intFail, .{});
}
test "timezone offset overflow" {
    const db = try h.timezone.Database.decode(a, .{ .zoneids = "A", .links = "", .index = "", .zoneinfo = &.{"0_0_0__A:0:1y2p0ij32e8e7__"} });
    defer db.deinit(a);
}
test "timezone standard offset overflow" {
    const db = try h.timezone.Database.decode(a, .{ .zoneids = "A", .links = "", .index = "", .zoneinfo = &.{"1y2p0ij32e8e7_0_0__A:0:0__"} });
    defer db.deinit(a);
}
fn nested(ctx: ?*const anyopaque, gpa: std.mem.Allocator, _: []const ?M.MessageArg, _: []const []const u8) M.Error![]const u8 {
    const f: *M.MessageFormatter = @ptrCast(@alignCast(@constCast(ctx.?)));
    return M.formatMessage(gpa, f, "inner", &.{}, &.{});
}
test "reentrant formatter" {
    var f: M.MessageFormatter = undefined;
    const fs = [_]M.Formatter{.{ .name = "nested", .ctx = &f, .func = nested }};
    f = try M.createMessageFormatter(a, .{ .cache_size = 1, .formatters = &fs });
    defer f.deinit();
    const s = try M.formatMessage(a, &f, "{x, nested} tail", &.{}, &.{.{ .name = "x", .value = .{ .string = "x" } }});
    defer a.free(s);
    try std.testing.expectEqualStrings("inner tail", s);
}
test "scale minimum overflow" {
    const n = try h.decimal.setScale(a, h.decimal.ONE, std.math.minInt(i64), .half_even);
    defer n.deinit(a);
}

test "default formatter bounded memory" {
    var dbg: std.heap.DebugAllocator(.{ .enable_memory_limit = true }) = .init;
    defer _ = dbg.deinit();
    const gpa = dbg.allocator();
    const l = try h.core.resolveLocale(gpa, "en");
    const b = try h.core.stringBundle(gpa, l.tag, &.{}, &.{}, null);
    var data = try h.core.LocaleData.initDefault(gpa, l, b);
    defer data.deinit();
    const f = try h.core.general.messageFormatter(&data);
    var at1000: usize = 0;
    var buf: [1024]u8 = @splat('x');
    for (0..2000) |i| {
        _ = std.fmt.bufPrint(buf[0..8], "{d:0>8}", .{i}) catch unreachable;
        const s = try M.formatMessage(gpa, f, &buf, &.{}, &.{});
        gpa.free(s);
        if (i == 999) at1000 = dbg.total_requested_bytes;
    }
    std.debug.print("live bytes after 1000={d}, after 2000={d}, cached={d}\n", .{at1000, dbg.total_requested_bytes, f.cache.size()});
    try std.testing.expect(dbg.total_requested_bytes < at1000 + 32 * 1024);
}
test "moved exponent overflow" {
    const n = try h.decimal.movePoint(a, h.decimal.ONE, std.math.maxInt(i64));
    defer n.deinit(a);
    const p = h.decimal.integerDigits(n);
    try std.testing.expect(p > 0);
}
fn patternFail(gpa: std.mem.Allocator) !void {
    const p = try h.core.date_parsing.parseDatePattern(gpa, "literal y");
    defer h.core.date_parsing.freePattern(gpa, p);
}
test "date pattern allocation failures" {
    try std.testing.checkAllAllocationFailures(a, patternFail, .{});
}

test "partial clone cleanup" {
    var fail = std.testing.FailingAllocator.init(std.testing.allocator, .{ .fail_index = 3 });
    const gpa = fail.allocator();
    const c: M.MessageCode = .{ .simple = .{ .name = "foo", .args = &.{ .{ .name = "first" }, .{ .name = "second" } }, .options = &.{} } };
    _ = M.cloneMessageCode(gpa, c) catch |e| {
        try std.testing.expectEqual(error.OutOfMemory, e);
        return;
    };
    return error.ExpectedOutOfMemory;
}
```

## Recheck

2026-11-04, first follow-up round; reviewed the final working tree against
`plan-fixups-approval.md`. Independently reran the full Debug and ReleaseSafe builds:
**46/46 steps and 120/120 tests passed in each mode**. The messageformat suite imports
`zig/test/release_regressions.zig` and ran all 27 tests, including the 23 named regression tests.

| Original item | Status | Regression in `zig/test/release_regressions.zig` | Debug | ReleaseSafe |
|---|---|---|---|---|
| 1. Reentrant code lifetime | Fixed | `reentrant formatter` (line 47) | Pass | Pass |
| 2. Default formatter retention | Fixed | `default formatter bounded memory` (line 60) | Pass | Pass |
| 3. Partial-slice cleanup | Fixed | `clone allocation failures`, `names allocation failures`, `catalog allocation failures`, `partial clone cleanup` (lines 11, 18, 27, 92) | Pass | Pass |
| 4. Integer formatting OOM | Fixed | `integer allocation failures` (line 34) | Pass | Pass |
| 5. Timezone decode overflow | Fixed | `timezone offset overflow`, `timezone standard offset overflow` (lines 37, 40) | Pass | Pass |
| 6. Decimal extreme inputs | Fixed | `scale minimum overflow`, `moved exponent overflow`, `decimal exponent and context limits` (lines 56, 79, 103) | Pass | Pass |
| 7. Date literal ownership | Fixed | `date pattern allocation failures` (line 88), including flush and trailing literal | Pass | Pass |

The repaired code matches the regression results: evaluations hold owned snapshots; default
formatter storage is reclaimed separately; error cleanup retains full allocation lengths;
integer parsing propagates OOM; timezone offset multiplication is checked; decimal operations
reject the original extremes with ExponentOutOfRange; literals transfer only after capacity
reservation. Full decimal, timezone, datetime, core formatting and ownership suites also passed.

Additional API/cache/timezone verification is recorded below as completed.

Additional verification completed:

- **Owning handles/CLDR:** regression `locale handles survive eviction and framework
  destruction` (line 148) includes allocation-failure sweeps and capacities 0/1/2;
  `locale cache hits refresh LRU order` (219) and framework memory plateau (168) passed in
  both modes. Pack/locale retain-release handoffs and failed cache insertion cleanup were
  inspected. CLDR.clone/deinit preserve exactly one owning handle per explicit clone.
- **Derived/message caches:** failed-build reclamation (163), formatter/translator byte and
  count bounds (185), translator reentrancy (242), and unknown-pattern memory plateau (251)
  passed in both modes. Finite derived keys replace arbitrary retained string keys; each
  failed build frees its arena. Default formatter teardown uses its reclaiming allocator.
- **Independent additional OOM probes:** `std.testing.checkAllAllocationFailures` sweeps of
  CLDR construction/clone, pack and locale eviction, use after framework destruction,
  successful derived-cache insertion, default formatter initialization/evaluation, and
  formatter/translator cache miss/hit/eviction/oversized bypass all passed. These exercised
  capacities **0, 1, 2**, with **2/2 supplementary tests passing in Debug and ReleaseSafe**.
  Scratch probe source was external to the repository; no implementation edits were made.
- **Explicit timezone selection:** regression `independent timezone databases remain
  explicit through date operations` (270) passed in both modes, covering simultaneous custom
  databases, CalendarDate transformations/conversion/difference, and locale use after
  framework destruction. `rg` over all Zig sources found **no setTimeZoneData,
  activeDatabase, or mutable active database selector**. Custom databases are borrowed with
  the documented lifetime through contexts, dates and locales; no implicit ownership was
  introduced by the rename.
- **API mapping:** direct/grouped/borrowed locale calls and concrete forwarder compilation
  are covered by `direct locale methods and TypeScript method mapping` (319), passing in
  both modes. Receiver-first methods, allocator-first namespace functions and approved
  field-collision exceptions match the approval; ExponentOutOfRange propagates through
  affected decimal and formatting APIs. `git diff --check` passed.

**Recheck result: all seven original items fixed; no remaining concrete correctness findings
in the approved API/cache/timezone changes reviewed.** This is the first follow-up round.
