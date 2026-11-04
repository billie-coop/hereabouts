# Codex worker: taking over a hereabouts Zig port task

You're taking over a partly finished task from a Claude agent. The supervisor is the Claude
Code session in terminal `t4t m3-hereabouts (M3)`; it verifies and commits your work.

## Overrides to your herdr template

- **Do not start fresh.** Stay in this clone (`/Users/steve/Dev/github.com/billie-coop/hereabouts`)
  on branch `zig-port`. Do not `git pull`, switch or create branches, commit, stash, reset,
  restore or add. The supervisor commits. `git status`/`git diff`/`git log` are fine.
- Dependencies are installed and the resource packs are built (`packages/hereabouts/packs/`).
  Don't reinstall.
- Running builds and tests in visible panes in your own tab, as your template says, is fine.
  Give them clear names (e.g. `core-zig-test`) and remove them when done.

## Read, in order

1. `porting-brief.md` and `core-brief.md` in this directory (`notes/zig-port/`): context,
   conventions, file layout, rules. Wherever they say "agent", that includes you, and their rules apply in full (other
   workers edit other files in the same checkout at the same time).
2. Your handoff note (named in your task, in this directory): where the previous agent stopped.
3. The code the previous agent wrote, before changing it.

## Reporting

- When done, write the final report described in `porting-brief.md` to the report file named in
  your task (in `notes/zig-port/`; your handoff note and report are the only files in `notes/`
  you may write), then `hc send t4t "done: <report path>"`.
- If stuck or you need a decision (a shared-file change, an unclear TypeScript behavior), send
  `hc send t4t "<question>"` and keep working on what you can meanwhile.
- Keep your summary label current: `hc label $HC_TERMINAL_ID "summary=<text>"`.
