import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  clearStoredCredentials,
  loadStoredCredentials,
  saveStoredCredentials,
} from '../lib/credentialsStore'
import { clearSupabaseCache, hasCredentials } from '../lib/supabase'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../credentials'

type Props = {
  onSaved: () => void
}

function isValidHttpUrl(s: string) {
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export function ConnectPage({ onSaved }: Props) {
  const initial = loadStoredCredentials()
  const fileUrl = SUPABASE_URL.trim()
  const fileKey = SUPABASE_ANON_KEY.trim()
  const [url, setUrl] = useState(initial.url || fileUrl)
  const [anonKey, setAnonKey] = useState(initial.anonKey || fileKey)
  const [error, setError] = useState<string | null>(null)

  const showBack = hasCredentials()

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const u = url.trim()
    const k = anonKey.trim()
    if (!u || !k) {
      setError('Enter both the project URL and the anon key.')
      return
    }
    if (!isValidHttpUrl(u)) {
      setError('URL should look like https://xxxx.supabase.co')
      return
    }
    saveStoredCredentials(u, k)
    clearSupabaseCache()
    onSaved()
  }

  function handleClearSaved() {
    clearStoredCredentials()
    clearSupabaseCache()
    setUrl(fileUrl)
    setAnonKey(fileKey)
    setError(null)
    if (!fileUrl && !fileKey) {
      window.location.reload()
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
          Supabase
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Paste your project URL and anon public key from Supabase → Project
          settings → API. They are stored in this browser only.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Project URL
            </span>
            <input
              type="url"
              placeholder="https://xxxxx.supabase.co"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoComplete="off"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none ring-violet-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Anon public key
            </span>
            <textarea
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={anonKey}
              onChange={(e) => setAnonKey(e.target.value)}
              rows={4}
              autoComplete="off"
              className="resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 outline-none ring-violet-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : null}
          <button
            type="submit"
            className="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
          >
            Save and continue
          </button>
        </form>

        {showBack ? (
          <p className="mt-4 text-center text-sm">
            <Link
              to="/"
              className="font-medium text-violet-600 hover:underline dark:text-violet-400"
            >
              ← Back to app
            </Link>
          </p>
        ) : null}

        <p className="mt-6 border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          Optional: you can also paste credentials in{' '}
          <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">
            src/credentials.ts
          </code>{' '}
          (saved browser values override that file).{' '}
          <button
            type="button"
            className="font-medium text-violet-600 underline-offset-2 hover:underline dark:text-violet-400"
            onClick={handleClearSaved}
          >
            Clear saved browser credentials
          </button>
        </p>
      </div>
    </div>
  )
}
