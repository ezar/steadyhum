import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'

/**
 * Chromium's default fake microphone plays a tone, which the guards accept.
 * Some properties can only be seen on audio they reject, so those tests feed
 * it silence from a file instead.
 */
export const SILENCE_WAV = join(tmpdir(), 'steadyhum-e2e', 'silence.wav')

/** Use an environment-provided Chromium when there is one (CI images, sandboxes). */
export const executablePath = process.env['CHROMIUM_PATH']

/** The whole product is a microphone. Every e2e run needs a fake one. */
export const FAKE_MIC_ARGS = [
  '--use-fake-ui-for-media-stream',
  '--use-fake-device-for-media-stream',
  '--autoplay-policy=no-user-gesture-required',
]

/**
 * Write a few seconds of digital silence as 16-bit mono PCM.
 *
 * Generated rather than committed: it is half a megabyte of zeroes, and a
 * binary fixture nobody can read in a diff is worse than eight lines of code.
 */
export function writeSilenceFixture(): void {
  const sampleRate = 48_000
  const seconds = 5
  const samples = sampleRate * seconds
  const dataBytes = samples * 2
  const buffer = Buffer.alloc(44 + dataBytes)

  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataBytes, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16) // PCM header size
  buffer.writeUInt16LE(1, 20) // PCM, uncompressed
  buffer.writeUInt16LE(1, 22) // mono
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * 2, 28) // byte rate
  buffer.writeUInt16LE(2, 32) // block align
  buffer.writeUInt16LE(16, 34) // bits per sample
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataBytes, 40)
  // The samples themselves are already zero.

  mkdirSync(dirname(SILENCE_WAV), { recursive: true })
  writeFileSync(SILENCE_WAV, buffer)
}
