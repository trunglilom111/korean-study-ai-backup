create table if not exists public.topik_master_import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('vocabulary', 'grammar', 'question')),
  source_name text not null check (char_length(source_name) between 2 and 160),
  source_url text,
  license_note text not null check (char_length(license_note) between 10 and 1000),
  status text not null default 'validating' check (status in ('validating', 'needs-fixes', 'review', 'ready', 'committed', 'rejected')),
  total_count integer not null default 0 check (total_count >= 0),
  valid_count integer not null default 0 check (valid_count >= 0),
  duplicate_count integer not null default 0 check (duplicate_count >= 0),
  approved_count integer not null default 0 check (approved_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  committed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists topik_master_import_batches_owner_idx
  on public.topik_master_import_batches (user_id, created_at desc);

create table if not exists public.topik_master_import_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.topik_master_import_batches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  ordinal integer not null check (ordinal > 0),
  external_key text not null,
  normalized_hash text not null check (char_length(normalized_hash) = 64),
  payload jsonb not null,
  validation_errors jsonb not null default '[]'::jsonb check (jsonb_typeof(validation_errors) = 'array'),
  duplicate_of text,
  review_status text not null default 'pending' check (review_status in ('pending', 'approved', 'rejected')),
  reviewer_note text not null default '',
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique (batch_id, ordinal)
);

create index if not exists topik_master_import_items_review_idx
  on public.topik_master_import_items (batch_id, review_status, ordinal);
create index if not exists topik_master_import_items_hash_idx
  on public.topik_master_import_items (batch_id, normalized_hash);

alter table public.topik_master_import_batches enable row level security;
alter table public.topik_master_import_items enable row level security;

create policy "TOPIK Master owner manages import batches"
  on public.topik_master_import_batches for all
  using (user_id = auth.uid() and public.is_topik_master_owner())
  with check (user_id = auth.uid() and public.is_topik_master_owner());

create policy "TOPIK Master owner manages import items"
  on public.topik_master_import_items for all
  using (user_id = auth.uid() and public.is_topik_master_owner())
  with check (user_id = auth.uid() and public.is_topik_master_owner());

create policy "TOPIK Master owner creates vocabulary"
  on public.topik_master_vocabulary for insert
  with check (public.is_topik_master_owner());
create policy "TOPIK Master owner updates vocabulary"
  on public.topik_master_vocabulary for update
  using (public.is_topik_master_owner()) with check (public.is_topik_master_owner());
create policy "TOPIK Master owner creates grammar"
  on public.topik_master_grammar for insert
  with check (public.is_topik_master_owner());
create policy "TOPIK Master owner updates grammar"
  on public.topik_master_grammar for update
  using (public.is_topik_master_owner()) with check (public.is_topik_master_owner());
create policy "TOPIK Master owner creates questions"
  on public.topik_master_questions for insert
  with check (public.is_topik_master_owner());
create policy "TOPIK Master owner updates questions"
  on public.topik_master_questions for update
  using (public.is_topik_master_owner()) with check (public.is_topik_master_owner());

revoke all on table public.topik_master_import_batches from anon;
revoke all on table public.topik_master_import_items from anon;
grant select, insert, update, delete on table public.topik_master_import_batches to authenticated;
grant select, insert, update, delete on table public.topik_master_import_items to authenticated;
grant insert, update on table public.topik_master_vocabulary to authenticated;
grant insert, update on table public.topik_master_grammar to authenticated;
grant insert, update on table public.topik_master_questions to authenticated;
