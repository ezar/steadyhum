import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { Descriptor } from 'earshot'

import type { WatchEpisode } from '@/lib/watchEpisodes.ts'
import { EpisodeList } from './EpisodeList.tsx'

function descriptor(overrides: Partial<Descriptor> = {}): Descriptor {
  return {
    feature: 'spectralCentroidHz',
    label: 'spectral centroid',
    direction: 'higher',
    zScore: 6,
    value: 406,
    reference: 400,
    unit: 'Hz',
    text: 'Spectral centroid is brighter than usual, by 6 Hz.',
    ...overrides,
  }
}

function episode(overrides: Partial<WatchEpisode> = {}): WatchEpisode {
  return {
    startSeconds: 65,
    endSeconds: 140,
    peakScore: 0.9,
    status: 'anomalous',
    dominantStateId: 'state-0',
    fromDrift: false,
    descriptors: [],
    ...overrides,
  }
}

describe('EpisodeList', () => {
  it('says when the episode happened, in the language of the screen', () => {
    render(<EpisodeList episodes={[episode()]} emptyText="nada" />)
    // 1:05 to 2:20, and the status named — not a raw score or an English word.
    expect(screen.getByText(/1:05/)).toHaveTextContent('2:20')
    expect(screen.getByText(/1:05/)).toHaveTextContent('Distinto')
  })

  it('explains how it differed, in Spanish, worst first', () => {
    /*
     * earshot ships an English sentence on every descriptor. Rendering that
     * directly typechecks, passes any test that only asks whether something
     * appeared, and puts English on a Spanish screen.
     */
    const episodes = [
      episode({
        descriptors: [
          descriptor(),
          descriptor({ feature: 'level', direction: 'lower', zScore: -3 }),
        ],
      }),
    ]
    const { container } = render(<EpisodeList episodes={episodes} emptyText="nada" />)

    const sentences = [...container.querySelectorAll('li ul li')].map((node) => node.textContent)
    expect(sentences).toEqual([
      'El sonido es más agudo que de costumbre.',
      'Suena más flojo de lo normal.',
    ])
  })

  it('names drift as drift rather than as a status', () => {
    render(<EpisodeList episodes={[episode({ fromDrift: true })]} emptyText="nada" />)
    expect(screen.getByText(/deriva/)).toBeInTheDocument()
  })

  it('says nothing under an episode it cannot explain', () => {
    // The ordinary case: above normal, with no single feature far enough out
    // to be worth naming. The line about when it happened, and nothing else.
    const { container } = render(<EpisodeList episodes={[episode()]} emptyText="nada" />)
    expect(container.querySelectorAll('ul')).toHaveLength(1)
  })

  it("falls back to earshot's own words for a feature nothing here phrases", () => {
    // Better an English sentence about a real difference than silence about
    // it. earshot invents a descriptor per frequency band, so this will happen.
    const band = descriptor({
      feature: 'band2000Hz',
      text: 'The 2 kHz band is louder than usual, by 11 dB.',
    })
    render(<EpisodeList episodes={[episode({ descriptors: [band] })]} emptyText="nada" />)
    expect(screen.getByText(/2 kHz band/)).toBeInTheDocument()
  })

  it('shows the empty line it was given when there is nothing to list', () => {
    render(<EpisodeList episodes={[]} emptyText="Nada que reseñar por ahora." />)
    expect(screen.getByText('Nada que reseñar por ahora.')).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })
})
