# Prompt Marks

In a long Claude Code session, your own prompts get buried under pages of output. Prompt Marks puts a colored bar and a tinted background behind every prompt you type, and lets you jump from one prompt to the next with the keyboard.

- Option+Up and Option+Down on macOS, Ctrl+Up and Ctrl+Down on Windows and Linux.
- Nothing extra is drawn on screen. Only your prompt rows change.

Needs Claude Code v2.1.287 or later. Jumping needs [fullscreen rendering](https://code.claude.com/docs/en/fullscreen).

## Install

```
/plugin install prompt-marks --marketplace adamcaviness/prompt-marks
```

Then turn on auto-update: `/plugin` → **Marketplaces** → **prompt-marks** → **Enable auto-update**. Claude Code leaves it off for marketplaces outside Anthropic's, so without it you keep the version you first installed.

It's also in [agentic-marketplace](https://github.com/adamcaviness/agentic-marketplace), and agentic-toolkit installs it for you.

## Configure

Open `/config` and look for the rows starting with `Prompt Marks:`.

| Option | Default | What it does |
| :- | :- | :- |
| `accent_color` | Purple | Bar color: type Purple, Indigo, Blue, Teal, Green, Olive, Amber, Orange, Red, Pink, Slate, or Custom (case doesn't matter). Anything else falls back to Purple. The row tint is mixed from it. |
| `custom_color` | `#5b2a86` | Hex color used when `accent_color` is Custom. |
| `enabled` | on | Turns Prompt Marks off entirely. If agentic-toolkit installed it, use this rather than disabling the plugin, since disabling it also disables the toolkit. |
| `navigation` | on | Jumps between prompts with the keys below. |
| `styling` | on | Draws the bar, with the ❯ pointer on its first row, and the tinted row behind each prompt. The pointer is the accent lightened toward white. |
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

## How jumping finds prompts

Claude Code draws only the newest part of a long transcript and draws older prompts when you scroll toward the top, so Prompt Marks learns the prompts as they are drawn. Each batch of older prompts goes before the ones it already knows, a prompt you send goes after them, and the order is kept in session memory so reloading the mod (for example after changing a setting in `/config`) does not lose it. Previews of prompts you queued while Claude was working are ignored until the prompt is stored.

When Up reaches the oldest prompt drawn so far, it waits a moment for Claude Code to draw older ones before it stops.

At either end a press does nothing. Pause there, then press the same key twice quickly to wrap to the other end: Up twice at the oldest prompt goes to the newest, and Down twice at the newest goes to the oldest drawn so far. Holding the key down stops at the end without wrapping.

Slash commands you run (`/doctor some words`, a skill) are jump targets too, from the moment you run them. Claude Code draws their rows itself with no hook for mods, so they keep the default gray row, and commands from before a resume are not known.

Each jump starts from the topmost prompt on screen. Claude Code does not report every prompt that leaves the screen during a long jump or when you send a prompt, so after a jump Prompt Marks treats the prompt it just revealed as the topmost, and after you send a prompt it starts again from the newest.

## What it hooks

Prompt Marks runs no programs, reads and writes no files, and sends nothing off your machine. Its only stored data is the list of prompt ids, kept in the session's memory and discarded when the session ends or on `/clear` and `/resume`. It never changes a setting or a permission decision. Each hook:

| Hook | When | What it does |
| :- | :- | :- |
| `session.start` | A session starts, or the mod reloads | Reads your `theme` setting to pick the dark or light tint, and restores the prompt order saved in session memory. |
| `session.end` | The session ends, including on `/clear` and resume | Forgets the prompts it was tracking for navigation, then passes the event on unchanged. |
| `config.set` (key `theme` only) | You change the theme | Reads the new theme to recompute the tint and redraws, then passes the change on unchanged. It never blocks or alters the setting. |
| `session.append` (doors `prompt`, `command` and `queue` only) | A prompt or slash command is stored, or queued behind a running turn | Notes which prompt or command is newest and which rows only preview a queued prompt, then passes the row on unchanged. |
| `prompt.submit` | You press Enter in the prompt box | Notes that the transcript scrolled to its end, then passes the prompt on unchanged. It never blocks or alters a prompt. |
| `ui.render` (`UserMessage`) | A prompt row is drawn | Draws your own typed prompts with the accent bar and tint, and records where they are for navigation. Notifications and agent messages keep the default row. |
| `ui.render` (`AbovePrompt`) | The area above the prompt is drawn | Adds two hidden buttons bound to the navigation keys. Nothing visible is drawn. |

## Develop

```
claude --plugin-dir .          # load this checkout for one session
claude plugin validate --strict .
claude plugin test .
npx -p typescript tsc -p .     # after one load has written .claude-plugin/types
```
