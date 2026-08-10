# Korean Study AI · Mandarin Path

Ứng dụng học tiếng Hàn và tiếng Trung, gồm phòng luyện TOPIK có nghe/đọc/viết và lộ trình Mandarin từ pinyin đến mục tiêu HSK 3–4.

## Chạy dự án

```bash
npm install
copy .env.example .env.local
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000).

## Cấu hình Gemini

Tạo một API key Gemini trong tài khoản Google AI Studio của bạn, sau đó dán vào `GEMINI_API_KEY` trong `.env.local`.

```env
GEMINI_API_KEY=your-private-key
```

Một khóa Gemini dùng chung cho hai tính năng AI:

- `/chinese`: tạo bộ từ theo HSK 1–4, chủ đề tự chọn, có pinyin, ví dụ và mẹo nhớ.
- `/topik`: tạo đề luyện TOPIK I/II mới theo kỹ năng, độ khó và chủ đề.

Khóa chỉ được dùng ở Route Handler phía máy chủ; không đặt tiền tố `NEXT_PUBLIC_` và không dán khóa vào mã nguồn hoặc commit Git. Các tính năng tạo học liệu AI yêu cầu đăng nhập Supabase.

## Âm thanh TOPIK

Mở trang `/topik`, dùng **Phòng âm thanh TOPIK** để chọn giọng tiếng Hàn và tốc độ phát. Danh sách giọng do Windows/trình duyệt cung cấp. Nếu không thấy giọng Hàn, cài thêm Korean speech trong cài đặt hệ điều hành rồi tải lại trang.
