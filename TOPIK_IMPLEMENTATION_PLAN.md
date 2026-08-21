# TOPIK Master — Implementation Plan

Cập nhật: 2026-08-22

## Nguyên tắc rollout

- Mỗi giai đoạn chạy được độc lập và có điểm dừng duyệt.
- Migration chỉ additive; không reset database.
- `/topik` cũ và các bảng hiện tại được giữ nguyên.
- Không đưa dữ liệu ngoài vào production khi provenance/license chưa được duyệt.
- Không bật Gemini hoặc Kiwi chỉ vì schema đã sẵn sàng.

## Giai đoạn 0 — Research & audit

Trạng thái: hoàn thành.

- Audit Next.js, Supabase Auth/schema, Gemini APIs và prototype UI.
- Kiểm tra 10 repository/biến thể theo brief.
- Phân loại CORE, DATA SOURCE, RESEARCH, FUTURE.
- Chốt kiến trúc database → deterministic → Gemini.
- Tạo `TOPIK_RESEARCH.md`, `TOPIK_FUNCTION_SPEC.md`, tài liệu này.

## Giai đoạn 1 — Access & Profile

Trạng thái: hoàn thành ở local; migration chưa apply lên Supabase remote.

- Server layout gate cho `/topik-master`.
- Shared email authorization helper.
- GET/PATCH profile Route Handler.
- `topik_master_profiles`, RLS và index.
- UI hồ sơ có dữ liệu/fallback và lưu thay đổi.

## Giai đoạn 2 — Study Brain foundation

Trạng thái: hoàn thành ở local; migration chưa apply lên Supabase remote.

- `topik_master_learning_events`.
- `topik_master_skill_stats`.
- `topik_master_item_stats`.
- `topik_master_review_queue`.
- RPC ghi câu trả lời + cập nhật thống kê/review queue atomically.
- TypeScript heuristic cho adaptive mix và SRS preview.

## Giai đoạn 3 — Learning Data foundation

Trạng thái: hoàn thành ở local; migration chưa apply lên Supabase remote.

- Vocabulary, Grammar, Question Bank.
- Bảng liên kết question-vocabulary và question-grammar.
- Index và RLS owner-only.
- Seed nhỏ, nguyên gốc, đủ kiểm tra schema/UI; chưa nhập dữ liệu ngoài.

## Giai đoạn 4 — Practice Engine

Trạng thái: hoàn thành ở local; migration chưa apply lên Supabase remote.

- Nối Question Bank vào danh sách đề và bộ lọc.
- Session state, timer, autosave, previous/next, question rail.
- Chấm đáp án deterministic.
- Gọi RPC Study Brain sau mỗi câu/submit.
- Resume an toàn khi reload hoặc đổi thiết bị.

Điểm duyệt: làm trọn một phiên sample từ mở đề đến lưu kết quả.

## Giai đoạn 5 — Results, Mistake Master & Planner

Trạng thái: hoàn thành phần core ở local; migration chưa apply lên Supabase remote.

- Dashboard thật từ skill stats/events.
- Kết quả theo phần, taxonomy điểm yếu.
- 오답노트 thật và lịch ôn.
- Adaptive queue 40/30/20/10.
- Study Planner dựa trên ngày thi và thời lượng tuần.
- Kiwi batch worker được giữ lại cho Giai đoạn 7 vì chưa có benchmark chứng minh lợi ích và chưa cần cho critical path.

Điểm duyệt: dữ liệu một phiên làm bài xuất hiện đúng ở dashboard, kết quả, sổ sai và planner.

## Giai đoạn 6 — AI reasoning layer

Trạng thái: hoàn thành phần core ở local; migration chưa apply lên Supabase remote.

- Gemini structured output cho explain-question.
- Cache explanation theo version/answer context.
- Writing feedback có rubric và fallback.
- Câu luyện tương tự có provenance `ai-generated`, trạng thái `draft` chờ review.
- Daily quota, timeout, một lần retry, token usage và ước tính chi phí qua rate cấu hình môi trường.

Điểm duyệt: AI không nằm trên critical path chấm điểm và không gọi lại vô ích.

## Giai đoạn 7 — Hoàn thiện cuối

Trạng thái: hoàn thành ở local; production migration/deploy chưa thực hiện vì workspace chưa có Supabase CLI/link, service role hoặc cấu hình hosting để xác nhận project đích và rollback.

- Import pipeline staging → validation/dedupe → review → commit draft, bắt buộc license và attribution.
- Mobile/desktop QA, touch target, font phụ, focus state, reduced motion và private security headers.
- Deterministic tests, static RLS/security audit, authenticated browser flow và anonymous smoke test.
- Runbook backup/rollout/rollback, content QA và chống trùng lặp.
- Production migration/deploy vẫn cần xác nhận project đích và backup có thể khôi phục.

## Quy trình apply migration sau khi duyệt

1. Backup schema/data hiện tại.
2. Review SQL diff và xác nhận project Supabase đích.
3. Apply theo thứ tự `202608220001` → `002` → `003` → `004` → `005` → `006` → `007`.
4. Kiểm tra RLS bằng tài khoản được phép, tài khoản khác và anonymous.
5. Smoke-test `/topik` cũ và `/topik-master`.
6. Smoke-test luồng mở đề → autosave → nộp bài → dashboard → sổ sai → planner → AI fallback.
7. Chỉ bật Gemini sau khi đặt quota/rate môi trường và xác nhận ngân sách.
