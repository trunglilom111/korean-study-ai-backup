alter table public.grammar
  add column if not exists review_count integer not null default 0
    check (review_count >= 0),
  add column if not exists correct_count integer not null default 0
    check (correct_count >= 0),
  add column if not exists wrong_count integer not null default 0
    check (wrong_count >= 0),
  add column if not exists last_reviewed_at timestamptz,
  add column if not exists next_review_at timestamptz,
  add column if not exists interval_days numeric not null default 0
    check (interval_days >= 0),
  add column if not exists difficulty text
    check (difficulty in ('again', 'hard', 'good', 'easy'));

create index if not exists grammar_owner_next_review_idx
  on public.grammar (user_id, next_review_at);
