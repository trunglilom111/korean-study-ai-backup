# TOPIK Master — Functional Specification

Phiên bản: Phase 0–6 core, 2026-08-22

## 1. Phạm vi sản phẩm

TOPIK Master là khu học TOPIK mobile-first dành riêng cho tài khoản `trunglilom11@gmail.com`. `/topik` hiện tại tiếp tục hoạt động độc lập.

## 2. Màn hình mục tiêu

1. Home: hero, bắt đầu học, test trình độ, 4 shortcut.
2. Dashboard: mục tiêu, ngày thi, streak, tiến độ, kỹ năng, hoạt động gần đây, gợi ý.
3. Học tập: Listening, Reading, Writing, Vocabulary, Grammar.
4. TOPIK Practice: danh sách đề, TOPIK I/II, lọc level và dạng câu.
5. Làm bài: tiến độ, timer, câu hỏi, đáp án, previous/next, question rail.
6. Kết quả: tổng điểm, từng phần, đúng/sai, điểm yếu, làm lại câu sai.
7. 오답노트: lọc kỹ năng, đáp án đã chọn/đúng, giải thích và lịch ôn.
8. Study Planner: mục tiêu, tuần, nhiệm vụ hôm nay, tiến độ.
9. Community: bài đăng, bộ từ vựng, study plan, Q&A.
10. Mobile navigation: Home, Học, TOPIK, Ôn tập, Cá nhân.

Giao diện khung và luồng core Giai đoạn 0–6 đã tồn tại ở local. Khi schema remote chưa được apply, UI dùng fallback an toàn và không giả vờ đã đồng bộ dữ liệu.

## 3. Giai đoạn 1 — Access & Profile

### Quyền truy cập

- Người chưa đăng nhập: chuyển sang `/login`.
- Người đăng nhập sai email: nhận trang 403, không render ứng dụng.
- Người đúng email: được mở TOPIK Master.
- Mọi API `/api/topik-master/*` tự kiểm tra lại user/email.
- Mọi bảng mới bật RLS và chỉ chấp nhận `auth.uid()` cùng email cho phép.

### Hồ sơ

Các trường:

- display name;
- current TOPIK level;
- target TOPIK level;
- exam date;
- weekly study minutes;
- preferred skills;
- streak và activity date cho dashboard về sau.

Hồ sơ có GET/PATCH API; client dùng fallback an toàn khi migration chưa được apply.

## 4. Giai đoạn 2 — Study Brain

### Learning event

Mỗi câu trả lời lưu:

- user, question key;
- skill và subskill;
- đúng/sai, lựa chọn;
- response time;
- confidence;
- error type;
- attempt number và thời điểm.

### Skill stats

Mỗi `(user, skill, subskill)` lưu:

- số lần làm và số đúng;
- thời gian phản hồi trung bình;
- mastery score 0–1;
- weakness score 0–1;
- lần học gần nhất.

Mastery ban đầu dùng EWMA deterministic, chưa dùng AI.

### Review queue

- Hỗ trợ entity `question`, `vocabulary`, `grammar`.
- Có priority, due time, interval, ease factor, lapse count và lý do dạng JSON.
- Sai: đến hạn ngay, priority tăng.
- Đúng: giãn lịch ôn theo interval/ease.

### Adaptive selection contract

Input: candidates, target level, skill stats, review queue, limit.

Output mặc định:

- 40% weak areas;
- 30% target level;
- 20% due review;
- 10% challenge/new.

Không random hoàn toàn; seed ổn định để phiên luyện có thể tái hiện.

## 5. Giai đoạn 3 — Learning Data

### Vocabulary

- lemma/normalized lemma, POS, hanja;
- nghĩa Việt, giải thích Hàn;
- NIKL/TOPIK level, frequency rank/score;
- source key/url/license note;
- metadata và trạng thái publish.

### Grammar

- pattern, nghĩa và cách dùng tiếng Việt;
- TOPIK level, difficulty;
- examples JSON;
- nguồn, license, metadata, publish state.

### Question Bank

- external key và version;
- exam type, skill, subskill, question type;
- prompt, passage/audio URL;
- options, correct answer index;
- fixed explanation tiếng Việt;
- difficulty, status;
- source kind/ref/license note;
- liên kết nhiều-nhiều với vocabulary/grammar.

### Quy tắc nội dung

- Seed Phase 3 là nội dung tự viết, không nhận là đề TOPIK chính thức.
- `source_kind` bắt buộc để truy vết provenance.
- Audio/media chỉ được thêm khi có quyền sử dụng và tái phân phối rõ ràng.
- Nội dung import sau này phải đi qua staging, validation, dedupe và review trước khi publish.

## 6. Giai đoạn 4–6 — Core runtime

- Practice session có start/resume, timer, autosave 15 giây, previous/next, question rail và server-side scoring.
- Kết quả lưu attempt, điểm từng phần, câu sai và gửi learning event cho Study Brain.
- Dashboard đọc mastery/weakness, streak, lịch thi, lượt ôn đến hạn và lịch sử gần đây.
- 오답노트 lọc kỹ năng, hiển thị đáp án, giải thích, đánh giá lượt ôn và cập nhật SRS.
- Planner tạo nhiệm vụ deterministic từ weakness score và review queue.
- Gemini dùng structured JSON cho giải thích câu hỏi và writing feedback; fixed/deterministic fallback không phụ thuộc AI.
- AI cache theo prompt/source version, có quota ngày, timeout, retry, token usage và tùy chọn ước tính chi phí.
- Câu tương tự do AI tạo được lưu với provenance `ai-generated` và trạng thái `draft`, không tự publish.

## 7. Ngoài phạm vi đến hết Giai đoạn 6

- Kiwi worker và pipeline import NIKL.
- Community backend, moderation, sharing.
- Bộ dữ liệu đề thi lớn và audio có license.
- Mobile/accessibility/performance QA đầy đủ và E2E trên Supabase staging.
- Production migration/deploy.

## 8. Tiêu chí hoàn thành Giai đoạn 0–6 local

- Build Next.js thành công.
- Route và API có 3 lớp giới hạn quyền như mô tả.
- Bảy migration additive tồn tại, không chứa `drop table`/`truncate`/reset.
- Có pure TypeScript Study Brain và test tự chạy cho heuristic/lịch ôn.
- Có schema catalog và seed tự viết.
- Có tài liệu nghiên cứu, đặc tả và kế hoạch.
- Production build và lint phạm vi TOPIK Master thành công.
- Chưa apply migration lên Supabase remote nếu chưa được người dùng duyệt riêng.
