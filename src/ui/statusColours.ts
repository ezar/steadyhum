import type { Status } from 'earshot'

/**
 * Status colours for the dark watch screen.
 *
 * Brighter than the light-theme chips: on a dark ground the soft tones the app
 * uses elsewhere disappear. One copy, shared by the big status word, the
 * timeline bars and the episode list, because three components showing the
 * same three states in slightly different greens is the sort of drift nobody
 * notices until a screenshot puts them side by side.
 */
export const DARK_STATUS_COLOUR: Readonly<Record<Status, string>> = {
  normal: '#5fae77',
  watch: '#d9a53f',
  anomalous: '#e0705a',
}
