const tagStyles: Record<string, string> = {
  task: 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200',
  idea: 'bg-sky-100 text-sky-900 dark:bg-sky-950/60 dark:text-sky-200',
  log: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200',
}

export function TagBadge({ name }: { name: string }) {
  const cls =
    tagStyles[name] ??
    'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      #{name}
    </span>
  )
}
