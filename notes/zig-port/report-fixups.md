# Zig release fixups

Completed by t7t m3-hereabouts-fixups (M3), under plan-fixups-approval.md.
The final reviewer recheck passes with no remaining concrete correctness findings.
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

## Step 4: mechanical names and direct locale methods

Applied the approval's TypeScript mapping, retaining existing type names and semantic function
names. Day/TimeOfDay/CalendarDate, MessageFormatter/Translator/MessageMatcher, UnitConverter/
UnitFactors, Matcher and NumberOperands expose their operations as methods. Methods put their
receiver before the allocator. Allocating namespace functions keep the allocator first.
Instant remains i64 with an instant namespace; free getPluralRules/resolveLanguageTag/
parseMessagePattern/evaluateMessage/messageArgNames and other non-receiver names retain TS
spelling. Decimal casing exceptions are alignExp/shiftLeft/shiftRight/divMod. There are no
rulesFor/hasKey/convert synonyms.

Owning CLDR and LocaleHandle and borrowed CLDRView each forward all 86 bound-group functions
directly, retaining exact TS names and the existing bound groups. CLDR groups and data/option
fields now use snake_case. Schema identifiers and private serialized wire records retain the
schema's names; conformance adapters explicitly map Zig data fields back to TS JSON keys.
The default formatter type remains MessageFormatter, the custom callback type remains Formatter,
and the other message/unit/plural types retain their names.

Supervisor decisions: CalendarDate's raw backing array is field_values so date.fields() maps
exactly from dateFields. Per-calendar constructor functions keep TS names; removed aliases
that implied GregorianDate etc. were distinct Zig types. LanguageTag keeps its raw fields and
uses exact tagLanguage/tagScript/tagRegion/tagVariant methods where dropping tag would collide;
getLanguage/getScript/getRegion/getVariant are removed. The README explains this collision rule.
The mechanical dayOfWeek/dayOfYear suffixes are Day.ofWeek/ofYear; no invented weekday/ordinal
names. Advanced date helpers are grouped under core.internals.calendars, retaining TS internal
names; date parsing joins number/wrapper parsing under core.parsing.date.

Every moved declaration's doc comment names the TypeScript original; Zig-only writer/copy
helpers explicitly identify their corresponding TS operation or data model. Zig-only enum
string helpers now consistently use toString. timezone.Error replaces the decoder-only error
set name. TimeData/quantity ownership helpers remain as recorded in step 2.

Added a direct-locale/method-mapping ownership smoke test and references to every concrete
forwarder so unused public wrappers are also compiled. Updated module examples and README,
including the requested Coming from TypeScript section. The actual README code compiles/runs
and prints the expected German number/currency formatting and exact 0.1+0.2 sum.

Initial final Debug and ReleaseSafe runs pass 46/46 steps, 120/120 tests. A targeted added TS
reference case for the mutation coverage gap below also passes. Scoped Biome, yarn ts-check,
and all 15 Vitest conformance/generated-data freshness checks pass. Current shared corpus:
107,206 cases in 14 files, including 12,606 datetime cases. Type-invalid number-style cases
remain skipped as before; this does not claim all JSON entries represent valid Zig enums.

## Deliberate-break verification

The twelve outstanding datetime checks were rerun one at a time on an isolated /tmp copy:
range drift, negative range days, year end, negative-zero year, wall candidate deduplication,
earlier skipped-time resolution, midnight-search termination bound, parsed offset sign,
formatted offset seconds, Kelvin normalization, instant boundary and time seconds form.
Eleven were caught by the existing corpus. The midnight termination bound initially survived.
Added one TS-generated reference case using a custom 75-minute forward jump crossing midnight
with unequal offsets, forcing convergence beyond the first midpoint. It catches that mutation;
restored baseline passes. Only the datetime generator and its JSON were regenerated. Logs:
/tmp/hereabouts-datetime-mutations.log and /tmp/hereabouts-midnight-mutation.log.

The supervisor confirmed the older foundation gap had remained open; the new serial isolated
copy audit closes it. All thirteen mutations below were caught by the existing cases. Both
restored core-number/core-unit baselines pass. The initial runner stopped before the ninth
mutation because a selector matched two branches; a more specific selector was used for the
remaining five. This was a preflight selection error, not a compiling mutation or source edit.

| Mutated branch | Cases rejecting it |
| --- | ---: |
| Pack script layer | 208 |
| Region exception override | 826 |
| Schema scalar offset | 3,144 |
| Floor rounding mode | 64 |
| Half-even tie rounding | 21 |
| Grouping enablement | 1,902 |
| Minimum grouping digits | 12 |
| Compact divisor | 617 |
| Compact plural selection | 10 |
| Currency spacing after symbol | 271 |
| Currency accounting pattern | 53 |
| Numbering-system digits | 4,621 |
| Unit plural patterns | 199 |

Logs: /tmp/hereabouts-foundation-mutations.log and
/tmp/hereabouts-foundation-mutations-final.log. No new foundation reference cases were needed.
The working-notes README's Not done section now contains only custom-schema scope and
unpublished-package status, rather than the closed mutation debt.

Follow-up review completed by t7j m3-hereabouts-review (M3); see the Recheck section of
review-codex.md. Implementation source stayed stable throughout the review.

## Final verification checkpoint

With the added datetime case, full Debug and ReleaseSafe each pass 46/46 steps and 120/120
tests; zig fmt --check src test and git diff --check pass. Logs:
/tmp/hereabouts-final-debug.log and /tmp/hereabouts-final-release.log. Scoped Biome,
yarn ts-check and 15/15 Vitest conformance/generated-data freshness checks pass. The README
example compiles and runs with the final API. All started verification panes are cleaned up
after their results are collected. Final reviewer recheck passes.

## Final review and scope

The reviewer independently reran Debug and ReleaseSafe (120/120 tests each), mapped all seven
original findings to passing regressions, and added external allocation-failure sweeps covering
CLDR construction/clone, pack and locale eviction, use after framework destruction, derived
cache insertion, default formatter setup/evaluation, and cache miss/hit/eviction/oversized bypass
at capacities 0/1/2. The supplementary tests pass 2/2 in both modes. No remaining concrete
correctness findings. This used the first follow-up round; no implementation edits were needed.

Nothing remains undone within the approved fixups. Deliberate deviations are documented:
single-threaded mutable owners with plain reference counts, user-retained handles pin memory
outside resident cache limits, custom database borrows require the database to outlive their
users, zero cache capacity disables retention, and out-of-domain decimal operations return
ExponentOutOfRange. Only shipped schema configuration is supported. Package publication remains
outside the task. No TypeScript library source was changed; the sole conformance addition is
the targeted datetime custom-gap case. No state-changing Git commands were used by this worker.
The supervisor owns the final commit.
