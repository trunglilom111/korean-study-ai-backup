-- TOPIK Master: real audio metadata, global vocabulary SRS, and TOPIK vocabulary collections.

alter table public.topik_master_questions
  add column if not exists translation_vi text,
  add column if not exists audio_duration_seconds numeric,
  add column if not exists audio_speakers jsonb not null default '[]'::jsonb,
  add column if not exists audio_speed numeric not null default 1.0;

alter table public.topik_master_questions
  drop constraint if exists topik_master_questions_audio_duration_check;
alter table public.topik_master_questions
  add constraint topik_master_questions_audio_duration_check
  check (audio_duration_seconds is null or audio_duration_seconds > 0);

alter table public.topik_master_questions
  drop constraint if exists topik_master_questions_audio_speed_check;
alter table public.topik_master_questions
  add constraint topik_master_questions_audio_speed_check
  check (audio_speed between 0.5 and 2.0);

update public.topik_master_questions as question
set
  audio_url = '/topik-master/audio/' || question.external_key || '.wav',
  translation_vi = source.translation_vi,
  audio_speakers = source.audio_speakers,
  audio_speed = 1.0,
  metadata = question.metadata || jsonb_build_object(
    'audioStatus', 'generated-file',
    'audioProvider', 'Gemini 3.1 Flash TTS',
    'audioDisclosure', 'synthetic-original-content',
    'practiceSpeeds', jsonb_build_array(0.75, 1.0, 1.25),
    'examSpeed', 1.0
  )
from (values
  ('tm-original-listening-001','Người nữ hỏi chuyến đi có khởi hành khi trời mưa và cần chuẩn bị đồ gì.', '[{"name":"여자","gender":"female","voice":"Kore"},{"name":"남자","gender":"male","voice":"Charon"}]'::jsonb),
  ('tm-original-listening-002','Hai người nói về đường tắc, nguy cơ muộn họp và đổi sang tàu điện ngầm.', '[{"name":"여자","gender":"female","voice":"Aoede"},{"name":"남자","gender":"male","voice":"Iapetus"}]'::jsonb),
  ('tm-original-listening-003','Người nam khuyên xử lý phần quan trọng trước để tiết kiệm thời gian.', '[{"name":"여자","gender":"female","voice":"Kore"},{"name":"남자","gender":"male","voice":"Charon"}]'::jsonb),
  ('tm-original-listening-004','Người nam muốn gửi bưu kiện đến Busan; nhân viên sẽ kiểm tra và cân bưu kiện.', '[{"name":"남자","gender":"male","voice":"Iapetus"},{"name":"여자","gender":"female","voice":"Kore"}]'::jsonb),
  ('tm-original-listening-005','Người nữ nói sẽ mang tài liệu đến phòng họp ngay.', '[{"name":"남자","gender":"male","voice":"Charon"},{"name":"여자","gender":"female","voice":"Aoede"}]'::jsonb),
  ('tm-original-listening-006','Thông báo cho biết thời hạn đăng ký sự kiện văn hóa được kéo dài đến thứ Sáu.', '[{"name":"안내자","gender":"female","voice":"Kore"}]'::jsonb),
  ('tm-original-listening-007','Người nam làm thực tập để tích lũy kinh nghiệm liên quan đến chuyên ngành.', '[{"name":"여자","gender":"female","voice":"Aoede"},{"name":"남자","gender":"male","voice":"Iapetus"}]'::jsonb),
  ('tm-original-listening-008','Người nữ rất hài lòng vì thư viện rộng và có nhiều tài liệu cần thiết.', '[{"name":"남자","gender":"male","voice":"Charon"},{"name":"여자","gender":"female","voice":"Kore"}]'::jsonb),
  ('tm-original-topik-i-listening-001','Xin chào, rất vui được gặp bạn lần đầu. Tôi là Sujin.', '[{"name":"여자","gender":"female","voice":"Aoede"}]'::jsonb),
  ('tm-original-topik-i-listening-002','Người nam hỏi có thể mượn cuốn sách thêm một tuần không; người nữ yêu cầu thẻ thành viên.', '[{"name":"남자","gender":"male","voice":"Iapetus"},{"name":"여자","gender":"female","voice":"Kore"}]'::jsonb),
  ('tm-original-topik-i-listening-003','Trời mưa lớn và người nam nói sẽ mua một chiếc ô ở cửa hàng tiện lợi.', '[{"name":"여자","gender":"female","voice":"Aoede"},{"name":"남자","gender":"male","voice":"Charon"}]'::jsonb),
  ('tm-original-topik-i-listening-004','Lớp tiếng Hàn ngày mai bắt đầu lúc hai giờ chiều tại phòng 302 tầng ba.', '[{"name":"안내자","gender":"female","voice":"Kore"}]'::jsonb)
) as source(external_key, translation_vi, audio_speakers)
where question.external_key = source.external_key;

