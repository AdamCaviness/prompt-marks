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
