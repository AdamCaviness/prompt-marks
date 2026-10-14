import { describe, expect, test } from 'claude-code/testing'

import { blend, resolveAccent } from '../hooks/color'
import { pickTarget, type Visible } from '../hooks/navigation'
import { CHUNK_MS, createOrder, PREVIEW_LOOKBACK_MS } from '../hooks/order'

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

  test('Down steps past the last jump when the viewport cannot scroll it to the top', () => {
    const shown = new Map<string, Visible>([['b', { first: 0, last: 2, of: 3 }], ['c', { first: 0, last: 2, of: 3 }]])
    expect(pickTarget(ids, shown, 1, 1)).toBe(2)
    expect(pickTarget(ids, shown, 2, 1)).toBe(-1)
  })

  test('returns -1 past either end', () => {
    expect(pickTarget(ids, shown([['a', { first: 0, last: 2, of: 3 }]]), -1, -1)).toBe(-1)
    expect(pickTarget(ids, shown([['c', { first: 0, last: 2, of: 3 }]]), -1, 1)).toBe(-1)
  })
})

describe('createOrder', () => {
  const drawn = (order: ReturnType<typeof createOrder>, at: number, ...ids: string[]) => ids.forEach(id => order.add(id, `text of ${id}`, at))

  test('keeps the transcript order of the first chunk drawn', () => {
    const order = createOrder()
    drawn(order, 0, 'p4', 'p5', 'p6')
    expect(order.ids).toEqual(['p4', 'p5', 'p6'])
  })

  test('puts a later chunk of older prompts before the known ones, in its own order', () => {
    const order = createOrder()
    drawn(order, 0, 'p4', 'p5', 'p6')
    drawn(order, 1000, 'p1', 'p2', 'p3')
    drawn(order, 5000, 'p0')
    expect(order.ids).toEqual(['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6'])
  })

  test('treats rows drawn within CHUNK_MS of each other as one chunk', () => {
    const order = createOrder()
    drawn(order, 0, 'p3')
    order.add('p1', 'one', 1000)
    order.add('p2', 'two', 1000 + CHUNK_MS)
    expect(order.ids).toEqual(['p1', 'p2', 'p3'])
  })

  test('puts an announced prompt at the end, however late it is drawn', () => {
    const order = createOrder()
    drawn(order, 0, 'p1', 'p2')
    order.announce('p3', 'three')
    drawn(order, 1000, 'p0')
    drawn(order, 2000, 'p3')
    expect(order.ids).toEqual(['p0', 'p1', 'p2', 'p3'])
  })

  test('ignores known ids and every placeholder row', () => {
    const order = createOrder()
    drawn(order, 0, 'p1', 'placeholder', 'placeholder-1', 'placeholder-2', 'p1')
    expect(order.ids).toEqual(['p1'])
  })

  test('a removed prompt leaves the order and is not added again', () => {
    const order = createOrder()
    drawn(order, 0, 'p1', 'p2', 'p3')
    order.remove('p2')
    drawn(order, 1000, 'p2')
    expect(order.ids).toEqual(['p1', 'p3'])
  })

  test('rows showing a queued prompt are previews, however often their id changes', () => {
    const order = createOrder()
    drawn(order, 0, 'p1', 'p2')
    order.queue('  do the\nthing ', 500)
    order.add('preview-a', 'do the thing', 1000)
    order.add('preview-b', 'do the thing', 2000)
    order.add('preview-a', 'do the thing', 3000)
    expect(order.ids).toEqual(['p1', 'p2'])
    expect(order.has('preview-a')).toBe(false)
    order.announce('p3', 'do the thing')
    order.add('p3', 'do the thing', 4000)
    expect(order.ids).toEqual(['p1', 'p2', 'p3'])
  })

  test('a queued prompt takes back the preview rows drawn just before it was noted', () => {
    const order = createOrder()
    drawn(order, 0, 'p1', 'p2')
    order.add('preview-a', 'do the thing', 5000)
    order.add('old', 'do the thing', 5000 + CHUNK_MS * 2)
    expect(order.queue('do the thing', 5300)).toEqual(['preview-a', 'old'])
    expect(order.ids).toEqual(['p1', 'p2'])
    expect(order.queue('do the thing', 5300 + PREVIEW_LOOKBACK_MS + 1)).toEqual([])
  })

  test('restore takes a saved order, with prompts drawn since after it', () => {
    const order = createOrder()
    drawn(order, 0, 'p9', 'p2')
    order.restore(['p1', 'p2', 'p3'])
    expect(order.ids).toEqual(['p1', 'p2', 'p3', 'p9'])
  })

  test('reset forgets everything', () => {
    const order = createOrder()
    drawn(order, 0, 'p1')
    order.announce('p2', 'two')
    order.reset()
    drawn(order, 0, 'p2')
    expect(order.ids).toEqual(['p2'])
  })
})

for (const surface of SURFACES) {
  test(`${surface}: a typed prompt gets the accent bar and the tinted row`, async $ => {
    const ui = await $.ui.mount({ plugin: 'prompt-marks', surface, component: 'UserMessage', props: prompt('hello') })
    expect(await ui.find({ type: 'Text', text: 'hello' })).toBeDefined()
    expect(JSON.stringify(await ui.drawn())).toContain('#5b2a86')
  })

  test(`${surface}: the pointer sits on the bar in a lightened accent`, async $ => {
    const ui = await $.ui.mount({ plugin: 'prompt-marks', surface, component: 'UserMessage', props: prompt('hello') })
    expect(await ui.find({ type: 'Text', text: '❯' })).toBeDefined()
    expect(JSON.stringify(await ui.drawn())).toContain(blend('#ffffff', '#5b2a86', 0.65))
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
