const URL_KEY = 'pm_supabase_url'
const ANON_KEY = 'pm_supabase_anon_key'

export function loadStoredCredentials(): { url: string; anonKey: string } {
  return {
    url: localStorage.getItem(URL_KEY) ?? '',
    anonKey: localStorage.getItem(ANON_KEY) ?? '',
  }
}

export function saveStoredCredentials(url: string, anonKey: string) {
  localStorage.setItem(URL_KEY, url.trim())
  localStorage.setItem(ANON_KEY, anonKey.trim())
}

export function clearStoredCredentials() {
  localStorage.removeItem(URL_KEY)
  localStorage.removeItem(ANON_KEY)
}
