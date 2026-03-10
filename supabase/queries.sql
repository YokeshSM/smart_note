-- ============================================================
-- Smart Notes — Reference Queries
--
-- This file is documentation-grade SQL.  Every query is:
--   - Safe to run against the live database for read ops
--   - Parameterised with <placeholder> values for writes
--   - Annotated with the corresponding API or UI action
--
-- All queries respect RLS; they assume auth.uid() is set by
-- a valid Supabase session.
-- ============================================================


-- ============================================================
-- SECTION 1: PROFILES
-- ============================================================

-- [GET /users/me] Fetch the current user's profile
select id, email, name, avatar_url, plan, preferences, created_at, updated_at
from profiles
where id = auth.uid();

-- [PATCH /users/me] Update display name only
update profiles
set name = '<new_name>'
where id = auth.uid()
returning *;

-- [PATCH /users/me] Merge a settings key into preferences JSONB
-- (does not overwrite sibling keys)
update profiles
set preferences = preferences || '{"theme": "dark"}'::jsonb
where id = auth.uid()
returning preferences;

-- [GET /users/me/plan] Fetch plan limits for the user's current plan
select
  p.plan,
  pl.max_notes,
  pl.max_folders,
  pl.max_tags,
  pl.max_note_size_kb,
  pl.ai_search,
  pl.note_sharing
from profiles p
join plan_limits pl on pl.plan = p.plan
where p.id = auth.uid();


-- ============================================================
-- SECTION 2: NOTES — List & Filter
-- ============================================================

-- [GET /notes] List active notes, pinned first, newest updated first
-- Pair with LIMIT / OFFSET for pagination (frontend uses page × page_size).
select
  id, user_id, folder_id, title, content, format, is_pinned,
  created_at, updated_at
from notes
where user_id   = auth.uid()
  and deleted_at is null
order by is_pinned desc, updated_at desc
limit 20 offset 0;

-- [GET /notes?folder=<id>] Notes inside a specific folder
select *
from notes
where user_id   = auth.uid()
  and folder_id = '<folder_id>'
  and deleted_at is null
order by is_pinned desc, updated_at desc;

-- [GET /notes?folder=unfiled] Notes with no folder assignment
select *
from notes
where user_id   = auth.uid()
  and folder_id  is null
  and deleted_at is null
order by is_pinned desc, updated_at desc;

-- [GET /notes?pinned=true] Pinned notes only
select *
from notes
where user_id   = auth.uid()
  and is_pinned  = true
  and deleted_at is null
order by updated_at desc;

-- [GET /notes?tag=<id>] All notes with a specific tag
select n.*
from notes n
join note_tags nt on nt.note_id = n.id
where nt.tag_id    = '<tag_id>'
  and n.user_id    = auth.uid()
  and n.deleted_at is null
order by n.updated_at desc;

-- [GET /trash] Trash view — soft-deleted notes, most recently trashed first
select id, title, content, deleted_at, created_at, updated_at
from notes
where user_id    = auth.uid()
  and deleted_at is not null
order by deleted_at desc;


-- ============================================================
-- SECTION 3: NOTES — Full-Text Search
-- ============================================================

-- [GET /notes/search?q=<term>] Full-text search with relevance ranking
-- The websearch_to_tsquery function handles phrase search,
-- negation (-word), and OR operators naturally from user input.
select
  id, user_id, folder_id, title, content, is_pinned,
  created_at, updated_at,
  ts_rank(
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, '')),
    websearch_to_tsquery('english', '<search_term>')
  ) as rank
from notes
where user_id    = auth.uid()
  and deleted_at is null
  and to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''))
      @@ websearch_to_tsquery('english', '<search_term>')
order by rank desc, updated_at desc
limit 25;

-- [GET /notes/search?q=<term>&highlight=true]
-- Same as above but returns an HTML snippet with matched terms highlighted.
-- Useful for showing context in search result cards.
select
  id,
  ts_headline(
    'english',
    title,
    websearch_to_tsquery('english', '<search_term>'),
    'StartSel=<mark>, StopSel=</mark>, MaxWords=10, MinWords=5'
  ) as title_headline,
  ts_headline(
    'english',
    content,
    websearch_to_tsquery('english', '<search_term>'),
    'StartSel=<mark>, StopSel=</mark>, MaxWords=30, MinWords=15, MaxFragments=2'
  ) as content_headline,
  ts_rank(
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, '')),
    websearch_to_tsquery('english', '<search_term>')
  ) as rank,
  updated_at
