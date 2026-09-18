/**
 * A bounded sample of an unbounded stream, spread evenly across all of it.
 *
 * An episode in a watch session can last hours, and the thing computed from it
 * — the mean of each feature — must describe the whole episode rather than
 * whichever end happened to survive. A ring buffer keeps the last N and says
 * "the compressor got louder" about the final minute of a two-hour episode; a
 * take-the-first-N keeps the opening and never notices the change at all.
 *
 * So this keeps every k-th item, doubling k whenever the sample outgrows its
 * capacity. The kept indices are always the multiples of the current stride,
 * which is what makes the halving exact: the multiples of 2k are precisely
 * every other multiple of k, so no item is ever kept out of turn and the
 * spacing stays uniform from the first item to the last.
 */
export interface UniformSample<T> {
  push: (item: T) => void
  /** The sample so far, oldest first. */
  readonly items: readonly T[]
  /** Hand back the sample and start afresh. */
  take: () => readonly T[]
}

export function createUniformSample<T>(capacity: number): UniformSample<T> {
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new Error(`capacity must be a positive integer, got ${capacity}`)
  }

  let kept: T[] = []
  /** Items pushed so far; the next one is item number `count`. */
  let count = 0
  /** Only items whose index is a multiple of this are kept. */
  let stride = 1

  return {
    push(item: T): void {
      if (count % stride === 0) kept.push(item)
      count += 1

      if (kept.length > capacity) {
        kept = kept.filter((_, index) => index % 2 === 0)
        stride *= 2
      }
    },
    get items(): readonly T[] {
      return kept
    },
    take(): readonly T[] {
      const taken = kept
      kept = []
      count = 0
      stride = 1
      return taken
    },
  }
}
