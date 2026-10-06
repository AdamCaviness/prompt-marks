// Which prompt a jump reveals, from where the prompts sit relative to the viewport.

export type Visible = { first: number; last: number; of: number }

/**
 * Index of the prompt to reveal, or -1 when there is none in that direction.
 *
 * Relative to the topmost prompt on screen: Up reveals that prompt when its top
 * is scrolled away, else the one before it; Down reveals the one after it. With
 * no prompt on screen, it steps from the last jump, or starts at the newest.
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
  return target >= 0 && target < prompts.length ? target : -1
}
