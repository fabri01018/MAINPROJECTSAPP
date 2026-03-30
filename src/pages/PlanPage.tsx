import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Link } from 'react-router-dom'
import { useSupabase } from '../context/SupabaseContext'
import { formatDateTime } from '../lib/format'
import { one } from '../lib/embed'
import { Layout } from '../components/Layout'

type TagRow = { id: string; name: string }
type NoteTagRow = {
  tag_id: string
  tags: { id: string; name: string } | { id: string; name: string }[] | null
}
type PlanNote = {
  id: string
  project_id: string
  title: string
  content: string
  created_at: string
  updated_at: string
  note_tags: NoteTagRow[] | null
}

type PlanProject = {
  id: string
  name: string
  updated_at: string
}

function noteHasAnySelectedTag(note: PlanNote, selected: Set<string>): boolean {
  if (selected.size === 0) return false
  for (const nt of note.note_tags ?? []) {
    const id = one(nt.tags)?.id
    if (id && selected.has(id)) return true
  }
  return false
}

type NoteDraft = { title: string; content: string; tagIds: Set<string> }

function draftFromNote(n: PlanNote): NoteDraft {
  return {
    title: n.title ?? '',
    content: n.content,
    tagIds: new Set(
      (n.note_tags ?? [])
        .map((nt) => one(nt.tags)?.id)
        .filter((id): id is string => Boolean(id)),
    ),
  }
}

async function replaceNoteTags(
  supabase: SupabaseClient,
  noteId: string,
  tagIds: string[],
) {
  const { error: delErr } = await supabase
    .from('note_tags')
    .delete()
    .eq('note_id', noteId)
  if (delErr) throw delErr
  if (tagIds.length === 0) return
  const { error: insErr } = await supabase.from('note_tags').insert(
    tagIds.map((tag_id) => ({ note_id: noteId, tag_id })),
  )
  if (insErr) throw insErr
}

function TagToggle({
  tags: allTags,
  selected,
  onChange,
}: {
  tags: TagRow[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
}) {
  function toggle(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(next)
  }

  return (
    <fieldset className="flex flex-wrap gap-2">
      <legend className="mb-1 w-full text-xs font-medium text-slate-600 dark:text-slate-400">
        Tags
      </legend>
      {allTags.map((t) => (
        <label
          key={t.id}
          className="flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 px-2 py-1 text-sm dark:border-slate-700"
        >
          <input
            type="checkbox"
            checked={selected.has(t.id)}
            onChange={() => toggle(t.id)}
            className="rounded border-slate-400 text-violet-600 focus:ring-violet-500"
          />
          <span>#{t.name}</span>
        </label>
      ))}
    </fieldset>
  )
}

function NoteBlock({
  n,
  tags,
  supabase,
  onSaved,
  setError,
}: {
  n: PlanNote
  tags: TagRow[]
  supabase: SupabaseClient
  onSaved: () => void | Promise<void>
  setError: Dispatch<SetStateAction<string | null>>
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<NoteDraft>(() => draftFromNote(n))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDraft(draftFromNote(n))
  }, [n.id, n.updated_at])

  const displayTitle = draft.title.trim() ? draft.title : 'Untitled'
  const panelId = `plan-note-panel-${n.id}`
  const buttonId = `plan-note-btn-${n.id}`

  function resetDraft() {
    setDraft(draftFromNote(n))
  }

  async function saveNote(e: FormEvent) {
    e.preventDefault()
    const title = draft.title.trim()
    const content = draft.content.trim()
    setSaving(true)
    setError(null)
    const { error: upErr } = await supabase
      .from('notes')
      .update({ title, content })
      .eq('id', n.id)
    if (upErr) {
      setError(upErr.message)
      setSaving(false)
      return
    }
    try {
      await replaceNoteTags(supabase, n.id, [...draft.tagIds])
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save tags'
      setError(message)
      setSaving(false)
      return
    }
    setSaving(false)
    await onSaved()
  }

  async function deleteNote() {
    if (!confirm('Delete this note?')) return
    setError(null)
    const { error: delErr } = await supabase.from('notes').delete().eq('id', n.id)
    if (delErr) {
      setError(delErr.message)
      return
    }
    await onSaved()
  }

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <button
        type="button"
        id={buttonId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 rounded-lg text-left outline-none ring-violet-500 focus-visible:ring-2"
      >
        <span className="min-w-0 flex-1 text-lg font-semibold text-slate-900 dark:text-white">
          {displayTitle}
        </span>
        <span
          aria-hidden
          className={`mt-0.5 shrink-0 text-slate-400 transition-transform duration-200 dark:text-slate-500 ${
            open ? 'rotate-180' : ''
          }`}
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </button>
      {open ? (
        <div
          id={panelId}
          role="region"
          aria-labelledby={buttonId}
          className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800"
        >
          <form onSubmit={(e) => void saveNote(e)} className="flex flex-col gap-4">
            <div className="flex justify-end">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {formatDateTime(n.updated_at)}
              </span>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                Title
              </span>
              <input
                type="text"
                value={draft.title}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, title: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none ring-violet-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                Content
              </span>
              <textarea
                rows={6}
                value={draft.content}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, content: e.target.value }))
                }
                className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none ring-violet-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>
            <TagToggle
              tags={tags}
              selected={draft.tagIds}
              onChange={(next) => setDraft((d) => ({ ...d, tagIds: next }))}
            />
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                disabled={saving}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-600"
                onClick={() => resetDraft()}
              >
                Reset
              </button>
              <button
                type="button"
                disabled={saving}
                className="rounded-lg px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400"
                onClick={() => void deleteNote()}
              >
                Delete
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </li>
  )
}

