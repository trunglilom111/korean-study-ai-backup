create table if not exists public.topik_master_learning_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_key text not null check (char_length(question_key) between 1 and 160),
  skill text not null check (skill in ('listening', 'reading', 'writing', 'vocabulary', 'grammar')),
  subskill text not null default 'general' check (char_length(subskill) between 1 and 80),
  correct boolean not null,
  selected_answer jsonb,
  response_time_ms integer not null default 0 check (response_time_ms >= 0),
  confidence numeric check (confidence is null or confidence between 0 and 1),
  error_type text,
  attempt_number integer not null default 1 check (attempt_number > 0),
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists topik_master_learning_events_user_created_idx
  on public.topik_master_learning_events (user_id, created_at desc);
create index if not exists topik_master_learning_events_user_skill_idx
  on public.topik_master_learning_events (user_id, skill, subskill, created_at desc);
create index if not exists topik_master_learning_events_question_idx
  on public.topik_master_learning_events (user_id, question_key, created_at desc);

create table if not exists public.topik_master_skill_stats (
  user_id uuid not null references auth.users(id) on delete cascade,
  skill text not null check (skill in ('listening', 'reading', 'writing', 'vocabulary', 'grammar')),
  subskill text not null default 'general',
  attempts integer not null default 0 check (attempts >= 0),
  correct_count integer not null default 0 check (correct_count between 0 and attempts),
  average_response_time_ms numeric not null default 0 check (average_response_time_ms >= 0),
  mastery_score numeric not null default 0 check (mastery_score between 0 and 1),
  weakness_score numeric not null default 1 check (weakness_score between 0 and 1),
  last_attempt_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, skill, subskill)
);

create index if not exists topik_master_skill_stats_weakness_idx
  on public.topik_master_skill_stats (user_id, weakness_score desc, attempts desc);

create table if not exists public.topik_master_item_stats (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('question', 'vocabulary', 'grammar')),
  item_key text not null check (char_length(item_key) between 1 and 160),
  attempts integer not null default 0 check (attempts >= 0),
  correct_count integer not null default 0 check (correct_count between 0 and attempts),
  mastery_score numeric not null default 0 check (mastery_score between 0 and 1),
  last_attempt_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, item_type, item_key)
);

create table if not exists public.topik_master_review_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('question', 'vocabulary', 'grammar')),
  entity_key text not null check (char_length(entity_key) between 1 and 160),
  priority numeric not null default 0.5 check (priority between 0 and 1),
  due_at timestamptz not null default timezone('utc', now()),
  interval_days integer not null default 0 check (interval_days >= 0),
  ease_factor numeric not null default 2.5 check (ease_factor between 1.3 and 3),
  lapse_count integer not null default 0 check (lapse_count >= 0),
  reason jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, entity_type, entity_key)
);

create index if not exists topik_master_review_queue_due_idx
  on public.topik_master_review_queue (user_id, due_at, priority desc);

alter table public.topik_master_learning_events enable row level security;
alter table public.topik_master_skill_stats enable row level security;
alter table public.topik_master_item_stats enable row level security;
alter table public.topik_master_review_queue enable row level security;

create policy "TOPIK Master owner manages learning events"
  on public.topik_master_learning_events for all
  using (user_id = auth.uid() and public.is_topik_master_owner())
  with check (user_id = auth.uid() and public.is_topik_master_owner());

create policy "TOPIK Master owner manages skill stats"
  on public.topik_master_skill_stats for all
  using (user_id = auth.uid() and public.is_topik_master_owner())
  with check (user_id = auth.uid() and public.is_topik_master_owner());

create policy "TOPIK Master owner manages item stats"
  on public.topik_master_item_stats for all
  using (user_id = auth.uid() and public.is_topik_master_owner())
  with check (user_id = auth.uid() and public.is_topik_master_owner());

create policy "TOPIK Master owner manages review queue"
  on public.topik_master_review_queue for all
  using (user_id = auth.uid() and public.is_topik_master_owner())
  with check (user_id = auth.uid() and public.is_topik_master_owner());

revoke all on table public.topik_master_learning_events from anon;
revoke all on table public.topik_master_skill_stats from anon;
revoke all on table public.topik_master_item_stats from anon;
revoke all on table public.topik_master_review_queue from anon;
grant select, insert, update, delete on table public.topik_master_learning_events to authenticated;
grant select, insert, update, delete on table public.topik_master_skill_stats to authenticated;
grant select, insert, update, delete on table public.topik_master_item_stats to authenticated;
grant select, insert, update, delete on table public.topik_master_review_queue to authenticated;

