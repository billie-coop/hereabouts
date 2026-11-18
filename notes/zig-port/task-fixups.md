# Task: Zig port fixups (API consistency, bounded caches, thread safety, review findings)

The Zig port in `zig/` is complete and every conformance case passes. This task makes it
releasable. Read `codex-handoff.md` (overrides to your template), `porting-brief.md`,
`core-brief.md` and `README.md` in this directory, then the module reports (`report-*.md`,
`handoff-*.md`) for the areas you touch.

A Codex reviewer, `t7j m3-hereabouts-review (M3)`, is reviewing the port right now and will write
`notes/zig-port/review-codex.md`. Don't edit Zig code while it reviews: its line references would
go stale.

## Phase 1: plan (no code changes)

Write `notes/zig-port/plan-fixups.md` with:

1. **API naming.** A table of every public function and type across `hereabouts.*` whose name or
   convention is inconsistent, with the proposed name. Principles:
   - A name doesn't repeat what its namespace says (`decimal.add`, not `decimal.decimalAdd`).
     Where a module holds several types, prefer methods on the type when that reads naturally in
     Zig (`day.add(...)` or `datetime.Day.add`), and say which you chose and why.
   - One allocator convention: allocating functions take the allocator first; owned results
     have `deinit`/free helpers named the same way everywhere.
   - Option structs use one field-naming style across modules (pick snake_case or the
     TypeScript camelCase and apply it everywhere).
   - Error sets: one style for naming and composing them.
   Keep the TypeScript name findable: each renamed function's doc comment names its TypeScript
   original.
2. **Bounded caches.** Today the framework keeps every loaded pack and locale until `deinit`
   (the TypeScript has LRU caches, `packCacheSize`/`localeCacheSize`). Propose a design that
   bounds memory in long-running programs without making pointers callers hold dangle (for
   example reference-counted locale handles, or an explicit `release`, or an LRU plus documented
   lifetimes). Same question for the per-locale derived caches and the messageformat caches.
3. **Thread safety.** `timezone.setTimeZoneData` swaps a global; the framework and locale caches
   aren't safe to share across threads. Propose what is safe to share, what needs a mutex, and
   what should take an explicit parameter instead of a global (for example passing a
   `*const Database`).
4. Anything else from the module reports that blocks a release.

Then `hc send t4t "plan ready: notes/zig-port/plan-fixups.md"` and wait for approval. The
supervisor (`t4t m3-hereabouts (M3)`) may change the plan.

## Phase 2: implement

After approval, and once `review-codex.md` exists: implement the approved plan and the review's
findings (fix what's real; for each finding you disagree with, write why in your report).
Renames touch the suites in `zig/test/` and the README example too; keep every suite passing
(`zig build test`, and `zig build test -Doptimize=ReleaseSafe`). Don't change TypeScript source
or conformance JSON; if a fix needs a new case, add it to the generator and regenerate only that
file.

When done, ask the reviewer to recheck: `hc send t7j "<what changed, where>"`. Its template
allows two rounds. Then write `notes/zig-port/report-fixups.md` (changes, decisions, review
findings and their outcome, anything not done) and `hc send t4t "done: <path>"`.

The supervisor commits; you don't.
