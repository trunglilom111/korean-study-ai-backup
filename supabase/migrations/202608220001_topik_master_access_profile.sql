create or replace function public.is_topik_master_owner()
returns boolean
language sql
stable
set search_path = public, auth
as $$
  select
    auth.uid() is not null
    and lower(coalesce(auth.jwt() ->> 'email', '')) = 'trunglilom11@gmail.com';
$$;

revoke all on function public.is_topik_master_owner() from public;
grant execute on function public.is_topik_master_owner() to authenticated;

create table if not exists public.topik_master_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  owner_email text not null default 'trunglilom11@gmail.com'
    check (lower(owner_email) = 'trunglilom11@gmail.com'),
  display_name text not null default 'Linh'
    check (char_length(display_name) between 1 and 80),
  current_level text not null default 'TOPIK II · Cấp 4'
    check (current_level in (
      'TOPIK I · Cấp 1', 'TOPIK I · Cấp 2',
      'TOPIK II · Cấp 3', 'TOPIK II · Cấp 4',
      'TOPIK II · Cấp 5', 'TOPIK II · Cấp 6'
    )),
  target_level text not null default 'TOPIK II · Cấp 6'
    check (target_level in (
      'TOPIK I · Cấp 1', 'TOPIK I · Cấp 2',
      'TOPIK II · Cấp 3', 'TOPIK II · Cấp 4',
      'TOPIK II · Cấp 5', 'TOPIK II · Cấp 6'
    )),
  exam_date date,
  weekly_study_minutes integer not null default 420
    check (weekly_study_minutes between 30 and 10080),
  preferred_skills text[] not null default array['listening', 'reading']::text[]
    check (preferred_skills <@ array['listening', 'reading', 'writing', 'vocabulary', 'grammar']::text[]),
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  last_activity_on date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.topik_master_profiles enable row level security;

create policy "TOPIK Master owner can read profile"
  on public.topik_master_profiles for select
  using (user_id = auth.uid() and public.is_topik_master_owner());

create policy "TOPIK Master owner can create profile"
  on public.topik_master_profiles for insert
  with check (
    user_id = auth.uid()
    and lower(owner_email) = 'trunglilom11@gmail.com'
    and public.is_topik_master_owner()
  );

create policy "TOPIK Master owner can update profile"
  on public.topik_master_profiles for update
  using (user_id = auth.uid() and public.is_topik_master_owner())
  with check (
    user_id = auth.uid()
    and lower(owner_email) = 'trunglilom11@gmail.com'
    and public.is_topik_master_owner()
  );

revoke all on table public.topik_master_profiles from anon;
grant select, insert, update on table public.topik_master_profiles to authenticated;