from notes
where user_id    = auth.uid()
  and deleted_at is null
  and to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''))
      @@ websearch_to_tsquery('english', '<search_term>')
order by rank desc
limit 25;

-- [POST /notes/search/semantic] Semantic / AI similarity search
-- Requires migration 003.  The <query_vector> is produced by the
-- embedding model in the Edge Function and passed as a parameter.
select * from match_notes(
  query_embedding => '<query_vector>'::vector,
  match_threshold => 0.72,
  match_count     => 10
);


-- ============================================================
-- SECTION 4: NOTES — Get Single Note with Tags
-- ============================================================

-- [GET /notes/:id] Fetch a note and aggregate its tags as JSON
select
  n.id,
  n.user_id,
  n.folder_id,
  n.title,
  n.content,
  n.format,
  n.is_pinned,
  n.deleted_at,
  n.created_at,
  n.updated_at,
  coalesce(
    json_agg(
      json_build_object('id', t.id, 'name', t.name, 'color', t.color)
      order by t.name
    ) filter (where t.id is not null),
    '[]'::json
  ) as tags
from notes n
left join note_tags nt on nt.note_id = n.id
left join tags      t  on t.id       = nt.tag_id
where n.id      = '<note_id>'
  and n.user_id = auth.uid()
group by n.id;


-- ============================================================
-- SECTION 5: NOTES — CRUD Mutations
-- ============================================================

-- [POST /notes] Create a new note (minimal)
insert into notes (user_id, title, content, folder_id, format)
values (auth.uid(), 'Untitled Note', '', null, 'plaintext')
returning *;

-- [POST /notes] Create with all fields explicit
insert into notes (user_id, folder_id, title, content, format, is_pinned)
values (auth.uid(), '<folder_id>', 'My Note', '# Heading\n\nContent here', 'markdown', false)
returning *;

-- [PATCH /notes/:id] Update title and content
update notes
set title   = '<new_title>',
    content = '<new_content>'
where id      = '<note_id>'
  and user_id = auth.uid()
returning *;

-- [PATCH /notes/:id] Move to a different folder
update notes
set folder_id = '<new_folder_id>'
where id      = '<note_id>'
  and user_id = auth.uid()
returning id, folder_id, updated_at;

-- [PATCH /notes/:id] Remove from folder (make unfiled)
update notes
set folder_id = null
where id      = '<note_id>'
  and user_id = auth.uid();

-- [PATCH /notes/:id/pin] Toggle pin state
update notes
set is_pinned = not is_pinned
where id      = '<note_id>'
  and user_id = auth.uid()
returning id, is_pinned;

-- [PATCH /notes/:id] Soft-delete (move to trash)
update notes
set deleted_at = now()
where id      = '<note_id>'
  and user_id = auth.uid();

-- [PATCH /notes/:id/restore] Restore from trash
update notes
set deleted_at = null
where id      = '<note_id>'
  and user_id = auth.uid();

-- [DELETE /notes/:id] Permanently delete a single note
delete from notes
where id      = '<note_id>'
  and user_id = auth.uid();

-- [DELETE /trash] Empty trash — permanently delete all trashed notes
delete from notes
where user_id    = auth.uid()
  and deleted_at is not null;


-- ============================================================
-- SECTION 6: FOLDERS
-- ============================================================

-- [GET /folders] All folders with active note count, sorted by position then name
select
  f.id,
  f.user_id,
  f.parent_id,
  f.name,
  f.color,
  f.position,
  f.created_at,
  f.updated_at,
  count(n.id) as note_count
from folders f
left join notes n
  on n.folder_id = f.id
  and n.deleted_at is null
where f.user_id = auth.uid()
group by f.id
order by f.position, f.name;

-- [GET /folders/:id] Single folder with children and note count
select
  f.*,
  (
    select json_agg(json_build_object('id', c.id, 'name', c.name, 'color', c.color))
    from folders c
    where c.parent_id = f.id
  ) as children
from folders f
where f.id      = '<folder_id>'
  and f.user_id = auth.uid();

-- [POST /folders] Create a root folder
insert into folders (user_id, name, color)
values (auth.uid(), 'Work', '#6366f1')
returning *;

-- [POST /folders] Create a nested folder
insert into folders (user_id, parent_id, name, color)
values (auth.uid(), '<parent_folder_id>', 'Projects', '#10b981')
returning *;

-- [PATCH /folders/:id] Rename a folder
update folders
set name = '<new_name>'
where id      = '<folder_id>'
  and user_id = auth.uid()
returning *;

