-- TOPIK Master Question Bank v1
-- Additive migration: keeps all existing catalog and learner data intact.

alter table public.topik_master_questions
  add column if not exists question_number integer check (question_number is null or question_number > 0),
  add column if not exists transcript text,
  add column if not exists explanation_ko text not null default '',
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists exam_year integer check (exam_year is null or exam_year between 1997 and 2100),
  add column if not exists exam_round text,
  add column if not exists source_url text,
  add column if not exists rights_status text not null default 'permission-required'
    check (rights_status in ('original', 'licensed', 'public-link-only', 'permission-required'));

alter table public.topik_master_exams
  add column if not exists test_format text not null default 'practice'
    check (test_format in ('PBT', 'IBT', 'practice')),
  add column if not exists exam_year integer check (exam_year is null or exam_year between 1997 and 2100),
  add column if not exists exam_round text,
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists section_counts jsonb not null default '{}'::jsonb
    check (jsonb_typeof(section_counts) = 'object'),
  add column if not exists source_url text,
  add column if not exists rights_status text not null default 'permission-required'
    check (rights_status in ('original', 'licensed', 'public-link-only', 'permission-required'));

update public.topik_master_questions
set
  question_number = coalesce(question_number, nullif(substring(external_key from '([0-9]+)$'), '')::integer),
  tags = case when cardinality(tags) = 0 then array[exam_type, skill, subskill, question_type] else tags end,
  rights_status = case when source_kind = 'original' then 'original' else rights_status end
where external_key like 'tm-original-%';

update public.topik_master_exams
set
  tags = case when cardinality(tags) = 0 then array[exam_type, 'practice'] else tags end,
  rights_status = case when source_kind = 'original' then 'original' else rights_status end
where external_key like 'tm-original-%';

create index if not exists topik_master_questions_bank_idx
  on public.topik_master_questions (exam_type, skill, question_type, difficulty, question_number)
  where status = 'published';
create index if not exists topik_master_questions_exam_round_idx
  on public.topik_master_questions (exam_year, exam_round, question_number)
  where status = 'published';
create index if not exists topik_master_questions_tags_idx
  on public.topik_master_questions using gin (tags);

create policy "TOPIK Master owner creates question vocabulary links"
  on public.topik_master_question_vocabulary for insert
  with check (public.is_topik_master_owner());
create policy "TOPIK Master owner updates question vocabulary links"
  on public.topik_master_question_vocabulary for update
  using (public.is_topik_master_owner()) with check (public.is_topik_master_owner());
create policy "TOPIK Master owner creates question grammar links"
  on public.topik_master_question_grammar for insert
  with check (public.is_topik_master_owner());
create policy "TOPIK Master owner updates question grammar links"
  on public.topik_master_question_grammar for update
  using (public.is_topik_master_owner()) with check (public.is_topik_master_owner());

grant insert, update on table public.topik_master_question_vocabulary to authenticated;
grant insert, update on table public.topik_master_question_grammar to authenticated;

-- Enrich the eight original Listening questions from the foundation migration.
update public.topik_master_questions as question
set
  question_number = source.question_number,
  transcript = source.transcript,
  explanation_ko = source.explanation_ko,
  tags = source.tags,
  rights_status = 'original',
  metadata = question.metadata || jsonb_build_object('audioStatus', 'transcript-only', 'contentLabel', 'original-exam-style')
