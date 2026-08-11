create table if not exists public.study_notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '' check (char_length(title) <= 160),
  content text not null default '' check (char_length(content) <= 20000),
  category text not null default 'OTHER'
    check (category in ('GRAMMAR', 'VOCABULARY', 'TOPIK', 'SENTENCE', 'OTHER')),
  tags text[] not null default '{}',
  source_type text,
  source_ref text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists study_notes_owner_updated_idx
  on public.study_notes (owner_id, updated_at desc);

create index if not exists study_notes_owner_category_idx
  on public.study_notes (owner_id, category, updated_at desc);

alter table public.study_notes enable row level security;

drop policy if exists "note owners can read their notes" on public.study_notes;
create policy "note owners can read their notes"
  on public.study_notes
  for select
  using (owner_id = auth.uid());

drop policy if exists "users can create their notes" on public.study_notes;
create policy "users can create their notes"
  on public.study_notes
  for insert
  with check (owner_id = auth.uid());

drop policy if exists "note owners can update their notes" on public.study_notes;
create policy "note owners can update their notes"
  on public.study_notes
  for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "note owners can delete their notes" on public.study_notes;
create policy "note owners can delete their notes"
  on public.study_notes
  for delete
  using (owner_id = auth.uid());
