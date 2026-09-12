import { describe, expect, it } from 'vitest'

import { formatDuration } from './format.ts'

describe('formatDuration', () => {
  it('shows minutes and seconds for a short session', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(7)).toBe('0:07')
    expect(formatDuration(67)).toBe('1:07')
  })

  it('adds hours only once there are any', () => {
    expect(formatDuration(3599)).toBe('59:59')
    expect(formatDuration(3600)).toBe('1:00:00')
    expect(formatDuration(7384)).toBe('2:03:04')
  })

  it('floors rather than rounds, so the clock never runs ahead of the audio', () => {
    expect(formatDuration(59.9)).toBe('0:59')
  })

  it('treats a negative elapsed time as zero rather than printing a minus', () => {
    expect(formatDuration(-5)).toBe('0:00')
  })
})