from (values
  ('tm-original-listening-001', 1, E'여자: 안녕하세요. 다음 주 제주도 여행을 예약했는데요. 비가 와도 출발하나요? 그리고 따로 준비해야 할 물건이 있습니까?\n남자: 네, 우산과 편한 신발을 준비해 주세요.', '여자는 여행 계획을 바꾸려는 것이 아니라 여행에 필요한 준비물을 문의하고 있다.', array['TOPIK II','listening','speaker-intention','travel','original']::text[]),
  ('tm-original-listening-002', 2, E'여자: 오늘 길이 많이 막히네요. 회의에 늦지 않을까요?\n남자: 지하철로 갈아타면 시간을 줄일 수 있을 거예요.', '길이 막히는 상황과 이동 시간에 관해 이야기하므로 주제는 교통 상황이다.', array['TOPIK II','listening','topic','transport','original']::text[]),
  ('tm-original-listening-003', 3, E'여자: 보고서 정리가 아직 많이 남았어요.\n남자: 중요한 부분부터 처리하면 시간을 아낄 수 있어요.', '남자는 중요한 일부터 처리하여 시간을 절약해야 한다고 생각한다.', array['TOPIK II','listening','opinion','work','original']::text[]),
  ('tm-original-listening-004', 4, E'남자: 이 소포를 부산으로 보내려고 하는데요.\n여자: 내용물을 확인한 뒤에 무게를 재겠습니다. 우표는 여기에서 사시면 됩니다.', '소포를 보내고 우표를 사는 곳은 우체국이다.', array['TOPIK II','listening','place','daily-life','original']::text[]),
  ('tm-original-listening-005', 5, E'남자: 회의 자료를 다 정리했어요?\n여자: 네. 지금 바로 자료를 가지고 회의실로 가겠습니다.', '여자는 자료를 가지고 회의실로 가겠다고 말했다.', array['TOPIK II','listening','next-action','work','original']::text[]),
  ('tm-original-listening-006', 6, '여자: 이번 문화 행사 신청 기간이 금요일까지 연장되었습니다. 장소와 참가비는 이전과 같습니다.', '안내에서 신청 기간이 연장되었다고 분명히 말했다.', array['TOPIK II','listening','detail-match','announcement','original']::text[]),
  ('tm-original-listening-007', 7, E'여자: 방학에도 회사에서 일해요?\n남자: 네. 전공과 관련된 경험을 쌓기 위해서 인턴으로 일하고 있어요.', '남자는 전공 관련 경험을 쌓기 위해 인턴 일을 한다.', array['TOPIK II','listening','reason','work','original']::text[]),
  ('tm-original-listening-008', 8, E'남자: 새로 이용한 도서관은 어땠어요?\n여자: 공간도 넓고 필요한 자료도 많아서 아주 만족스러웠어요.', '여자는 도서관의 공간과 자료를 긍정적으로 평가하며 만족을 표현한다.', array['TOPIK II','listening','attitude','public-service','original']::text[])
) as source(external_key, question_number, transcript, explanation_ko, tags)
where question.external_key = source.external_key;