-- [PATCH /folders/:id] Change colour
update folders
set color = '<hex_color>'
where id      = '<folder_id>'
  and user_id = auth.uid()
returning id, color;

-- [PATCH /folders] Reorder — update position values in a single transaction
-- (Application sends array of {id, position} tuples; each row is one statement)
update folders set position = 0 where id = '<folder_id_1>' and user_id = auth.uid();
update folders set position = 1 where id = '<folder_id_2>' and user_id = auth.uid();
update folders set position = 2 where id = '<folder_id_3>' and user_id = auth.uid();

-- [DELETE /folders/:id] Delete folder; notes remain, become unfiled (ON DELETE SET NULL)
delete from folders
where id      = '<folder_id>'
  and user_id = auth.uid();


-- ============================================================
-- SECTION 7: TAGS
-- ============================================================

-- [GET /tags] All tags with usage count (only active/non-trashed notes)
select
  t.id,
  t.user_id,
  t.name,
  t.color,
  t.created_at,
  count(nt.note_id) as usage_count
from tags t
left join note_tags nt on nt.tag_id = t.id
left join notes     n  on n.id      = nt.note_id
  and n.deleted_at is null
where t.user_id = auth.uid()
group by t.id
order by t.name;

-- [POST /tags] Create a tag (case-insensitive uniqueness enforced by DB)
insert into tags (user_id, name, color)
values (auth.uid(), 'ideas', '#10b981')
returning *;

-- [PATCH /tags/:id] Rename a tag
update tags
set name = '<new_name>'
where id      = '<tag_id>'
  and user_id = auth.uid()
returning *;

-- [PATCH /tags/:id] Change colour
update tags
set color = '<hex_color>'
where id      = '<tag_id>'
  and user_id = auth.uid();

-- [DELETE /tags/:id] Delete tag; removes from all notes via cascade
delete from tags
where id      = '<tag_id>'
  and user_id = auth.uid();


-- ============================================================
-- SECTION 8: NOTE TAG ASSOCIATIONS
-- ============================================================

-- [POST /notes/:id/tags] Add a tag to a note
insert into note_tags (note_id, tag_id)
values ('<note_id>', '<tag_id>')
on conflict do nothing;

-- [DELETE /notes/:id/tags/:tag_id] Remove a tag from a note
delete from note_tags
where note_id = '<note_id>'
  and tag_id  = '<tag_id>';

-- [PUT /notes/:id/tags] Replace all tags for a note in one transaction
-- Step 1: remove all existing tags
delete from note_tags where note_id = '<note_id>';
-- Step 2: insert the new full set
insert into note_tags (note_id, tag_id)
select '<note_id>', unnest(array['<tag_id_1>', '<tag_id_2>']::uuid[]);


-- ============================================================
-- SECTION 9: SHARING
-- ============================================================

-- [POST /notes/:id/shares] Share a note with a specific user (viewer)
insert into note_shares (note_id, grantee_id, permission)
values ('<note_id>', '<grantee_user_id>', 'viewer')
returning *;

-- [POST /notes/:id/shares] Create a public shareable link (link-based, no grantee)
insert into note_shares (note_id, grantee_id, permission, expires_at)
values ('<note_id>', null, 'viewer', now() + interval '7 days')
returning share_token, expires_at;

-- [GET /notes/:id/shares] List all shares for a note (owner only)
select
  ns.id,
  ns.grantee_id,
  ns.permission,
  ns.share_token,
  ns.expires_at,
  ns.created_at,
  p.name  as grantee_name,
  p.email as grantee_email
from note_shares ns
left join profiles p on p.id = ns.grantee_id
where ns.note_id = '<note_id>';

-- [GET /shared-with-me] All notes explicitly shared with the current user
select
  n.id,
  n.title,
  n.content,
  n.updated_at,
  ns.permission,
  p.name  as owner_name
from note_shares ns
join notes    n on n.id = ns.note_id
join profiles p on p.id = n.user_id
where ns.grantee_id = auth.uid()
  and n.deleted_at   is null
  and (ns.expires_at is null or ns.expires_at > now())
order by n.updated_at desc;

-- [GET /notes/shared/:token] Resolve a shared note by its public token
-- (No auth required — this is the public link-sharing read path.)
select
  n.id,
  n.title,
  n.content,
  n.format,
  n.updated_at,
  ns.permission,
  ns.expires_at
from note_shares ns
join notes n on n.id = ns.note_id
where ns.share_token = '<share_token>'
  and n.deleted_at   is null
  and (ns.expires_at is null or ns.expires_at > now());

