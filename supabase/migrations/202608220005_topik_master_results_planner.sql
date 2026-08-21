alter table public.topik_mistakes
  add column if not exists question_uuid uuid references public.topik_master_questions(id) on delete set null,
  add column if not exists question_key text,
  add column if not exists skill text,
  add column if not exists subskill text,
  add column if not exists selected_answer_index integer,
  add column if not exists correct_answer_index integer,
  add column if not exists error_type text,
  add column if not exists priority numeric default 0.5 check (priority is null or priority between 0 and 1);

create index if not exists topik_mistakes_user_skill_due_idx
  on public.topik_mistakes (user_id, skill, next_review_at);

create table if not exists public.topik_master_attempt_sections (
  attempt_id uuid not null references public.topik_attempts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  skill text not null check (skill in ('listening', 'reading', 'writing', 'vocabulary', 'grammar')),
  correct_count integer not null default 0 check (correct_count >= 0),
  total_questions integer not null default 0 check (total_questions >= 0),
  score_percent numeric not null default 0 check (score_percent between 0 and 100),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (attempt_id, skill)
);

create index if not exists topik_master_attempt_sections_user_idx
  on public.topik_master_attempt_sections (user_id, created_at desc);

create table if not exists public.topik_master_planner_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_key text not null check (char_length(task_key) between 1 and 160),
  due_date date not null,
  skill text not null check (skill in ('listening', 'reading', 'writing', 'vocabulary', 'grammar')),
  task_type text not null check (task_type in ('practice', 'review', 'lesson', 'writing')),
  title text not null,
  description text not null default '',
  target_count integer not null default 1 check (target_count > 0),
  completed_count integer not null default 0 check (completed_count between 0 and target_count),
  source text not null default 'deterministic' check (source in ('deterministic', 'manual', 'ai')),
  metadata jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, due_date, task_key)
);

create index if not exists topik_master_planner_tasks_due_idx
  on public.topik_master_planner_tasks (user_id, due_date, completed_at);

alter table public.topik_master_attempt_sections enable row level security;
alter table public.topik_master_planner_tasks enable row level security;

create policy "TOPIK Master owner manages attempt sections"
  on public.topik_master_attempt_sections for all
  using (user_id = auth.uid() and public.is_topik_master_owner())
  with check (user_id = auth.uid() and public.is_topik_master_owner());

create policy "TOPIK Master owner manages planner tasks"
  on public.topik_master_planner_tasks for all
  using (user_id = auth.uid() and public.is_topik_master_owner())
  with check (user_id = auth.uid() and public.is_topik_master_owner());

revoke all on table public.topik_master_attempt_sections from anon;
revoke all on table public.topik_master_planner_tasks from anon;
grant select, insert, update, delete on table public.topik_master_attempt_sections to authenticated;
grant select, insert, update, delete on table public.topik_master_planner_tasks to authenticated;
