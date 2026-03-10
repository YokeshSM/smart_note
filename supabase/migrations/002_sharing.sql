-- ============================================================
-- Smart Notes — Migration 002: Note Sharing
--
-- Adds the ability for a note owner to share individual notes
-- with other registered users via a permission-based model.
--
-- Tables created:
--   note_shares   — share grants between users
--
-- Depends on: 001_init.sql
-- ============================================================


-- ============================================================
-- NOTE_SHARES
--   An owner grants another user (grantee) a permission level
--   on a specific note.
--
--   permission values:
--     'viewer'  — read-only
--     'editor'  — can edit title and content; cannot delete
--
--   A share token (UUID) is also generated so notes can be
--   opened via a link without requiring the grantee to be
--   a registered user (link-sharing pattern).
-- ============================================================

create table if not exists note_shares (
  id            uuid        primary key default gen_random_uuid(),
  note_id       uuid        not null references notes(id) on delete cascade,

  -- NULL = link-based sharing (anyone with the token can view).
  -- Non-NULL = explicit user grant.
  grantee_id    uuid        references auth.users(id) on delete cascade,

  permission    text        not null default 'viewer'
                  check (permission in ('viewer', 'editor')),

  -- Opaque token used for shareable links; unique globally.
  share_token   uuid        not null default gen_random_uuid(),

  -- Optional expiry; NULL = never expires.
  expires_at    timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- A specific grantee may only have one share record per note.
  constraint note_shares_note_grantee_unique unique (note_id, grantee_id)
);

-- Look up a share record by its public token (link-sharing flow).
create unique index if not exists note_shares_token_idx
  on note_shares(share_token);

-- Reverse lookup: all notes shared with a specific user.
create index if not exists note_shares_grantee_idx
  on note_shares(grantee_id)
  where grantee_id is not null;

-- All shares for a given note (owner revocation list).
create index if not exists note_shares_note_id_idx
  on note_shares(note_id);

alter table note_shares enable row level security;

-- ── RLS Policies ─────────────────────────────────────────────────────────────

-- Note owners manage shares on their own notes.
create policy "note_shares: owner manage"
  on note_shares for all
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

-- Grantees can read their own share records (to check permission level).
create policy "note_shares: grantee read"
  on note_shares for select
  using (auth.uid() = grantee_id);

-- ── Shared note read access on notes table ───────────────────────────────────

-- Allow a grantee to SELECT a note that has been explicitly shared with them.
-- The existing "notes: owner all" policy already covers the owner.
-- We add a second SELECT policy here; Supabase RLS uses OR between policies.
create policy "notes: shared viewer read"
  on notes for select
  using (
    exists (
      select 1 from note_shares ns
      where ns.note_id   = id
        and ns.grantee_id = auth.uid()
        and (ns.expires_at is null or ns.expires_at > now())
    )
  );

-- Allow a grantee with 'editor' permission to UPDATE a shared note.
create policy "notes: shared editor update"
  on notes for update
  using (
    exists (
      select 1 from note_shares ns
      where ns.note_id    = id
        and ns.grantee_id  = auth.uid()
        and ns.permission  = 'editor'
        and (ns.expires_at is null or ns.expires_at > now())
    )
  )
  with check (
    exists (
      select 1 from note_shares ns
      where ns.note_id    = id
        and ns.grantee_id  = auth.uid()
        and ns.permission  = 'editor'
        and (ns.expires_at is null or ns.expires_at > now())
    )
  );

-- Updated-at trigger.
drop trigger if exists note_shares_updated_at on note_shares;
create trigger note_shares_updated_at
  before update on note_shares
  for each row execute function touch_updated_at();
