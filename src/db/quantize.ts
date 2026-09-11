/**
 * Int8 quantization for YAMNet embeddings.
 *
 * A 1024-dimensional Float32 embedding is 4 KB; quantized it is 1 KB plus a
 * scale, which is what keeps a two hour watch session inside the storage budget
 * of section 7. The error this introduces is far below the within-state spread
 * the scorer works with.
 */

/** Largest magnitude an Int8 sample can hold. */
const INT8_MAX = 127

export interface QuantizedEmbedding {
  readonly values: Int8Array
  /** Multiply each value by this to recover the original scale. */
  readonly scale: number
}

export function quantizeEmbedding(embedding: Float32Array): QuantizedEmbedding {
  let peak = 0
  for (const value of embedding) {
    const magnitude = Math.abs(value)
    if (magnitude > peak) peak = magnitude
  }
  const scale = peak === 0 ? 1 : peak / INT8_MAX
  const values = new Int8Array(embedding.length)
  for (let i = 0; i < embedding.length; i += 1) {
    const value = embedding[i] ?? 0
    values[i] = Math.max(-INT8_MAX, Math.min(INT8_MAX, Math.round(value / scale)))
  }
  return { values, scale }
}

export function dequantizeEmbedding(quantized: QuantizedEmbedding): Float32Array {
  const { values, scale } = quantized
  const embedding = new Float32Array(values.length)
  for (let i = 0; i < values.length; i += 1) {
    embedding[i] = (values[i] ?? 0) * scale
  }
  return embedding
}
