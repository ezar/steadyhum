import { BrowserRouter, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'

import { AddAppliance } from './screens/AddAppliance.tsx'
import { ApplianceDetail } from './screens/ApplianceDetail.tsx'
import { Check } from './screens/Check.tsx'
import { Enroll } from './screens/Enroll.tsx'
import { Help } from './screens/Help.tsx'
import { Home } from './screens/Home.tsx'
import { NotFound } from './screens/NotFound.tsx'
import { Privacy } from './screens/Privacy.tsx'
import { Settings } from './screens/Settings.tsx'
import { Watch } from './screens/Watch.tsx'
import { Welcome } from './screens/Welcome.tsx'

export function App(): ReactNode {
  return (
    /*
     * The router has to know the subpath too.
     *
     * Vite's `base` fixes where assets are fetched from; it does nothing for
     * client-side routing. Without a basename the router compares the full
     * pathname `/steadyhum/` against routes declared from `/`, matches nothing
     * and renders the not-found screen — on a page whose assets all loaded fine.
     */
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/appliances/new" element={<AddAppliance />} />
        <Route path="/appliances/:applianceId" element={<ApplianceDetail />} />
        <Route path="/appliances/:applianceId/learn" element={<Enroll />} />
        <Route path="/appliances/:applianceId/check" element={<Check />} />
        <Route path="/appliances/:applianceId/watch" element={<Watch />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/help" element={<Help />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}
