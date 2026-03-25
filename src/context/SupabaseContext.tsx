import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabase } from '../lib/supabase'

const SupabaseContext = createContext<SupabaseClient | null>(null)

export function SupabaseProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => getSupabase(), [])
  if (!client) {
    throw new Error('SupabaseProvider mounted without credentials')
  }
  return (
    <SupabaseContext.Provider value={client}>{children}</SupabaseContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSupabase() {
  const client = useContext(SupabaseContext)
  if (!client) {
    throw new Error('useSupabase must be used within SupabaseProvider')
  }
  return client
}
