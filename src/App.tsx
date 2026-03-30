import { useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { SupabaseProvider } from './context/SupabaseContext'
import { clearSupabaseCache, hasCredentials } from './lib/supabase'
import { ConnectPage } from './pages/ConnectPage'
import { DashboardPage } from './pages/DashboardPage'
import { PlanPage } from './pages/PlanPage'
import { ProjectPage } from './pages/ProjectPage'

export default function App() {
  const [needsSetup, setNeedsSetup] = useState(() => !hasCredentials())

  if (needsSetup) {
    return (
      <ConnectPage
        onSaved={() => {
          clearSupabaseCache()
          setNeedsSetup(false)
        }}
      />
    )
  }

  return (
    <SupabaseProvider>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/plan" element={<PlanPage />} />
        <Route path="/project/:projectId" element={<ProjectPage />} />
        <Route
          path="/connect"
          element={
            <ConnectPage
              onSaved={() => {
                clearSupabaseCache()
                window.location.reload()
              }}
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SupabaseProvider>
  )
}
