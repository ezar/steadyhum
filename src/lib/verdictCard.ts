/**
 * The verdict as an image, for sending to a technician or a family chat.
 *
 * This is the only thing SteadyHum produces that leaves the device, and it
 * will be read by someone who has never seen the app and cannot ask it
 * anything. Two consequences run through the whole layout:
 *
 * - it has to carry its own context — which machine, when, compared against
 *   what — because a screenshot in a chat arrives with none;
 * - it has to carry the limit, not just the finding. "Suena distinto" on its
 *   own reads like a diagnosis once it is out of the app. The footer saying
 *   this is a change against a learned normal, and not a diagnosis, is load
 *   bearing rather than legal boilerplate.
 */

/** Everything the card draws. Deliberately plain data: no DB rows, no React. */
export interface VerdictCardData {
  readonly applianceName: string
  readonly applianceType: string
  readonly statusLabel: string
  /**
   * No `unusable`: a check too spoiled to score has no verdict, so there is
   * nothing to share. Leaving it out of the union keeps a card that reads
   * "I could not listen properly" above "no notable differences" — a claim it
   * has no basis for — from being expressible at all.
   */
  readonly statusKind: 'normal' | 'watch' | 'anomalous'
  readonly headline: string
  readonly when: string
  readonly confidence: string
  /** The differences found, each already phrased for the reader. May be empty. */
  readonly differences: readonly string[]
  readonly differencesTitle: string
  /**
   * What to say when {@link differences} is empty.
   *
   * Kept apart from the list rather than passed as its only entry: heading a
   * lone "no notable differences" with "how it differs" contradicts itself,
   * and the accent bar the list draws would imply a finding where there is
   * none.
   */
  readonly noDifferences: string
  readonly disclaimer: string
  readonly madeWith: string
}

export interface CardPalette {
  readonly paper: string
  readonly card: string
  readonly ink: string
  readonly inkSoft: string
  readonly inkFaint: string
  readonly hairline: string
  readonly status: string
  readonly statusSoft: string
}

const FALLBACK: Readonly<Record<string, string>> = {
  '--color-paper': '#f7f4ef',
  '--color-card': '#fffdfa',
  '--color-ink': '#1b1a17',
  '--color-ink-soft': '#55504a',
  '--color-ink-faint': '#8b857c',
  '--color-hairline': '#e2dcd1',
  '--color-normal': '#4f8f63',
  '--color-normal-soft': '#dff0e3',
  '--color-slight': '#b8801b',
  '--color-slight-soft': '#f8ecd4',
  '--color-different': '#c25743',
  '--color-different-soft': '#f7e0da',
}

/** Status kinds map onto the same tokens the chips use, so the card cannot drift. */
const STATUS_TOKEN: Readonly<Record<VerdictCardData['statusKind'], string>> = {
  normal: 'normal',
  watch: 'slight',
  anomalous: 'different',
}

/**
 * Read the app's own design tokens rather than restating them here.
 *
 * A second copy of the palette is a second thing to keep in step, and the one
 * that drifts is always the one nobody looks at.
 */
export function paletteFromDocument(kind: VerdictCardData['statusKind']): CardPalette {
  const styles =
    typeof globalThis.getComputedStyle === 'function' && typeof document !== 'undefined'
      ? globalThis.getComputedStyle(document.documentElement)
      : null
  const read = (token: string): string => {
    const value = styles?.getPropertyValue(token).trim()
    return value !== undefined && value !== '' ? value : (FALLBACK[token] ?? '#000000')
  }
  const status = STATUS_TOKEN[kind]
  return {
    paper: read('--color-paper'),
    card: read('--color-card'),
    ink: read('--color-ink'),
    inkSoft: read('--color-ink-soft'),
    inkFaint: read('--color-ink-faint'),
    hairline: read('--color-hairline'),
    status: read(`--color-${status}`),
    statusSoft: read(`--color-${status}-soft`),
  }
}

const WIDTH = 1080
const PADDING = 72
const FONT = "'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', 'Noto Sans', sans-serif"

/** The subset of the canvas context this module needs, so it can be faked in tests. */
export interface TextMeasurer {
  measureText: (text: string) => { readonly width: number }
  font: string
}

/**
 * Break `text` into lines that fit `maxWidth`.
 *
 * A word longer than the line is left to overflow rather than split: appliance
 * names are user input, and hyphenating "Lavadora" mid-word to save six pixels
 * looks like a bug.
 */
export function wrapText(
  measurer: TextMeasurer,
  text: string,
  maxWidth: number,
): readonly string[] {
  const words = text.split(/\s+/).filter((word) => word !== '')
  if (words.length === 0) return []

  const lines: string[] = []
  let line = words[0] as string
  for (const word of words.slice(1)) {
    const candidate = `${line} ${word}`
    if (measurer.measureText(candidate).width <= maxWidth) {
      line = candidate
    } else {
      lines.push(line)
      line = word
    }
  }
  lines.push(line)
  return lines
}

/**
 * Draw the card, sizing the canvas to its content first.
 *
 * Height is measured rather than fixed because the number of differences
 * varies from none to several, and a fixed canvas either clips them or leaves
 * a pale gap under a one-line verdict.
 */
