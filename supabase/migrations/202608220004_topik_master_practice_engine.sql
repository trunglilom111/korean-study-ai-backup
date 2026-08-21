create table if not exists public.topik_master_practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_id uuid not null references public.topik_master_exams(id) on delete restrict,
  mode text not null default 'practice' check (mode in ('practice', 'timed')),
  status text not null default 'active' check (status in ('active', 'submitting', 'submitted', 'abandoned')),
  current_position integer not null default 1 check (current_position > 0),
  remaining_seconds integer not null check (remaining_seconds >= 0),
  total_questions integer not null check (total_questions > 0),
  correct_count integer check (correct_count is null or correct_count >= 0),
  score_percent numeric check (score_percent is null or score_percent between 0 and 100),
  result_snapshot jsonb,
  started_at timestamptz not null default timezone('utc', now()),
  submitted_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists topik_master_practice_sessions_active_idx
  on public.topik_master_practice_sessions (user_id, status, updated_at desc);

create table if not exists public.topik_master_session_answers (
  session_id uuid not null references public.topik_master_practice_sessions(id) on delete cascade,
  question_id uuid not null references public.topik_master_questions(id) on delete restrict,
  selected_answer_index integer check (selected_answer_index is null or selected_answer_index >= 0),
  response_time_ms integer not null default 0 check (response_time_ms >= 0),
  confidence numeric check (confidence is null or confidence between 0 and 1),
  is_correct boolean,
  answered_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (session_id, question_id)
);

create index if not exists topik_master_session_answers_question_idx
  on public.topik_master_session_answers (question_id, answered_at desc);

alter table public.topik_attempts
  add column if not exists topik_master_session_id uuid references public.topik_master_practice_sessions(id) on delete set null;

create unique index if not exists topik_attempts_topik_master_session_uidx
  on public.topik_attempts (topik_master_session_id)
  where topik_master_session_id is not null;

alter table public.topik_master_practice_sessions enable row level security;
alter table public.topik_master_session_answers enable row level security;

create policy "TOPIK Master owner manages practice sessions"
  on public.topik_master_practice_sessions for all
  using (user_id = auth.uid() and public.is_topik_master_owner())
  with check (user_id = auth.uid() and public.is_topik_master_owner());

create policy "TOPIK Master owner manages session answers"
  on public.topik_master_session_answers for all
  using (
    public.is_topik_master_owner()
    and exists (
      select 1 from public.topik_master_practice_sessions session
      where session.id = session_id and session.user_id = auth.uid()
    )
  )
  with check (
    public.is_topik_master_owner()
    and exists (
      select 1 from public.topik_master_practice_sessions session
      where session.id = session_id and session.user_id = auth.uid()
    )
  );

revoke all on table public.topik_master_practice_sessions from anon;
revoke all on table public.topik_master_session_answers from anon;
grant select, insert, update, delete on table public.topik_master_practice_sessions to authenticated;
grant select, insert, update, delete on table public.topik_master_session_answers to authenticated;
