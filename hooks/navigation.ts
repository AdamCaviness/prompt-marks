// Which prompt a jump reveals, from where the prompts sit relative to the viewport.

export type Visible = { first: number; last: number; of: number }

/**
 * Index of the prompt to reveal, or -1 when there is none in that direction.
 *
 * Relative to the topmost prompt on screen: Up reveals that prompt when its top
 * is scrolled away, else the one before it; Down reveals the one after it. With
 * no prompt on screen, it steps from the last jump, or starts at the newest.
 *
 * Down steps past the last jump's prompt when it would pick that prompt again: near
 * the bottom the viewport cannot move it to the top, so the prompt above it stays
 * the topmost on screen and would otherwise be picked forever.
 */
export function pickTarget(
  prompts: readonly string[],
  visible: ReadonlyMap<string, Visible>,
  cursor: number,
  direction: -1 | 1,
): number {
  const top = prompts.findIndex(id => visible.has(id))
  const target =
    top === -1
      ? cursor === -1
        ? prompts.length - 1
        : cursor + direction
      : direction === 1
        ? top + 1
        : visible.get(prompts[top]!)!.first > 0
          ? top
          : top - 1
  const next = direction === 1 && target === cursor ? target + 1 : target
  return next >= 0 && next < prompts.length ? next : -1
}

// At an end a press moves nothing. Pressed again soon after, toward the same end, it wraps to the other end. The
// first press must come after a pause at that end, so steady presses that walk to an end stop there, and the second
// must be farther from it than a held key repeats.
export const DOUBLE_PRESS_MS = 500
export const KEY_REPEAT_MS = 120

/** A press that found no prompt in `direction`, at time `at`, after a pause. */
export type EndPress = { direction: -1 | 1; at: number }

/**
 * What a press at `at`, `sincePress` after the press before it, that found no prompt in `direction` does: whether it
 * wraps, and the end press the next press compares with.
 */
export function pressAtEnd(
  last: EndPress | null,
  direction: -1 | 1,
  at: number,
  sincePress: number,
): { wrap: boolean; last: EndPress | null } {
  if (last !== null && last.direction === direction && at - last.at <= DOUBLE_PRESS_MS && sincePress >= KEY_REPEAT_MS)
    return { wrap: true, last: null }
  return { wrap: false, last: sincePress > DOUBLE_PRESS_MS ? { direction, at } : null }
}

// Where the prompts sit, from the engine's reports, and the prompt the last jump revealed.
//
// The engine reports a row again when a scroll moves it past an edge of the viewport, after the scroll resolves. A
// jump moves the viewport farther than that: a prompt it moves off screen past a long reply is never reported gone,
// and one that stays on screen is not reported again. So a jump drops the reports made before it and records its
// prompt at the top of the viewport, where `block: 'start'` puts it.
export type Viewport = {
  /** Records where the engine reports prompt `id`: `null` off screen, `undefined` where the surface does not say. */
  report(id: string, onScreen: Visible | null | undefined): void
  /** Index of the prompt a jump in `direction` reveals, or -1 when there is none. */
  pick(direction: -1 | 1): number
  /** A point in the reports, taken before a jump scrolls. */
  mark(): number
  /** The jump begun at `since` revealed `id` at the top: reports made before it may be of rows it moved off screen. */
  landed(id: string, since: number): void
  /** Forgets `id`, a prompt that turned out not to be drawn. */
  forget(id: string): void
  /** The viewport snapped to the end of the transcript: what was on screen before says nothing. */
  toEnd(): void
  reset(): void
}

// Where a jump's prompt sits once revealed: its first row at the top of the viewport.
const AT_TOP: Visible = { first: 0, last: 0, of: 1 }

export function createViewport(prompts: () => readonly string[]): Viewport {
  let shown = new Map<string, { at: Visible; seq: number }>()
  let seq = 0
  let cursorId: string | null = null

  return {
    report(id, onScreen) {
      seq++
      if (!onScreen) {
        shown.delete(id)
        return
      }
      shown.set(id, { at: onScreen, seq })
      // A prompt cut off at the top of the viewport has nothing older on screen; one cut off at the bottom, nothing newer.
      const ids = prompts()
      const index = ids.indexOf(id)
      const cutTop = onScreen.first > 0
      const cutBottom = onScreen.last < onScreen.of - 1
      if (!cutTop && !cutBottom) return
      for (const other of [...shown.keys()]) {
        const at = ids.indexOf(other)
        if ((cutTop && at < index) || (cutBottom && at > index)) shown.delete(other)
      }
    },
    pick(direction) {
      const ids = prompts()
      const visible = new Map([...shown].map(([id, entry]) => [id, entry.at]))
      return pickTarget(ids, visible, cursorId === null ? -1 : ids.indexOf(cursorId), direction)
    },
    mark() {
      return seq
    },
    landed(id, since) {
      cursorId = id
      shown = new Map([...shown].filter(([, entry]) => entry.seq > since))
      if (!shown.has(id)) shown.set(id, { at: AT_TOP, seq })
    },
    forget(id) {
      shown.delete(id)
    },
    toEnd() {
      shown = new Map()
      cursorId = null
    },
    reset() {
      shown = new Map()
      seq = 0
      cursorId = null
    },
  }
}
