# Approval of plan-fixups.md, with amendments

Approved by the supervisor (`t4t m3-hereabouts (M3)`) after asking Stephen. Where this file and
`plan-fixups.md` disagree, this file wins. The review (`review-codex.md`) is complete, so
implementation can start.

## 1. Naming: a mechanical mapping from the TypeScript

The goal: idiomatic Zig that someone who knows the TypeScript can predict without looking anything
up. The rules, applied with no exceptions:

1. **Methods for the type the function operates on.** If a TypeScript function's first argument
   is a value of type T and its name starts with T's word, drop that word and make it a method
   of T: `dayAdd(day, …)` → `day.add(…)`, `dateYear(date)` → `date.year()`,
   `timeOfDayToString(t)` → `t.toString(gpa)`, `rationalAdd(u, v)` →
   `rational.add(u, v)` (decimal and rational stay namespace functions, as planned).
   Constructors follow the same rule: `day(y, m, d)` → `Day.init(y, m, d)`,
   `createMessageFormatter(opts)` → `MessageFormatter.init(gpa, opts)`.
2. **Locale functions become methods on the locale.** Every TypeScript locale function whose
   first argument is `LocaleData` (`formatDecimal(locale, …)`, `formatDate(locale, …)`,
   `formatList(locale, …)`, …) is a method on the Zig locale handle with the **exact TypeScript
   name**: `de.formatDecimal(gpa, n, .{…})`. Keep the bound groups too (`de.numbers.formatDecimal`),
   matching the TypeScript convenience object.
3. **Otherwise keep the exact TypeScript name.** Drop a prefix only when rule 1 applies; never
   invent a synonym. From the plan's table, keep these as in the TypeScript:
   `getPluralRules` (not `rulesFor`), `resolveLanguageTag`/`resolveLocaleId` (not
   `resolveTag`/`resolveId`), `localeFlag`, `isMessageKey` (not `hasKey`), `convertUnits` (not
   `convert`), `getDistance`, `parseMessagePattern`, `evaluateMessage`, `messageArgNames`,
   `timeZoneId`/`timeZoneOffset`, `systemTimeZone`, type names (`PluralRules`, `UnitConverter`,
   `UnitFactors`, `MessageFormatter`, `MessageArg`, …: don't shorten type names). Apply the same
   test to every other row of the table: if the new name isn't "TypeScript name minus the
   receiver's type word", keep the TypeScript name. Zig-only additions (e.g. `formatBuffer`
   writer variants) are fine but must be named after the TypeScript function they mirror.
4. **Casing:** camelCase functions keep TypeScript's spelling except where TypeScript itself is
   inconsistent with camelCase (`alignexp`, `shiftleft`, `shiftright`, `divmod` → `alignExp`,
   `shiftLeft`, `shiftRight`, `divMod` are fine). Option and struct fields use snake_case
   mechanically from the TypeScript camelCase (`maximumFractionDigits` →
   `maximum_fraction_digits`), everywhere including the calendar and skeleton structs in your
   table. Generated schema names stay as they are.
5. Every renamed or moved declaration's doc comment names its TypeScript original. Add a
   "Coming from TypeScript" section to `zig/README.md` stating these rules with a few
   side-by-side examples.

Internal namespaces exposed under `core` (`date_skeletons`, `date_patterns`, `date_manager`,
`arrows`, `parsing`, …): apply the same rules, but it's fine to make them less prominent
(e.g. group under `core.internals`) rather than polish every internal name.

## 2. Threads: single-threaded objects, no internal locks

Stephen chose this over the plan's locking design. Replace the plan's thread-safety section:

- Immutable data is safe to share across threads: generated tables, plural rules, schema, the
  default time zone database, custom decoded `Database`s, loaded packs and locale data once
  built, `Decimal`/`Rational`/`Day`/`TimeOfDay`/`CalendarDate` values.
- Mutable objects are single-threaded: framework, locale handles' lazily built caches, message
  formatters, translators. Use one per thread, or the caller adds a lock, like Zig's std
  containers. Document this contract in the README and the types' doc comments.
- Therefore: no mutexes, plain (non-atomic) reference counts, no publish/recheck protocol.
- Keep the plan's removal of the global `setTimeZoneData` and the explicit `*const Database`
  propagation (CalendarDate remembers its database): that is about correctness, not threads.
- Same-thread reentrancy (review finding 1) must still be safe: callbacks may format other
  messages with the same formatter. Clone-on-use of cached code, as planned, covers it.

## 3. Everything else in the plan is approved

Including: review findings first (each with a regression test), bounded framework/locale caches
with reference-counted locale handles (TypeScript defaults 2 and 64), the reclaimable default
formatter cache, the bounded translator cache, `max_cached_message_bytes`, the error-set and
ownership conventions, rerunning the twelve datetime deliberate-break checks, and the recheck
by `t7j m3-hereabouts-review (M3)`.

Order: (1) review findings, (2) caches and ownership, (3) explicit time zone database,
(4) renames, docs and examples. Commit points: after each step, `hc send t4t` with a one-line
summary and the test status, so the supervisor can commit a working state before the next step.
Codex usage is near its weekly limit; if you're about to run out, stop at a clean point and
write `notes/zig-port/handoff-fixups.md` (done, in progress, next).
