# Proposal

## Why

When an agent works through an OpenSpec change in opencode, the only live
progress view is opencode's own Todo section, which reflects the agent's
`todowrite` list — not the change's artifacts or its `tasks.md`. Seeing which
artifacts exist and which task is next requires opening files or running
`openspec status`. Existing plugins either show project-wide progress with a
~2.3s CLI round-trip per checkbox (`opencode-openspec-task-tui`) or are a full
workbench (`@vladislavlad/opencode-openspec-plugin`); neither follows the
change the *current session* is working on.

## What Changes

- New opencode TUI plugin rendering a sidebar section directly below Todo
  (`order: 410`), visually identical to the Todo section.
- The section lists every artifact the change's schema defines (from
  `openspec status --json`) with `[✓]` done / `[ ]` ready / muted `[ ]`
  blocked; the `tasks` row shows `n/m`, is `[•]` (warning) while tasks remain,
  and expands into the task list with the first unchecked task marked `[•]`.
- The change shown is the one this session works on: session evidence
  (`/opsx-*` commands, tool calls touching `openspec/changes/<name>/`), then the
  git branch name, then a sole active change, then the most recently modified.
- `tasks.md` updates are applied from opencode bus events (`file.edited`,
  `file.watcher.updated`) with an `fs` watch as fallback; no CLI on the
  per-checkbox path and no polling.
- Core written in Effect 4 (services, `Stream`, `Schema`), one
  `ManagedRuntime` per plugin instance disposed with the TUI lifecycle.

## Capabilities

### New Capabilities
- `sidebar-change-progress`: rendering of the change's artifact status and task progress in the opencode sidebar.
- `change-resolution`: choosing which OpenSpec change a session is working on.
- `progress-refresh`: keeping the displayed state current from opencode events and filesystem changes.

### Modified Capabilities
- none

## Impact

- New code under `src/`; entry point `src/tui.tsx` (loaded directly by opencode).
- Runtime dependencies: `effect@4.0.0`, `@effect/platform-node@4.0.0`.
- Requires the `openspec` CLI on `PATH` for artifact status and change listing.
- Users enable it in `~/.config/opencode/tui.json`.