export function PlanPage() {
  const supabase = useSupabase()
  const [projects, setProjects] = useState<PlanProject[]>([])
  const [tags, setTags] = useState<TagRow[]>([])
  const [notes, setNotes] = useState<PlanNote[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    await Promise.resolve()
    setError(null)

    const [projRes, tagsRes, notesRes] = await Promise.all([
      supabase
        .from('projects')
        .select('id, name, updated_at')
        .order('updated_at', { ascending: false }),
      supabase.from('tags').select('id, name').order('name'),
      supabase
        .from('notes')
        .select(
          `
          id,
          project_id,
          title,
          content,
          created_at,
          updated_at,
          note_tags (
            tag_id,
            tags ( id, name )
          )
        `,
        )
        .order('updated_at', { ascending: false }),
    ])

    if (projRes.error) setError(projRes.error.message)
    else setProjects((projRes.data ?? []) as PlanProject[])

    if (tagsRes.error) setError(tagsRes.error.message)
    else setTags((tagsRes.data ?? []) as TagRow[])

    if (notesRes.error) setError(notesRes.error.message)
    else setNotes((notesRes.data ?? []) as unknown as PlanNote[])

    setLoading(false)
  }, [supabase])

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(t)
  }, [load])

  const filteredNotes = useMemo(
    () => notes.filter((n) => noteHasAnySelectedTag(n, selectedTagIds)),
    [notes, selectedTagIds],
  )

  const notesByProjectId = useMemo(() => {
    const m = new Map<string, PlanNote[]>()
    for (const n of filteredNotes) {
      const list = m.get(n.project_id)
      if (list) list.push(n)
      else m.set(n.project_id, [n])
    }
    for (const list of m.values()) {
      list.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      )
    }
    return m
  }, [filteredNotes])

  function toggleTag(id: string) {
    setSelectedTagIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Plan
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Pick tags, then see matching notes under each project.{' '}
          <Link
            to="/"
            className="font-medium text-violet-600 hover:underline dark:text-violet-400"
          >
            Dashboard
          </Link>
        </p>
      </div>

      {error ? (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-slate-600 dark:text-slate-400">Loading…</p>
      ) : (
        <>
          <section className="mb-8 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">
              Filter notes by tags
            </h2>
            <p className="mb-3 text-xs text-slate-600 dark:text-slate-400">
              Select one or more tags. Notes that include{' '}
              <span className="font-medium text-slate-800 dark:text-slate-200">
                any
              </span>{' '}
              of them appear under the project they belong to.
            </p>
            {tags.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                No tags yet. Add tags on a project page.
              </p>
            ) : (
              <fieldset className="flex flex-wrap gap-2">
                <legend className="sr-only">Choose tags to filter notes</legend>
                {tags.map((t) => (
                  <label
                    key={t.id}
                    className="flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 px-2 py-1 text-sm dark:border-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTagIds.has(t.id)}
                      onChange={() => toggleTag(t.id)}
                      className="rounded border-slate-400 text-violet-600 focus:ring-violet-500"
                    />
                    <span>#{t.name}</span>
                  </label>
                ))}
              </fieldset>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              By project
            </h2>
            {projects.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                No projects yet.
              </p>
            ) : selectedTagIds.size === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Select at least one tag to see notes grouped under each project.
              </p>
            ) : filteredNotes.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                No notes match the selected tags.
              </p>
            ) : (
              <ul className="list-none flex flex-col gap-10">
                {projects.map((p) => {
                  const projectNotes = notesByProjectId.get(p.id) ?? []
                  if (projectNotes.length === 0) return null

                  return (
                    <li key={p.id}>
                      <div className="mb-3 border-b border-slate-200 pb-2 dark:border-slate-700">
                        <Link
                          to={`/project/${p.id}`}
                          className="text-lg font-semibold text-violet-600 hover:underline dark:text-violet-400"
                        >
                          {p.name}
                        </Link>
                        <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                          Last activity {formatDateTime(p.updated_at)}
                        </span>
                      </div>
                      <ul className="flex flex-col gap-4">
                        {projectNotes.map((n) => (
                          <NoteBlock
                            key={n.id}
                            n={n}
                            tags={tags}
                            supabase={supabase}
                            onSaved={() => void load()}
                            setError={setError}
                          />
                        ))}
                      </ul>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </Layout>
  )
}
