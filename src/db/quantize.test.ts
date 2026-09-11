import { describe, expect, it } from 'vitest'

import { dequantizeEmbedding, quantizeEmbedding } from './quantize.ts'

function randomEmbedding(length: number, seed: number): Float32Array {
  const values = new Float32Array(length)
  let state = seed
  for (let i = 0; i < length; i += 1) {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648
    values[i] = (state / 2_147_483_648) * 4 - 2
  }
  return values
}

describe('embedding quantization', () => {
  it('round-trips within the quantization step', () => {
    const original = randomEmbedding(1024, 7)
    const restored = dequantizeEmbedding(quantizeEmbedding(original))
    const peak = Math.max(...Array.from(original, Math.abs))
    const step = peak / 127
    for (let i = 0; i < original.length; i += 1) {
      expect(Math.abs((restored[i] ?? 0) - (original[i] ?? 0))).toBeLessThanOrEqual(step)
    }
  })

  it('keeps one byte per dimension', () => {
    const { values } = quantizeEmbedding(randomEmbedding(1024, 11))
    expect(values.byteLength).toBe(1024)
  })

  it('handles an all-zero embedding without dividing by zero', () => {
    const { values, scale } = quantizeEmbedding(new Float32Array(8))
    expect(scale).toBe(1)
    expect(Array.from(values)).toEqual([0, 0, 0, 0, 0, 0, 0, 0])
  })
})
