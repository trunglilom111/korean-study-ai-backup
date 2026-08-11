alter table public.vocabulary_collections
  add column if not exists copied_from_id uuid
    references public.vocabulary_collections(id) on delete set null;

create index if not exists vocabulary_collections_copied_from_idx
  on public.vocabulary_collections (copied_from_id);

create table if not exists public.vocabulary_collection_follows (
  collection_id uuid not null
    references public.vocabulary_collections(id) on delete cascade,
  follower_id uuid not null
    references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (collection_id, follower_id)
);

create index if not exists vocabulary_collection_follows_collection_idx
  on public.vocabulary_collection_follows (collection_id, created_at desc);

create index if not exists vocabulary_collection_follows_follower_idx
  on public.vocabulary_collection_follows (follower_id, created_at desc);

alter table public.vocabulary_collection_follows enable row level security;

drop policy if exists "users can read visible collection follows"
  on public.vocabulary_collection_follows;
create policy "users can read visible collection follows"
  on public.vocabulary_collection_follows
  for select
  using (
    follower_id = auth.uid()
    or exists (
      select 1
      from public.vocabulary_collections as collection
      where collection.id = vocabulary_collection_follows.collection_id
        and collection.visibility in ('PUBLIC', 'UNLISTED')
    )
  );

drop policy if exists "users can follow visible collections"
  on public.vocabulary_collection_follows;
create policy "users can follow visible collections"
  on public.vocabulary_collection_follows
  for insert
  with check (
    follower_id = auth.uid()
    and exists (
      select 1
      from public.vocabulary_collections as collection
      where collection.id = vocabulary_collection_follows.collection_id
        and collection.visibility in ('PUBLIC', 'UNLISTED')
    )
  );

drop policy if exists "users can unfollow their collections"
  on public.vocabulary_collection_follows;
create policy "users can unfollow their collections"
  on public.vocabulary_collection_follows
  for delete
  using (follower_id = auth.uid());
