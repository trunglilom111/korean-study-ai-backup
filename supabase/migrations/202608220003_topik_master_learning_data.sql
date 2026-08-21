create table if not exists public.topik_master_vocabulary (
  id uuid primary key default gen_random_uuid(),
  lemma text not null check (char_length(lemma) between 1 and 120),
  normalized_lemma text not null check (char_length(normalized_lemma) between 1 and 120),
  part_of_speech text not null check (char_length(part_of_speech) between 1 and 80),
  hanja text,
  meaning_vi text not null default '',
  explanation_ko text not null default '',
  nikl_level text check (nikl_level is null or nikl_level in ('A', 'B', 'C')),
  topik_level text check (topik_level is null or topik_level in ('TOPIK I', 'TOPIK II')),
  frequency_rank integer check (frequency_rank is null or frequency_rank > 0),
  frequency_score numeric not null default 0 check (frequency_score between 0 and 1),
  source_key text not null,
  source_url text,
  license_note text not null,
  metadata jsonb not null default '{}'::jsonb,
  is_published boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (normalized_lemma, part_of_speech)
);

create index if not exists topik_master_vocabulary_level_frequency_idx
  on public.topik_master_vocabulary (topik_level, frequency_score desc)
  where is_published;
create index if not exists topik_master_vocabulary_lemma_idx
  on public.topik_master_vocabulary (normalized_lemma);

