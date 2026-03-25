-- Run this in the Supabase SQL Editor ONLY if you previously applied the old
-- auth-based migration and need a clean slate before applying 20250324120000_init.sql

drop trigger if exists on_auth_user_created_tags on auth.users;
drop function if exists public.handle_new_user_tags();

drop table if exists public.note_tags cascade;
drop table if exists public.notes cascade;
drop table if exists public.tags cascade;
drop table if exists public.projects cascade;

drop function if exists public.bump_project_from_note_tag();
drop function if exists public.bump_project_from_note();
drop function if exists public.set_updated_at();
