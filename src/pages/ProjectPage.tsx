import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useSupabase } from '../context/SupabaseContext'
import { formatDateTime } from '../lib/format'
import { one } from '../lib/embed'
import { Layout } from '../components/Layout'

type TagRow = { id: string; name: string }
type NoteTagRow = {
  tag_id: string
  tags: { id: string; name: string } | { id: string; name: string }[] | null
}
type NoteRow = {
  id: string
  title: string
  content: string
  created_at: string
  updated_at: string
  note_tags: NoteTagRow[] | null
}

type ProjectRow = {
  id: string
  name: string
  updated_at: string
}

type NoteDraft = { title: string; content: string; tagIds: Set<string> }

function draftFromNote(n: NoteRow): NoteDraft {
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
  tags,
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
      {tags.map((t) => (
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

export function ProjectPage() {
  const supabase = useSupabase()
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<ProjectRow | null>(null)
  const [tags, setTags] = useState<TagRow[]>([])
  const [notes, setNotes] = useState<NoteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterTag, setFilterTag] = useState<string | null>(null)
  const [newTagName, setNewTagName] = useState('')
  const [savingTag, setSavingTag] = useState(false)
  const [deletingTagId, setDeletingTagId] = useState<string | null>(null)

  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newTagIds, setNewTagIds] = useState<Set<string>>(new Set())
  const [savingNew, setSavingNew] = useState(false)

  const [renameOpen, setRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState('')

  const [noteDrafts, setNoteDrafts] = useState<Record<string, NoteDraft>>({})
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null)

  useEffect(() => {
    const next: Record<string, NoteDraft> = {}
    for (const n of notes) {
      next[n.id] = draftFromNote(n)
    }
    setNoteDrafts(next)
  }, [notes])

  const load = useCallback(async () => {
    await Promise.resolve()
    if (!projectId) return
    setError(null)

    const [{ data: proj, error: pErr }, tagsRes, notesRes] = await Promise.all([
      supabase.from('projects').select('id, name, updated_at').eq('id', projectId).maybeSingle(),
      supabase.from('tags').select('id, name').order('name'),
      supabase
        .from('notes')
        .select(
          `
          id,
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
        .eq('project_id', projectId)
        .order('created_at', { ascending: false }),
    ])

    if (pErr) {
      setError(pErr.message)
      setProject(null)
      setNotes([])
      setLoading(false)
      return
    }
    if (!proj) {
      setProject(null)
      setNotes([])
      setLoading(false)
      return
    }

    setProject(proj as ProjectRow)
    if (tagsRes.error) setError(tagsRes.error.message)
    else setTags((tagsRes.data ?? []) as TagRow[])
    if (notesRes.error) setError(notesRes.error.message)
    else setNotes((notesRes.data ?? []) as unknown as NoteRow[])
    setLoading(false)
  }, [projectId, supabase])

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(t)
  }, [load])

  const filteredNotes = useMemo(() => {
    if (!filterTag) return notes
    return notes.filter((n) =>
      (n.note_tags ?? []).some((nt) => one(nt.tags)?.name === filterTag),
    )
  }, [notes, filterTag])

  async function handleCreateNote(e: FormEvent) {
    e.preventDefault()
    if (!projectId) return
    const content = newContent.trim()
    if (!content) return
    const title = newTitle.trim()
    setSavingNew(true)
    setError(null)
    const { data: note, error: insErr } = await supabase
      .from('notes')
      .insert({ project_id: projectId, title, content })
      .select('id')
      .single()
    if (insErr) {
      setError(insErr.message)
      setSavingNew(false)
      return
    }
    try {
      await replaceNoteTags(supabase, note.id, [...newTagIds])
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save tags'
      setError(message)
      setSavingNew(false)
      return
    }
    setNewTitle('')
    setNewContent('')
    setNewTagIds(new Set())
    setSavingNew(false)
    await load()
  }

  function draftFor(n: NoteRow): NoteDraft {
    return noteDrafts[n.id] ?? draftFromNote(n)
  }

  function setDraftFor(
    n: NoteRow,
    updater: (prev: NoteDraft) => NoteDraft,
  ) {
    setNoteDrafts((prev) => {
      const cur = prev[n.id] ?? draftFromNote(n)
      return { ...prev, [n.id]: updater(cur) }
    })
  }

  function resetNoteDraft(n: NoteRow) {
    setNoteDrafts((prev) => ({
      ...prev,
      [n.id]: draftFromNote(n),
    }))
  }

  async function saveNote(noteId: string) {
    const n = notes.find((x) => x.id === noteId)
    if (!n) return
    const d = draftFor(n)
    setSavingNoteId(noteId)
    setError(null)
    const title = d.title.trim()
    const content = d.content.trim()
    const { error: upErr } = await supabase
      .from('notes')
      .update({ title, content })
      .eq('id', noteId)
    if (upErr) {
      setError(upErr.message)
      setSavingNoteId(null)
      return
    }
    try {
      await replaceNoteTags(supabase, noteId, [...d.tagIds])
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save tags'
      setError(message)
      setSavingNoteId(null)
      return
    }
    setSavingNoteId(null)
    await load()
  }

  async function deleteNote(id: string) {
    if (!confirm('Delete this note?')) return
    const { error: delErr } = await supabase.from('notes').delete().eq('id', id)
    if (delErr) {
      setError(delErr.message)
      return
    }
    await load()
  }

  async function saveRename() {
    if (!projectId) return
    const name = renameValue.trim()
    if (!name) return
    const { error: err } = await supabase
      .from('projects')
      .update({ name })
      .eq('id', projectId)
    if (err) {
      setError(err.message)
      return
    }
    setRenameOpen(false)
    await load()
  }

  async function handleCreateTag(e: FormEvent) {
    e.preventDefault()
    const name = newTagName.trim()
    if (!name) return
    setSavingTag(true)
    setError(null)
    const { error: insErr } = await supabase.from('tags').insert({ name })
    setSavingTag(false)
    if (insErr) {
      if (insErr.code === '23505') {
        setError('A tag with that name already exists.')
      } else {
        setError(insErr.message)
      }
      return
    }
    setNewTagName('')
    await load()
  }

  async function handleDeleteTag(t: TagRow) {
    if (
      !confirm(
        `Delete tag #${t.name}? It will be removed from every note that uses it.`,
      )
    ) {
      return
    }
    setDeletingTagId(t.id)
    setError(null)
    const { error: delErr } = await supabase.from('tags').delete().eq('id', t.id)
    setDeletingTagId(null)
    if (delErr) {
      setError(delErr.message)
      return
    }
    if (filterTag === t.name) setFilterTag(null)
    setNewTagIds((prev) => {
      const next = new Set(prev)
      next.delete(t.id)
      return next
    })
    setNoteDrafts((prev) => {
      const next: Record<string, NoteDraft> = { ...prev }
      for (const id of Object.keys(next)) {
        const d = next[id]
        if (!d.tagIds.has(t.id)) continue
        const tagIds = new Set(d.tagIds)
        tagIds.delete(t.id)
        next[id] = { ...d, tagIds }
      }
      return next
    })
    await load()
  }

  async function deleteProject() {
    if (!projectId) return
    if (!confirm('Delete this project and all notes?')) return
    const { error: err } = await supabase.from('projects').delete().eq('id', projectId)
    if (err) {
      setError(err.message)
      return
    }
    navigate('/')
  }

  if (!projectId) {
    return (
      <Layout>
        <p className="text-slate-600 dark:text-slate-400">Invalid project.</p>
      </Layout>
    )
  }

  if (!loading && !project) {
    return (
      <Layout>
        <p className="text-slate-600 dark:text-slate-400">Project not found.</p>
        <Link to="/" className="mt-4 inline-block text-violet-600 dark:text-violet-400">
          ← Back to dashboard
        </Link>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="mb-6">
        <Link
          to="/"
          className="text-sm font-medium text-violet-600 hover:underline dark:text-violet-400"
        >
          ← Dashboard
        </Link>
        {project ? (
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            {renameOpen ? (
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="min-w-[12rem] rounded-lg border border-slate-300 px-3 py-2 text-lg font-semibold text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void saveRename()
                    if (e.key === 'Escape') setRenameOpen(false)
                  }}
                />
                <button
                  type="button"
                  className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white"
                  onClick={() => void saveRename()}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600"
                  onClick={() => setRenameOpen(false)}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                  {project.name}
                </h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Last activity {formatDateTime(project.updated_at)}
                </p>
              </div>
            )}
            {!renameOpen ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium dark:border-slate-600"
                  onClick={() => {
                    setRenameOpen(true)
                    setRenameValue(project.name)
                  }}
                >
                  Rename
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 dark:border-red-900 dark:text-red-300"
                  onClick={() => void deleteProject()}
                >
                  Delete project
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
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
            <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
              New note
            </h2>
            <form onSubmit={handleCreateNote} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Title
                </span>
                <input
                  type="text"
                  placeholder="Optional"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none ring-violet-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
              <textarea
                required
                rows={4}
                placeholder="Write a note…"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none ring-violet-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
              />
              <TagToggle
                tags={tags}
                selected={newTagIds}
                onChange={setNewTagIds}
              />
              <button
                type="submit"
                disabled={savingNew || !newContent.trim()}
                className="self-start rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {savingNew ? 'Saving…' : 'Add note'}
              </button>
            </form>
          </section>

          <section>
            <form
              onSubmit={handleCreateTag}
              className="mb-4 flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-950/50 sm:flex-row sm:flex-wrap sm:items-end sm:gap-3"
            >
              <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  New tag
                </span>
                <input
                  type="text"
                  placeholder="e.g. bug, follow-up"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none ring-violet-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
              <button
                type="submit"
                disabled={savingTag || !newTagName.trim()}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {savingTag ? 'Adding…' : 'Add tag'}
              </button>
            </form>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Filter:
              </span>
              <button
                type="button"
                onClick={() => setFilterTag(null)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  filterTag === null
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
                }`}
              >
                All
              </button>
              {tags.map((t) => (
                <span
                  key={t.id}
                  className="inline-flex items-center gap-0.5 rounded-full border border-slate-200 bg-slate-50 pl-0.5 dark:border-slate-700 dark:bg-slate-900/80"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setFilterTag((prev) => (prev === t.name ? null : t.name))
                    }
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      filterTag === t.name
                        ? 'bg-violet-600 text-white'
                        : 'text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    #{t.name}
                  </button>
                  <button
                    type="button"
                    title={`Delete tag #${t.name}`}
                    disabled={deletingTagId === t.id}
                    onClick={() => void handleDeleteTag(t)}
                    className="mr-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/50"
                  >
                    {deletingTagId === t.id ? '…' : '×'}
                  </button>
                </span>
              ))}
            </div>

            <ul className="flex flex-col gap-4">
              {filteredNotes.length === 0 ? (
                <li className="text-sm text-slate-600 dark:text-slate-400">
                  {filterTag
                    ? `No notes tagged #${filterTag}.`
                    : 'No notes yet.'}
                </li>
              ) : (
                filteredNotes.map((n) => {
                  const d = draftFor(n)
                  const saving = savingNoteId === n.id
                  return (
                    <li
                      key={n.id}
                      className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="flex flex-col gap-3">
                        <label className="flex flex-col gap-1 text-sm">
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            Title
                          </span>
                          <input
                            type="text"
                            placeholder="Optional"
                            value={d.title}
                            onChange={(e) =>
                              setDraftFor(n, (prev) => ({
                                ...prev,
                                title: e.target.value,
                              }))
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                          />
                        </label>
                        <textarea
                          rows={4}
                          value={d.content}
                          onChange={(e) =>
                            setDraftFor(n, (prev) => ({
                              ...prev,
                              content: e.target.value,
                            }))
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                        />
                        <TagToggle
                          tags={tags}
                          selected={d.tagIds}
                          onChange={(next) =>
                            setDraftFor(n, (prev) => ({ ...prev, tagIds: next }))
                          }
                        />
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                          <span>{formatDateTime(n.created_at)}</span>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white"
                              onClick={() => void saveNote(n.id)}
                              disabled={saving}
                            >
                              {saving ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600"
                              onClick={() => resetNoteDraft(n)}
                              disabled={saving}
                            >
                              Reset
                            </button>
                            <button
                              type="button"
                              className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400"
                              onClick={() => void deleteNote(n.id)}
                              disabled={saving}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  )
                })
              )}
            </ul>
          </section>
        </>
      )}
    </Layout>
  )
}
