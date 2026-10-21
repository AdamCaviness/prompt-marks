import type { EngineInterface, Register } from 'claude-code'

import { ACCENTS, blend, resolveAccent } from './color'
import { createViewport, type EndPress, pressAtEnd, type Visible } from './navigation'
import { commandLine, createOrder } from './order'

const DEFAULT_TINT_STRENGTH = 22
// Assumed terminal backgrounds for the theme family; the tint is mixed over these.
const DARK_BACKGROUND = '#1e1e1e'
const LIGHT_BACKGROUND = '#ffffff'
// The ❯ pointer sits on the accent bar, so it is lightened toward white to read against the accent on any theme.
const POINTER = '❯'
const POINTER_LIGHTNESS = 0.65
// Engine keybinding actions borrowed for navigation: Ctrl+Up/Down and Option(Alt)+Up/Down by default.
const ACTION_PREVIOUS = 'app:diffFileListUp'
const ACTION_NEXT = 'app:diffFileListDown'
// Rows the person typed (or sent from Remote Control); notifications and agent messages stay unstyled.
const OWN_ORIGINS: ReadonlySet<string> = new Set(['composer', 'bridge'])
// A command that only prints (`/context`) is stored with the engine as its origin, though the person typed it.
const COMMAND_ORIGINS: ReadonlySet<string> = new Set([...OWN_ORIGINS, 'engine'])
// The order is saved this long after it last changed, so the rows of one chunk make one write.
const SAVE_DELAY_MS = 100
// Where the order survives a reload of the mod; `plugin` and `key` are literals for `claude plugin validate`.
const ORDER_STATE = { plugin: 'prompt-marks', key: 'order' } as const
// Reaching the oldest drawn prompt makes the engine draw older rows within a few milliseconds; Up waits this long for them.
const OLDER_ROWS_WAIT_MS = 150

let accent = ACCENTS.Purple!
let strength = DEFAULT_TINT_STRENGTH
let tint = blend(accent, DARK_BACKGROUND, DEFAULT_TINT_STRENGTH / 100)
let pointer = blend('#ffffff', accent, POINTER_LIGHTNESS)

// Prompt message ids in transcript order, and where they sit relative to the viewport.
const order = createOrder()
const viewport = createViewport(() => order.ids)
// Jumps run one at a time, so a second key press sees where the first one left the viewport.
let pending: Promise<void> = Promise.resolve()
// When the last key press came, and the last one that found no prompt past an end after a pause.
let lastPressAt = Number.NEGATIVE_INFINITY
let endPress: EndPress | null = null
let saveQueued = false

function reset() {
  order.reset()
  viewport.reset()
  endPress = null
}

function applyTheme(theme: unknown) {
  const isLight = typeof theme === 'string' && theme.startsWith('light')
  tint = blend(accent, isLight ? LIGHT_BACKGROUND : DARK_BACKGROUND, strength / 100)
}

async function loadTheme($: EngineInterface) {
  applyTheme((await $.config.list()).find(row => row.key === 'theme')?.value)
}

// A ui.render hook may not write state, so the save runs from a timer.
function saveOrderSoon($: EngineInterface) {
  if (saveQueued) return
  saveQueued = true
  $.clock.after(SAVE_DELAY_MS, async () => {
    saveQueued = false
    await $.state.set(ORDER_STATE, [...order.ids])
  })
}

function track($: EngineInterface, id: string, text: string, onScreen: Visible | null | undefined) {
  const known = order.ids.length
  order.add(id, text, Date.now())
  if (!order.has(id)) return
  if (order.ids.length !== known) saveOrderSoon($)
  viewport.report(id, onScreen)
}

// A target whose row is not drawn (refused by the engine) is forgotten, and the
// jump picks again, so it ends only when no prompt is left in that direction.
// At an end nothing moves, and a second press there soon after wraps to the other end.
async function jump($: EngineInterface, direction: -1 | 1, at: number, sincePress: number) {
  let target = viewport.pick(direction)
  if (target === -1 && direction === -1) {
    const known = order.ids.length
    await $.clock.sleep(OLDER_ROWS_WAIT_MS)
    if (order.ids.length !== known) target = viewport.pick(direction)
  }
  if (target !== -1) endPress = null
  else {
    const end = pressAtEnd(endPress, direction, at, sincePress)
    endPress = end.last
    if (end.wrap && order.ids.length > 0) target = direction === -1 ? order.ids.length - 1 : 0
  }
  while (target !== -1) {
    const id = order.ids[target]!
    const since = viewport.mark()
    const result = await $.ui.scroll({ to: { requestId: id }, block: 'start' })
    if (!result.deny) {
      viewport.landed(id, since)
      return
    }
    order.remove(id)
    saveOrderSoon($)
    viewport.forget(id)
    target = viewport.pick(direction)
  }
}

