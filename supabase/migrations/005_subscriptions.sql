-- ============================================================
-- Smart Notes — Migration 005: Subscription & Entitlements
--
-- Tracks SaaS subscription state and enforces plan-based limits
-- at the database layer via CHECK constraints and helper functions.
--
-- Tables created:
--   subscriptions       — one active subscription per user
--   subscription_events — immutable billing event log
--
-- Helper functions:
--   get_user_plan()           — returns the user's current plan
--   check_note_quota()        — enforces per-plan note limits
--   check_folder_quota()      — enforces per-plan folder limits
--
-- Depends on: 001_init.sql (profiles table)
-- ============================================================


-- ============================================================
-- SUBSCRIPTIONS
--   Mirrors the authoritative state from your billing provider
--   (Stripe, RevenueCat, etc.).  One row per user; upserted by
--   a webhook Edge Function whenever a subscription event fires.
-- ============================================================

create table if not exists subscriptions (
  id                  uuid        primary key default gen_random_uuid(),
  user_id             uuid        not null unique references auth.users(id) on delete cascade,

  -- Plan identifier, kept in sync with profiles.plan.
  plan                text        not null default 'free'
                        check (plan in ('free', 'pro', 'team')),

  -- Billing provider's own subscription/customer identifiers.
  stripe_customer_id      text    unique,
  stripe_subscription_id  text    unique,

  -- Current billing-cycle interval.
  billing_interval    text        check (billing_interval in ('month', 'year')),

  -- Lifecycle state from the billing provider.
  status              text        not null default 'active'
                        check (status in (
                          'active',
                          'trialing',
                          'past_due',
                          'canceled',
                          'unpaid',
                          'incomplete'
                        )),

  -- When the current paid period ends (NULL for free plan).
  current_period_end  timestamptz,
  trial_end           timestamptz,

  -- Raw event payload from the last webhook; useful for debugging.
  raw_data            jsonb,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists subscriptions_user_id_idx on subscriptions(user_id);
create index if not exists subscriptions_stripe_customer_idx
  on subscriptions(stripe_customer_id)
  where stripe_customer_id is not null;

alter table subscriptions enable row level security;

-- Users may read their own subscription row.
create policy "subscriptions: owner read"
  on subscriptions for select
  using (auth.uid() = user_id);

-- All writes come from the service role (webhook Edge Function); no user write policy.

drop trigger if exists subscriptions_updated_at on subscriptions;
create trigger subscriptions_updated_at
  before update on subscriptions
  for each row execute function touch_updated_at();

-- Keep profiles.plan in sync whenever a subscription row changes.
create or replace function sync_plan_to_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update profiles
  set plan = new.plan
  where id = new.user_id;
  return new;
end;
$$;

drop trigger if exists subscriptions_sync_plan on subscriptions;
create trigger subscriptions_sync_plan
  after insert or update of plan on subscriptions
  for each row execute function sync_plan_to_profile();


-- ============================================================
-- SUBSCRIPTION_EVENTS
--   Immutable log of every billing event received from the
--   payment provider.  Never updated or deleted.
-- ============================================================

create table if not exists subscription_events (
  id              bigint      primary key generated always as identity,
  user_id         uuid        not null references auth.users(id) on delete cascade,

  -- Stripe event type, e.g. 'customer.subscription.updated'
  event_type      text        not null,

  -- Full raw JSON from the webhook payload.
  payload         jsonb       not null,

  -- Idempotency key: Stripe event ID or equivalent.
  provider_event_id  text     unique,

  occurred_at     timestamptz not null default now()
);

create index if not exists subscription_events_user_id_idx
  on subscription_events(user_id, occurred_at desc);

alter table subscription_events enable row level security;

create policy "subscription_events: owner read"
  on subscription_events for select
  using (auth.uid() = user_id);


-- ============================================================
-- PLAN LIMITS (reference table, not user data)
--   Single source of truth for per-plan quotas.
--   Rows are managed by the engineering team, not users.
-- ============================================================

create table if not exists plan_limits (
  plan            text    primary key check (plan in ('free', 'pro', 'team')),
  max_notes       integer not null,   -- -1 = unlimited
  max_folders     integer not null,
  max_tags        integer not null,
  max_note_size_kb integer not null,  -- max content length in KB
  ai_search       boolean not null default false,
  note_sharing    boolean not null default false
);

-- Seed the plan limits.  Values are intentionally conservative
-- for the free tier to drive upgrade conversion.
insert into plan_limits (plan, max_notes, max_folders, max_tags, max_note_size_kb, ai_search, note_sharing)
values
  ('free',  50,   5,  20,   64,  false, false),
  ('pro',   -1,  -1, 200, 1024,  true,  true),
  ('team',  -1,  -1,  -1, 4096,  true,  true)
on conflict (plan) do update
  set
    max_notes         = excluded.max_notes,
    max_folders       = excluded.max_folders,
    max_tags          = excluded.max_tags,
    max_note_size_kb  = excluded.max_note_size_kb,
    ai_search         = excluded.ai_search,
    note_sharing      = excluded.note_sharing;

-- Allow all authenticated users to read plan limits (used in UI to
-- display upgrade prompts with actual limit numbers).
alter table plan_limits enable row level security;

create policy "plan_limits: authenticated read"
  on plan_limits for select
  using (auth.role() = 'authenticated');


-- ============================================================
-- HELPER: get_user_plan()
--   Returns the caller's current plan as text.
--   Used inside quota-check functions below.
-- ============================================================

create or replace function get_user_plan()
returns text
language sql
stable
security invoker
as $$
  select plan from profiles where id = auth.uid();
$$;


-- ============================================================
-- HELPER: check_note_quota()
--   Trigger function — fires BEFORE INSERT on notes.
--   Raises an exception if the user is at their plan limit.
-- ============================================================

create or replace function check_note_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan       text;
  v_max_notes  integer;
  v_count      integer;
begin
  select get_user_plan() into v_plan;

  select max_notes into v_max_notes
  from plan_limits
  where plan = v_plan;

  -- -1 means unlimited; skip the count query entirely.
  if v_max_notes = -1 then
    return new;
  end if;

  select count(*) into v_count
  from notes
  where user_id  = new.user_id
    and deleted_at is null;

  if v_count >= v_max_notes then
    raise exception
      'Note limit reached for % plan (max: %). Upgrade to create more notes.',
      v_plan, v_max_notes
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists notes_check_quota on notes;
create trigger notes_check_quota
  before insert on notes
  for each row execute function check_note_quota();


-- ============================================================
-- HELPER: check_folder_quota()
--   Same pattern as check_note_quota but for folders.
-- ============================================================

create or replace function check_folder_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan        text;
  v_max_folders integer;
  v_count       integer;
begin
  select get_user_plan() into v_plan;

  select max_folders into v_max_folders
  from plan_limits
  where plan = v_plan;

  if v_max_folders = -1 then
    return new;
  end if;

  select count(*) into v_count
  from folders
  where user_id = new.user_id;

  if v_count >= v_max_folders then
    raise exception
      'Folder limit reached for % plan (max: %). Upgrade to create more folders.',
      v_plan, v_max_folders
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists folders_check_quota on folders;
create trigger folders_check_quota
  before insert on folders
  for each row execute function check_folder_quota();
