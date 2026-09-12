import { describe, expect, it } from 'vitest'

import { wrapText } from './verdictCard.ts'
import type { TextMeasurer } from './verdictCard.ts'

/** A measurer where every character is exactly ten units wide. */
const measurer: TextMeasurer = {
  font: '',
  measureText: (text: string) => ({ width: text.length * 10 }),
}

describe('wrapText', () => {
  it('keeps a line that fits on one line', () => {
    expect(wrapText(measurer, 'suena igual', 200)).toEqual(['suena igual'])
  })

  it('breaks at the last word that fits', () => {
    // 200 units is 20 characters.
    expect(wrapText(measurer, 'uno dos tres cuatro cinco', 200)).toEqual([
      'uno dos tres cuatro',
      'cinco',
    ])
  })

  it('lets a single over-long word overflow rather than hyphenating it', () => {
    // Appliance names are user input; splitting one mid-word looks like a bug.
    expect(wrapText(measurer, 'Electrodomesticoinmenso', 100)).toEqual(['Electrodomesticoinmenso'])
  })

  it('puts an over-long word on its own line without swallowing its neighbours', () => {
    expect(wrapText(measurer, 'la Electrodomesticoinmenso ya', 100)).toEqual([
      'la',
      'Electrodomesticoinmenso',
      'ya',
    ])
  })

  it('returns nothing for text with no words, rather than one empty line', () => {
    // An empty line would still reserve its height and open a gap in the card.
    expect(wrapText(measurer, '', 200)).toEqual([])
    expect(wrapText(measurer, '   ', 200)).toEqual([])
  })

  it('collapses the runs of whitespace a translated sentence can carry', () => {
    expect(wrapText(measurer, 'uno   dos', 200)).toEqual(['uno dos'])
  })
})
