# Zig release fixups

Work in progress by t7t m3-hereabouts-fixups (M3), under plan-fixups-approval.md.
The supervisor commits each completed step; this worker does not use state-changing Git.

## Step 1: review findings

All seven findings are accepted and fixed, with Zig-only regressions in
`zig/test/release_regressions.zig`, imported by the messageformat suite.

1. Reentrant formatter callbacks: formatting clones cached MessageCode before evaluation.
   Eviction during a nested callback cannot free the outer traversal's storage.
2. Locale default formatter retention: allocate formatter and its LRU with the reclaiming
   locale allocator, store separately from the derived arena, and explicitly deinit it.
   A DebugAllocator churn test verifies live bytes plateau after thousands of messages.
3. Allocation-failure cleanup: free initialized children separately, then the complete
   allocation; destroy the issue ArrayList with its capacity-aware deinit. Allocation-failure
   sweeps cover Code clone, argument names, and catalog checks, including partial clones.
4. Grouped integer formatting: use try decimal.fromInt instead of catching OOM as unreachable.
5. Timezone decoder offsets: checked multiplication for both local and standard offsets;
   invalid overflowing records return InvalidTimeZoneData.
6. Decimal exponent/scale domain: finite stored exponents are bounded by
   +/-decimal.MAX_EXPONENT (999,999,999), documented on Decimal. Exponent-changing APIs,
   MathContext scales/precision and scientific minimum digits return ExponentOutOfRange;
   exponent addition uses i128 before validation. Parse retains ExponentTooLarge for text
   outside its domain. Rational arithmetic and user-controlled core number/unit/relative-time
   formatting propagate decimal.Error; operations unable to exceed the domain keep allocator
   errors. toInteger handles only the impossible range error with a documented unreachable.
   Tests cover both i64 limits, boundary moves, multiply, shift and MathContext/scientific inputs.
7. Date parser literal ownership: reserve node capacity before moving the literal buffer;
   allocation-failure sweeps cover both literal flush and trailing literal paths.

No TypeScript source or conformance JSON changes. Public names and cache/handle ownership are
unchanged at this checkpoint, apart from the added decimal error/domain. Additional formatter
and translator bounds, framework handles, explicit timezone data and naming remain for steps
2 through 4.

Validation: final full Debug and ReleaseSafe builds each passed 46/46 steps and 110/110 tests,
including both literal-failure paths. git diff --check is clean. Logs:
/tmp/hereabouts-step1-debug.log and /tmp/hereabouts-step1-release.log.
All builds run in visible hc panes.
