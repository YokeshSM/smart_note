-- ============================================================
-- Smart Notes — Migration 001: Core Schema
-- Applies to: Supabase (PostgreSQL 15+)
--
-- Tables created:
--   profiles      — extends auth.users with app-level data
--   folders       — user-owned note containers
--   notes         — core content, soft-deletable
--   tags          — flat per-user labels
--   note_tags     — many-to-many junction
--
-- Run order: this file must be run first; it is idempotent.
-- ============================================================


-- ============================================================
-- EXTENSIONS
-- ============================================================

-- pgvector: enables AI embedding columns (used in migration 003).
-- Enabling here so the extension is available project-wide.
-- Safe to run even if vectors are added in a later migration.
create extension if not exists vector;


-- ============================================================
-- UTILITY FUNCTIONS
-- ============================================================

-- Reusable trigger function: stamp updated_at on every row mutation.
create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ============================================================
-- 1. PROFILES
--    One row per auth.users entry; created automatically by
--    the on_auth_user_created trigger on first Google sign-in.
-- ============================================================

create table if not exists profiles (
  id          uuid        primary key references auth.users(id) on delete cascade,
  email       text        not null,
  name        text,
  avatar_url  text,

  -- SaaS subscription tier; enforced at the application layer.
  -- Values: 'free' | 'pro' | 'team'
  plan        text        not null default 'free'
                check (plan in ('free', 'pro', 'team')),

  -- Soft preferences stored as JSONB so the schema stays stable
  -- as settings grow. Flutter app reads/writes individual keys.
  -- Example: { "theme": "dark", "default_font_size": 14 }
  preferences jsonb       not null default '{}',

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Index: direct lookup by id is the PK; this index covers email
-- lookups used during Google OAuth find-or-create.
create index if not exists profiles_email_idx on profiles(email);

alter table profiles enable row level security;

-- A user may only read and update their own row.
create policy "profiles: owner read"
  on profiles for select
  using (auth.uid() = id);

create policy "profiles: owner update"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Service-role inserts are handled by the trigger below; no user INSERT policy needed.

drop trigger if exists profiles_updated_at on profiles;
create trigger profiles_updated_at
  before update on profiles
  for each row execute function touch_updated_at();

-- Auto-create a profile row whenever a new user authenticates via Supabase Auth.
-- Runs as SECURITY DEFINER so it can insert even though public INSERT is blocked.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      new.email
    ),
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();


-- ============================================================
-- 2. FOLDERS
--    Users organise notes into named, colour-coded folders.
--    Supports one level of nesting via parent_id (NULL = root).
-- ============================================================

create table if not exists folders (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,

  -- Optional parent for nested folders (max 1 level deep enforced in app).
  parent_id   uuid        references folders(id) on delete set null,

  name        text        not null,
  color       text        not null default '#6366f1',
  position    integer     not null default 0,  -- display sort order

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint folders_name_length check (char_length(name) between 1 and 100),
  constraint folders_no_self_parent check (id <> parent_id)
);

create index if not exists folders_user_id_idx     on folders(user_id);
create index if not exists folders_parent_id_idx   on folders(parent_id) where parent_id is not null;

alter table folders enable row level security;

create policy "folders: owner all"
  on folders for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists folders_updated_at on folders;
create trigger folders_updated_at
  before update on folders
  for each row execute function touch_updated_at();


-- ============================================================
-- 3. NOTES
--    Core content entity.  Soft-deletable via deleted_at.
--    Belongs to one folder (nullable), one user (non-nullable).
-- ============================================================

create table if not exists notes (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  folder_id   uuid        references folders(id) on delete set null,

  title       text        not null default '',
  content     text        not null default '',

  -- Rich-text format hint so clients know how to render content.
  -- Values: 'plaintext' | 'markdown' | 'html'
  format      text        not null default 'plaintext'
                check (format in ('plaintext', 'markdown', 'html')),

  is_pinned   boolean     not null default false,

  -- Soft delete: non-NULL means the note is in trash.
  deleted_at  timestamptz,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

-- Primary list query: user's active notes, newest-updated first.
create index if not exists notes_user_updated_idx
  on notes(user_id, updated_at desc)
  where deleted_at is null;

-- Pin toggle query.
create index if not exists notes_user_pinned_idx
  on notes(user_id, is_pinned)
  where deleted_at is null;

-- Folder drill-down.
create index if not exists notes_folder_idx
  on notes(folder_id)
  where deleted_at is null;

-- Trash view: list soft-deleted notes, newest-deleted first.
create index if not exists notes_deleted_idx
  on notes(user_id, deleted_at desc)
  where deleted_at is not null;

-- Full-text search index: GIN over concatenated title + content.
-- tsvector is computed at index time; kept in sync by PostgreSQL.
create index if not exists notes_fts_idx
  on notes using gin(
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''))
  );

-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table notes enable row level security;

create policy "notes: owner all"
  on notes for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Triggers ─────────────────────────────────────────────────────────────────

drop trigger if exists notes_updated_at on notes;
create trigger notes_updated_at
  before update on notes
  for each row execute function touch_updated_at();


-- ============================================================
-- 4. TAGS
--    Flat per-user labels; names are unique within a user scope.
-- ============================================================

create table if not exists tags (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  name        text        not null,
  color       text        not null default '#6366f1',
  created_at  timestamptz not null default now(),

  constraint tags_name_length check (char_length(name) between 1 and 50),
  -- Case-insensitive uniqueness enforced via a partial unique index below.
  unique (user_id, name)
);

-- Case-insensitive uniqueness guard (separate from the exact-match UNIQUE above).
create unique index if not exists tags_user_name_lower_idx
  on tags(user_id, lower(name));

create index if not exists tags_user_id_idx on tags(user_id);

alter table tags enable row level security;

create policy "tags: owner all"
  on tags for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ============================================================
-- 5. NOTE_TAGS  (many-to-many junction)
--    Associates notes with tags.  Both FKs cascade on delete.
-- ============================================================

create table if not exists note_tags (
  note_id     uuid        not null references notes(id) on delete cascade,
  tag_id      uuid        not null references tags(id)  on delete cascade,
  primary key (note_id, tag_id)
);

-- Reverse index: "all notes with tag X" pattern.
create index if not exists note_tags_tag_id_idx on note_tags(tag_id);

alter table note_tags enable row level security;

-- Access is granted when the authenticated user owns the parent note.
-- Both SELECT and mutation check the same ownership condition.
create policy "note_tags: owner all"
  on note_tags for all
  using (
    exists (
      select 1 from notes n
      where n.id = note_id
        and n.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from notes n
      where n.id = note_id
        and n.user_id = auth.uid()
    )
  );
