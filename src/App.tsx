import { BrowserRouter, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'

import { AddAppliance } from './screens/AddAppliance.tsx'
import { ApplianceDetail } from './screens/ApplianceDetail.tsx'
import { Check } from './screens/Check.tsx'
import { Enroll } from './screens/Enroll.tsx'
import { Home } from './screens/Home.tsx'
import { NotFound } from './screens/NotFound.tsx'
import { Privacy } from './screens/Privacy.tsx'
import { Settings } from './screens/Settings.tsx'

export function App(): ReactNode {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/appliances/new" element={<AddAppliance />} />
        <Route path="/appliances/:applianceId" element={<ApplianceDetail />} />
        <Route path="/appliances/:applianceId/learn" element={<Enroll />} />
        <Route path="/appliances/:applianceId/check" element={<Check />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}
