create table if not exists public.topik_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_id text not null,
  exam_title text not null,
  target text not null check (target in ('TOPIK I', 'TOPIK II')),
  mode text not null default 'practice' check (mode in ('practice', 'timed')),
  score_percent numeric not null default 0 check (score_percent between 0 and 100),
  correct_count integer not null default 0 check (correct_count >= 0),
  total_questions integer not null default 0 check (total_questions >= 0),
  time_spent_seconds integer not null default 0 check (time_spent_seconds >= 0),
  answers jsonb not null default '{}'::jsonb,
  mistakes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists topik_attempts_user_created_idx
  on public.topik_attempts (user_id, created_at desc);

create table if not exists public.topik_mistakes (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.topik_attempts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_id text not null,
  question_id text not null,
  prompt text not null,
  selected_answer text not null default '',
  correct_answer text not null,
  explanation text not null default '',
  review_count integer not null default 0 check (review_count >= 0),
  correct_count integer not null default 0 check (correct_count >= 0),
  wrong_count integer not null default 0 check (wrong_count >= 0),
  last_reviewed_at timestamptz,
  next_review_at timestamptz,
  interval_days numeric not null default 0 check (interval_days >= 0),
  difficulty text check (difficulty in ('again', 'hard', 'good', 'easy')),
  created_at timestamptz not null default timezone('utc', now()),
  unique (attempt_id, question_id)
);

create index if not exists topik_mistakes_user_next_review_idx
  on public.topik_mistakes (user_id, next_review_at);

alter table public.topik_attempts enable row level security;
alter table public.topik_mistakes enable row level security;

drop policy if exists "users can read their TOPIK attempts" on public.topik_attempts;
create policy "users can read their TOPIK attempts"
  on public.topik_attempts for select using (user_id = auth.uid());

drop policy if exists "users can create their TOPIK attempts" on public.topik_attempts;
create policy "users can create their TOPIK attempts"
  on public.topik_attempts for insert with check (user_id = auth.uid());

drop policy if exists "users can delete their TOPIK attempts" on public.topik_attempts;
create policy "users can delete their TOPIK attempts"
  on public.topik_attempts for delete using (user_id = auth.uid());

drop policy if exists "users can read their TOPIK mistakes" on public.topik_mistakes;
create policy "users can read their TOPIK mistakes"
  on public.topik_mistakes for select using (user_id = auth.uid());

drop policy if exists "users can create their TOPIK mistakes" on public.topik_mistakes;
create policy "users can create their TOPIK mistakes"
  on public.topik_mistakes for insert with check (user_id = auth.uid());

drop policy if exists "users can update their TOPIK mistakes" on public.topik_mistakes;
create policy "users can update their TOPIK mistakes"
  on public.topik_mistakes
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "users can delete their TOPIK mistakes" on public.topik_mistakes;
create policy "users can delete their TOPIK mistakes"
  on public.topik_mistakes for delete using (user_id = auth.uid());
