import { describe, expect, test } from 'claude-code/testing'

import { blend } from '../hooks/color'
import { pickTarget, type Visible } from '../hooks/navigation'

const SURFACES = ['terminal', 'desktop'] as const
const prompt = (text: string, kind: 'composer' | 'task-notification' = 'composer') =>
  ({ text, origin: { kind }, isExpanded: true }) as const

describe('blend', () => {
  test('mixes the accent over the background by amount', () => {
    expect(blend('#ffffff', '#000000', 0.5)).toBe('#808080')
    expect(blend('#5b2a86', '#1e1e1e', 0)).toBe('#1e1e1e')
    expect(blend('#5b2a86', '#1e1e1e', 1)).toBe('#5b2a86')
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

  test(`${surface}: the accent comes from userConfig`, { options: { accent_color: '#ff0000' } }, async $ => {
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
