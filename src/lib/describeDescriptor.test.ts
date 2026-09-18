import { describe, expect, it } from 'vitest'

import type { Descriptor } from 'earshot'

import { translate } from '@/i18n/messages.ts'
import { describeDescriptor, describeDetail, roundForDisplay } from './describeDescriptor.ts'

const t = ((key: never, vars?: never) => translate('es', key, vars)) as Parameters<
  typeof describeDescriptor
>[1]

function descriptor(overrides: Partial<Descriptor> = {}): Descriptor {
  return {
    feature: 'spectralFlatness',
    label: 'spectral flatness',
    direction: 'higher',
    zScore: 3,
    value: 0.0231,
    reference: 0.0104,
    unit: '',
    text: 'Spectral flatness is rougher than usual, by 0.01.',
    ...overrides,
  }
}

describe('describeDescriptor', () => {
  it('translates an octave band, keeping the frequency it names', () => {
    // A real check on a washing machine put earshot's English sentence about
    // the 4 kHz band on a Spanish screen. The frequency is the actionable part,
    // so the translation keeps it rather than rounding it into "los agudos".
    const sentence = describeDescriptor(descriptor({ feature: 'band4000Hz', unit: 'dB' }), t)
    expect(sentence).toBe('El sonido carga más en la zona aguda (4 kHz) que de costumbre.')
  })

  it('names the end of the spectrum a band sits in', () => {
    const zone = (feature: string): string =>
      describeDescriptor(descriptor({ feature, unit: 'dB' }), t)
    expect(zone('band63Hz')).toContain('zona grave (63 Hz)')
    expect(zone('band500Hz')).toContain('zona media (500 Hz)')
    expect(zone('band8000Hz')).toContain('zona aguda (8 kHz)')
  })

  it('says which way a band moved', () => {
    const quieter = describeDescriptor(
      descriptor({ feature: 'band4000Hz', direction: 'lower', unit: 'dB' }),
      t,
    )
    expect(quieter).toBe('El sonido carga menos en la zona aguda (4 kHz) que de costumbre.')
  })
})

describe('describeDetail', () => {
  it('keeps two significant digits on a value that would round to zero', () => {
    // "0.0 frente a 0.0 de costumbre" was on screen under a real verdict. It
    // reads as "nothing changed" under a sentence saying something did.
    expect(describeDetail(descriptor(), t)).toBe('0.023 frente a 0.010 de costumbre')
  })

  it('leaves no gap where a unitless feature has no unit', () => {
    expect(describeDetail(descriptor(), t)).not.toContain('  ')
  })

  it('keeps the unit when there is one', () => {
    const detail = describeDetail(
      descriptor({ feature: 'spectralCentroidHz', unit: 'Hz', value: 1308.4, reference: 1015.2 }),
      t,
    )
    expect(detail).toBe('1308 Hz frente a 1015 Hz de costumbre')
  })
})

describe('roundForDisplay', () => {
  it('drops decimals once the number is large enough not to need them', () => {
    expect(roundForDisplay(1308.4)).toBe('1308')
    expect(roundForDisplay(-27.14)).toBe('-27.1')
  })

  it('writes a plain zero rather than a precision-padded one', () => {
    expect(roundForDisplay(0)).toBe('0.0')
  })
})
