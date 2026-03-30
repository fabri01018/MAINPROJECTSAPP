import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import atmosphereImg from '../assets/app-atmosphere.png'

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 dark:border-slate-800">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
          <Link
            to="/"
            className="text-lg font-semibold tracking-tight text-violet-600 dark:text-violet-400"
          >
            Project Notes
          </Link>
          <div className="flex items-center gap-4">
            <Link
              to="/plan"
              className="text-sm font-medium text-slate-600 hover:text-violet-600 dark:text-slate-400 dark:hover:text-violet-400"
            >
              PLAN
            </Link>
            <Link
              to="/connect"
              className="text-sm font-medium text-slate-600 hover:text-violet-600 dark:text-slate-400 dark:hover:text-violet-400"
            >
              Supabase
            </Link>
          </div>
        </div>
      </header>
      <div
        className="relative h-28 w-full overflow-hidden sm:h-36"
        aria-hidden
      >
        <img
          src={atmosphereImg}
          alt=""
          className="h-full w-full object-cover object-[center_25%] opacity-[0.92] saturate-[0.85] dark:opacity-[0.75]"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-50/10 via-slate-50/40 to-slate-50 dark:from-slate-950/30 dark:via-slate-950/60 dark:to-slate-950" />
      </div>
      <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
    </div>
  )
}
