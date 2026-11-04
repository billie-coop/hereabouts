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

## Step 2: caches and ownership

Implemented bounded framework LRUs (`pack_cache_size = 2`, `locale_cache_size = 64`; zero
retains no entries). Framework.loadLocale now returns an owning LocaleHandle with data(),
clone() and deinit(); CLDRFramework.get returns owning CLDR with clone/deinit. bindCLDR returns
borrowed CLDRView. Plain reference counts pin the locale and its pack through eviction and
framework destruction. Each node owns its allocator; caller-held handles account for memory
outside the resident cache limits. No locks or atomics.

Derived caches now use finite typed keys and one independently reclaimed arena per successful
build. Failed builds release their arena immediately. The default formatter retains the
reclaiming allocation/destruction fix from step 1. Packs decode the finite region exception
maps at load time, making subsequent pack lookup immutable and safe to share with a suitable
caller allocator. Existing callers now explicitly release all returned handles.

Formatter and translator parse caches are bounded (default 100), with nullable cache_size
(null = default; zero = disabled) and max_cached_message_bytes (default 64 KiB; larger messages
format without retention). Translator plural rules use a bounded LRU (default 64, separately
configurable) rather than removing it, preserving useful cache diagnostics/conformance stats.
Unknown-key fallback patterns are bounded too. Both formatter and translator evaluate owned
Code snapshots, permitting same-thread reentrant callbacks even with capacity 1.

TimeData adds deinit(gpa); timePeriodToQuantity now returns owned quantities/Decimals with
unit_options.freeQuantities; the arena implementation remains an explicit internal helper.
README documents the new lifetimes/cache/thread contract and releases its example's CLDR.

Added tests for capacities 0/1/2, handle clone/release and surviving framework destruction,
LRU hit recency, cache count bounds and live-byte plateaus, failed derived builds, oversized
pattern bypass, disabled formatter caching, unknown-key translator churn, reentrant translator
eviction, quantity cleanup and allocation-failure sweeps through handle construction.

Validation: full Debug and ReleaseSafe each passed 46/46 steps and 118/118 tests; Zig formatting
and git diff --check pass. No TS source, generators or conformance JSON changes.

## Step 3: explicit timezone databases

Removed timezone.setTimeZoneData and activeDatabase; there is no mutable global selection.
Database now exposes immutable lookup methods, while timezone namespace convenience calls
always use the bundled database. datetime.ZoneContext carries an explicit database and exposes
the TypeScript-named zone/instant operations; existing datetime conveniences use bundled data.

FrameworkOptions.timezone_database flows into LocaleData and all locale-created dates and
bound timezone methods. Low-level calendar constructors take a Database pointer. CalendarDate
stores it, and set/add/subtract/withZone/string conversion/difference reuse it. Calendar-type
conversion preserves a CalendarDate's database; epoch input uses the locale's database.
Mixed-database differences keep each operand's instant and use the receiver's database for wall
arithmetic. Database storage must outlive contexts, dates, locale handles and borrowed metadata.

All replacement-database conformance cases now select a database directly. New tests hold two
custom databases simultaneously, check instant parse/format, calendar construction/transform,
locale construction and lookup after framework destruction, mixed differences, and conversion
preservation. Also fixed unknown-zone metadata fallback when a custom DB lacks `Factory`.

Validation: final Debug and ReleaseSafe each pass 46/46 steps and 119/119 tests. Formatting and
git diff --check pass. Logs /tmp/hereabouts-step3-debug.log and /tmp/hereabouts-step3-release.log.
No TS source, generators or conformance JSON changes.
