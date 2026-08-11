create table if not exists public.vocabulary_collection_progress (
  collection_id uuid not null references public.vocabulary_collections(id) on delete cascade,
  vocabulary_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'learning'
    check (status in ('learning', 'mastered')),
  review_count integer not null default 0 check (review_count >= 0),
  correct_count integer not null default 0 check (correct_count >= 0),
  wrong_count integer not null default 0 check (wrong_count >= 0),
  last_reviewed_at timestamptz,
  next_review_at timestamptz,
  interval_days numeric not null default 0 check (interval_days >= 0),
  difficulty text check (difficulty in ('again', 'hard', 'good', 'easy')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (collection_id, vocabulary_id, user_id)
);

create index if not exists vocabulary_collection_progress_user_next_review_idx
  on public.vocabulary_collection_progress (user_id, next_review_at);

create index if not exists vocabulary_collection_progress_collection_user_idx
  on public.vocabulary_collection_progress (collection_id, user_id);

alter table public.vocabulary_collection_progress enable row level security;

drop policy if exists "users can read visible collection progress"
  on public.vocabulary_collection_progress;
create policy "users can read visible collection progress"
  on public.vocabulary_collection_progress
  for select
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.vocabulary_collections as collection
      where collection.id = vocabulary_collection_progress.collection_id
        and (
          collection.owner_id = auth.uid()
          or collection.visibility in ('PUBLIC', 'UNLISTED')
        )
    )
  );

drop policy if exists "users can create visible collection progress"
  on public.vocabulary_collection_progress;
create policy "users can create visible collection progress"
  on public.vocabulary_collection_progress
  for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.vocabulary_collections as collection
      where collection.id = vocabulary_collection_progress.collection_id
        and (
          collection.owner_id = auth.uid()
          or collection.visibility in ('PUBLIC', 'UNLISTED')
        )
    )
  );

drop policy if exists "users can update their collection progress"
  on public.vocabulary_collection_progress;
create policy "users can update their collection progress"
  on public.vocabulary_collection_progress
  for update
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.vocabulary_collections as collection
      where collection.id = vocabulary_collection_progress.collection_id
        and (
          collection.owner_id = auth.uid()
          or collection.visibility in ('PUBLIC', 'UNLISTED')
        )
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.vocabulary_collections as collection
      where collection.id = vocabulary_collection_progress.collection_id
        and (
          collection.owner_id = auth.uid()
          or collection.visibility in ('PUBLIC', 'UNLISTED')
        )
    )
  );

drop policy if exists "users can delete their collection progress"
  on public.vocabulary_collection_progress;
create policy "users can delete their collection progress"
  on public.vocabulary_collection_progress
  for delete
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.vocabulary_collections as collection
      where collection.id = vocabulary_collection_progress.collection_id
        and (
          collection.owner_id = auth.uid()
          or collection.visibility in ('PUBLIC', 'UNLISTED')
        )
    )
  );
