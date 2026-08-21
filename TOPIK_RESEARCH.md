# TOPIK Master — Research & Architecture Audit

Ngày audit: 2026-08-22

## 1. Kết luận điều hành

TOPIK Master nên được phát triển như một module mới tại `/topik-master`, dùng lại Supabase Auth và các bảng lịch sử TOPIK hiện có, nhưng không thay đổi hành vi của `/topik` cũ.

Kiến trúc được chốt:

```text
Supabase/Postgres + dữ liệu đã kiểm duyệt
                ↓
Luật chấm điểm, thống kê, SRS và Korean NLP deterministic
                ↓
Gemini cho giải thích/cá nhân hóa thực sự cần reasoning
```

Trong Giai đoạn 0–3:

- Không cài Kiwi và không gọi Gemini trong runtime TOPIK Master.
- Không nhập dữ liệu từ repository bên ngoài.
- Chỉ tạo schema, API hồ sơ, Study Brain deterministic và dữ liệu mẫu tự viết.
- Mọi migration đều bổ sung, không reset hoặc xóa database.
- `/topik-master` và API tương ứng chỉ dành cho `trunglilom11@gmail.com`.

## 2. Audit hệ thống hiện tại

### Stack

- Next.js 16.3 App Router, React 19, TypeScript strict.
- Supabase Auth/Postgres qua `@supabase/ssr` và `@supabase/supabase-js`.
- Gemini qua `@google/genai`, chỉ chạy trong Route Handlers phía server.
- CSS Modules cho giao diện TOPIK Master; mobile-first.

### Auth và bảo mật

- Đăng nhập hiện dùng Supabase email/password tại `/login`.
- API hiện tại xác thực bằng `supabase.auth.getUser()` ở server.
- `GEMINI_API_KEY` chỉ nằm ở server environment; không có service-role key phía client.
- Kế hoạch TOPIK cá nhân hiện đã giới hạn email bằng cả Route Handler và RLS.

Khoảng trống trước Giai đoạn 1: `/topik-master` mới chỉ là client prototype, chưa có cổng authorization ở server và chưa có hồ sơ riêng.

### Database TOPIK hiện có

- `topik_attempts`: kết quả tổng của một lần làm đề.
- `topik_mistakes`: snapshot câu sai và lịch ôn SRS cơ bản.
- `topik_personal_goals`: ngày bắt đầu và mục tiêu độ chính xác.
- `topik_daily_lessons`: bài học/ngày và tiến độ dạng JSON.

Quyết định tái sử dụng:

- Giữ nguyên các bảng trên để không phá `/topik`.
- Study Brain mới lưu event chi tiết theo câu và thống kê theo kỹ năng.
- Question Bank dùng khóa ổn định `external_key`; learning event không bị phụ thuộc cứng vào một phiên bản nội dung.

### Gemini hiện tại

Project đã có các API chat, từ vựng, ngữ pháp, dịch, shadowing và phân tích TOPIK. Một API kế hoạch cá nhân còn có thể sinh bài mới mỗi ngày bằng Gemini.

TOPIK Master sẽ không gọi các API này trong Giai đoạn 0–3. Ở giai đoạn sau, Gemini chỉ nên xử lý:

- giải thích vì sao đúng/sai bằng tiếng Việt;
- phân biệt ngữ pháp gần nghĩa;
- phản hồi bài viết;
- tạo bài tương tự theo điểm yếu;
- tóm tắt hồ sơ năng lực và đề xuất học.

Gemini không dùng cho tra từ cố định, POS/lemma, chấm đáp án cố định, lọc level, xếp tần suất hoặc tính lịch ôn.

## 3. Đánh giá repository và giấy phép

> Trạng thái giấy phép được kiểm tra từ repository nguồn ngày 2026-08-22. Cần kiểm tra lại trước mỗi đợt import hoặc phát hành thương mại.