-- Original exam-style starter content. These are not past official TOPIK questions.
insert into public.topik_master_questions (
  external_key, exam_type, skill, subskill, question_number, question_type,
  prompt, passage, transcript, options, correct_answer_index,
  explanation_vi, explanation_ko, difficulty, tags, status, source_kind,
  source_ref, license_note, rights_status, metadata
) values
  ('tm-original-topik-i-listening-001','TOPIK I','listening','response',1,'multiple-choice',
   '다음을 듣고 이어질 말로 가장 알맞은 것을 고르십시오.',null,
   '여자: 안녕하세요? 처음 뵙겠습니다. 저는 수진입니다.',
   '["네, 안녕히 가세요.","네, 만나서 반갑습니다.","아니요, 괜찮습니다.","네, 잘 먹겠습니다."]'::jsonb,1,
   'Đây là lời tự giới thiệu khi gặp lần đầu, nên câu đáp tự nhiên là “Rất vui được gặp bạn”.',
   '처음 만난 사람이 자기소개를 했으므로 “만나서 반갑습니다”가 자연스럽다.',1,
   array['TOPIK I','listening','response','greeting','original'],'published','original','question-bank-v1-original','Nội dung tự viết mô phỏng dạng TOPIK, không phải đề thi chính thức.','original','{"audioStatus":"transcript-only","contentLabel":"original-exam-style"}'::jsonb),
  ('tm-original-topik-i-listening-002','TOPIK I','listening','place',2,'multiple-choice',
   '두 사람이 이야기하는 장소는 어디입니까?',null,
   E'남자: 이 책을 일주일 더 빌릴 수 있어요?\n여자: 네, 회원증을 보여 주세요.',
   '["서점","도서관","은행","병원"]'::jsonb,1,
   'Mượn sách thêm và xuất trình thẻ thành viên là tình huống ở thư viện.',
   '책을 더 빌리고 회원증을 확인하는 곳은 도서관이다.',1,
   array['TOPIK I','listening','place','public-service','original'],'published','original','question-bank-v1-original','Nội dung tự viết mô phỏng dạng TOPIK, không phải đề thi chính thức.','original','{"audioStatus":"transcript-only","contentLabel":"original-exam-style"}'::jsonb),
  ('tm-original-topik-i-listening-003','TOPIK I','listening','next-action',3,'multiple-choice',
   '남자는 다음에 무엇을 할 것입니까?',null,
   E'여자: 민수 씨, 비가 많이 와요. 우산이 있어요?\n남자: 없어요. 편의점에서 하나 사야겠어요.',
   '["우산을 산다","친구를 만난다","집에 돌아간다","버스를 탄다"]'::jsonb,0,
   'Người nam nói sẽ mua một chiếc ở cửa hàng tiện lợi.',
   '남자는 편의점에서 우산을 사겠다고 말했다.',1,
   array['TOPIK I','listening','next-action','weather','original'],'published','original','question-bank-v1-original','Nội dung tự viết mô phỏng dạng TOPIK, không phải đề thi chính thức.','original','{"audioStatus":"transcript-only","contentLabel":"original-exam-style"}'::jsonb),
  ('tm-original-topik-i-listening-004','TOPIK I','listening','detail-match',4,'multiple-choice',
   '들은 내용과 같은 것을 고르십시오.',null,
   '여자: 내일 한국어 수업은 오전 열 시가 아니라 오후 두 시에 시작합니다. 교실은 삼 층 302호입니다.',
   '["수업은 오전에 시작합니다.","수업은 두 시에 시작합니다.","교실은 이 층에 있습니다.","내일 수업이 없습니다."]'::jsonb,1,
   'Thông báo nói lớp bắt đầu lúc 2 giờ chiều.',
   '수업은 오후 두 시에 시작한다고 안내했다.',2,
   array['TOPIK I','listening','detail-match','school','original'],'published','original','question-bank-v1-original','Nội dung tự viết mô phỏng dạng TOPIK, không phải đề thi chính thức.','original','{"audioStatus":"transcript-only","contentLabel":"original-exam-style"}'::jsonb),
  ('tm-original-topik-i-reading-001','TOPIK I','reading','vocabulary-blank',5,'multiple-choice',
   '빈칸에 들어갈 가장 알맞은 것을 고르십시오.',
   '저는 아침마다 공원에서 한 시간 동안 (   ).',null,
   '["운동합니다","요리합니다","운전합니다","청소합니다"]'::jsonb,0,
   'Ở công viên vào mỗi sáng, hành động hợp ngữ cảnh nhất là tập thể dục.',
   '아침마다 공원에서 하는 활동으로 “운동합니다”가 가장 자연스럽다.',1,
   array['TOPIK I','reading','vocabulary-blank','daily-life','original'],'published','original','question-bank-v1-original','Nội dung tự viết mô phỏng dạng TOPIK, không phải đề thi chính thức.','original','{"contentLabel":"original-exam-style"}'::jsonb),
  ('tm-original-topik-i-reading-002','TOPIK I','reading','grammar-blank',6,'multiple-choice',
   '빈칸에 들어갈 가장 알맞은 것을 고르십시오.',
   '주말에 친구를 (   ) 같이 영화를 봤습니다.',null,
   '["만나고","만나서","만나면","만나지만"]'::jsonb,1,
   'Hai hành động gặp bạn rồi cùng xem phim nối theo trình tự tự nhiên bằng -아서/어서.',
   '친구를 만난 뒤 함께 영화를 본 순서를 나타내므로 “만나서”가 알맞다.',2,
   array['TOPIK I','reading','grammar-blank','connection','original'],'published','original','question-bank-v1-original','Nội dung tự viết mô phỏng dạng TOPIK, không phải đề thi chính thức.','original','{"contentLabel":"original-exam-style"}'::jsonb),
  ('tm-original-topik-i-reading-003','TOPIK I','reading','notice-detail',7,'multiple-choice',
   '다음 안내문의 내용과 같은 것을 고르십시오.',
   E'[도서관 이용 안내]\n이번 주 토요일은 내부 공사로 쉽니다. 반납할 책은 도서관 앞 무인 반납함에 넣어 주십시오.',null,
   '["도서관은 토요일에 엽니다.","토요일에 내부 공사가 있습니다.","책은 다음 주에만 반납할 수 있습니다.","무인 반납함은 도서관 안에 있습니다."]'::jsonb,1,
   'Thông báo ghi thư viện nghỉ thứ Bảy vì có thi công bên trong.',
   '토요일에 내부 공사를 하기 때문에 도서관이 쉰다고 했다.',2,
   array['TOPIK I','reading','notice-detail','public-service','original'],'published','original','question-bank-v1-original','Nội dung tự viết mô phỏng dạng TOPIK, không phải đề thi chính thức.','original','{"contentLabel":"original-exam-style"}'::jsonb),
  ('tm-original-topik-i-reading-004','TOPIK I','reading','main-idea',8,'multiple-choice',
   '다음 글의 중심 생각을 고르십시오.',
   '잠을 충분히 자면 몸의 피로가 풀리고 공부할 때 집중도 잘됩니다. 그래서 바쁘더라도 규칙적으로 자는 것이 중요합니다.',null,
   '["공부할 때 음악을 들어야 합니다.","피곤할 때 운동해야 합니다.","규칙적으로 충분히 자야 합니다.","바쁘면 잠을 줄여야 합니다."]'::jsonb,2,
   'Toàn đoạn giải thích lợi ích của ngủ đủ và kết luận cần ngủ đều đặn.',
   '충분한 수면의 장점을 설명하고 규칙적으로 자는 것이 중요하다고 강조한다.',2,
   array['TOPIK I','reading','main-idea','health','original'],'published','original','question-bank-v1-original','Nội dung tự viết mô phỏng dạng TOPIK, không phải đề thi chính thức.','original','{"contentLabel":"original-exam-style"}'::jsonb),
  ('tm-original-topik-ii-reading-001','TOPIK II','reading','context-blank',1,'multiple-choice',
   '빈칸에 들어갈 내용으로 가장 알맞은 것을 고르십시오.',
   '새로운 습관을 만드는 데에는 시간이 필요하다. 처음부터 큰 목표를 세우면 쉽게 지칠 수 있다. 따라서 (   ).',null,
   '["목표를 자주 바꾸는 것이 좋다","실천하기 쉬운 작은 일부터 시작해야 한다","다른 사람의 습관을 그대로 따라야 한다","결과보다 계획을 중요하게 생각하지 말아야 한다"]'::jsonb,1,
   'Hai câu đầu nói mục tiêu lớn dễ gây mệt, vì vậy kết luận hợp lý là bắt đầu bằng việc nhỏ dễ thực hiện.',
   '큰 목표는 쉽게 지치게 하므로 실천하기 쉬운 작은 일부터 시작해야 한다는 결론이 자연스럽다.',3,
   array['TOPIK II','reading','context-blank','self-development','original'],'published','original','question-bank-v1-original','Nội dung tự viết mô phỏng dạng TOPIK, không phải đề thi chính thức.','original','{"contentLabel":"original-exam-style"}'::jsonb),
  ('tm-original-topik-ii-reading-002','TOPIK II','reading','main-idea',2,'multiple-choice',
   '다음 글의 중심 생각을 고르십시오.',
   '도시의 공공 공간은 단순히 사람들이 지나가는 장소가 아니다. 누구나 머물며 다른 사람과 관계를 맺을 수 있는 생활의 무대이다. 그러므로 공공 공간을 설계할 때에는 이동의 편리함뿐 아니라 사람들이 편안하게 머물 수 있는 환경도 고려해야 한다.',null,
   '["도시에서는 이동 시간을 줄이는 것이 가장 중요하다","공공 공간은 여러 기능을 고려하여 설계해야 한다","사람들은 공공 공간보다 집에서 쉬는 것을 좋아한다","도시의 공공 공간은 통행을 위해서만 필요하다"]'::jsonb,1,
   'Tác giả nhấn mạnh không gian công cộng vừa phục vụ di chuyển vừa phải tạo điều kiện để mọi người lưu lại và tương tác.',
   '공공 공간을 설계할 때 이동뿐 아니라 머무름과 관계 형성까지 고려해야 한다는 내용이다.',3,
   array['TOPIK II','reading','main-idea','society','original'],'published','original','question-bank-v1-original','Nội dung tự viết mô phỏng dạng TOPIK, không phải đề thi chính thức.','original','{"contentLabel":"original-exam-style"}'::jsonb),
  ('tm-original-topik-ii-reading-003','TOPIK II','reading','detail-match',3,'multiple-choice',
   '다음 글의 내용과 같은 것을 고르십시오.',
   '한 연구팀은 사무실에 식물을 두었을 때 직원들의 반응을 조사했다. 식물이 있는 공간에서 일한 직원들은 그렇지 않은 직원들보다 업무 만족도가 높았지만 실제 업무 속도에는 큰 차이가 없었다.',null,
   '["식물이 있으면 업무 속도가 크게 빨라졌다","식물이 없는 곳의 만족도가 더 높았다","식물은 업무 만족도에 긍정적인 영향을 주었다","연구팀은 집에서 일하는 사람만 조사했다"]'::jsonb,2,
   'Nghiên cứu cho thấy cây xanh làm tăng mức hài lòng, nhưng tốc độ làm việc không khác biệt lớn.',
   '식물이 있는 공간에서 일한 직원들의 업무 만족도가 더 높았다고 했다.',3,
   array['TOPIK II','reading','detail-match','work','original'],'published','original','question-bank-v1-original','Nội dung tự viết mô phỏng dạng TOPIK, không phải đề thi chính thức.','original','{"contentLabel":"original-exam-style"}'::jsonb),
  ('tm-original-topik-ii-reading-004','TOPIK II','reading','inference',4,'multiple-choice',
   '다음 글을 쓴 사람의 태도로 가장 알맞은 것을 고르십시오.',
   '기술은 생활을 편리하게 만들지만 모든 문제를 자동으로 해결해 주지는 않는다. 새로운 기술을 도입하기 전에 그것이 누구에게 어떤 영향을 미치는지 충분히 살펴야 한다.',null,
   '["기술의 도입을 무조건 반대하고 있다","기술의 효과를 신중하게 검토해야 한다고 본다","기술이 모든 사회 문제를 해결한다고 믿는다","기술보다 전통적인 방법만 사용해야 한다고 주장한다"]'::jsonb,1,
   'Tác giả không phản đối công nghệ mà yêu cầu xem xét tác động một cách thận trọng.',
   '기술 자체를 반대하는 것이 아니라 도입 전에 영향을 신중히 살펴야 한다는 태도이다.',4,
   array['TOPIK II','reading','inference','technology','original'],'published','original','question-bank-v1-original','Nội dung tự viết mô phỏng dạng TOPIK, không phải đề thi chính thức.','original','{"contentLabel":"original-exam-style"}'::jsonb),
  ('tm-original-topik-ii-reading-005','TOPIK II','reading','sentence-order',5,'multiple-choice',
   E'다음 문장이 들어갈 곳으로 가장 알맞은 것을 고르십시오.\n“그러나 기록만 해 두고 다시 확인하지 않으면 같은 실수를 반복하기 쉽다.”',
   '(ㄱ) 실수를 기록하는 것은 학습에 도움이 된다. (ㄴ) 기록을 통해 자신이 자주 틀리는 부분을 알 수 있기 때문이다. (ㄷ) 따라서 기록한 내용을 정기적으로 검토하고 다시 풀어 보는 과정이 필요하다. (ㄹ)',null,
   '["(ㄱ) 앞","(ㄱ)과 (ㄴ) 사이","(ㄴ)과 (ㄷ) 사이","(ㄷ)과 (ㄹ) 사이"]'::jsonb,2,
   'Câu chèn mở đầu bằng “tuy nhiên”, đối lập với lợi ích của ghi chép rồi dẫn tới kết luận cần xem lại, nên đặt giữa (ㄴ) và (ㄷ).',
   '기록의 장점을 말한 뒤 한계를 제시하고, 이어서 검토의 필요성을 결론으로 내리므로 (ㄴ)과 (ㄷ) 사이가 알맞다.',4,
   array['TOPIK II','reading','sentence-order','learning','original'],'published','original','question-bank-v1-original','Nội dung tự viết mô phỏng dạng TOPIK, không phải đề thi chính thức.','original','{"contentLabel":"original-exam-style"}'::jsonb),
  ('tm-original-topik-ii-reading-006','TOPIK II','reading','headline',6,'multiple-choice',
   '다음 글의 제목으로 가장 알맞은 것을 고르십시오.',
   '최근 여러 지역에서 사용하지 않는 학교 건물을 주민을 위한 문화 공간으로 바꾸고 있다. 낡은 건물을 철거하지 않고 활용할 수 있을 뿐 아니라 지역 주민들이 배우고 교류할 장소도 생긴다는 점에서 좋은 평가를 받고 있다.',null,
   '["학생 수 감소, 학교 운영의 위기","낡은 학교의 변신, 지역에 활력을 더하다","새 건물 건설로 늘어나는 지역 예산","문화 공간 이용을 줄이는 주민들"]'::jsonb,1,
   'Đoạn nói việc biến trường học cũ thành không gian văn hóa đem lại sức sống và nơi giao lưu cho cộng đồng.',
   '사용하지 않는 학교가 문화 공간으로 바뀌어 지역에 긍정적인 효과를 준다는 내용이다.',3,
   array['TOPIK II','reading','headline','community','original'],'published','original','question-bank-v1-original','Nội dung tự viết mô phỏng dạng TOPIK, không phải đề thi chính thức.','original','{"contentLabel":"original-exam-style"}'::jsonb)
