import { describe, expect, it } from 'vitest'

import { createUniformSample } from './uniformSample.ts'

/** Push `count` consecutive integers and return what was kept. */
function run(capacity: number, count: number): readonly number[] {
  const sample = createUniformSample<number>(capacity)
  for (let index = 0; index < count; index += 1) sample.push(index)
  return sample.items
}

/** Distance between consecutive kept items. */
function gaps(items: readonly number[]): number[] {
  return items.slice(1).map((item, index) => item - (items[index] as number))
}

describe('createUniformSample', () => {
  it('keeps everything while it fits', () => {
    expect(run(10, 10)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('never grows past its capacity, however long the stream runs', () => {
    for (const count of [11, 100, 7_500, 100_000]) {
      expect(run(10, count).length, `overflowed at ${count}`).toBeLessThanOrEqual(10)
    }
  })

  it('spreads the sample evenly across the whole stream', () => {
    /*
     * The point of the whole module, and it takes both halves to pin down.
     *
     * Even spacing alone is not it: a ring buffer keeps the last sixteen
     * items, whose spacing is a flawless 1, while describing only the last
     * minute of a two hour episode. Coverage alone is not it either: halving
     * the whole array on overflow spans the stream but leaves the old end
     * sampled coarsely and the new end densely, which is how a two-minute
     * blip at the end outvotes an hour of what came before.
     */
    for (const count of [37, 500, 7_500, 100_000]) {
      const items = run(16, count)
      const spacing = gaps(items)
      expect(new Set(spacing).size, `uneven spacing over ${count} items`).toBe(1)

      const stride = spacing[0] as number
      expect(items[0], `sample skips the start of ${count} items`).toBe(0)
      expect(
        (items.at(-1) as number) + stride,
        `sample stops short of the end of ${count} items`,
      ).toBeGreaterThanOrEqual(count - 1)
    }
  })

  it('stays in order', () => {
    const items = run(16, 5_000)
    expect([...items].sort((a, b) => a - b)).toEqual(items)
  })

  it('hands the sample back and starts afresh', () => {
    const sample = createUniformSample<number>(4)
    for (let index = 0; index < 50; index += 1) sample.push(index)

    const first = sample.take()
    expect(first.length).toBeGreaterThan(0)
    expect(sample.items).toEqual([])

    // Afresh means the stride resets too: a second episode of three windows is
    // three windows, not three windows thinned by the first episode's stride.
    sample.push(100)
    sample.push(101)
    sample.push(102)
    expect(sample.items).toEqual([100, 101, 102])
    // And the sample already handed out is not disturbed by what follows.
    expect(first[0]).toBe(0)
  })

  it('works at a capacity of one', () => {
    expect(run(1, 1_000)).toHaveLength(1)
  })

  it('refuses a capacity that cannot hold anything', () => {
    expect(() => createUniformSample(0)).toThrow(/positive integer/)
    expect(() => createUniformSample(2.5)).toThrow(/positive integer/)
  })
})