const queueJump = ($: EngineInterface, direction: -1 | 1) => {
  const at = Date.now()
  const sincePress = at - lastPressAt
  lastPressAt = at
  const run = () => jump($, direction, at, sincePress)
  pending = pending.then(run, run)
  return pending
}

export const register: Register = (on, options) => {
  // A change in /config reloads the module, so options are read once here.
  if (options.enabled === false) return
  accent = resolveAccent(options.accent_color, options.custom_color)
  pointer = blend('#ffffff', accent, POINTER_LIGHTNESS)
  if (typeof options.tint_strength === 'number') strength = options.tint_strength

  on('session.start', async ($, e, next) => {
    await loadTheme($)
    order.restore((await $.state.get(ORDER_STATE)).value ?? [])
    return next(e)
  })

  // The session this order belongs to ends on /clear and resume, and the process goes on under a new one. A classic
  // hook is not used: an organization's security default moves classic events past a person's plugins.
  on('session.end', async ($, e, next) => {
    reset()
    return next(e)
  }).catch(($, e, next) => (next.called ? undefined : next(e)))

  // Reads the theme being set to recompute the tint, then passes the change on unchanged.
  on('config.set', { key: 'theme' }, async ($, e, next) => {
    applyTheme(e.value)
    $.ui.invalidate('ui.render')
    return next(e)
  }).catch(($, e, next) => (next.called ? undefined : next(e)))

  const styling = options.styling !== false
  const navigation = options.navigation !== false

  // A stored prompt is newer than every prompt drawn so far, and its row is drawn after this runs. A queued one
  // is previewed by rows that are no prompts until it is stored.
  // Each door is matched by a literal, never a pattern: the engine cannot tell that a pattern leaves out the doors an
  // organization's security default moves past a person's plugins, so it reports a pattern hook as skipped.
  // The queue door is in newer builds only, and older builds' declarations do not list it, hence the cast.
  const textOf = (message: { content: readonly { type: string; text?: string }[] }) =>
    message.content.flatMap(block => (block.type === 'text' && block.text !== undefined ? [block.text] : [])).join('')

  if (navigation) {
    on('session.append', { door: 'prompt' }, async ($, e, next) => {
      if (OWN_ORIGINS.has(e.origin.kind)) order.announce(e.uuid, textOf(e.message))
      return next(e)
    }).catch(($, e, next) => (next.called ? undefined : next(e)))

    // A slash command's row is drawn by no hook, so it is learned when stored. Its output is stored the same way.
    on('session.append', { door: 'command' }, async ($, e, next) => {
      const line = COMMAND_ORIGINS.has(e.origin.kind) ? commandLine(textOf(e.message)) : undefined
      if (line !== undefined) {
        order.command(e.uuid, line)
        saveOrderSoon($)
      }
      return next(e)
    }).catch(($, e, next) => (next.called ? undefined : next(e)))

    // Enter in the prompt box scrolls the transcript to its end, past rows the engine does not report gone.
    // Older builds' declarations do not list the slash command a submission runs, hence the `in` check.
    on('prompt.submit', async ($, e, next) => {
      if (e.origin.kind === 'composer' && !('command' in e && e.command)) viewport.toEnd()
      return next(e)
    }).catch(($, e, next) => (next.called ? undefined : next(e)))

    on('session.append', { door: 'queue' as 'prompt' }, async ($, e, next) => {
      const previews = order.queue(textOf(e.message), Date.now())
      previews.forEach(id => viewport.forget(id))
      if (previews.length > 0) saveOrderSoon($)
      return next(e)
    }).catch(($, e, next) => (next.called ? undefined : next(e)))
  }

  // Navigation learns the prompts from these rows, so the hook runs when either feature is on.
  if (styling || navigation) on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    if (!OWN_ORIGINS.has(e.props.origin.kind)) return next(e)
    if (navigation) track($, e.requestId, e.props.text, e.props.onScreen)
    if (!styling) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="row" marginTop={1} width="100%">
        <Box width={1} backgroundColor={accent}>
          <Text color={pointer} backgroundColor={accent}>{POINTER}</Text>
        </Box>
        <Box flexGrow={1} paddingX={1} backgroundColor={tint}>
          <Text>{e.props.text}</Text>
        </Box>
      </Box>
    )
  })

  // Hidden Buttons hold the navigation chords without drawing anything.
  if (navigation) on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const theirs = await next(e)
    const { Box, Button } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {theirs}
        <Box display="none">
          <Button key="previous-prompt" label="previous prompt" action={ACTION_PREVIOUS} onPress={() => queueJump($, -1)} />
          <Button key="next-prompt" label="next prompt" action={ACTION_NEXT} onPress={() => queueJump($, 1)} />
        </Box>
      </Box>
    )
  })
}
