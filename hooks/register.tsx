import type { EngineInterface, Register } from 'claude-code'

import { blend, isHex } from './color'
import { pickTarget, type Visible } from './navigation'

const DEFAULT_ACCENT = '#5b2a86'
const DEFAULT_TINT_STRENGTH = 22
// Assumed terminal backgrounds for the theme family; the tint is mixed over these.
const DARK_BACKGROUND = '#1e1e1e'
const LIGHT_BACKGROUND = '#ffffff'
// Engine keybinding actions borrowed for navigation: Ctrl+Up/Down and Option(Alt)+Up/Down by default.
const ACTION_PREVIOUS = 'app:diffFileListUp'
const ACTION_NEXT = 'app:diffFileListDown'
// Rows the person typed (or sent from Remote Control); notifications and agent messages stay unstyled.
const OWN_ORIGINS: ReadonlySet<string> = new Set(['composer', 'bridge'])

let accent = DEFAULT_ACCENT
let strength = DEFAULT_TINT_STRENGTH
let tint = blend(DEFAULT_ACCENT, DARK_BACKGROUND, DEFAULT_TINT_STRENGTH / 100)

// Prompt message ids in transcript order, as first drawn, and which of them the viewport shows.
let prompts: string[] = []
let visible = new Map<string, Visible>()
let cursor = -1

function reset() {
  prompts = []
  visible = new Map()
  cursor = -1
}

async function loadTheme($: EngineInterface) {
  const theme = (await $.config.list()).find(row => row.key === 'theme')?.value
  const isLight = typeof theme === 'string' && theme.startsWith('light')
  tint = blend(accent, isLight ? LIGHT_BACKGROUND : DARK_BACKGROUND, strength / 100)
}

function track(id: string, onScreen: Visible | null | undefined) {
  if (!prompts.includes(id)) prompts.push(id)
  if (onScreen) visible.set(id, onScreen)
  else visible.delete(id)
}

// A refused target (its row is not drawn right now) is skipped, and the jump
// tries the next prompt in the same direction.
async function jump($: EngineInterface, direction: -1 | 1) {
  for (let target = pickTarget(prompts, visible, cursor, direction); target >= 0 && target < prompts.length; target += direction) {
    const result = await $.ui.scroll({ to: { requestId: prompts[target]! }, block: 'start' })
    if (!result.deny) {
      cursor = target
      return
    }
  }
  $.ui.toast(direction === -1 ? 'No earlier prompt' : 'No later prompt')
}

export const register: Register = (on, options) => {
  if (typeof options.accent_color === 'string' && isHex(options.accent_color)) accent = options.accent_color
  if (typeof options.tint_strength === 'number') strength = options.tint_strength

  on('session.start', async ($, e, next) => {
    await loadTheme($)
    return next(e)
  })

  on('classic.SessionStart', { source: ['clear', 'resume', 'fork'] }, async ($, e, next) => {
    reset()
    return next(e)
  }).catch(($, e, next) => next(e))

  on('config.set', { key: 'theme' }, async ($, e, next) => {
    const result = await next(e)
    await loadTheme($)
    $.ui.invalidate('ui.render')
    return result
  }).catch(($, e, next) => (next.called ? undefined : next(e)))

  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    if (!OWN_ORIGINS.has(e.props.origin.kind)) return next(e)
    track(e.requestId, e.props.onScreen)
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="row" marginTop={1} width="100%">
        <Box width={1} backgroundColor={accent} />
        <Box flexGrow={1} paddingX={1} backgroundColor={tint}>
          <Text>{e.props.text}</Text>
        </Box>
      </Box>
    )
  })

  // Hidden Buttons hold the navigation chords without drawing anything.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const theirs = await next(e)
    const { Box, Button } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {theirs}
        <Box display="none">
          <Button key="previous-prompt" label="previous prompt" action={ACTION_PREVIOUS} onPress={() => jump($, -1)} />
          <Button key="next-prompt" label="next prompt" action={ACTION_NEXT} onPress={() => jump($, 1)} />
        </Box>
      </Box>
    )
  })
}
