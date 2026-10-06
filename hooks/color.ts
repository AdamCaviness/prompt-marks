// Terminals have no alpha channel, so a "translucent" tint is computed by
// mixing the accent color into the background the terminal is assumed to show.

const HEX = /^#?([0-9a-f]{6})$/i

export const isHex = (value: string): boolean => HEX.test(value)

const channels = (hex: string): [number, number, number] => {
  const digits = HEX.exec(hex)?.[1] ?? '000000'
  return [0, 2, 4].map(at => parseInt(digits.slice(at, at + 2), 16)) as [number, number, number]
}

const toHex = (rgb: readonly number[]): string =>
  '#' + rgb.map(c => Math.round(c).toString(16).padStart(2, '0')).join('')

/** Mixes `amount` (0..1) of `color` over `background`. */
export const blend = (color: string, background: string, amount: number): string => {
  const top = channels(color)
  const bottom = channels(background)
  const a = Math.min(1, Math.max(0, amount))
  return toHex(top.map((c, i) => c * a + bottom[i]! * (1 - a)))
}

// Named accents offered in /config, each dark enough to tint over a dark or light background.
export const ACCENTS: Readonly<Record<string, string>> = {
  Purple: '#5b2a86',
  Indigo: '#3f3d9e',
  Blue: '#1f5fae',
  Teal: '#127a7a',
  Green: '#2e7d32',
  Olive: '#6b7a1f',
  Amber: '#b7791f',
  Orange: '#c2571a',
  Red: '#b3261e',
  Pink: '#b0306a',
  Slate: '#4a5568',
}

export const CUSTOM = 'Custom'

/**
 * The hex for a named accent, or `custom` when Custom is picked and valid, else Purple.
 * The name is typed freely in /config, so case and surrounding spaces are ignored.
 */
export const resolveAccent = (name: unknown, custom: unknown): string => {
  const typed = typeof name === 'string' ? name.trim().toLowerCase() : ''
  if (typed === CUSTOM.toLowerCase() && typeof custom === 'string' && isHex(custom)) return custom.startsWith('#') ? custom : `#${custom}`
  const match = Object.keys(ACCENTS).find(key => key.toLowerCase() === typed)
  return (match && ACCENTS[match]) || ACCENTS.Purple!
}
