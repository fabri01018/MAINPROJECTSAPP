import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../credentials'
import { loadStoredCredentials } from './credentialsStore'

function resolveCredentials(): { url: string; anonKey: string } | null {
  const stored = loadStoredCredentials()
  if (stored.url && stored.anonKey) return stored
  const u = SUPABASE_URL.trim()
  const k = SUPABASE_ANON_KEY.trim()
  if (u && k) return { url: u, anonKey: k }
  return null
}

export function hasCredentials(): boolean {
  return resolveCredentials() !== null
}

let cached: SupabaseClient | null = null
let cacheSig = ''

export function getSupabase(): SupabaseClient | null {
  const c = resolveCredentials()
  if (!c) {
    cached = null
    cacheSig = ''
    return null
  }
  const sig = `${c.url}\0${c.anonKey}`
  if (cached && sig === cacheSig) return cached
  cached = createClient(c.url, c.anonKey)
  cacheSig = sig
  return cached
}

export function clearSupabaseCache() {
  cached = null
  cacheSig = ''
}