-- [PATCH /notes/:id/shares/:share_id] Upgrade permission to editor
update note_shares
set permission = 'editor'
where id      = '<share_id>'
  -- Only the note owner can change permissions; enforced by RLS policy.
returning *;

-- [DELETE /notes/:id/shares/:share_id] Revoke a share
delete from note_shares
where id = '<share_id>';

-- [DELETE /notes/:id/shares] Revoke all shares for a note
delete from note_shares
where note_id = '<note_id>';


-- ============================================================
-- SECTION 10: SUBSCRIPTIONS
-- ============================================================

-- [GET /billing] Fetch user's subscription status
select
  s.plan,
  s.status,
  s.billing_interval,
  s.current_period_end,
  s.trial_end,
  pl.max_notes,
  pl.max_folders,
  pl.ai_search,
  pl.note_sharing
from subscriptions s
join plan_limits pl on pl.plan = s.plan
where s.user_id = auth.uid();

-- [POST /billing/webhook] Upsert subscription from billing provider webhook
-- (Executed by the service role inside the webhook Edge Function)
insert into subscriptions (
  user_id, plan, stripe_customer_id, stripe_subscription_id,
  billing_interval, status, current_period_end, raw_data
)
values (
  '<user_id>',
  'pro',
  '<stripe_customer_id>',
  '<stripe_subscription_id>',
  'month',
  'active',
  '<period_end_timestamp>',
  '<raw_json>'::jsonb
)
on conflict (user_id) do update
  set
    plan                    = excluded.plan,
    stripe_subscription_id  = excluded.stripe_subscription_id,
    billing_interval        = excluded.billing_interval,
    status                  = excluded.status,
    current_period_end      = excluded.current_period_end,
    raw_data                = excluded.raw_data;


-- ============================================================
-- SECTION 11: DASHBOARD STATS (single-query aggregation)
-- ============================================================

-- [GET /dashboard] Summary counts for the sidebar / home screen
select
  (
    select count(*)
    from notes
    where user_id   = auth.uid()
      and deleted_at is null
  ) as total_notes,
  (
    select count(*)
    from notes
    where user_id   = auth.uid()
      and is_pinned  = true
      and deleted_at is null
  ) as pinned_notes,
  (
    select count(*)
    from notes
    where user_id    = auth.uid()
      and deleted_at is not null
  ) as trashed_notes,
  (
    select count(*)
    from folders
    where user_id = auth.uid()
  ) as total_folders,
  (
    select count(*)
    from tags
    where user_id = auth.uid()
  ) as total_tags,
  (
    select plan
    from profiles
    where id = auth.uid()
  ) as current_plan;


-- ============================================================
-- SECTION 12: AUDIT LOG
-- ============================================================

-- [GET /audit?limit=50] Recent audit events for the current user
select
  id,
  table_name,
  record_id,
  operation,
  old_values,
  new_values,
  occurred_at
from audit_log
where user_id = auth.uid()
order by occurred_at desc
limit 50;

-- [GET /audit?record=<note_id>] Full history for a specific note
select
  id,
  operation,
  old_values,
  new_values,
  occurred_at
from audit_log
where user_id    = auth.uid()
  and table_name = 'notes'
  and record_id  = '<note_id>'
order by occurred_at desc;


-- ============================================================
-- SECTION 13: ADMIN / ANALYTICS QUERIES
-- (Service-role only; never exposed to end users via RLS)
-- ============================================================

-- Total users by plan
select plan, count(*) as user_count
from profiles
group by plan
order by plan;

-- Daily new note creation over the last 30 days
select
  date_trunc('day', created_at) as day,
  count(*) as notes_created
from notes
where created_at >= now() - interval '30 days'
group by day
order by day;

-- Users approaching free plan note limit (>= 40 of 50 notes)
select
  p.id,
  p.email,
  p.plan,
  count(n.id) as note_count,
  pl.max_notes
from profiles p
join plan_limits pl on pl.plan = p.plan
join notes n on n.user_id = p.id and n.deleted_at is null
where p.plan = 'free'
group by p.id, p.email, p.plan, pl.max_notes
having count(n.id) >= 40
order by note_count desc;

-- Top active users by note count (last 7 days of activity)
select
  p.id,
  p.email,
  p.plan,
  count(n.id) as recent_notes
from profiles p
join notes n on n.user_id = p.id
where n.updated_at >= now() - interval '7 days'
  and n.deleted_at  is null
group by p.id, p.email, p.plan
order by recent_notes desc
limit 20;
