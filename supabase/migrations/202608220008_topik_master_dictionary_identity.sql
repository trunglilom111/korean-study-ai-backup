alter table public.topik_master_vocabulary
  add column if not exists source_target_code text,
  add column if not exists homonym_number text not null default '';

alter table public.topik_master_vocabulary
  drop constraint if exists topik_master_vocabulary_normalized_lemma_part_of_speech_key;

alter table public.topik_master_vocabulary
  add constraint topik_master_vocabulary_lemma_pos_homonym_key
  unique (normalized_lemma, part_of_speech, homonym_number);

create index if not exists topik_master_vocabulary_source_target_code_idx
  on public.topik_master_vocabulary (source_target_code)
  where source_target_code is not null;

comment on column public.topik_master_vocabulary.source_target_code is
  'Stable target code supplied by the source dictionary; never an API key.';

comment on column public.topik_master_vocabulary.homonym_number is
  'Source homonym number. Empty for records that do not provide one.';

alter table public.topik_master_grammar
  alter column topik_level drop not null;

alter table public.topik_master_grammar
  drop constraint if exists topik_master_grammar_topik_level_check;

alter table public.topik_master_grammar
  add constraint topik_master_grammar_topik_level_check
  check (topik_level is null or topik_level in ('TOPIK I', 'TOPIK II'));

comment on column public.topik_master_grammar.topik_level is
  'Null means the licensed source did not classify this grammar by TOPIK level; keep draft until reviewed.';
