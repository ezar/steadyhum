import { writeSilenceFixture } from './fake-audio.ts'

export default function globalSetup(): void {
  writeSilenceFixture()
}
