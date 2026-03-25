-- Optional note title (empty string when unset).
alter table public.notes
  add column if not exists title text not null default '';
