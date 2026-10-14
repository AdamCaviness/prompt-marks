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
