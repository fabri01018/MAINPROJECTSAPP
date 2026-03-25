import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useSupabase } from '../context/SupabaseContext'
import { formatDateTime } from '../lib/format'
import { one } from '../lib/embed'
import { Layout } from '../components/Layout'

type NoteTagRow = { tags: { name: string } | { name: string }[] | null }
type DashboardNote = {
  id: string
  note_tags: NoteTagRow[] | null
}

type DashboardProject = {
  id: string
  name: string
  created_at: string
  updated_at: string
  notes: DashboardNote[] | null
}

function tagCountsFromNotes(notes: DashboardNote[] | null): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const n of notes ?? []) {
    for (const nt of n.note_tags ?? []) {
      const name = one(nt.tags)?.name
      if (!name) continue
      counts[name] = (counts[name] ?? 0) + 1
    }
  }
  return counts
}

export function DashboardPage() {
  const supabase = useSupabase()
  const [projects, setProjects] = useState<DashboardProject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const load = useCallback(async () => {
    await Promise.resolve()
    setError(null)
    const { data, error: err } = await supabase
      .from('projects')
      .select(
        `
        id,
        name,
        created_at,
        updated_at,
        notes (
          id,
          note_tags (
            tags ( name )
          )
        )
      `,
      )
      .order('updated_at', { ascending: false })

    if (err) {
      setError(err.message)
      setProjects([])
    } else {
      setProjects((data ?? []) as unknown as DashboardProject[])
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(t)
  }, [load])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setCreating(true)
    const { error: err } = await supabase.from('projects').insert({ name })
    setCreating(false)
    if (err) {
      setError(err.message)
      return
    }
    setNewName('')
    await load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this project and all of its notes?')) return
    const { error: err } = await supabase.from('projects').delete().eq('id', id)
    if (err) {
      setError(err.message)
      return
    }
    await load()
  }

  async function saveRename(id: string) {
    const name = renameValue.trim()
    if (!name) return
    const { error: err } = await supabase
      .from('projects')
      .update({ name })
      .eq('id', id)
    if (err) {
      setError(err.message)
      return
    }
    setRenameId(null)
    await load()
  }

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          All projects, last activity, and tag summaries.
        </p>
      </div>

      <form
        onSubmit={handleCreate}
        className="mb-8 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-end"
      >
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-300">
            New project
          </span>
          <input
            type="text"
            placeholder="Project name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none ring-violet-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>
        <button
          type="submit"
          disabled={creating || !newName.trim()}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {creating ? 'Creating…' : 'Create'}
        </button>
      </form>

      {error ? (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-slate-600 dark:text-slate-400">Loading projects…</p>
      ) : projects.length === 0 ? (
        <p className="text-slate-600 dark:text-slate-400">
          No projects yet. Create one above.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {projects.map((p) => {
            const counts = tagCountsFromNotes(p.notes)
            const totalNotes = p.notes?.length ?? 0
            const summary = Object.entries(counts)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([name, n]) => `${name}: ${n}`)
              .join(' · ')

            return (
              <li
                key={p.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {renameId === p.id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          className="min-w-[12rem] rounded-lg border border-slate-300 px-2 py-1 text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void saveRename(p.id)
                            if (e.key === 'Escape') setRenameId(null)
                          }}
                        />
                        <button
                          type="button"
                          className="text-sm font-medium text-violet-600 dark:text-violet-400"
                          onClick={() => void saveRename(p.id)}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="text-sm text-slate-600 dark:text-slate-400"
                          onClick={() => setRenameId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <Link
                        to={`/project/${p.id}`}
                        className="text-lg font-medium text-violet-600 hover:underline dark:text-violet-400"
                      >
                        {p.name}
                      </Link>
                    )}
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Last activity {formatDateTime(p.updated_at)}
                    </p>
                    <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                      <span className="font-medium text-slate-900 dark:text-white">
                        {totalNotes}
                      </span>{' '}
                      {totalNotes === 1 ? 'note' : 'notes'}
                      {summary ? (
                        <>
                          {' '}
                          · {summary}
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                      onClick={() => {
                        setRenameId(p.id)
                        setRenameValue(p.name)
                      }}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
                      onClick={() => void handleDelete(p.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Layout>
  )
}