create or replace function public.record_topik_master_answer(
  p_question_key text,
  p_skill text,
  p_subskill text default 'general',
  p_correct boolean default false,
  p_selected_answer jsonb default null,
  p_response_time_ms integer default 0,
  p_confidence numeric default null,
  p_error_type text default null,
  p_context jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
set search_path = public, auth
as $$
declare
  v_event_id uuid;
  v_now timestamptz := timezone('utc', now());
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_priority numeric;
begin
  if not public.is_topik_master_owner() then
    raise exception 'TOPIK Master access denied' using errcode = '42501';
  end if;
  if p_skill not in ('listening', 'reading', 'writing', 'vocabulary', 'grammar') then
    raise exception 'Invalid TOPIK skill' using errcode = '22023';
  end if;
  if coalesce(char_length(trim(p_question_key)), 0) = 0 then
    raise exception 'Question key is required' using errcode = '22023';
  end if;
  if p_response_time_ms < 0 or (p_confidence is not null and (p_confidence < 0 or p_confidence > 1)) then
    raise exception 'Invalid answer metrics' using errcode = '22023';
  end if;

  insert into public.topik_master_learning_events (
    user_id, question_key, skill, subskill, correct, selected_answer,
    response_time_ms, confidence, error_type, context
  ) values (
    auth.uid(), trim(p_question_key), p_skill, coalesce(nullif(trim(p_subskill), ''), 'general'),
    p_correct, p_selected_answer, p_response_time_ms, p_confidence, p_error_type, coalesce(p_context, '{}'::jsonb)
  ) returning id into v_event_id;

  insert into public.topik_master_skill_stats (
    user_id, skill, subskill, attempts, correct_count, average_response_time_ms,
    mastery_score, weakness_score, last_attempt_at, updated_at
  ) values (
    auth.uid(), p_skill, coalesce(nullif(trim(p_subskill), ''), 'general'), 1,
    case when p_correct then 1 else 0 end, p_response_time_ms,
    case when p_correct then 0.65 else 0.25 end,
    case when p_correct then 0.35 else 0.75 end, v_now, v_now
  )
  on conflict (user_id, skill, subskill) do update set
    attempts = public.topik_master_skill_stats.attempts + 1,
    correct_count = public.topik_master_skill_stats.correct_count + case when p_correct then 1 else 0 end,
    average_response_time_ms = (
      public.topik_master_skill_stats.average_response_time_ms * public.topik_master_skill_stats.attempts + p_response_time_ms
    ) / (public.topik_master_skill_stats.attempts + 1),
    mastery_score = least(1, greatest(0,
      public.topik_master_skill_stats.mastery_score * 0.8 + case when p_correct then 0.2 else 0 end
    )),
    weakness_score = least(1, greatest(0,
      1 - (public.topik_master_skill_stats.mastery_score * 0.8 + case when p_correct then 0.2 else 0 end)
    )),
    last_attempt_at = v_now,
    updated_at = v_now;

  insert into public.topik_master_item_stats (
    user_id, item_type, item_key, attempts, correct_count, mastery_score, last_attempt_at, updated_at
  ) values (
    auth.uid(), 'question', trim(p_question_key), 1, case when p_correct then 1 else 0 end,
    case when p_correct then 0.65 else 0.25 end, v_now, v_now
  )
  on conflict (user_id, item_type, item_key) do update set
    attempts = public.topik_master_item_stats.attempts + 1,
    correct_count = public.topik_master_item_stats.correct_count + case when p_correct then 1 else 0 end,
    mastery_score = least(1, greatest(0,
      public.topik_master_item_stats.mastery_score * 0.8 + case when p_correct then 0.2 else 0 end
    )),
    last_attempt_at = v_now,
    updated_at = v_now;

  v_priority := case
    when not p_correct then least(1, 0.85 + least(p_response_time_ms::numeric / 600000, 0.1))
    else greatest(0.1, 0.45 - least(p_response_time_ms::numeric / 1000000, 0.2))
  end;

  insert into public.topik_master_review_queue (
    user_id, entity_type, entity_key, priority, due_at, interval_days,
    ease_factor, lapse_count, reason, updated_at
  ) values (
    auth.uid(), 'question', trim(p_question_key), v_priority,
    case when p_correct then v_now + interval '1 day' else v_now end,
    case when p_correct then 1 else 0 end,
    case when p_correct then 2.55 else 2.3 end,
    case when p_correct then 0 else 1 end,
    jsonb_build_object('skill', p_skill, 'subskill', coalesce(nullif(trim(p_subskill), ''), 'general'), 'lastCorrect', p_correct),
    v_now
  )
  on conflict (user_id, entity_type, entity_key) do update set
    priority = v_priority,
    interval_days = case
      when p_correct then greatest(1, round(public.topik_master_review_queue.interval_days * public.topik_master_review_queue.ease_factor)::integer)
      else 0
    end,
    due_at = case
      when p_correct then v_now + make_interval(days => greatest(1, round(public.topik_master_review_queue.interval_days * public.topik_master_review_queue.ease_factor)::integer))
      else v_now
    end,
    ease_factor = least(3, greatest(1.3, public.topik_master_review_queue.ease_factor + case when p_correct then 0.05 else -0.2 end)),
    lapse_count = public.topik_master_review_queue.lapse_count + case when p_correct then 0 else 1 end,
    reason = jsonb_build_object('skill', p_skill, 'subskill', coalesce(nullif(trim(p_subskill), ''), 'general'), 'lastCorrect', p_correct),
    updated_at = v_now;

  update public.topik_master_profiles set
    current_streak = case
      when last_activity_on = v_today then current_streak
      when last_activity_on = v_today - 1 then current_streak + 1
      else 1
    end,
    longest_streak = greatest(
      longest_streak,
      case
        when last_activity_on = v_today then current_streak
        when last_activity_on = v_today - 1 then current_streak + 1
        else 1
      end
    ),
    last_activity_on = v_today,
    updated_at = v_now
  where user_id = auth.uid();

  return v_event_id;
end;
$$;

revoke all on function public.record_topik_master_answer(text, text, text, boolean, jsonb, integer, numeric, text, jsonb) from public;
grant execute on function public.record_topik_master_answer(text, text, text, boolean, jsonb, integer, numeric, text, jsonb) to authenticated;
