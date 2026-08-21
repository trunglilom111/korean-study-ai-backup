# TOPIK Master — Phase 7 Runbook

Cập nhật: 2026-08-22

## Phạm vi hoàn thiện

- Migration `001`–`007` đều additive và phải được apply đúng thứ tự.
- Import dữ liệu luôn đi qua staging, validation, dedupe, review và commit ở trạng thái chưa publish.
- Chỉ tài khoản `trunglilom11@gmail.com` được mở UI, API và dữ liệu TOPIK Master.
- Gemini không nằm trên critical path chấm điểm; quota, timeout, retry, cache và token usage phải được bật trước production.

## Backup trước migration

1. Xác nhận chính xác Supabase project đích và môi trường (staging/production).
2. Tạo backup database hoặc point-in-time restore trong Supabase Dashboard.
3. Export schema hiện tại và các bảng `topik_attempts`, `topik_mistakes` trước khi apply.
4. Ghi lại commit Git, danh sách migration đã apply và thời điểm backup.

Không apply nếu chưa có backup có thể khôi phục hoặc không xác định được project đích.

## Thứ tự rollout

1. Apply `202608220001` đến `202608220007` theo thứ tự tăng dần.
2. Kiểm tra migration history không bị thiếu hoặc chạy lệch thứ tự.
3. Test anonymous: page redirect login, API trả 401.
4. Test tài khoản không được phép: page 403, API trả 403, RLS không đọc/ghi được.
5. Test tài khoản được phép: profile, start/resume/autosave/submit, result, mistake SRS, planner, writing draft và AI fallback.
6. Test `/topik` cũ sau migration.
7. Chỉ bật `GEMINI_API_KEY` sau khi đặt quota và ngân sách.

## Import và content QA

- Batch bắt buộc có tên nguồn, URL nếu có, và license note đủ rõ.
- Item lỗi validation hoặc trùng trong batch không thể được duyệt.
- Commit chỉ đưa nội dung vào catalog ở `draft`/`is_published=false`.
- Người duyệt phải kiểm tra bản quyền, attribution, đáp án, tiếng Hàn, tiếng Việt, độ khó và trùng lặp trước khi publish.
- Không dùng đề TOPIK chính thức hoặc audio nếu chưa có quyền tái phân phối bằng văn bản.

## Rollback

- Nếu lỗi trước khi có dữ liệu người dùng: rollback bằng backup hoặc migration đảo chiều đã review riêng.
- Nếu đã có dữ liệu người dùng: không drop/reset; tắt route bằng access gate, khôi phục bản deploy trước và sửa forward bằng migration additive mới.
- Phiên `submitting` bị kẹt phải được đưa về `active` sau khi xác nhận không có submit đang chạy.
- AI có thể tắt ngay bằng cách gỡ biến `GEMINI_API_KEY`; deterministic fallback vẫn hoạt động.
- Nội dung import lỗi được giữ ở staging hoặc chuyển `rejected`, không xóa lịch sử audit.

## Điều kiện phát hành

- Build, TOPIK lint, deterministic tests và anonymous smoke đều pass.
- Mobile không tràn ngang, touch target chính tối thiểu 44px, keyboard focus rõ và reduced motion được hỗ trợ.
- Mỗi asset riêng của TOPIK Master tối đa 500 KB, tổng thư mục public tối đa 1 MB; mascot hiện dùng WebP responsive.
- Không có console error ở các luồng core.
- Đã kiểm tra RLS bằng ba vai trò: anonymous, tài khoản sai và tài khoản đúng.
- Có backup/restore point và người chịu trách nhiệm duyệt production.
