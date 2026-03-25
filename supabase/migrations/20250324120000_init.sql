-- Solo single-user app: no login. Use the Supabase anon key from your machine only.
-- RLS is OFF; anyone with the anon key can read/write — treat the key like a password.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  unique (name)
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null default '',
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.note_tags (
  note_id uuid not null references public.notes (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (note_id, tag_id)
);

create index notes_project_created_idx on public.notes (project_id, created_at desc);
create index note_tags_tag_id_idx on public.note_tags (tag_id);
create index projects_updated_idx on public.projects (updated_at desc);

-- ---------------------------------------------------------------------------
-- updated_at + last activity on project
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_set_updated_at
  before update on public.projects
  for each row
  execute function public.set_updated_at();

create trigger notes_set_updated_at
  before update on public.notes
  for each row
  execute function public.set_updated_at();

create or replace function public.bump_project_from_note()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    update public.projects set updated_at = now() where id = old.project_id;
    return old;
  elsif tg_op = 'UPDATE' then
    update public.projects set updated_at = now() where id = new.project_id;
    if old.project_id is distinct from new.project_id then
      update public.projects set updated_at = now() where id = old.project_id;
    end if;
    return new;
  else
    update public.projects set updated_at = now() where id = new.project_id;
    return new;
  end if;
end;
$$;

create trigger notes_bump_project
  after insert or update or delete on public.notes
  for each row
  execute function public.bump_project_from_note();

create or replace function public.bump_project_from_note_tag()
returns trigger
language plpgsql
as $$
declare
  pid uuid;
begin
  select n.project_id into pid
  from public.notes n
  where n.id = coalesce(new.note_id, old.note_id);
  if pid is not null then
    update public.projects set updated_at = now() where id = pid;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger note_tags_bump_project
  after insert or update or delete on public.note_tags
  for each row
  execute function public.bump_project_from_note_tag();

insert into public.tags (name) values ('task'), ('idea'), ('log')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- No RLS (solo client with anon key)
-- ---------------------------------------------------------------------------

alter table public.projects disable row level security;
alter table public.tags disable row level security;
alter table public.notes disable row level security;
alter table public.note_tags disable row level security;

grant usage on schema public to postgres, anon, authenticated, service_role;

grant select, insert, update, delete on public.projects to anon, authenticated;
grant select, insert, update, delete on public.tags to anon, authenticated;
grant select, insert, update, delete on public.notes to anon, authenticated;
grant select, insert, delete on public.note_tags to anon, authenticated;

grant all on public.projects to postgres, service_role;
grant all on public.tags to postgres, service_role;
grant all on public.notes to postgres, service_role;
grant all on public.note_tags to postgres, service_role;

grant usage on all sequences in schema public to anon, authenticated;
