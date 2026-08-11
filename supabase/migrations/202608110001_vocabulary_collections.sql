create table if not exists public.vocabulary_collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  visibility text not null default 'PRIVATE'
    check (visibility in ('PRIVATE', 'UNLISTED', 'PUBLIC')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists vocabulary_collections_owner_created_idx
  on public.vocabulary_collections (owner_id, created_at desc);

create index if not exists vocabulary_collections_visibility_created_idx
  on public.vocabulary_collections (visibility, created_at desc);

create table if not exists public.vocabulary_collection_items (
  collection_id uuid not null references public.vocabulary_collections(id) on delete cascade,
  vocabulary_id uuid not null references public.vocabulary(id) on delete cascade,
  position integer not null default 0 check (position >= 0),
  personal_note text check (personal_note is null or char_length(personal_note) <= 1000),
  vocabulary_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (collection_id, vocabulary_id)
);

create index if not exists vocabulary_collection_items_position_idx
  on public.vocabulary_collection_items (collection_id, position, created_at);

alter table public.vocabulary_collections enable row level security;
alter table public.vocabulary_collection_items enable row level security;

drop policy if exists "collection owners can read their collections"
  on public.vocabulary_collections;
create policy "collection owners can read their collections"
  on public.vocabulary_collections
  for select
  using (
    owner_id = auth.uid()
    or visibility in ('PUBLIC', 'UNLISTED')
  );

drop policy if exists "collection owners can create collections"
  on public.vocabulary_collections;
create policy "collection owners can create collections"
  on public.vocabulary_collections
  for insert
  with check (owner_id = auth.uid());

drop policy if exists "collection owners can update collections"
  on public.vocabulary_collections;
create policy "collection owners can update collections"
  on public.vocabulary_collections
  for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "collection owners can delete collections"
  on public.vocabulary_collections;
create policy "collection owners can delete collections"
  on public.vocabulary_collections
  for delete
  using (owner_id = auth.uid());

drop policy if exists "visible collection items can be read"
  on public.vocabulary_collection_items;
create policy "visible collection items can be read"
  on public.vocabulary_collection_items
  for select
  using (
    exists (
      select 1
      from public.vocabulary_collections as collection
      where collection.id = vocabulary_collection_items.collection_id
        and (
          collection.owner_id = auth.uid()
          or collection.visibility in ('PUBLIC', 'UNLISTED')
        )
    )
  );

drop policy if exists "collection owners can add items"
  on public.vocabulary_collection_items;
create policy "collection owners can add items"
  on public.vocabulary_collection_items
  for insert
  with check (
    exists (
      select 1
      from public.vocabulary_collections as collection
      where collection.id = vocabulary_collection_items.collection_id
        and collection.owner_id = auth.uid()
    )
  );

drop policy if exists "collection owners can update items"
  on public.vocabulary_collection_items;
create policy "collection owners can update items"
  on public.vocabulary_collection_items
  for update
  using (
    exists (
      select 1
      from public.vocabulary_collections as collection
      where collection.id = vocabulary_collection_items.collection_id
        and collection.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.vocabulary_collections as collection
      where collection.id = vocabulary_collection_items.collection_id
        and collection.owner_id = auth.uid()
    )
  );

drop policy if exists "collection owners can delete items"
  on public.vocabulary_collection_items;
create policy "collection owners can delete items"
  on public.vocabulary_collection_items
  for delete
  using (
    exists (
      select 1
      from public.vocabulary_collections as collection
      where collection.id = vocabulary_collection_items.collection_id
        and collection.owner_id = auth.uid()
    )
  );