| Repository | Nhóm | Giá trị | Giấy phép/rủi ro | Runtime? | Import? | Khuyến nghị |
|---|---|---|---|---|---|---|
| [combined_korean_vocabulary_list](https://github.com/julienshim/combined_korean_vocabulary_list) | DATA SOURCE candidate | `results.tsv`: word, POS, hanja, explanation, NIKL/TOPIK level | Repository không có LICENSE; dữ liệu tổng hợp từ NIKL/TOPIK | Không | Chưa | Chỉ dùng schema/ý tưởng làm tham chiếu; xin phép hoặc truy nguồn chính thức trước khi nhập |
| [korean-dict-nikl](https://github.com/spellcheck-ko/korean-dict-nikl) | CORE DATA SOURCE candidate | XML từ 한국어기초사전, 표준국어대사전, 우리말샘 | README nêu CC BY-SA 2.0 KR; ví dụ trích dẫn và media/audio không được tự do tái phân phối | Không | Chưa | Lập pipeline lọc trường và attribution riêng; không nhập media, không nhập ví dụ có nguồn bên thứ ba |
| [Kiwi](https://github.com/bab2min/Kiwi) / [kiwipiepy](https://github.com/bab2min/kiwipiepy) | CORE NLP | morphology, lemma, POS, sentence split, spacing | LGPL v3 theo repository | Có, ở worker/service riêng | Chưa cài | Thử nghiệm ở Giai đoạn 5; không đưa binary nặng vào Next.js web runtime |
| [Korean-TOPIK-Exam-App](https://github.com/aliktl/Korean-TOPIK-Exam-App) | RESEARCH | word-frequency scripts và các tệp từ đề TOPIK | Không có LICENSE; dữ liệu có nguồn từ đề thi | Không | Không | Chỉ nghiên cứu công thức tần suất; không sao chép đề hoặc word list |
| [KLM-corpus](https://github.com/NLPxL2Korean/KLM-corpus) | RESEARCH | CoNLL-U, lemma, Sejong POS và lỗi người học L2 | CC BY-NC-SA 4.0 | Không | Không | Chỉ học taxonomy/quy trình; không đưa corpus vào sản phẩm có khả năng thương mại |
| [Korean-Lexical-Diversity](https://github.com/NLPxL2Korean/Korean-Lexical-Diversity) | RESEARCH | chỉ số đa dạng từ vựng cho writing | CC BY-NC-SA 4.0; phụ thuộc Python/tokenizer, một số chức năng phụ thuộc Windows | Không | Không | Tự cài đặt các chỉ số đã được mô tả công khai sau khi rà soát pháp lý, không copy source |
| [CLIcK](https://github.com/rladmstn1714/click) | RESEARCH | taxonomy textual/grammatical/functional knowledge | Repository không có LICENSE; một phần dữ liệu tái phân loại từ đề chính thức | Không | Không | Chỉ tham khảo taxonomy, không nhập câu hỏi/dataset |
| [KLUE](https://github.com/KLUE-benchmark/KLUE) | FUTURE | 8 benchmark tasks, gồm MRC/STS/NLI | CC BY-SA 4.0 | Không ở V1 | Không ở V1 | Chỉ cân nhắc benchmark offline khi đã có nhu cầu NLP rõ ràng |
| [Korpora](https://github.com/ko-nlp/Korpora) | FUTURE | bộ tải/chuẩn hóa nhiều Korean corpora | Package CC BY 4.0 nhưng từng corpus có license riêng | Không ở V1 | Không ở V1 | Không tải “all”; chỉ chọn corpus cụ thể sau audit license riêng |

### Quyết định nhập dữ liệu

1. Giai đoạn 3 chỉ seed nội dung tự viết và gắn `source_kind = original`.
2. NIKL là nguồn đáng ưu tiên nhất cho đợt import đầu tiên, nhưng phải có manifest attribution và bộ lọc ví dụ/media.
3. `combined_korean_vocabulary_list` hữu ích để đối chiếu cấu trúc và làm QA, không được coi là nguồn có quyền tái phân phối khi chưa có LICENSE.
4. Không dùng câu hỏi hoặc audio đề thi từ repository không có giấy phép rõ ràng.

## 4. Phân vai kỹ thuật

### Database/cache

- từ vựng, ngữ pháp, question bank và nguồn gốc;
- đáp án cố định và giải thích đã kiểm duyệt;
- event học, thống kê kỹ năng, review queue;
- cache kết quả AI theo question/version/user context ở giai đoạn sau.

### Deterministic layer

- chấm đúng/sai;
- mastery/weakness score;
- lịch ôn và priority;
- adaptive mix khởi đầu: 40% điểm yếu, 30% level mục tiêu, 20% đến hạn SRS, 10% nội dung mới/thử thách;
- Kiwi sau này: lemma, POS, morphology, sentence split và vocabulary extraction.

### Gemini layer

- chỉ gọi sau khi đã có kết quả deterministic và context nhỏ;
- structured JSON output;
- cache theo `question_id + question_version + selected_answer + explanation_version`;
- không gửi khóa API xuống client;
- có timeout, quota và fallback sang giải thích cố định.

## 5. Ảnh hưởng lên database và hiệu năng

- Question Bank là read-heavy: index theo `exam_type`, `skill`, `subskill`, `difficulty`, `status`.
- Learning events là append-only: index theo `user_id, created_at` và `user_id, skill, subskill`.
- Skill stats và review queue là bảng tổng hợp nhỏ, đọc nhanh cho dashboard/adaptive practice.
- Nội dung mẫu không chứa audio binary; chỉ lưu URL khi có asset hợp lệ ở giai đoạn sau.
- Không tải Kiwi model trong request Next.js. Nếu dùng, chạy batch/worker và ghi metadata đã xử lý vào Postgres.

## 6. Kết quả audit Giai đoạn 0

- Có thể tiếp tục trên stack hiện tại, không cần rewrite.
- Có thể giới hạn đúng một tài khoản bằng 3 lớp: server route gate, API authorization, Supabase RLS.
- Schema hiện tại đủ để tái sử dụng lịch sử cấp đề; cần bổ sung event theo câu và catalog nội dung.
- Không có nguồn bên ngoài nào được phép import “mù”.
- Hướng triển khai Giai đoạn 1–3 đã được chốt trong `TOPIK_IMPLEMENTATION_PLAN.md`.
