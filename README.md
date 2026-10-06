# Prompt Marks

A Claude Code mod that makes your own prompts easy to find in a long transcript.

- **Marked prompts**: each prompt you type gets a solid accent bar on its left and a tinted background across the full row width.
- **Jump between prompts**: Option+Up / Option+Down (macOS) or Ctrl+Up / Ctrl+Down (Windows, Linux) scroll the transcript to the previous or next prompt. Nothing is added to the screen.

Requires Claude Code v2.1.287 or later. Navigation needs [fullscreen rendering](https://code.claude.com/docs/en/fullscreen).

## Install

```
/plugin install prompt-marks --marketplace adamcaviness/prompt-marks
```

It is also listed in [agentic-marketplace](https://github.com/adamcaviness/agentic-marketplace) and installed with agentic-toolkit.

## Configure

Run `/config`. Every option's label starts with `Prompt Marks:`, so the rows sort together.

| Option | Default | What it does |
| :- | :- | :- |
| `accent_color` | Purple | Bar color, picked from Purple, Indigo, Blue, Teal, Green, Olive, Amber, Orange, Red, Pink, Slate, or Custom. The row tint is mixed from it. |
| `custom_color` | `#5b2a86` | Hex color used when `accent_color` is Custom. |
| `enabled` | on | Turns all of Prompt Marks on or off. Use this instead of disabling the plugin, which also disables agentic-toolkit when it was installed as the toolkit's dependency. |
| `navigation` | on | Jumps between prompts with the keys below. |
| `styling` | on | Draws the bar and tinted row behind each prompt. |
| `tint_strength` | `22` | Percent of the accent mixed into the background behind each prompt. |

Terminals have no transparency, so the tint is the accent mixed into an assumed background: `#1e1e1e` for dark themes, `#ffffff` for light ones.

## Keys

A mod cannot define keybinding actions, so Prompt Marks answers two existing ones: `app:diffFileListUp` and `app:diffFileListDown`. By default they are bound to Ctrl+Up/Down and Option(Alt)+Up/Down. While the `/diff` panel is open, those keys scroll its file list instead.

| Platform | Use | Why not the other |
| :- | :- | :- |
| macOS | Option+Up/Down | macOS reserves Ctrl+Up/Down for Mission Control |
| Windows | Ctrl+Up/Down | Windows Terminal uses Alt+arrows to move between split panes |

To use other keys, bind them in `~/.claude/keybindings.json`. For Cmd+Up/Down, your terminal must report the Super modifier (iTerm2: Profiles > Keys > Report keys using CSI u) and must not bind those keys itself:

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
