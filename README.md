# Prompt Marks

In a long Claude Code session, your own prompts get buried under pages of output. Prompt Marks puts a colored bar and a tinted background behind every prompt you type, and lets you jump from one prompt to the next with the keyboard.

- Option+Up and Option+Down on macOS, Ctrl+Up and Ctrl+Down on Windows and Linux.
- Nothing extra is drawn on screen. Only your prompt rows change.

Needs Claude Code v2.1.287 or later. Jumping needs [fullscreen rendering](https://code.claude.com/docs/en/fullscreen).

## Install

```
/plugin install prompt-marks --marketplace adamcaviness/prompt-marks
```

It's also in [agentic-marketplace](https://github.com/adamcaviness/agentic-marketplace), and agentic-toolkit installs it for you.

## Configure

Open `/config` and look for the rows starting with `Prompt Marks:`.

| Option | Default | What it does |
| :- | :- | :- |
| `accent_color` | Purple | Bar color, picked from Purple, Indigo, Blue, Teal, Green, Olive, Amber, Orange, Red, Pink, Slate, or Custom. The row tint is mixed from it. |
| `custom_color` | `#5b2a86` | Hex color used when `accent_color` is Custom. |
| `enabled` | on | Turns Prompt Marks off entirely. If agentic-toolkit installed it, use this rather than disabling the plugin, since disabling it also disables the toolkit. |
| `navigation` | on | Jumps between prompts with the keys below. |
| `styling` | on | Draws the bar and tinted row behind each prompt. |
| `tint_strength` | `22` | Percent of the accent mixed into the background behind each prompt. |

Terminals can't do transparency, so the tint is the accent blended with `#1e1e1e` on dark themes and `#ffffff` on light ones. If it looks off against your background, adjust `tint_strength`.

## Keys

Mods can't add their own keybinding actions, so Prompt Marks listens on two that already exist: `app:diffFileListUp` and `app:diffFileListDown`. Both Ctrl and Option (Alt) with Up/Down are bound to them by default. While the `/diff` panel is open, the keys scroll its file list as usual.

| Platform | Use | Why |
| :- | :- | :- |
| macOS | Option+Up/Down | macOS reserves Ctrl+Up/Down for Mission Control |
| Windows | Ctrl+Up/Down | Windows Terminal uses Alt+arrows to move between split panes |

Any other key can be bound to the same actions in `~/.claude/keybindings.json`. Cmd+Up/Down only works if your terminal passes Cmd through (in iTerm2: Profiles > Keys > Report keys using CSI u) and doesn't already use those keys:

```json
{
  "bindings": [
    { "context": "Global", "bindings": { "cmd+up": "app:diffFileListUp", "cmd+down": "app:diffFileListDown" } }
  ]
}
```

## Develop

```
claude --plugin-dir .          # load this checkout for one session
claude plugin validate --strict .
claude plugin test .
npx -p typescript tsc -p .     # after one load has written .claude-plugin/types
```
