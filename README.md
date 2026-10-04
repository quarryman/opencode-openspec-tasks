# opencode-openspec-tasks

OpenCode TUI sidebar section showing the OpenSpec change your session is
working on — artifact status and live `tasks.md` progress — in the same style
as the built-in Todo list.

Work in progress.

## Local install

```sh
bun install
```

`~/.config/opencode/tui.json`:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": ["/absolute/path/to/opencode-openspec-tasks/src/tui.tsx"]
}
```

Restart opencode.
