## 1. Pure domain

- [ ] 1.1 `src/domain/tasks.ts`: parse `tasks.md` into sections and tasks with completed/total, ignoring fenced code
- [ ] 1.2 `src/domain/evidence.ts`: extract change names from tool inputs and commands, latest wins, archive excluded
- [ ] 1.3 `src/domain/resolve.ts`: resolution order evidence → branch → single → latest modified
- [ ] 1.4 `src/domain/view.ts`: build the row model (artifact marks, tasks row, first unchecked task in progress)
- [ ] 1.5 Unit tests for 1.1–1.4

## 2. Effect services

- [ ] 2.1 `src/openspec/schema.ts`: Schema for `list --json` and `status --json` with realistic decode tests
- [ ] 2.2 `src/openspec/cli.ts`: `OpenSpecCli` service over `ChildProcessSpawner`, typed errors
- [ ] 2.3 `src/opencode/events.ts`: `OpencodeEvents` service wrapping `api.event.on` with `Stream.callback`
- [ ] 2.4 `src/progress.ts`: per-session pipeline (resolution, status refresh, tasks refresh, debounce, switch on change)
- [ ] 2.5 Effect tests for the pipeline with stub CLI, stub events and a temp directory

## 3. TUI

- [ ] 3.1 `src/view.tsx`: Solid section mirroring the Todo section
- [ ] 3.2 `src/tui.tsx`: plugin entry, runtime lifecycle, session evidence memo, slot registration
- [ ] 3.3 Typecheck passes; README documents install via `tui.json`

## 4. Verification

- [ ] 4.1 Load the plugin in a real opencode session against a repo with an active change and confirm the section renders and updates on a checkbox edit