on conflict (external_key) do update set
  question_number = excluded.question_number,
  transcript = excluded.transcript,
  explanation_ko = excluded.explanation_ko,
  tags = excluded.tags,
  rights_status = excluded.rights_status,
  updated_at = timezone('utc', now());

insert into public.topik_master_exams (
  external_key, title, exam_type, description, duration_minutes, status,
  source_kind, source_ref, license_note, metadata, test_format, tags,
  section_counts, rights_status
) values
  ('tm-original-topik-i-starter-001','TOPIK I · Starter 01','TOPIK I',
   'Bộ 8 câu mô phỏng gồm Listening và Reading để kiểm thử toàn bộ Practice Engine.',20,'published',
   'original','question-bank-v1-original','Nội dung tự viết mô phỏng dạng TOPIK, không phải đề thi chính thức.',
   '{"questionCount":8,"skill":"Tổng hợp","difficulty":"Cấp 1–2","contentLabel":"original-exam-style"}'::jsonb,
   'practice',array['TOPIK I','listening','reading','starter','original'],'{"listening":4,"reading":4}'::jsonb,'original'),
  ('tm-original-topik-ii-reading-starter-001','TOPIK II Reading · Starter 01','TOPIK II',
   'Bộ 6 câu đọc mô phỏng theo nhiều dạng câu để luyện phân loại và suy luận.',18,'published',
   'original','question-bank-v1-original','Nội dung tự viết mô phỏng dạng TOPIK, không phải đề thi chính thức.',
   '{"questionCount":6,"skill":"Reading","difficulty":"Cấp 3–5","contentLabel":"original-exam-style"}'::jsonb,
   'practice',array['TOPIK II','reading','starter','original'],'{"reading":6}'::jsonb,'original')
