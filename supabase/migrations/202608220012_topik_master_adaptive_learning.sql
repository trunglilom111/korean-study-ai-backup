-- Grammar progress, central Study Brain events, persistent exam flags and fast search.
create extension if not exists pg_trgm;

create table if not exists public.topik_master_grammar_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  grammar_id uuid not null references public.topik_master_grammar(id) on delete cascade,
  status text not null default 'learning' check (status in ('learning', 'understood', 'mastered', 'hard')),
  bookmarked boolean not null default false,
  note text not null default '' check (char_length(note) <= 5000),
  first_seen_at timestamptz not null default timezone('utc', now()),
  last_studied_at timestamptz,
  next_review_at timestamptz,
  review_count integer not null default 0 check (review_count >= 0),
  correct_count integer not null default 0 check (correct_count >= 0),
  wrong_count integer not null default 0 check (wrong_count >= 0),
  ease_factor numeric not null default 2.5 check (ease_factor between 1.3 and 3.2),
  interval_days numeric not null default 0 check (interval_days >= 0),
  mastery_score numeric not null default 0 check (mastery_score between 0 and 100),
  last_rating text check (last_rating is null or last_rating in ('again', 'hard', 'good', 'easy')),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, grammar_id)
);

create index if not exists topik_master_grammar_progress_due_idx
  on public.topik_master_grammar_progress (user_id, next_review_at)
  where next_review_at is not null;
create index if not exists topik_master_grammar_progress_status_idx
  on public.topik_master_grammar_progress (user_id, status, bookmarked);

alter table public.topik_master_grammar_progress enable row level security;
create policy "TOPIK Master owner manages grammar progress"
  on public.topik_master_grammar_progress for all
  using (user_id = auth.uid() and public.is_topik_master_owner())
  with check (user_id = auth.uid() and public.is_topik_master_owner());
revoke all on table public.topik_master_grammar_progress from anon;
grant select, insert, update, delete on table public.topik_master_grammar_progress to authenticated;

-- The project already owns a durable learning event stream. This security-invoker
-- view gives it the requested Study Brain vocabulary without duplicating history.
create or replace view public.topik_master_study_events
with (security_invoker = true) as
select
  id,
  user_id,
  coalesce(nullif(context->>'activityType', ''), 'question_answer') as activity_type,
  coalesce(nullif(context->>'contentId', ''), question_key) as content_id,
  skill,
  subskill as question_type,
  correct,
  not correct as wrong,
  response_time_ms,
  case when (context->>'difficulty') ~ '^[0-9]+$' then (context->>'difficulty')::integer else null end as difficulty,
  context as metadata,
  created_at
from public.topik_master_learning_events;

grant select on public.topik_master_study_events to authenticated;
revoke all on public.topik_master_study_events from anon;

create table if not exists public.topik_master_session_flags (
  session_id uuid not null references public.topik_master_practice_sessions(id) on delete cascade,
  question_id uuid not null references public.topik_master_questions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (session_id, question_id)
);
create index if not exists topik_master_session_flags_user_idx
  on public.topik_master_session_flags (user_id, session_id);
alter table public.topik_master_session_flags enable row level security;
create policy "TOPIK Master owner manages exam flags"
  on public.topik_master_session_flags for all
  using (user_id = auth.uid() and public.is_topik_master_owner())
  with check (user_id = auth.uid() and public.is_topik_master_owner());
revoke all on table public.topik_master_session_flags from anon;
grant select, insert, delete on table public.topik_master_session_flags to authenticated;

create index if not exists topik_master_vocabulary_lemma_trgm_idx
  on public.topik_master_vocabulary using gin (lemma gin_trgm_ops);
create index if not exists topik_master_vocabulary_meaning_vi_trgm_idx
  on public.topik_master_vocabulary using gin (meaning_vi gin_trgm_ops);
create index if not exists topik_master_grammar_pattern_trgm_idx
  on public.topik_master_grammar using gin (pattern gin_trgm_ops);
create index if not exists topik_master_grammar_meaning_vi_trgm_idx
  on public.topik_master_grammar using gin (meaning_vi gin_trgm_ops);
create index if not exists topik_master_questions_prompt_trgm_idx
  on public.topik_master_questions using gin (prompt gin_trgm_ops);