create table if not exists public.topik_master_grammar (
  id uuid primary key default gen_random_uuid(),
  pattern text not null unique check (char_length(pattern) between 1 and 160),
  meaning_vi text not null,
  usage_vi text not null default '',
  topik_level text not null check (topik_level in ('TOPIK I', 'TOPIK II')),
  difficulty integer not null default 1 check (difficulty between 1 and 5),
  examples jsonb not null default '[]'::jsonb check (jsonb_typeof(examples) = 'array'),
  source_key text not null,
  source_url text,
  license_note text not null,
  metadata jsonb not null default '{}'::jsonb,
  is_published boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists topik_master_grammar_level_difficulty_idx
  on public.topik_master_grammar (topik_level, difficulty)
  where is_published;

create table if not exists public.topik_master_questions (
  id uuid primary key default gen_random_uuid(),
  external_key text not null unique check (char_length(external_key) between 1 and 160),
  version integer not null default 1 check (version > 0),
  exam_type text not null check (exam_type in ('TOPIK I', 'TOPIK II')),
  skill text not null check (skill in ('listening', 'reading', 'writing', 'vocabulary', 'grammar')),
  subskill text not null default 'general' check (char_length(subskill) between 1 and 80),
  question_type text not null check (char_length(question_type) between 1 and 80),
  prompt text not null,
  passage text,
  audio_url text,
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  correct_answer_index integer,
  explanation_vi text not null default '',
  difficulty integer not null default 1 check (difficulty between 1 and 5),
  status text not null default 'draft' check (status in ('draft', 'review', 'published', 'archived')),
  source_kind text not null check (source_kind in ('original', 'licensed', 'user-generated', 'ai-generated')),
  source_ref text not null,
  license_note text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (
    correct_answer_index is null
    or (
      correct_answer_index >= 0
      and jsonb_array_length(options) > correct_answer_index
    )
  )
);

create index if not exists topik_master_questions_catalog_idx
  on public.topik_master_questions (exam_type, skill, subskill, difficulty)
  where status = 'published';
create index if not exists topik_master_questions_type_idx
  on public.topik_master_questions (question_type, difficulty)
  where status = 'published';

create table if not exists public.topik_master_question_vocabulary (
  question_id uuid not null references public.topik_master_questions(id) on delete cascade,
  vocabulary_id uuid not null references public.topik_master_vocabulary(id) on delete cascade,
  relevance numeric not null default 1 check (relevance between 0 and 1),
  primary key (question_id, vocabulary_id)
);

create table if not exists public.topik_master_question_grammar (
  question_id uuid not null references public.topik_master_questions(id) on delete cascade,
  grammar_id uuid not null references public.topik_master_grammar(id) on delete cascade,
  relevance numeric not null default 1 check (relevance between 0 and 1),
  primary key (question_id, grammar_id)
);

create table if not exists public.topik_master_exams (
  id uuid primary key default gen_random_uuid(),
  external_key text not null unique check (char_length(external_key) between 1 and 160),
  title text not null,
  exam_type text not null check (exam_type in ('TOPIK I', 'TOPIK II')),
  description text not null default '',
  duration_minutes integer not null check (duration_minutes > 0),
  status text not null default 'draft' check (status in ('draft', 'review', 'published', 'archived')),
  source_kind text not null check (source_kind in ('original', 'licensed', 'user-generated', 'ai-generated')),
  source_ref text not null,
  license_note text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.topik_master_exam_questions (
  exam_id uuid not null references public.topik_master_exams(id) on delete cascade,
  question_id uuid not null references public.topik_master_questions(id) on delete restrict,
  position integer not null check (position > 0),
  points numeric not null default 1 check (points > 0),
  primary key (exam_id, question_id),
  unique (exam_id, position)
);

alter table public.topik_master_vocabulary enable row level security;
alter table public.topik_master_grammar enable row level security;
alter table public.topik_master_questions enable row level security;
alter table public.topik_master_question_vocabulary enable row level security;
alter table public.topik_master_question_grammar enable row level security;
alter table public.topik_master_exams enable row level security;
alter table public.topik_master_exam_questions enable row level security;

create policy "TOPIK Master owner reads vocabulary"
  on public.topik_master_vocabulary for select using (public.is_topik_master_owner());
create policy "TOPIK Master owner reads grammar"
  on public.topik_master_grammar for select using (public.is_topik_master_owner());
create policy "TOPIK Master owner reads questions"
  on public.topik_master_questions for select using (public.is_topik_master_owner());
create policy "TOPIK Master owner reads question vocabulary"
  on public.topik_master_question_vocabulary for select using (public.is_topik_master_owner());
create policy "TOPIK Master owner reads question grammar"
  on public.topik_master_question_grammar for select using (public.is_topik_master_owner());
create policy "TOPIK Master owner reads exams"
  on public.topik_master_exams for select using (public.is_topik_master_owner());
create policy "TOPIK Master owner reads exam questions"
  on public.topik_master_exam_questions for select using (public.is_topik_master_owner());

revoke all on table public.topik_master_vocabulary from anon;
revoke all on table public.topik_master_grammar from anon;
revoke all on table public.topik_master_questions from anon;
revoke all on table public.topik_master_question_vocabulary from anon;
revoke all on table public.topik_master_question_grammar from anon;
revoke all on table public.topik_master_exams from anon;
revoke all on table public.topik_master_exam_questions from anon;
grant select on table public.topik_master_vocabulary to authenticated;
grant select on table public.topik_master_grammar to authenticated;
grant select on table public.topik_master_questions to authenticated;
grant select on table public.topik_master_question_vocabulary to authenticated;
grant select on table public.topik_master_question_grammar to authenticated;
grant select on table public.topik_master_exams to authenticated;
grant select on table public.topik_master_exam_questions to authenticated;

insert into public.topik_master_vocabulary (
  lemma, normalized_lemma, part_of_speech, hanja, meaning_vi, explanation_ko,
  nikl_level, topik_level, frequency_score, source_key, license_note, metadata, is_published
) values
  ('계획', '계획', '명사', '計劃', 'kế hoạch', '앞으로 할 일의 순서와 방법을 미리 정한 것', 'A', 'TOPIK I', 0.82, 'phase3-original-seed', 'Nội dung mẫu tự viết cho TOPIK Master.', '{"topic":"daily-life"}'::jsonb, true),
  ('변경하다', '변경하다', '동사', '變更', 'thay đổi', '정해진 내용을 다르게 바꾸다', 'B', 'TOPIK II', 0.78, 'phase3-original-seed', 'Nội dung mẫu tự viết cho TOPIK Master.', '{"topic":"work"}'::jsonb, true),
  ('준비물', '준비물', '명사', '準備物', 'đồ cần chuẩn bị', '어떤 일을 하기 전에 마련해야 하는 물건', 'A', 'TOPIK I', 0.72, 'phase3-original-seed', 'Nội dung mẫu tự viết cho TOPIK Master.', '{"topic":"travel"}'::jsonb, true),
  ('문의하다', '문의하다', '동사', '問議', 'hỏi, liên hệ để biết thông tin', '모르는 내용을 관계자에게 묻다', 'B', 'TOPIK II', 0.7, 'phase3-original-seed', 'Nội dung mẫu tự viết cho TOPIK Master.', '{"topic":"service"}'::jsonb, true),
  ('교통', '교통', '명사', '交通', 'giao thông', '사람이나 물건이 오고 가는 일', 'A', 'TOPIK I', 0.85, 'phase3-original-seed', 'Nội dung mẫu tự viết cho TOPIK Master.', '{"topic":"transport"}'::jsonb, true),
  ('절약하다', '절약하다', '동사', '節約', 'tiết kiệm', '돈이나 시간 등을 아껴 쓰다', 'B', 'TOPIK II', 0.76, 'phase3-original-seed', 'Nội dung mẫu tự viết cho TOPIK Master.', '{"topic":"economy"}'::jsonb, true),
  ('정리하다', '정리하다', '동사', '整理', 'sắp xếp, chỉnh lý', '흩어진 것을 가지런히 하거나 내용을 체계화하다', 'A', 'TOPIK I', 0.8, 'phase3-original-seed', 'Nội dung mẫu tự viết cho TOPIK Master.', '{"topic":"work"}'::jsonb, true),
  ('참가비', '참가비', '명사', '參加費', 'phí tham gia', '행사나 모임에 참가하기 위해 내는 돈', 'B', 'TOPIK II', 0.62, 'phase3-original-seed', 'Nội dung mẫu tự viết cho TOPIK Master.', '{"topic":"events"}'::jsonb, true),
  ('만족스럽다', '만족스럽다', '형용사', '滿足', 'đáng hài lòng', '마음에 들어 부족함이 없는 느낌이 있다', 'B', 'TOPIK II', 0.68, 'phase3-original-seed', 'Nội dung mẫu tự viết cho TOPIK Master.', '{"topic":"emotion"}'::jsonb, true),
  ('실천', '실천', '명사', '實踐', 'sự thực hành', '생각하거나 계획한 일을 실제로 행동에 옮김', 'B', 'TOPIK II', 0.74, 'phase3-original-seed', 'Nội dung mẫu tự viết cho TOPIK Master.', '{"topic":"society"}'::jsonb, true)
on conflict (normalized_lemma, part_of_speech) do nothing;

insert into public.topik_master_grammar (
  pattern, meaning_vi, usage_vi, topik_level, difficulty, examples,
  source_key, license_note, metadata, is_published
) values
  ('-기 위해(서)', 'để, nhằm', 'Dùng với động từ để diễn tả mục đích của hành động.', 'TOPIK I', 2, '[{"ko":"시험에 합격하기 위해 매일 공부해요.","vi":"Tôi học mỗi ngày để đỗ kỳ thi."}]'::jsonb, 'phase3-original-seed', 'Nội dung mẫu tự viết cho TOPIK Master.', '{}'::jsonb, true),
  ('-(으)려고', 'định, để', 'Diễn tả ý định hoặc mục đích của chủ thể.', 'TOPIK I', 2, '[{"ko":"여행 준비물을 문의하려고 전화했어요.","vi":"Tôi gọi điện để hỏi về đồ cần chuẩn bị cho chuyến đi."}]'::jsonb, 'phase3-original-seed', 'Nội dung mẫu tự viết cho TOPIK Master.', '{}'::jsonb, true),
  ('-(으)ㄴ/는 것 같다', 'có vẻ như', 'Dùng khi người nói đưa ra phỏng đoán dựa trên dấu hiệu.', 'TOPIK I', 2, '[{"ko":"신청 기간이 늘어난 것 같아요.","vi":"Có vẻ thời hạn đăng ký đã được kéo dài."}]'::jsonb, 'phase3-original-seed', 'Nội dung mẫu tự viết cho TOPIK Master.', '{}'::jsonb, true),
  ('-(으)ㅁ에 따라', 'theo, cùng với sự thay đổi của', 'Diễn tả kết quả thay đổi tương ứng với một sự việc.', 'TOPIK II', 4, '[{"ko":"이용자가 증가함에 따라 서비스도 확대되었다.","vi":"Theo đà người dùng tăng, dịch vụ cũng được mở rộng."}]'::jsonb, 'phase3-original-seed', 'Nội dung mẫu tự viết cho TOPIK Master.', '{}'::jsonb, true),
  ('-더라도', 'dù cho, ngay cả khi', 'Giả định một tình huống nhưng kết quả phía sau không thay đổi.', 'TOPIK II', 4, '[{"ko":"시간이 부족하더라도 끝까지 해 보세요.","vi":"Dù thiếu thời gian, hãy thử làm đến cùng."}]'::jsonb, 'phase3-original-seed', 'Nội dung mẫu tự viết cho TOPIK Master.', '{}'::jsonb, true)
on conflict (pattern) do nothing;

insert into public.topik_master_questions (
  external_key, exam_type, skill, subskill, question_type, prompt, options,
  correct_answer_index, explanation_vi, difficulty, status, source_kind,
  source_ref, license_note, metadata
) values
  ('tm-original-listening-001', 'TOPIK II', 'listening', 'speaker-intention', 'multiple-choice', '여자는 왜 이 이야기를 하고 있습니까?', '["여행 계획을 변경하려고","여행 준비물을 문의하려고","여행 경험을 이야기하려고","여행 일정을 확인하려고"]'::jsonb, 1, 'Người nữ gọi để hỏi về những đồ cần chuẩn bị cho chuyến đi; -(으)려고 cho biết mục đích.', 3, 'published', 'original', 'phase3-original-seed', 'Câu hỏi mẫu tự viết, không phải đề TOPIK chính thức.', '{"audioStatus":"script-only"}'::jsonb),
  ('tm-original-listening-002', 'TOPIK II', 'listening', 'topic', 'multiple-choice', '두 사람은 무엇에 대해 이야기하고 있습니까?', '["회사 행사","주말 약속","교통 상황","건강 관리"]'::jsonb, 2, 'Các từ khóa về đường đông và thời gian di chuyển cho thấy chủ đề là tình hình giao thông.', 2, 'published', 'original', 'phase3-original-seed', 'Câu hỏi mẫu tự viết, không phải đề TOPIK chính thức.', '{"audioStatus":"script-only"}'::jsonb),
  ('tm-original-listening-003', 'TOPIK II', 'listening', 'opinion', 'multiple-choice', '남자의 생각으로 맞는 것을 고르십시오.', '["시간을 아껴야 한다","운동을 자주 해야 한다","계획을 바꿔야 한다","친구에게 알려야 한다"]'::jsonb, 0, 'Ý kiến trung tâm của người nam là cần tiết kiệm thời gian.', 3, 'published', 'original', 'phase3-original-seed', 'Câu hỏi mẫu tự viết, không phải đề TOPIK chính thức.', '{"audioStatus":"script-only"}'::jsonb),
  ('tm-original-listening-004', 'TOPIK II', 'listening', 'place', 'multiple-choice', '이 대화가 이루어지는 장소는 어디입니까?', '["은행","도서관","병원","우체국"]'::jsonb, 3, 'Ngữ cảnh gửi bưu phẩm và tem cho biết hội thoại diễn ra ở bưu điện.', 2, 'published', 'original', 'phase3-original-seed', 'Câu hỏi mẫu tự viết, không phải đề TOPIK chính thức.', '{"audioStatus":"script-only"}'::jsonb),
  ('tm-original-listening-005', 'TOPIK II', 'listening', 'next-action', 'multiple-choice', '여자가 다음에 할 일은 무엇입니까?', '["자료를 정리한다","전화를 건다","회의실에 간다","음식을 주문한다"]'::jsonb, 2, 'Người nữ nói sẽ mang tài liệu đến phòng họp ngay sau cuộc trò chuyện.', 3, 'published', 'original', 'phase3-original-seed', 'Câu hỏi mẫu tự viết, không phải đề TOPIK chính thức.', '{"audioStatus":"script-only"}'::jsonb),
  ('tm-original-listening-006', 'TOPIK II', 'listening', 'detail-match', 'multiple-choice', '들은 내용과 같은 것을 고르십시오.', '["행사가 취소되었다","신청 기간이 늘었다","장소가 변경되었다","참가비가 필요하다"]'::jsonb, 1, 'Thông báo nói thời hạn đăng ký được kéo dài; các phương án còn lại trái với nội dung.', 3, 'published', 'original', 'phase3-original-seed', 'Câu hỏi mẫu tự viết, không phải đề TOPIK chính thức.', '{"audioStatus":"script-only"}'::jsonb),
  ('tm-original-listening-007', 'TOPIK II', 'listening', 'reason', 'multiple-choice', '남자가 이 일을 하는 이유는 무엇입니까?', '["경험을 쌓기 위해","돈을 절약하기 위해","친구를 돕기 위해","건강을 지키기 위해"]'::jsonb, 0, 'Cấu trúc -기 위해서 nối trực tiếp với mục đích tích lũy kinh nghiệm.', 3, 'published', 'original', 'phase3-original-seed', 'Câu hỏi mẫu tự viết, không phải đề TOPIK chính thức.', '{"audioStatus":"script-only"}'::jsonb),
  ('tm-original-listening-008', 'TOPIK II', 'listening', 'attitude', 'multiple-choice', '여자의 태도로 가장 알맞은 것을 고르십시오.', '["걱정스럽다","만족스럽다","부끄럽다","무관심하다"]'::jsonb, 1, 'Giọng điệu tích cực và lời đánh giá tốt thể hiện sự hài lòng.', 4, 'published', 'original', 'phase3-original-seed', 'Câu hỏi mẫu tự viết, không phải đề TOPIK chính thức.', '{"audioStatus":"script-only"}'::jsonb)
on conflict (external_key) do nothing;

insert into public.topik_master_exams (
  external_key, title, exam_type, description, duration_minutes, status,
  source_kind, source_ref, license_note, metadata
) values (
  'tm-original-diagnostic-listening-001',
  'Bài chẩn đoán Listening · Foundation',
  'TOPIK II',
  'Bộ 8 câu mẫu tự viết dùng để kiểm tra Practice Engine và Study Brain.',
  25,
  'published',
  'original',
  'phase3-original-seed',
  'Nội dung mẫu tự viết, không phải đề TOPIK chính thức.',
  '{"questionCount":8,"phase":"foundation"}'::jsonb
)
on conflict (external_key) do nothing;

insert into public.topik_master_exam_questions (exam_id, question_id, position, points)
select
  exam.id,
  question.id,
  right(question.external_key, 3)::integer,
  1
from public.topik_master_exams exam
join public.topik_master_questions question
  on question.external_key like 'tm-original-listening-%'
where exam.external_key = 'tm-original-diagnostic-listening-001'
on conflict do nothing;

insert into public.topik_master_question_vocabulary (question_id, vocabulary_id, relevance)
select question.id, vocabulary.id, mapping.relevance
from (values
  ('tm-original-listening-001', '준비물', 1.0::numeric),
  ('tm-original-listening-001', '문의하다', 1.0::numeric),
  ('tm-original-listening-002', '교통', 1.0::numeric),
  ('tm-original-listening-003', '절약하다', 0.9::numeric),
  ('tm-original-listening-005', '정리하다', 0.8::numeric),
  ('tm-original-listening-006', '참가비', 0.7::numeric),
  ('tm-original-listening-008', '만족스럽다', 1.0::numeric)
) as mapping(question_key, lemma, relevance)
join public.topik_master_questions question on question.external_key = mapping.question_key
join public.topik_master_vocabulary vocabulary on vocabulary.normalized_lemma = mapping.lemma
on conflict do nothing;

insert into public.topik_master_question_grammar (question_id, grammar_id, relevance)
select question.id, grammar.id, mapping.relevance
from (values
  ('tm-original-listening-001', '-(으)려고', 1.0::numeric),
  ('tm-original-listening-007', '-기 위해(서)', 1.0::numeric)
) as mapping(question_key, pattern, relevance)
join public.topik_master_questions question on question.external_key = mapping.question_key
join public.topik_master_grammar grammar on grammar.pattern = mapping.pattern
on conflict do nothing;
