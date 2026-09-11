import { useEffect, useState } from 'react'

import { probeEngine } from './engine.ts'
import type { EngineAvailability } from './engine.ts'

/** Reports engine availability once per mount. Null while the probe is running. */
export function useEngineAvailability(): EngineAvailability | null {
  const [availability, setAvailability] = useState<EngineAvailability | null>(null)

  useEffect(() => {
    let cancelled = false
    void probeEngine().then((result) => {
      if (!cancelled) setAvailability(result)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return availability
}
