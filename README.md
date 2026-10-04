# opencode-openspec-tasks

OpenCode TUI sidebar section showing the OpenSpec change your session is
working on — artifact status and live `tasks.md` progress — in the same style
as the built-in Todo list.

```
▼ OpenSpec add-openspec-sidebar
[✓] proposal
[✓] specs
[✓] design
[•] tasks 12/14
    ▶ 1. Pure domain 5/5
    ▼ 3. TUI 2/3
    [✓] 3.1 …
    [•] 3.3 …
```

## Requirements

- opencode ≥ 1.18 (TUI plugins, `sidebar_content` slot)
- `openspec` on `PATH`, running on Node ≥ 20

## Local install

```sh
bun install
```

Add the entry file to `~/.config/opencode/tui.json` (create it if absent; keep
any plugins already listed):

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": ["/absolute/path/to/opencode-openspec-tasks/src/tui.tsx"]
}
```

Restart opencode. There is no build step — opencode loads the `.tsx` source
directly and shares its own Solid and OpenTUI instances with the plugin.

To try it without touching your global config, point opencode at a separate
TUI config for one run:

```sh
OPENCODE_TUI_CONFIG=/path/to/test-tui.json opencode
```

## Which change is shown

The first that applies, restricted to changes `openspec list` reports:

1. the latest change the session referenced — an `/opsx-*` command argument,
   a tool touching `openspec/changes/<name>/`, `--change <name>`, or
   `openspec archive|show|validate <name>`;
2. the git branch, when its last segment names a change;
3. the only active change;
4. the most recently modified change.

With no OpenSpec project or no active changes, the section is not shown.

## Troubleshooting

Plugin errors go to the TUI console, not the log file: `ctrl+p` →
**Toggle console**.
