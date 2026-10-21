// The prompts of the transcript in transcript order, learned from the order their rows are first drawn.
//
// The transcript draws its newest rows first, and later draws older chunks as the viewport nears the top.
// A chunk arrives in one burst, in transcript order, and is older than every prompt already known. A prompt
// the person just sent is announced by `session.append` before its row is drawn, and is newer than all.
//
// A slash command the person runs is stored by `session.append` too, but its row is drawn by no hook, so it goes at the
// end when stored. Commands stored before the session was resumed are never announced, so they are not in the order.
//
// A prompt typed while the engine works is drawn as a preview row, under an id that changes whenever the queue
// does, until it is stored. `session.append` announces the queued text just after the first preview is drawn, so a
// row with that text, drawn then or shortly before, is no prompt.

// The engine draws a row under `placeholder`, or `placeholder-1` and so on for prompts queued while it works,
// while a sent prompt is still being stored; the real row follows under its own id.
// A preview row can be drawn this long before its queued text is announced.
export const PREVIEW_LOOKBACK_MS = 2000
// Texts of prompts waiting behind a turn that are never stored as a prompt (a notification's) would stay forever.
const MAX_QUEUED = 20
const PLACEHOLDER_PREFIX = 'placeholder'
export const isPlaceholder = (id: string): boolean => id.startsWith(PLACEHOLDER_PREFIX)
// Rows first drawn within this many milliseconds of the previous one belong to the same chunk.
export const CHUNK_MS = 50

export type PromptOrder = {
  /** Prompt message ids, oldest first. */
  readonly ids: readonly string[]
  /**
   * Notes a prompt with `text` waiting behind the running turn: rows showing it are previews, not prompts.
   * Returns the ids it takes back out of the order, for rows drawn just before the note.
   */
  queue(text: string, now: number): string[]
  /** Marks `id`, a prompt just stored with `text`, so its first draw goes at the end. */
  announce(id: string, text: string): void
  /** Puts `id`, a slash command just stored as `line`, at the end: no hook draws its row. */
  command(id: string, line: string): void
  /** Records a drawn row; a known, placeholder, preview or removed id changes nothing. */
  add(id: string, text: string, now: number): void
  /** Whether `id` is a prompt in the order. */
  has(id: string): boolean
  /** Takes the order saved before a reload; prompts drawn since go after it. */
  restore(saved: readonly string[]): void
  /** Forgets `id` for good, for a prompt that turned out not to be drawn. */
  remove(id: string): void
  reset(): void
}

const normalize = (text: string): string => text.trim().replace(/\s+/g, ' ')

// A stored slash command's text names it in tags, as `<command-name>/doctor</command-name>` and `<command-args>`.
const COMMAND_NAME = /<command-name>([^<]*)<\/command-name>/
const COMMAND_ARGS = /<command-args>([\s\S]*?)<\/command-args>/

/** The command line a stored slash command ran, as typed; `undefined` for a row that runs none, such as its output. */
export const commandLine = (text: string): string | undefined => {
  const name = COMMAND_NAME.exec(text)?.[1]
  if (name === undefined) return undefined
  const args = COMMAND_ARGS.exec(text)?.[1]?.trim()
  return args ? `${name} ${args}` : name
}

export function createOrder(): PromptOrder {
  let ids: string[] = []
  const queued: string[] = []
  let recent: { id: string; text: string; at: number }[] = []
  const announced = new Set<string>()
  const removed = new Set<string>()
  let chunkAt = 0
  let lastAt = Number.NEGATIVE_INFINITY

  return {
    get ids() {
      return ids
    },
    queue(text, now) {
      const shown = normalize(text)
      queued.push(shown)
      if (queued.length > MAX_QUEUED) queued.shift()
      const previews = recent.filter(row => row.text === shown && now - row.at <= PREVIEW_LOOKBACK_MS).map(row => row.id)
      previews.forEach(id => removed.add(id))
      ids = ids.filter(id => !previews.includes(id))
      recent = recent.filter(row => !previews.includes(row.id))
      return previews
    },
    announce(id, text) {
      announced.add(id)
      const waiting = queued.indexOf(normalize(text))
      if (waiting !== -1) queued.splice(waiting, 1)
    },
    command(id, line) {
      const waiting = queued.indexOf(normalize(line))
      if (waiting !== -1) queued.splice(waiting, 1)
      if (!removed.has(id) && !ids.includes(id)) ids.push(id)
    },
    has(id) {
      return ids.includes(id)
    },
    add(id, text, now) {
      if (isPlaceholder(id) || removed.has(id) || ids.includes(id)) return
      if (announced.delete(id)) {
        ids.push(id)
        return
      }
      if (queued.includes(normalize(text))) {
        removed.add(id)
        return
      }
      if (now - lastAt > CHUNK_MS) chunkAt = 0
      lastAt = now
      ids.splice(chunkAt++, 0, id)
      recent = [...recent.filter(row => now - row.at <= PREVIEW_LOOKBACK_MS), { id, text: normalize(text), at: now }]
    },
    restore(saved) {
      const known = new Set(saved)
      ids = [...saved, ...ids.filter(id => !known.has(id))]
    },
    remove(id) {
      removed.add(id)
      ids = ids.filter(known => known !== id)
    },
    reset() {
      ids = []
      announced.clear()
      removed.clear()
      queued.length = 0
      recent = []
      chunkAt = 0
      lastAt = Number.NEGATIVE_INFINITY
    },
  }
}