export function drawVerdictCard(canvas: HTMLCanvasElement, data: VerdictCardData): void {
  const context = canvas.getContext('2d')
  if (context === null) throw new Error('canvas 2d context unavailable')

  const palette = paletteFromDocument(data.statusKind)
  const inner = WIDTH - PADDING * 2

  // Measure before sizing: setting width or height clears the canvas.
  context.font = `500 34px ${FONT}`
  const differenceLines = data.differences.map((line) => wrapText(context, line, inner - 40))
  context.font = `30px ${FONT}`
  const noDifferenceLines =
    data.differences.length === 0 ? wrapText(context, data.noDifferences, inner) : []
  context.font = `600 44px ${FONT}`
  // Appliance names are user input with no length limit, so this wraps like
  // everything else. Drawn on one line it simply ran off a 1080-pixel canvas
  // and was clipped out of the exported image.
  const nameLines = wrapText(context, data.applianceName, inner)
  context.font = `600 56px ${FONT}`
  const headlineLines = wrapText(context, data.headline, inner)
  context.font = `28px ${FONT}`
  const disclaimerLines = wrapText(context, data.disclaimer, inner)

  let height = PADDING
  height += nameLines.length * 56 + 4 // appliance name
  height += 32 + 40 // type and date
  height += 72 + 24 // status pill
  height += headlineLines.length * 68 + 16
  height += 36 + 40 // confidence
  if (differenceLines.length > 0) {
    height += 44 + 12 // differences title
    for (const lines of differenceLines) height += lines.length * 46 + 14
    height += 28
  } else {
    height += noDifferenceLines.length * 42 + 28
  }
  height += 1 + 32 // hairline
  height += disclaimerLines.length * 38 + 28
  height += 34 // made-with
  height += PADDING

  canvas.width = WIDTH
  canvas.height = Math.round(height)

  const ctx = canvas.getContext('2d')
  if (ctx === null) throw new Error('canvas 2d context unavailable')
  ctx.textBaseline = 'alphabetic'

  ctx.fillStyle = palette.paper
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  let y = PADDING

  ctx.fillStyle = palette.ink
  ctx.font = `600 44px ${FONT}`
  for (const line of nameLines) {
    y += 56
    ctx.fillText(line, PADDING, y)
  }
  y += 4 + 32

  ctx.fillStyle = palette.inkFaint
  ctx.font = `28px ${FONT}`
  ctx.fillText(`${data.applianceType} · ${data.when}`, PADDING, y)
  y += 40

  // Status pill, in the same colours as the chip on screen.
  const pillHeight = 72
  ctx.font = `600 36px ${FONT}`
  const pillWidth = ctx.measureText(data.statusLabel).width + 64
  ctx.fillStyle = palette.statusSoft
  roundedRect(ctx, PADDING, y, pillWidth, pillHeight, pillHeight / 2)
  ctx.fill()
  ctx.fillStyle = palette.status
  ctx.fillText(data.statusLabel, PADDING + 32, y + 48)
  y += pillHeight + 24

  ctx.fillStyle = palette.ink
  ctx.font = `600 56px ${FONT}`
  for (const line of headlineLines) {
    y += 68
    ctx.fillText(line, PADDING, y)
  }
  y += 16

  ctx.fillStyle = palette.inkSoft
  ctx.font = `30px ${FONT}`
  y += 36
  ctx.fillText(data.confidence, PADDING, y)
  y += 40

  if (differenceLines.length > 0) {
    ctx.fillStyle = palette.ink
    ctx.font = `600 34px ${FONT}`
    y += 44
    ctx.fillText(data.differencesTitle, PADDING, y)
    y += 12

    ctx.font = `500 34px ${FONT}`
    for (const lines of differenceLines) {
      ctx.fillStyle = palette.status
      ctx.fillRect(PADDING, y + 14, 8, lines.length * 46 - 12)
      ctx.fillStyle = palette.inkSoft
      for (const line of lines) {
        y += 46
        ctx.fillText(line, PADDING + 40, y)
      }
      y += 14
    }
    y += 28
  } else {
    ctx.fillStyle = palette.inkSoft
    ctx.font = `30px ${FONT}`
    for (const line of noDifferenceLines) {
      y += 42
      ctx.fillText(line, PADDING, y)
    }
    y += 28
  }

  ctx.fillStyle = palette.hairline
  ctx.fillRect(PADDING, y, inner, 1)
  y += 1 + 32

  ctx.fillStyle = palette.inkFaint
  ctx.font = `28px ${FONT}`
  for (const line of disclaimerLines) {
    y += 38
    ctx.fillText(line, PADDING, y)
  }
  y += 28

  ctx.fillStyle = palette.inkFaint
  ctx.font = `600 26px ${FONT}`
  y += 34
  ctx.fillText(data.madeWith, PADDING, y)
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + width, y, x + width, y + height, radius)
  ctx.arcTo(x + width, y + height, x, y + height, radius)
  ctx.arcTo(x, y + height, x, y, radius)
  ctx.arcTo(x, y, x + width, y, radius)
  ctx.closePath()
}

/** Renders the card and hands back a PNG. */
export async function renderVerdictCard(data: VerdictCardData): Promise<Blob> {
  const canvas = document.createElement('canvas')
  drawVerdictCard(canvas, data)
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null) {
        reject(new Error('canvas produced no image'))
        return
      }
      resolve(blob)
    }, 'image/png')
  })
}
