import { describe, expect, test } from 'claude-code/testing'

import { blend, resolveAccent } from '../hooks/color'
import { pickTarget, type Visible } from '../hooks/navigation'

const SURFACES = ['terminal', 'desktop'] as const
const BAND = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 10,
  bodyColumns: 80,
  scroll: { offset: 0, bodyRows: 10 },
  view: {},
} as const
const prompt = (text: string, kind: 'composer' | 'task-notification' = 'composer') =>
  ({ text, origin: { kind }, isExpanded: true }) as const

describe('blend', () => {
  test('mixes the accent over the background by amount', () => {
    expect(blend('#ffffff', '#000000', 0.5)).toBe('#808080')
    expect(blend('#5b2a86', '#1e1e1e', 0)).toBe('#1e1e1e')
    expect(blend('#5b2a86', '#1e1e1e', 1)).toBe('#5b2a86')
  })
})

describe('resolveAccent', () => {
  test('maps a named accent, honors Custom, and falls back to Purple', () => {
    expect(resolveAccent('Teal', undefined)).toBe('#127a7a')
    expect(resolveAccent('Custom', 'ff0000')).toBe('#ff0000')
    expect(resolveAccent('Custom', 'not a color')).toBe('#5b2a86')
    expect(resolveAccent('Mauve', undefined)).toBe('#5b2a86')
  })

  test('ignores case and surrounding spaces in a typed name', () => {
    expect(resolveAccent(' teal ', undefined)).toBe('#127a7a')
    expect(resolveAccent('custom', '#00ff00')).toBe('#00ff00')
  })
})

describe('theme changes', () => {
  test('a theme change passes through unchanged and retints prompts', async ($, on) => {
    let received: unknown
    on('config.set', ($, e) => {
      received = e.value
      return { value: e.value }
    })
    const change = { key: 'theme', value: 'light', previous: 'dark', origin: { kind: 'composer' }, provider: { plugin: 'engine' } }
    await $.config.set(change as Parameters<typeof $.config.set>[0])
    expect(received).toBe('light')
    const ui = await $.ui.mount({ plugin: 'prompt-marks', surface: 'terminal', component: 'UserMessage', props: prompt('hi') })
    expect(JSON.stringify(await ui.drawn())).toContain(blend('#5b2a86', '#ffffff', 0.22))
  })
})

describe('pickTarget', () => {
  const ids = ['a', 'b', 'c']
  const shown = (entries: [string, Visible][]) => new Map(entries)

  test('Up reveals the prompt above the topmost one on screen', () => {
    expect(pickTarget(ids, shown([['b', { first: 0, last: 2, of: 3 }]]), -1, -1)).toBe(0)
  })

  test('Up reveals the topmost prompt itself when its top is scrolled away', () => {
    expect(pickTarget(ids, shown([['b', { first: 4, last: 9, of: 10 }]]), -1, -1)).toBe(1)
  })

  test('Down reveals the prompt after the topmost one on screen', () => {
    expect(pickTarget(ids, shown([['a', { first: 0, last: 2, of: 3 }]]), -1, 1)).toBe(1)
  })

  test('with no prompt on screen it steps from the last jump, or starts at the newest', () => {
    expect(pickTarget(ids, shown([]), 1, -1)).toBe(0)
    expect(pickTarget(ids, shown([]), -1, -1)).toBe(2)
  })

  test('returns -1 past either end', () => {
    expect(pickTarget(ids, shown([['a', { first: 0, last: 2, of: 3 }]]), -1, -1)).toBe(-1)
    expect(pickTarget(ids, shown([['c', { first: 0, last: 2, of: 3 }]]), -1, 1)).toBe(-1)
  })
})

for (const surface of SURFACES) {
  test(`${surface}: a typed prompt gets the accent bar and the tinted row`, async $ => {
    const ui = await $.ui.mount({ plugin: 'prompt-marks', surface, component: 'UserMessage', props: prompt('hello') })
    expect(await ui.find({ type: 'Text', text: 'hello' })).toBeDefined()
    expect(JSON.stringify(await ui.drawn())).toContain('#5b2a86')
  })

  test(`${surface}: the accent comes from userConfig`, { options: { accent_color: 'Custom', custom_color: '#ff0000' } }, async $ => {
    const ui = await $.ui.mount({ plugin: 'prompt-marks', surface, component: 'UserMessage', props: prompt('hi') })
    expect(JSON.stringify(await ui.drawn())).toContain('#ff0000')
  })

  test(`${surface}: a task notification keeps the engine's row`, async ($, on) => {
    on('ui.render', { component: 'UserMessage' }, ($, e) => $.ui.resolve(e).Text({ children: ['engine row'] }))
    const ui = await $.ui.mount({
      plugin: 'prompt-marks',
      surface,
      component: 'UserMessage',
      props: prompt('done', 'task-notification'),
    })
    expect(await ui.find({ type: 'Text', text: 'engine row' })).toBeDefined()
    expect(JSON.stringify(await ui.drawn())).not.toContain('#5b2a86')
  })
}

describe('toggles', () => {
  for (const [name, options] of [
    ['enabled off', { enabled: false }],
    ['styling off', { styling: false }],
  ] as const) {
    test(`${name}: prompts keep the engine's row`, { options }, async ($, on) => {
      on('ui.render', { component: 'UserMessage' }, ($, e) => $.ui.resolve(e).Text({ children: ['engine row'] }))
      const ui = await $.ui.mount({ plugin: 'prompt-marks', surface: 'terminal', component: 'UserMessage', props: prompt('hi') })
      expect(await ui.find({ type: 'Text', text: 'engine row' })).toBeDefined()
    })
  }

  test('navigation on: the band holds the hidden navigation Buttons', async ($, on) => {
    on('ui.render', { component: 'AbovePrompt' }, ($, e) => $.ui.resolve(e).Text({ children: [''] }))
    const ui = await $.ui.mount({ plugin: 'prompt-marks', surface: 'terminal', component: 'AbovePrompt', props: BAND })
    expect(await ui.find({ key: 'previous-prompt' })).toBeDefined()
    expect(await ui.find({ key: 'next-prompt' })).toBeDefined()
  })

  test('navigation off: the band draws no navigation Buttons', { options: { navigation: false } }, async ($, on) => {
    on('ui.render', { component: 'AbovePrompt' }, ($, e) => $.ui.resolve(e).Text({ children: [''] }))
    const ui = await $.ui.mount({ plugin: 'prompt-marks', surface: 'terminal', component: 'AbovePrompt', props: BAND })
    expect(await ui.find({ key: 'previous-prompt' })).toBeUndefined()
  })
})
