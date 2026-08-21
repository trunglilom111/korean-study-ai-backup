update public.topik_master_vocabulary
set source_target_code = ''
where source_target_code is null;

alter table public.topik_master_vocabulary
  alter column source_target_code set default '',
  alter column source_target_code set not null;

alter table public.topik_master_vocabulary
  drop constraint if exists topik_master_vocabulary_lemma_pos_homonym_key;

alter table public.topik_master_vocabulary
  add constraint topik_master_vocabulary_source_identity_key
  unique (normalized_lemma, part_of_speech, homonym_number, source_target_code);

comment on constraint topik_master_vocabulary_source_identity_key
  on public.topik_master_vocabulary is
  'Preserves distinct source entries that share the same lemma, POS and homonym number.';
