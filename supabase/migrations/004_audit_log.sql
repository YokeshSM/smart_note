-- ============================================================
-- Smart Notes — Migration 004: Audit Log
--
-- Append-only log of destructive or security-relevant mutations.
-- Used for:
--   - Debugging ("who deleted this note?")
--   - Compliance ("show all data changes for user X")
--   - Abuse detection (server-side, via service role)
--
-- Tables created:
--   audit_log   — immutable event records
--
-- Design notes:
--   - Rows are INSERT-only; no UPDATE or DELETE allowed for any user.
--   - The service role writes audit entries via triggers.
--   - Users may read only their own audit rows.
--
-- Depends on: 001_init.sql
-- ============================================================


-- ============================================================
-- AUDIT_LOG
-- ============================================================

create table if not exists audit_log (
  id            bigint      primary key generated always as identity,
  user_id       uuid        not null references auth.users(id) on delete cascade,

  -- Which table was affected.
  table_name    text        not null,

  -- Which row was affected (UUID cast to text; covers all entity types).
  record_id     text        not null,

  -- Operation: 'INSERT' | 'UPDATE' | 'DELETE'
  operation     text        not null
                  check (operation in ('INSERT', 'UPDATE', 'DELETE')),

  -- JSON snapshot of old values (NULL for INSERT).
  old_values    jsonb,

  -- JSON snapshot of new values (NULL for DELETE).
  new_values    jsonb,

  -- IP address of the request, captured via app-level metadata if available.
  ip_address    inet,

  occurred_at   timestamptz not null default now()
);

-- Query patterns: all events for a user, or all events on a specific record.
create index if not exists audit_log_user_id_idx    on audit_log(user_id, occurred_at desc);
create index if not exists audit_log_record_id_idx  on audit_log(table_name, record_id);

alter table audit_log enable row level security;

-- Users can read their own audit rows; no writes at all for any user role.
create policy "audit_log: owner read"
  on audit_log for select
  using (auth.uid() = user_id);

-- Explicitly block user-level INSERT/UPDATE/DELETE.
-- The service-role (trigger function) bypasses RLS by design.


-- ============================================================
-- TRIGGER: log note deletes
--   Fires on hard-DELETE of a notes row (permanent delete or
--   empty-trash).  Captures the old row as JSONB.
--   Does NOT fire on soft-delete (UPDATE setting deleted_at).
-- ============================================================

create or replace function log_note_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into audit_log (user_id, table_name, record_id, operation, old_values)
  values (
    old.user_id,
    'notes',
    old.id::text,
    'DELETE',
    to_jsonb(old)
  );
  return old;
end;
$$;

drop trigger if exists notes_audit_delete on notes;
create trigger notes_audit_delete
  after delete on notes
  for each row execute function log_note_delete();


-- ============================================================
-- TRIGGER: log note soft-deletes and restores
--   Fires on UPDATE when deleted_at transitions between NULL
--   and non-NULL, capturing the intent (trash or restore).
-- ============================================================

create or replace function log_note_soft_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_operation text;
begin
  -- Determine the semantic operation from the transition.
  if old.deleted_at is null and new.deleted_at is not null then
    v_operation := 'SOFT_DELETE';
  elsif old.deleted_at is not null and new.deleted_at is null then
    v_operation := 'RESTORE';
  else
    -- Not a trash/restore transition; do nothing.
    return new;
  end if;

  insert into audit_log (user_id, table_name, record_id, operation, old_values, new_values)
  values (
    new.user_id,
    'notes',
    new.id::text,
    v_operation,
    jsonb_build_object('deleted_at', old.deleted_at),
    jsonb_build_object('deleted_at', new.deleted_at)
  );
  return new;
end;
$$;

drop trigger if exists notes_audit_soft_delete on notes;
create trigger notes_audit_soft_delete
  after update of deleted_at on notes
  for each row execute function log_note_soft_delete();


-- ============================================================
-- TRIGGER: log note_shares creation and deletion
-- ============================================================

create or replace function log_note_share()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  -- Resolve the owner of the note for the user_id column.
  select user_id into v_user_id from notes where id = coalesce(new.note_id, old.note_id);

  if tg_op = 'INSERT' then
    insert into audit_log (user_id, table_name, record_id, operation, new_values)
    values (v_user_id, 'note_shares', new.id::text, 'INSERT', to_jsonb(new));
  elsif tg_op = 'DELETE' then
    insert into audit_log (user_id, table_name, record_id, operation, old_values)
    values (v_user_id, 'note_shares', old.id::text, 'DELETE', to_jsonb(old));
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists note_shares_audit on note_shares;
create trigger note_shares_audit
  after insert or delete on note_shares
  for each row execute function log_note_share();