on conflict (external_key) do update set
  title = excluded.title,
  description = excluded.description,
  tags = excluded.tags,
  section_counts = excluded.section_counts,
  rights_status = excluded.rights_status,
  updated_at = timezone('utc', now());

insert into public.topik_master_exam_questions (exam_id, question_id, position, points)
select exam.id, question.id, question.question_number, 1
from public.topik_master_exams exam
join public.topik_master_questions question
  on question.external_key like 'tm-original-topik-i-listening-%'
  or question.external_key like 'tm-original-topik-i-reading-%'
where exam.external_key = 'tm-original-topik-i-starter-001'
on conflict do nothing;

insert into public.topik_master_exam_questions (exam_id, question_id, position, points)
select exam.id, question.id, question.question_number, 1
from public.topik_master_exams exam
join public.topik_master_questions question
  on question.external_key like 'tm-original-topik-ii-reading-%'
where exam.external_key = 'tm-original-topik-ii-reading-starter-001'
on conflict do nothing;

-- Link selected bank questions to the existing vocabulary and grammar catalogs.
insert into public.topik_master_question_vocabulary (question_id, vocabulary_id, relevance)
select question.id, vocabulary.id, mapping.relevance
from (values
  ('tm-original-topik-i-listening-002','빌리다',1.0::numeric),
  ('tm-original-topik-i-listening-004','연장하다',0.9::numeric),
  ('tm-original-topik-i-reading-004','집중',0.9::numeric),
  ('tm-original-topik-ii-reading-001','습관',1.0::numeric),
  ('tm-original-topik-ii-reading-002','공공',0.8::numeric),
  ('tm-original-topik-ii-reading-004','도입',0.9::numeric),
  ('tm-original-topik-ii-reading-006','활용하다',0.9::numeric)
) as mapping(question_key, lemma, relevance)
join public.topik_master_questions question on question.external_key = mapping.question_key
join public.topik_master_vocabulary vocabulary on vocabulary.normalized_lemma = mapping.lemma
on conflict do nothing;

insert into public.topik_master_question_grammar (question_id, grammar_id, relevance)
select question.id, grammar.id, mapping.relevance
from (values
  ('tm-original-topik-i-reading-002','-아/어서',1.0::numeric),
  ('tm-original-topik-ii-reading-001','-기 쉽다',0.9::numeric),
  ('tm-original-topik-ii-reading-002','-(으)ㄹ 뿐 아니라',1.0::numeric),
  ('tm-original-topik-ii-reading-004','-기 전에',0.9::numeric)
) as mapping(question_key, pattern, relevance)
join public.topik_master_questions question on question.external_key = mapping.question_key
join public.topik_master_grammar grammar on grammar.pattern = mapping.pattern
on conflict do nothing;