update public.topik_master_questions as question
set audio_duration_seconds = source.duration_seconds
from (values
  ('tm-original-listening-001',14.0::numeric),
  ('tm-original-listening-002',8.3::numeric),
  ('tm-original-listening-003',7.8::numeric),
  ('tm-original-listening-004',10.2::numeric),
  ('tm-original-listening-005',7.2::numeric),
  ('tm-original-listening-006',10.4::numeric),
  ('tm-original-listening-007',8.4::numeric),
  ('tm-original-listening-008',8.5::numeric),
  ('tm-original-topik-i-listening-001',5.6::numeric),
  ('tm-original-topik-i-listening-002',7.4::numeric),
  ('tm-original-topik-i-listening-003',9.2::numeric),
  ('tm-original-topik-i-listening-004',11.6::numeric)
) as source(external_key, duration_seconds)
where question.external_key = source.external_key;

create table if not exists public.topik_master_vocabulary_srs (
  user_id uuid not null references auth.users(id) on delete cascade,
  vocabulary_id uuid not null references public.topik_master_vocabulary(id) on delete cascade,
  status text not null default 'learning'
    check (status in ('learning', 'mastered', 'hard')),
  bookmarked boolean not null default false,
  first_seen_at timestamptz not null default timezone('utc', now()),
  last_reviewed_at timestamptz,
  next_review_at timestamptz,
  review_count integer not null default 0 check (review_count >= 0),
  correct_count integer not null default 0 check (correct_count >= 0),
  wrong_count integer not null default 0 check (wrong_count >= 0),
  ease_factor numeric not null default 2.5 check (ease_factor between 1.3 and 4.0),
  interval_days numeric not null default 0 check (interval_days >= 0),
  mastery_score numeric not null default 0 check (mastery_score between 0 and 1),
  last_rating text check (last_rating is null or last_rating in ('again','hard','good','easy')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, vocabulary_id)
);

create index if not exists topik_master_vocabulary_srs_due_idx
  on public.topik_master_vocabulary_srs (user_id, next_review_at);
create index if not exists topik_master_vocabulary_srs_status_idx
  on public.topik_master_vocabulary_srs (user_id, status);
create index if not exists topik_master_vocabulary_srs_bookmarked_idx
  on public.topik_master_vocabulary_srs (user_id, bookmarked) where bookmarked;

alter table public.topik_master_vocabulary_srs enable row level security;
drop policy if exists "users manage own topik vocabulary srs" on public.topik_master_vocabulary_srs;
create policy "users manage own topik vocabulary srs"
  on public.topik_master_vocabulary_srs for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.topik_master_vocabulary_srs to authenticated;

-- Existing collections were tied to the legacy vocabulary table. Snapshots keep
-- collections stable, so TOPIK Master IDs can safely coexist after removing that FK.
alter table public.vocabulary_collection_items
  drop constraint if exists vocabulary_collection_items_vocabulary_id_fkey;
