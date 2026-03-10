-- ============================================================
-- Smart Notes — Migration 003: AI Embeddings & Semantic Search
--
-- Adds vector embeddings to notes for semantic similarity search
-- ("find notes related to this idea") powered by pgvector.
--
-- The embedding column stores a 1536-dimension float vector
-- compatible with OpenAI text-embedding-3-small and Ada-002.
-- Switch to 768 for models like text-embedding-gecko (Google).
--
-- Tables created:
--   note_embeddings  — one embedding vector per note
--
-- Edge Functions created (not SQL — documented here for reference):
--   supabase/functions/embed-note/   — called after note save
--   supabase/functions/search/       — semantic search endpoint
--
-- Depends on: 001_init.sql (pgvector extension enabled there)
-- ============================================================


-- ============================================================
-- NOTE_EMBEDDINGS
--   Decoupled from the notes table so:
--     a) the notes table stays lean for list queries
--     b) embeddings can be regenerated without touching notes
--     c) NOT NULL on notes.embedding is not required
-- ============================================================

create table if not exists note_embeddings (
  note_id         uuid        primary key references notes(id) on delete cascade,

  -- 1536 dimensions: OpenAI text-embedding-3-small / ada-002.
  -- Change to vector(768) for Google Vertex / Gecko models.
  embedding       vector(1536) not null,

  -- Track which model produced this embedding so we can detect
  -- stale vectors after a model upgrade.
  model           text        not null default 'text-embedding-3-small',

  -- Version counter: increment when the source note is re-embedded.
  version         integer     not null default 1,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- IVFFlat index: approximate nearest-neighbour search.
-- lists=100 is a reasonable starting value for < 1 M rows.
-- Rebuild with more lists as the dataset grows.
-- cosine distance is correct for normalised OpenAI embeddings.
create index if not exists note_embeddings_ivfflat_idx
  on note_embeddings
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

alter table note_embeddings enable row level security;

-- A user may only query embeddings for their own notes.
create policy "note_embeddings: owner read"
  on note_embeddings for select
  using (
    exists (
      select 1 from notes n
      where n.id = note_id
        and n.user_id = auth.uid()
    )
  );

-- Service-role (Edge Function) handles INSERT/UPDATE.
-- No user-level write policy is intentional.

drop trigger if exists note_embeddings_updated_at on note_embeddings;
create trigger note_embeddings_updated_at
  before update on note_embeddings
  for each row execute function touch_updated_at();


-- ============================================================
-- SEMANTIC SEARCH FUNCTION
--   Called from the Flutter app or an Edge Function.
--   Returns notes ordered by cosine similarity to a query vector.
--
--   Parameters:
--     query_embedding  — the vector from the embedding model
--     match_threshold  — minimum cosine similarity (0.0–1.0)
--     match_count      — max rows to return
--
--   Usage:
--     select * from match_notes(
--       query_embedding := '[0.1, 0.2, ...]'::vector,
--       match_threshold := 0.7,
--       match_count     := 10
--     );
-- ============================================================

create or replace function match_notes(
  query_embedding  vector(1536),
  match_threshold  float    default 0.70,
  match_count      integer  default 10
)
returns table (
  id          uuid,
  user_id     uuid,
  folder_id   uuid,
  title       text,
  content     text,
  is_pinned   boolean,
  created_at  timestamptz,
  updated_at  timestamptz,
  similarity  float
)
language sql
stable
security invoker   -- runs as the calling user; RLS is enforced
as $$
  select
    n.id,
    n.user_id,
    n.folder_id,
    n.title,
    n.content,
    n.is_pinned,
    n.created_at,
    n.updated_at,
    1 - (ne.embedding <=> query_embedding) as similarity
  from note_embeddings ne
  join notes n on n.id = ne.note_id
  where
    n.user_id    = auth.uid()
    and n.deleted_at is null
    and 1 - (ne.embedding <=> query_embedding) >= match_threshold
  order by ne.embedding <=> query_embedding   -- ascending distance = descending similarity
  limit match_count;
$$;
