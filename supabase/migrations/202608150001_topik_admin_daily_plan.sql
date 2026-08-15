create table if not exists public.topik_personal_goals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  owner_email text not null default 'trunglilom11@gmail.com'
    check (lower(owner_email) = 'trunglilom11@gmail.com'),
  started_on date not null default current_date,
  target_accuracy integer not null default 80
    check (target_accuracy between 0 and 100),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.topik_daily_lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  study_date date not null,
  day_number integer not null check (day_number > 0),
  phase text not null check (phase in ('topik-i', 'reading', 'listening', 'writing')),
  lesson jsonb not null,
  progress jsonb not null default jsonb_build_object(
    'vocabularyCompleted', jsonb_build_array(),
    'grammarCompleted', jsonb_build_array(),
    'listeningScore', 0,
    'readingScore', 0,
    'writingCompleted', false
  ),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, study_date)
);

create index if not exists topik_daily_lessons_user_date_idx
  on public.topik_daily_lessons (user_id, study_date desc);

alter table public.topik_personal_goals enable row level security;
alter table public.topik_daily_lessons enable row level security;

drop policy if exists "TOPIK admin can read personal goal" on public.topik_personal_goals;
create policy "TOPIK admin can read personal goal"
  on public.topik_personal_goals for select
  using (
    user_id = auth.uid()
    and lower(coalesce(auth.jwt() ->> 'email', '')) = 'trunglilom11@gmail.com'
  );

drop policy if exists "TOPIK admin can create personal goal" on public.topik_personal_goals;
create policy "TOPIK admin can create personal goal"
  on public.topik_personal_goals for insert
  with check (
    user_id = auth.uid()
    and lower(owner_email) = 'trunglilom11@gmail.com'
    and lower(coalesce(auth.jwt() ->> 'email', '')) = 'trunglilom11@gmail.com'
  );

drop policy if exists "TOPIK admin can update personal goal" on public.topik_personal_goals;
create policy "TOPIK admin can update personal goal"
  on public.topik_personal_goals for update
  using (
    user_id = auth.uid()
    and lower(coalesce(auth.jwt() ->> 'email', '')) = 'trunglilom11@gmail.com'
  )
  with check (
    user_id = auth.uid()
    and lower(owner_email) = 'trunglilom11@gmail.com'
    and lower(coalesce(auth.jwt() ->> 'email', '')) = 'trunglilom11@gmail.com'
  );

drop policy if exists "TOPIK admin can read daily lessons" on public.topik_daily_lessons;
create policy "TOPIK admin can read daily lessons"
  on public.topik_daily_lessons for select
  using (
    user_id = auth.uid()
    and lower(coalesce(auth.jwt() ->> 'email', '')) = 'trunglilom11@gmail.com'
  );

drop policy if exists "TOPIK admin can create daily lessons" on public.topik_daily_lessons;
create policy "TOPIK admin can create daily lessons"
  on public.topik_daily_lessons for insert
  with check (
    user_id = auth.uid()
    and lower(coalesce(auth.jwt() ->> 'email', '')) = 'trunglilom11@gmail.com'
  );

drop policy if exists "TOPIK admin can update daily lessons" on public.topik_daily_lessons;
create policy "TOPIK admin can update daily lessons"
  on public.topik_daily_lessons for update
  using (
    user_id = auth.uid()
    and lower(coalesce(auth.jwt() ->> 'email', '')) = 'trunglilom11@gmail.com'
  )
  with check (
    user_id = auth.uid()
    and lower(coalesce(auth.jwt() ->> 'email', '')) = 'trunglilom11@gmail.com'
  );
