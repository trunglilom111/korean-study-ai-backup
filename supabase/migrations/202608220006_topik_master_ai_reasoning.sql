create table if not exists public.topik_master_ai_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cache_key text not null check (char_length(cache_key) between 32 and 128),
  kind text not null check (kind in ('question-explanation', 'writing-feedback', 'similar-practice')),
  source_key text not null,
  source_version integer not null default 1 check (source_version > 0),
  model text not null,
  prompt_version text not null,
  payload jsonb not null,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  thought_tokens integer not null default 0 check (thought_tokens >= 0),
  estimated_cost_usd numeric check (estimated_cost_usd is null or estimated_cost_usd >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz,
  unique (user_id, cache_key)
);

create index if not exists topik_master_ai_cache_lookup_idx
  on public.topik_master_ai_cache (user_id, kind, source_key, created_at desc);

create table if not exists public.topik_master_writing_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt_key text not null,
  prompt_text text not null,
  response_text text not null,
  character_count integer not null check (character_count >= 0),
  deterministic_metrics jsonb not null default '{}'::jsonb,
  status text not null default 'submitted' check (status in ('draft', 'submitted', 'reviewed')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists topik_master_writing_submissions_user_idx
  on public.topik_master_writing_submissions (user_id, created_at desc);

create table if not exists public.topik_master_writing_feedback (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.topik_master_writing_submissions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('deterministic', 'gemini')),
  model text,
  prompt_version text not null,
  feedback jsonb not null,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  thought_tokens integer not null default 0 check (thought_tokens >= 0),
  estimated_cost_usd numeric check (estimated_cost_usd is null or estimated_cost_usd >= 0),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists topik_master_writing_feedback_submission_idx
  on public.topik_master_writing_feedback (submission_id, created_at desc);

create table if not exists public.topik_master_generated_practice (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_question_key text not null,
  source_kind text not null default 'ai-generated' check (source_kind = 'ai-generated'),
  model text not null,
  prompt_version text not null,
  content jsonb not null,
  review_status text not null default 'draft' check (review_status in ('draft', 'approved', 'rejected')),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists topik_master_generated_practice_review_idx
  on public.topik_master_generated_practice (user_id, review_status, created_at desc);

alter table public.topik_master_ai_cache enable row level security;
alter table public.topik_master_writing_submissions enable row level security;
alter table public.topik_master_writing_feedback enable row level security;
alter table public.topik_master_generated_practice enable row level security;

create policy "TOPIK Master owner manages AI cache"
  on public.topik_master_ai_cache for all
  using (user_id = auth.uid() and public.is_topik_master_owner())
  with check (user_id = auth.uid() and public.is_topik_master_owner());

create policy "TOPIK Master owner manages writing submissions"
  on public.topik_master_writing_submissions for all
  using (user_id = auth.uid() and public.is_topik_master_owner())
  with check (user_id = auth.uid() and public.is_topik_master_owner());

create policy "TOPIK Master owner manages writing feedback"
  on public.topik_master_writing_feedback for all
  using (user_id = auth.uid() and public.is_topik_master_owner())
  with check (user_id = auth.uid() and public.is_topik_master_owner());

create policy "TOPIK Master owner manages generated practice"
  on public.topik_master_generated_practice for all
  using (user_id = auth.uid() and public.is_topik_master_owner())
  with check (user_id = auth.uid() and public.is_topik_master_owner());

revoke all on table public.topik_master_ai_cache from anon;
revoke all on table public.topik_master_writing_submissions from anon;
revoke all on table public.topik_master_writing_feedback from anon;
revoke all on table public.topik_master_generated_practice from anon;
grant select, insert, update, delete on table public.topik_master_ai_cache to authenticated;
grant select, insert, update, delete on table public.topik_master_writing_submissions to authenticated;
grant select, insert, update, delete on table public.topik_master_writing_feedback to authenticated;
grant select, insert, update, delete on table public.topik_master_generated_practice to authenticated;
