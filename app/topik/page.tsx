"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import StudyCanvas from "@/components/StudyCanvas";
import { createClient } from "@/utils/supabase/client";
import { getKoreanVoices, speakKorean } from "@/utils/speech";

type Skill = "listening" | "reading" | "writing";
type Workspace = "library" | "ai" | "strategy";
type ExamMode = "practice" | "timed";

type ExamQuestion = {
  id: string;
  number: number;
  prompt: string;
  supportText: string;
  audioText: string;
  options: string[];
  answer: string;
  explanation: string;
  writingGuide: string[];
  points: number;
};

type ExamSection = {
  skill: Skill;
  title: string;
  instructions: string;
  questions: ExamQuestion[];
};

type PracticeExam = {
  id: string;
  title: string;
  subtitle: string;
  target: "TOPIK I" | "TOPIK II";
  level: string;
  estimatedMinutes: number;
  sections: ExamSection[];
  source: "library" | "ai";
};

type VocabularyRow = {
  id: string;
  level: string | null;
  status: string;
};

type AiTopikResponse = {
  ok: boolean;
  error?: string;
  exam?: Omit<PracticeExam, "id" | "level" | "source"> & { target: "TOPIK I" | "TOPIK II" };
};

const skillInfo: Record<Skill, { label: string; icon: string; color: string }> = {
  listening: { label: "Nghe", icon: "01", color: "text-sky-300 bg-sky-400/10 border-sky-400/25" },
  reading: { label: "Đọc", icon: "02", color: "text-emerald-300 bg-emerald-400/10 border-emerald-400/25" },
  writing: { label: "Viết", icon: "03", color: "text-violet-300 bg-violet-400/10 border-violet-400/25" },
};

const topikFormat = {
  "TOPIK I": "Nghe → Đọc · luyện theo luồng làm bài trên máy",
  "TOPIK II": "Nghe → Viết → Đọc · có quản lý thời gian và bảng đáp án",
};

function formatRemainingTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

const practiceLibrary: PracticeExam[] = [
  {
    id: "topik-1-basic-01",
    title: "Đề mô phỏng 01 · Nền tảng",
    subtitle: "Chào hỏi, thời gian và sinh hoạt hằng ngày",
    target: "TOPIK I",
    level: "Cấp 1–2",
    estimatedMinutes: 12,
    source: "library",
    sections: [
      {
        skill: "listening",
        title: "듣기 · Nghe hiểu",
        instructions: "Bấm “Nghe lại” tối đa hai lần, sau đó chọn đáp án phù hợp nhất.",
        questions: [
          {
            id: "i1-q1",
            number: 1,
            audioText: "여자: 오늘 몇 시에 만나요? 남자: 오후 세 시에 카페에서 만나요.",
            supportText: "",
            prompt: "두 사람은 언제 만납니까?",
            options: ["오전 세 시", "오후 세 시", "오후 네 시", "저녁 여섯 시"],
            answer: "오후 세 시",
            explanation: "Nghe thấy ‘오후 세 시’ nghĩa là 3 giờ chiều.",
            writingGuide: [],
            points: 2,
          },
          {
            id: "i1-q2",
            number: 2,
            audioText: "남자: 이 빵은 얼마예요? 여자: 삼천 원이에요.",
            supportText: "",
            prompt: "빵은 얼마입니까?",
            options: ["천 원", "이천 원", "삼천 원", "사천 원"],
            answer: "삼천 원",
            explanation: "‘삼천 원’ là 3.000 won.",
            writingGuide: [],
            points: 2,
          },
        ],
      },
      {
        skill: "reading",
        title: "읽기 · Đọc hiểu",
        instructions: "Đọc câu/đoạn văn rồi chọn đáp án đúng nhất.",
        questions: [
          {
            id: "i1-q3",
            number: 3,
            audioText: "",
            supportText: "오늘은 비가 와요. 우산을 가지고 가세요.",
            prompt: "알맞은 것을 고르세요.",
            options: ["오늘은 날씨가 좋아요.", "오늘은 비가 옵니다.", "우산을 사야 합니다.", "집에 있어야 합니다."],
            answer: "오늘은 비가 옵니다.",
            explanation: "‘비가 와요’ nghĩa là trời mưa.",
            writingGuide: [],
            points: 2,
          },
          {
            id: "i1-q4",
            number: 4,
            audioText: "",
            supportText: "저는 매일 아침에 일곱 시에 일어나서 학교에 갑니다.",
            prompt: "이 사람은 아침에 무엇을 합니까?",
            options: ["운동합니다.", "학교에 갑니다.", "아침을 만듭니다.", "친구를 만납니다."],
            answer: "학교에 갑니다.",
            explanation: "Câu văn nói người này thức dậy lúc 7 giờ rồi đi đến trường.",
            writingGuide: [],
            points: 2,
          },
        ],
      },
    ],
  },
  {
    id: "topik-1-daily-02",
    title: "Đề mô phỏng 02 · Đời sống",
    subtitle: "Mua sắm, hẹn gặp và chỉ đường",
    target: "TOPIK I",
    level: "Cấp 1–2",
    estimatedMinutes: 15,
    source: "library",
    sections: [
      {
        skill: "listening",
        title: "듣기 · Nghe hiểu",
        instructions: "Nghe hội thoại ngắn và xác định nội dung chính.",
        questions: [
          {
            id: "i2-q1",
            number: 1,
            audioText: "여자: 지하철역이 어디예요? 남자: 이 길로 쭉 가세요. 은행 옆에 있어요.",
            supportText: "",
            prompt: "지하철역은 어디에 있습니까?",
            options: ["은행 옆", "학교 앞", "공원 안", "병원 뒤"],
            answer: "은행 옆",
            explanation: "Người nam nói ga tàu điện ở bên cạnh ngân hàng: ‘은행 옆’.",
            writingGuide: [],
            points: 2,
          },
          {
            id: "i2-q2",
            number: 2,
            audioText: "남자: 주말에 뭐 했어요? 여자: 가족하고 바다에 다녀왔어요.",
            supportText: "",
            prompt: "여자는 주말에 무엇을 했습니까?",
            options: ["영화를 봤습니다.", "바다에 갔습니다.", "집에서 쉬었습니다.", "친구를 만났습니다."],
            answer: "바다에 갔습니다.",
            explanation: "‘바다에 다녀왔어요’ nghĩa là đã đi biển về.",
            writingGuide: [],
            points: 2,
          },
        ],
      },
      {
        skill: "reading",
        title: "읽기 · Đọc hiểu",
        instructions: "Chọn câu phù hợp nhất với thông báo hoặc đoạn văn.",
        questions: [
          {
            id: "i2-q3",
            number: 3,
            audioText: "",
            supportText: "도서관은 월요일에 쉽니다. 화요일부터 일요일까지 열어요.",
            prompt: "도서관에 갈 수 없는 날은 언제입니까?",
            options: ["월요일", "화요일", "토요일", "일요일"],
            answer: "월요일",
            explanation: "‘월요일에 쉽니다’ nghĩa là thư viện nghỉ vào thứ Hai.",
            writingGuide: [],
            points: 2,
          },
          {
            id: "i2-q4",
            number: 4,
            audioText: "",
            supportText: "민수 씨는 한국 음식을 좋아합니다. 특히 김치찌개를 자주 먹습니다.",
            prompt: "민수 씨에 대한 설명으로 맞는 것을 고르세요.",
            options: ["한국 음식을 싫어합니다.", "김치찌개를 자주 먹습니다.", "요리를 잘 못합니다.", "매일 식당에 갑니다."],
            answer: "김치찌개를 자주 먹습니다.",
            explanation: "Đoạn văn nêu rõ Minsu thường ăn kimchi-jjigae.",
            writingGuide: [],
            points: 2,
          },
          {
            id: "i2-q5",
            number: 5,
            audioText: "",
            supportText: "[휴대폰 수리] 오늘 오후 5시까지 접수하면 내일 찾을 수 있습니다.",
            prompt: "안내문과 같은 것을 고르세요.",
            options: ["오늘 바로 받을 수 있습니다.", "내일 수리 신청을 해야 합니다.", "오늘 5시 전에 맡기면 내일 받을 수 있습니다.", "휴대폰을 새로 사야 합니다."],
            answer: "오늘 5시 전에 맡기면 내일 받을 수 있습니다.",
            explanation: "Thông báo nói nộp trước 5 giờ chiều hôm nay thì ngày mai có thể nhận lại.",
            writingGuide: [],
            points: 2,
          },
        ],
      },
    ],
  },
  {
    id: "topik-2-balanced-01",
    title: "Đề mô phỏng 01 · Tổng hợp",
    subtitle: "Ý kiến, thói quen và viết đoạn ngắn",
    target: "TOPIK II",
    level: "Cấp 3–4",
    estimatedMinutes: 22,
    source: "library",
    sections: [
      {
        skill: "listening",
        title: "듣기 · Nghe hiểu",
        instructions: "Nghe nội dung và chọn ý chính hoặc chi tiết phù hợp.",
        questions: [
          {
            id: "ii1-q1",
            number: 1,
            audioText: "여자: 요즘 회사 근처에 자전거 도로가 생겼어요. 그래서 저는 출근할 때 자전거를 타기 시작했어요. 시간도 절약되고 운동도 돼서 만족해요.",
            supportText: "",
            prompt: "여자가 자전거로 출근하는 이유로 알맞은 것을 고르세요.",
            options: ["주차비가 비싸서", "시간을 아끼고 운동도 할 수 있어서", "버스가 너무 늦게 와서", "친구와 함께 타고 싶어서"],
            answer: "시간을 아끼고 운동도 할 수 있어서",
            explanation: "Người nói hài lòng vì tiết kiệm thời gian và vận động được.",
            writingGuide: [],
            points: 3,
          },
          {
            id: "ii1-q2",
            number: 2,
            audioText: "남자: 이번 행사는 신청자가 많아서 장소를 더 큰 강당으로 바꿨습니다. 시간은 그대로 토요일 오전 열 시입니다. 참석하실 분들은 금요일까지 이메일로 알려 주세요.",
            supportText: "",
            prompt: "안내 내용과 같은 것을 고르세요.",
            options: ["행사 시간이 바뀌었습니다.", "행사 장소가 바뀌었습니다.", "신청자가 적었습니다.", "토요일에 신청해야 합니다."],
            answer: "행사 장소가 바뀌었습니다.",
            explanation: "Địa điểm được đổi sang hội trường lớn hơn, còn thời gian giữ nguyên.",
            writingGuide: [],
            points: 3,
          },
        ],
      },
      {
        skill: "reading",
        title: "읽기 · Đọc hiểu",
        instructions: "Đọc đoạn văn và chọn nội dung đúng nhất.",
        questions: [
          {
            id: "ii1-q3",
            number: 3,
            audioText: "",
            supportText: "최근에는 물건을 소유하기보다 필요한 기간에만 빌려 쓰는 사람들이 늘고 있다. 특히 자주 사용하지 않는 공구나 캠핑 용품은 대여 서비스가 편리하고 비용도 적게 든다.",
            prompt: "이 글의 중심 생각으로 알맞은 것을 고르세요.",
            options: ["대여 서비스는 물건을 사는 것보다 항상 비싸다.", "자주 쓰지 않는 물건은 빌려 쓰는 것이 효율적일 수 있다.", "캠핑 용품은 직접 만들어야 한다.", "공구는 누구에게도 빌려 주면 안 된다."],
            answer: "자주 쓰지 않는 물건은 빌려 쓰는 것이 효율적일 수 있다.",
            explanation: "Đoạn văn nhấn mạnh lợi ích tiện và tiết kiệm của dịch vụ thuê đồ ít dùng.",
            writingGuide: [],
            points: 3,
          },
          {
            id: "ii1-q4",
            number: 4,
            audioText: "",
            supportText: "회의가 길어지는 가장 큰 이유는 목적 없이 여러 주제를 한꺼번에 논의하기 때문이다. 회의 전에 안건과 시간을 정하고, 결정이 필요한 내용부터 다루면 시간을 줄일 수 있다.",
            prompt: "글의 내용으로 맞는 것을 고르세요.",
            options: ["회의는 주제가 많을수록 짧아진다.", "회의 전에 안건과 시간을 정하는 것이 도움이 된다.", "회의에서는 결정할 일을 마지막에 다뤄야 한다.", "긴 회의는 피할 수 없다."],
            answer: "회의 전에 안건과 시간을 정하는 것이 도움이 된다.",
            explanation: "Tác giả đề xuất xác định nội dung và thời gian họp trước để giảm thời lượng.",
            writingGuide: [],
            points: 3,
          },
        ],
      },
      {
        skill: "writing",
        title: "쓰기 · Viết",
        instructions: "Viết một đoạn ngắn theo yêu cầu. Sau khi nộp, dùng checklist để tự kiểm tra.",
        questions: [
          {
            id: "ii1-q5",
            number: 5,
            audioText: "",
            supportText: "",
            prompt: "‘건강을 위해 내가 실천하는 일’에 대해 4~6문장으로 쓰세요.",
            options: [],
            answer: "저는 건강을 위해 매일 저녁에 삼십 분씩 걷습니다. 그리고 물을 자주 마시려고 합니다. 주말에는 친구와 배드민턴을 칩니다. 이런 습관을 계속 지키고 싶습니다.",
            explanation: "Bài mẫu chỉ để tham khảo cách triển khai: thói quen → ví dụ cụ thể → kết luận.",
            writingGuide: ["Có nêu ít nhất hai việc làm cụ thể.", "Dùng đúng liên kết câu như 그리고, 그래서 hoặc -려고 하다.", "Đủ 4–6 câu và bám đúng chủ đề.", "Tự kiểm tra trợ từ, thì và khoảng cách."],
            points: 10,
          },
        ],
      },
    ],
  },
  {
    id: "topik-2-advanced-02",
    title: "Đề mô phỏng 02 · Phân tích",
    subtitle: "Xã hội, môi trường và lập luận viết",
    target: "TOPIK II",
    level: "Cấp 5–6",
    estimatedMinutes: 25,
    source: "library",
    sections: [
      {
        skill: "listening",
        title: "듣기 · Nghe hiểu",
        instructions: "Nghe và xác định lập trường, lý do hoặc kết luận của người nói.",
        questions: [
          {
            id: "ii2-q1",
            number: 1,
            audioText: "여자: 일회용품 사용을 줄이려면 개인의 노력만 강조해서는 안 됩니다. 소비자가 선택하기 쉬운 친환경 제품을 늘리고, 기업과 지방자치단체도 함께 제도를 마련해야 합니다.",
            supportText: "",
            prompt: "여자의 주장으로 알맞은 것을 고르세요.",
            options: ["개인의 노력은 전혀 필요 없다.", "환경 문제는 소비자만 해결해야 한다.", "일회용품을 줄이기 위해 여러 주체의 협력이 필요하다.", "친환경 제품은 선택하기 어렵게 만들어야 한다."],
            answer: "일회용품을 줄이기 위해 여러 주체의 협력이 필요하다.",
            explanation: "Người nói đề cập nỗ lực cá nhân cùng doanh nghiệp và chính quyền địa phương.",
            writingGuide: [],
            points: 4,
          },
        ],
      },
      {
        skill: "reading",
        title: "읽기 · Đọc hiểu",
        instructions: "Đọc lập luận và chọn suy luận hợp lý nhất.",
        questions: [
          {
            id: "ii2-q2",
            number: 2,
            audioText: "",
            supportText: "재택근무가 확산되면서 업무 성과를 평가하는 방식도 달라지고 있다. 출근 시간이나 자리에 앉아 있는 시간보다, 정해진 목표를 얼마나 책임 있게 달성했는지가 더 중요해졌다.",
            prompt: "이 글에서 알 수 있는 것은 무엇입니까?",
            options: ["재택근무에서는 업무 목표가 필요 없다.", "업무 평가는 근무 시간만으로 이루어진다.", "재택근무 확산으로 결과 중심의 평가가 중요해졌다.", "모든 회사가 재택근무를 금지하고 있다."],
            answer: "재택근무 확산으로 결과 중심의 평가가 중요해졌다.",
            explanation: "Bài đọc so sánh thời gian ngồi làm với mức độ hoàn thành mục tiêu và nhấn mạnh kết quả.",
            writingGuide: [],
            points: 4,
          },
          {
            id: "ii2-q3",
            number: 3,
            audioText: "",
            supportText: "지역 축제는 관광객을 모으는 데 도움이 되지만, 주민의 일상생활에 불편을 줄 수도 있다. 따라서 축제를 기획할 때에는 방문객 수뿐 아니라 교통, 소음, 쓰레기 문제에 대한 대책도 함께 마련해야 한다.",
            prompt: "글쓴이가 강조하는 것은 무엇입니까?",
            options: ["축제는 관광객이 많을수록 성공한다.", "축제를 기획할 때 주민 생활에 미치는 영향도 고려해야 한다.", "지역 축제는 모두 취소해야 한다.", "교통 문제는 축제와 관계없다."],
            answer: "축제를 기획할 때 주민 생활에 미치는 영향도 고려해야 한다.",
            explanation: "Tác giả yêu cầu chuẩn bị biện pháp cho giao thông, tiếng ồn, rác thải bên cạnh việc thu hút khách.",
            writingGuide: [],
            points: 4,
          },
        ],
      },
      {
        skill: "writing",
        title: "쓰기 · Viết",
        instructions: "Viết ý kiến có lý do và ví dụ. Đối chiếu với checklist trước khi tự đánh giá.",
        questions: [
          {
            id: "ii2-q4",
            number: 4,
            audioText: "",
            supportText: "",
            prompt: "‘대중교통을 더 많이 이용해야 하는가’에 대한 자신의 생각을 6~8문장으로 쓰세요.",
            options: [],
            answer: "저는 대중교통을 더 많이 이용해야 한다고 생각합니다. 자동차를 적게 사용하면 교통 체증과 대기 오염을 줄일 수 있기 때문입니다. 물론 사람이 많은 시간에는 불편할 수 있습니다. 하지만 버스와 지하철 노선을 늘리면 이런 문제를 해결할 수 있습니다. 따라서 개인과 정부가 함께 노력해야 합니다.",
            explanation: "Bài mẫu có cấu trúc: nêu quan điểm → lý do → thừa nhận mặt hạn chế → đề xuất → kết luận.",
            writingGuide: ["Mở đầu bằng quan điểm rõ ràng: -다고 생각하다.", "Có ít nhất hai lý do hoặc một lý do kèm ví dụ cụ thể.", "Dùng liên kết lập luận như 하지만, 따라서, -기 때문이다.", "Đủ 6–8 câu, không lạc sang chủ đề khác.", "Kiểm tra kính ngữ/trang trọng và lỗi chính tả."],
            points: 12,
          },
        ],
      },
    ],
  },
  {
    id: "topik-1-work-03",
    title: "Đề mô phỏng 03 · Công việc và lịch hẹn",
    subtitle: "Mini test mới: thời gian, thông báo và phản hồi ngắn",
    target: "TOPIK I",
    level: "Cấp 1–2",
    estimatedMinutes: 10,
    source: "library",
    sections: [
      {
        skill: "listening",
        title: "듣기 · Nghe hiểu",
        instructions: "Nghe hội thoại và chọn thông tin đúng nhất.",
        questions: [
          {
            id: "i3-q1",
            number: 1,
            audioText: "여자: 내일 회의는 몇 시에 시작해요? 남자: 원래 아홉 시였는데 열 시로 바뀌었어요.",
            supportText: "",
            prompt: "회의는 언제 시작합니까?",
            options: ["아침 여덟 시", "아침 아홉 시", "아침 열 시", "오후 열 시"],
            answer: "아침 열 시",
            explanation: "Cuộc họp ban đầu lúc 9 giờ nhưng đã đổi sang 10 giờ sáng.",
            writingGuide: [],
            points: 2,
          },
        ],
      },
      {
        skill: "reading",
        title: "읽기 · Đọc hiểu",
        instructions: "Đọc thông báo và chọn câu đúng.",
        questions: [
          {
            id: "i3-q2",
            number: 2,
            audioText: "",
            supportText: "[안내] 오늘 도서관은 오후 6시에 문을 닫습니다. 책을 빌리고 싶은 분은 5시 30분까지 와 주세요.",
            prompt: "안내 내용과 같은 것을 고르십시오.",
            options: ["도서관은 오늘 쉽니다.", "책은 오후 6시까지 빌릴 수 있습니다.", "책을 빌리려면 5시 30분 전에 와야 합니다.", "도서관은 오후 5시에 문을 닫습니다."],
            answer: "책을 빌리려면 5시 30분 전에 와야 합니다.",
            explanation: "Thư viện đóng cửa lúc 6 giờ, nhưng phải đến trước 5 giờ 30 để mượn sách.",
            writingGuide: [],
            points: 2,
          },
        ],
      },
    ],
  },
  {
    id: "topik-2-city-03",
    title: "Đề mô phỏng 03 · Thành phố bền vững",
    subtitle: "Mini test mới: ý chính bài đọc và lập luận ngắn",
    target: "TOPIK II",
    level: "Cấp 3–4",
    estimatedMinutes: 14,
    source: "library",
    sections: [
      {
        skill: "reading",
        title: "읽기 · Đọc hiểu",
        instructions: "Đọc đoạn văn và chọn ý chính phù hợp nhất.",
        questions: [
          {
            id: "ii3-q1",
            number: 1,
            audioText: "",
            supportText: "도시의 공원을 늘리는 일은 단순히 쉴 곳을 만드는 것 이상의 의미가 있다. 공원은 여름철 열기를 줄이고 주민들이 운동하거나 이웃과 만나는 공간이 되기 때문이다. 따라서 공원 계획을 세울 때에는 면적뿐 아니라 사람들이 쉽게 찾아갈 수 있는지도 함께 고려해야 한다.",
            prompt: "글의 중심 생각으로 가장 알맞은 것을 고르십시오.",
            options: ["공원은 넓을수록 항상 좋다.", "공원은 환경과 주민 생활을 함께 고려해 계획해야 한다.", "공원에서는 운동만 해야 한다.", "도시에는 공원이 필요하지 않다."],
            answer: "공원은 환경과 주민 생활을 함께 고려해 계획해야 한다.",
            explanation: "Đoạn văn nêu lợi ích môi trường lẫn đời sống cộng đồng, và nhấn mạnh việc quy hoạch phải dễ tiếp cận.",
            writingGuide: [],
            points: 4,
          },
        ],
      },
      {
        skill: "writing",
        title: "쓰기 · Viết",
        instructions: "Viết ý kiến ngắn có nêu quan điểm và ít nhất một lý do cụ thể.",
        questions: [
          {
            id: "ii3-q2",
            number: 2,
            audioText: "",
            supportText: "",
            prompt: "‘우리 동네에 공원이 더 필요하다’에 대한 자신의 생각을 4~6문장으로 쓰십시오.",
            options: [],
            answer: "저는 우리 동네에 공원이 더 필요하다고 생각합니다. 공원이 있으면 사람들이 가까운 곳에서 운동할 수 있습니다. 또한 아이들과 어른들이 함께 쉴 공간도 생깁니다. 그래서 공원을 늘리고 잘 관리해야 합니다.",
            explanation: "Bài mẫu đi theo khung: quan điểm → hai lợi ích cụ thể → kết luận/đề xuất.",
            writingGuide: ["Mở đầu bằng -다고 생각하다 để nêu quan điểm.", "Nêu ít nhất một lợi ích cụ thể cho cư dân.", "Dùng liên kết như 또한, 그래서 hoặc -기 때문에.", "Viết đủ 4–6 câu và kiểm tra cách nhau giữa từ."],
            points: 10,
          },
        ],
      },
    ],
  },
];

function getAllQuestions(exam: PracticeExam | null) {
  return exam?.sections.flatMap((section) =>
    section.questions.map((question) => ({ question, section }))
  ) ?? [];
}

function isSkill(value: string): value is Skill {
  return value === "listening" || value === "reading" || value === "writing";
}

export default function TopikPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [words, setWords] = useState<VocabularyRow[]>([]);
  const [authReady, setAuthReady] = useState(false);
  const [workspace, setWorkspace] = useState<Workspace>("library");
  const [activeExam, setActiveExam] = useState<PracticeExam | null>(null);
  const [examMode, setExamMode] = useState<ExamMode>("practice");
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [aiTarget, setAiTarget] = useState<"TOPIK I" | "TOPIK II">("TOPIK I");
  const [aiSkill, setAiSkill] = useState("all");
  const [aiLevel, setAiLevel] = useState("beginner");
  const [aiTopic, setAiTopic] = useState("");
  const [aiCount, setAiCount] = useState(8);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [koreanVoices, setKoreanVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceName, setVoiceName] = useState("");
  const [speechRate, setSpeechRate] = useState(0.85);

  useEffect(() => {
    let cancelled = false;

    async function loadTopikData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("vocabulary")
        .select("id, level, status")
        .eq("user_id", user.id);

      if (cancelled) return;

      if (error) {
        console.error("TOPIK vocabulary error:", error);
      } else {
        setWords((data || []) as VocabularyRow[]);
      }

      setAuthReady(true);
    }

    loadTopikData();

    return () => {
      cancelled = true;
    };
  }, [router, supabase]);

  useEffect(() => {
    function loadVoices() {
      const availableVoices = getKoreanVoices();
      setKoreanVoices(availableVoices);
      setVoiceName((currentName) => currentName || availableVoices.find((voice) => voice.default)?.name || availableVoices[0]?.name || "");
    }

    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, []);

  const questions = useMemo(() => getAllQuestions(activeExam), [activeExam]);
  const current = questions[questionIndex];
  const scoredQuestions = questions.filter(({ question }) => question.options.length > 0);
  const correctCount = scoredQuestions.filter(
    ({ question }) => answers[question.id] === question.answer
  ).length;
  const answeredCount = questions.filter(({ question }) => Boolean(answers[question.id]?.trim())).length;
  const scorePercent = scoredQuestions.length
    ? Math.round((correctCount / scoredQuestions.length) * 100)
    : 0;

  useEffect(() => {
    if (!activeExam || submitted || examMode !== "timed" || remainingSeconds === null) return;
    if (remainingSeconds <= 0) return;

    const timer = window.setInterval(() => {
      setRemainingSeconds((currentSeconds) => {
        if (currentSeconds === null) return null;
        if (currentSeconds <= 1) {
          window.setTimeout(() => setSubmitted(true), 0);
          return 0;
        }
        return currentSeconds - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [activeExam, examMode, remainingSeconds, submitted]);

  useEffect(() => {
    if (!current?.question.audioText || submitted || examMode !== "timed") return;
    const timeout = window.setTimeout(() => {
      speakKorean(current.question.audioText, { rate: speechRate, voiceName });
    }, 450);

    return () => window.clearTimeout(timeout);
  }, [current?.question.audioText, current?.question.id, examMode, speechRate, submitted, voiceName]);

  const beginnerWords = words.filter((word) => word.level === "초급").length;
  const intermediateWords = words.filter((word) => word.level === "중급").length;
  const advancedWords = words.filter((word) => word.level === "고급").length;
  const masteredWords = words.filter((word) => word.status === "mastered").length;

  function startExam(exam: PracticeExam, mode: ExamMode = "practice") {
    setActiveExam(exam);
    setExamMode(mode);
    setRemainingSeconds(mode === "timed" ? exam.estimatedMinutes * 60 : null);
    setQuestionIndex(0);
    setAnswers({});
    setSubmitted(false);
    window.setTimeout(() => {
      document.getElementById("exam-room")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function chooseAnswer(questionId: string, answer: string) {
    if (submitted) return;
    setAnswers((previous) => ({ ...previous, [questionId]: answer }));
  }

  function finishExam() {
    setSubmitted(true);

    if (!activeExam) return;

    const attempt = {
      id: `${activeExam.id}-${Date.now()}`,
      title: activeExam.title,
      target: activeExam.target,
      completedAt: new Date().toISOString(),
      scorePercent,
      correctCount,
      totalMultipleChoice: scoredQuestions.length,
    };

    try {
      const stored = window.localStorage.getItem("topik-practice-history");
      const history = stored ? (JSON.parse(stored) as unknown[]) : [];
      window.localStorage.setItem(
        "topik-practice-history",
        JSON.stringify([attempt, ...history].slice(0, 12))
      );
    } catch {
      // The result is still visible even when browser storage is unavailable.
    }
  }

  async function generateExam() {
    if (aiTarget === "TOPIK I" && aiSkill === "writing") {
      setGenerationError("TOPIK I không có phần viết. Hãy chọn nghe, đọc hoặc cả hai.");
      return;
    }

    setGenerating(true);
    setGenerationError("");

    try {
      const response = await fetch("/api/ai/topik", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: aiTarget,
          skill: aiSkill,
          level: aiLevel,
          topic: aiTopic,
          questionCount: aiCount,
        }),
      });

      const data = (await response.json()) as AiTopikResponse;

      if (!response.ok || !data.ok || !data.exam) {
        setGenerationError(data.error || "Không thể tạo đề bằng AI.");
        return;
      }

      const sections = data.exam.sections.filter((section) => isSkill(section.skill));

      if (!sections.length || !sections.some((section) => section.questions.length > 0)) {
        setGenerationError("AI trả về đề chưa đủ cấu trúc. Hãy thử tạo lại.");
        return;
      }

      const generatedExam: PracticeExam = {
        ...data.exam,
        id: `ai-${Date.now()}`,
        level: aiLevel,
        source: "ai",
        sections: sections.map((section) => ({ ...section, skill: section.skill as Skill })),
      };

      startExam(generatedExam);
    } catch {
      setGenerationError("Không kết nối được với AI. Hãy thử lại sau.");
    } finally {
      setGenerating(false);
    }
  }

  if (!authReady) {
    return (
      <AppShell>
        <div className="flex min-h-[65vh] items-center justify-center text-center">
          <div>
            <div className="text-5xl">TOPIK</div>
            <p className="mt-4 font-semibold">Đang chuẩn bị khu vực luyện thi...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl">
        <section className="relative overflow-hidden rounded-[2rem] border border-amber-300/20 bg-[radial-gradient(circle_at_82%_8%,rgba(251,191,36,0.2),transparent_31%),linear-gradient(135deg,#1e1b4b,#101827_58%,#172554)] p-6 md:p-9">
          <div className="relative z-10 max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-300">TOPIK PREP CENTER</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-white md:text-5xl">Ôn thi TOPIK có chiến lược.</h1>
            <p className="mt-4 max-w-2xl leading-7 text-slate-300">Luyện đề mô phỏng cho TOPIK I và TOPIK II theo luồng thi trên máy: nghe tự phát, bảng đáp án, làm có giờ, xem lỗi và tạo đề mới theo đúng kỹ năng cần ôn.</p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm">
              <span className="rounded-full border border-slate-500/50 bg-slate-950/25 px-3 py-1.5 text-slate-200">TOPIK I · Nghe + Đọc</span>
              <span className="rounded-full border border-slate-500/50 bg-slate-950/25 px-3 py-1.5 text-slate-200">TOPIK II · Nghe + Đọc + Viết</span>
              <span className="rounded-full border border-slate-500/50 bg-slate-950/25 px-3 py-1.5 text-slate-200">Đề AI nguyên gốc · tới 30 câu</span>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ReadinessStat label="Từ sơ cấp" value={beginnerWords} note="cho TOPIK I" />
          <ReadinessStat label="Từ trung cấp" value={intermediateWords} note="cho TOPIK II" />
          <ReadinessStat label="Từ cao cấp" value={advancedWords} note="cho TOPIK II" />
          <ReadinessStat label="Đã thuộc" value={masteredWords} note="tổng kho từ" highlight />
        </section>

        <section className="mt-6 grid gap-5 rounded-3xl border border-sky-400/20 bg-sky-400/5 p-5 md:grid-cols-[0.8fr_1.2fr] md:p-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-300">PHÒNG ÂM THANH TOPIK</p>
            <h2 className="mt-2 text-xl font-bold text-white">Chọn giọng đọc dễ nghe trước khi làm đề.</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">Giọng lấy từ các giọng tiếng Hàn đã cài trong Windows/trình duyệt. Cài thêm giọng Hàn trong hệ điều hành nếu danh sách trống.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_150px_auto] sm:items-end">
            <label className="block text-sm font-medium text-slate-300"><span className="mb-2 block">Giọng tiếng Hàn</span><select value={voiceName} onChange={(event) => setVoiceName(event.target.value)} className="form-control" disabled={!koreanVoices.length}><option value="">{koreanVoices.length ? "Giọng hệ thống mặc định" : "Chưa tìm thấy giọng Hàn"}</option>{koreanVoices.map((voice) => <option key={`${voice.name}-${voice.lang}`} value={voice.name}>{voice.name} · {voice.lang}</option>)}</select></label>
            <label className="block text-sm font-medium text-slate-300"><span className="mb-2 flex justify-between"><span>Tốc độ</span><span className="text-sky-300">{speechRate.toFixed(2)}×</span></span><input aria-label="Tốc độ giọng đọc" type="range" min="0.7" max="1" step="0.05" value={speechRate} onChange={(event) => setSpeechRate(Number(event.target.value))} className="h-3 w-full accent-sky-300" /></label>
            <button type="button" onClick={() => speakKorean("안녕하세요. 지금은 TOPIK 듣기 연습을 시작합니다.", { rate: speechRate, voiceName })} className="rounded-xl bg-sky-300 px-4 py-3 text-sm font-bold text-sky-950 transition hover:bg-sky-200">Thử giọng</button>
          </div>
        </section>

        <div className="mt-8 grid grid-cols-3 rounded-2xl border border-slate-800 bg-slate-900 p-1.5">
          <WorkspaceButton active={workspace === "library"} onClick={() => setWorkspace("library")} label="Kho đề" />
          <WorkspaceButton active={workspace === "ai"} onClick={() => setWorkspace("ai")} label="Tạo đề AI" />
          <WorkspaceButton active={workspace === "strategy"} onClick={() => setWorkspace("strategy")} label="Chiến lược" />
        </div>

        {workspace === "library" && (
          <section className="mt-8">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
              <div>
                <p className="text-sm font-semibold text-amber-300">KHO ĐỀ MÔ PHỎNG</p>
                <h2 className="mt-1 text-2xl font-bold text-white">Chọn một đề và làm theo nhịp thi.</h2>
              </div>
              <p className="max-w-lg text-sm leading-6 text-slate-500">Các đề dưới đây được viết mới để luyện kỹ năng, không phải đề TOPIK chính thức hoặc đề quá khứ.</p>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {practiceLibrary.map((exam) => (
                <article key={exam.id} className="rounded-3xl border border-slate-800 bg-slate-900 p-6 transition hover:border-amber-400/45 hover:bg-slate-800">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${exam.target === "TOPIK I" ? "border-sky-400/30 bg-sky-400/10 text-sky-300" : "border-violet-400/30 bg-violet-400/10 text-violet-300"}`}>{exam.target}</span>
                      <h3 className="mt-4 text-xl font-bold text-white">{exam.title}</h3>
                      <p className="mt-2 text-sm text-slate-400">{exam.subtitle}</p>
                      <p className="mt-2 text-xs leading-5 text-slate-500">{topikFormat[exam.target]}</p>
                    </div>
                    <span className="shrink-0 rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-400">{exam.estimatedMinutes} phút</span>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {exam.sections.map((section) => (
                      <SkillBadge key={section.skill} skill={section.skill} count={section.questions.length} />
                    ))}
                  </div>

                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-5">
                    <span className="text-sm text-slate-500">{exam.level} · {getAllQuestions(exam).length} câu</span>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => startExam(exam, "practice")} className="rounded-xl border border-slate-600 px-3 py-2.5 text-sm font-bold text-slate-200 transition hover:border-slate-400">Luyện</button>
                      <button type="button" onClick={() => startExam(exam, "timed")} className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-amber-100">Thi có giờ →</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {workspace === "ai" && (
          <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.8fr]">
            <div className="rounded-3xl border border-violet-400/20 bg-[linear-gradient(135deg,rgba(91,33,182,0.22),rgba(15,23,42,0.92))] p-6 md:p-8">
              <p className="text-sm font-semibold text-violet-300">AI EXAM MAKER</p>
              <h2 className="mt-2 text-2xl font-bold text-white">Tạo đề TOPIK theo đúng điểm yếu của bạn.</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">AI tạo đề luyện mới, đáp án và giải thích tiếng Việt. Đề không sử dụng câu hỏi chính thức.</p>

              <div className="mt-7 grid gap-4 sm:grid-cols-2">
                <FormField label="Kỳ thi">
                  <select value={aiTarget} onChange={(event) => { const target = event.target.value as "TOPIK I" | "TOPIK II"; setAiTarget(target); if (target === "TOPIK I" && aiSkill === "writing") setAiSkill("all"); if (target === "TOPIK I") setAiLevel("beginner"); }} className="form-control">
                    <option value="TOPIK I">TOPIK I · Cấp 1–2</option>
                    <option value="TOPIK II">TOPIK II · Cấp 3–6</option>
                  </select>
                </FormField>
                <FormField label="Kỹ năng">
                  <select value={aiSkill} onChange={(event) => setAiSkill(event.target.value)} className="form-control">
                    <option value="all">Tổng hợp kỹ năng</option>
                    <option value="listening">Chỉ nghe</option>
                    <option value="reading">Chỉ đọc</option>
                    {aiTarget === "TOPIK II" && <option value="writing">Chỉ viết</option>}
                  </select>
                </FormField>
                <FormField label="Độ khó">
                  <select value={aiLevel} onChange={(event) => setAiLevel(event.target.value)} className="form-control">
                    {aiTarget === "TOPIK I" ? <option value="beginner">Sơ cấp · Cấp 1–2</option> : <><option value="intermediate">Trung cấp · Cấp 3–4</option><option value="advanced">Cao cấp · Cấp 5–6</option></>}
                  </select>
                </FormField>
                <FormField label="Số câu">
                  <select value={aiCount} onChange={(event) => setAiCount(Number(event.target.value))} className="form-control">
                    <option value={8}>8 câu · nhanh</option>
                    <option value={12}>12 câu · tiêu chuẩn</option>
                    <option value={20}>20 câu · luyện sâu</option>
                    <option value={30}>30 câu · phiên mô phỏng dài</option>
                  </select>
                </FormField>
              </div>

              <div className="mt-4">
                <label className="mb-2 block text-sm font-medium text-slate-300">Chủ đề muốn ôn <span className="font-normal text-slate-500">(không bắt buộc)</span></label>
                <input value={aiTopic} onChange={(event) => setAiTopic(event.target.value)} maxLength={180} placeholder="Ví dụ: môi trường, đời sống công sở, du lịch..." className="form-control" />
              </div>

              {generationError && <p className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{generationError}</p>}

              <button type="button" onClick={generateExam} disabled={generating} className="mt-6 rounded-xl bg-violet-400 px-5 py-3 font-bold text-violet-950 transition hover:bg-violet-300 disabled:cursor-not-allowed disabled:opacity-50">
                {generating ? "AI đang tạo đề..." : "Tạo đề TOPIK bằng AI"}
              </button>
            </div>

            <aside className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
              <p className="text-sm font-semibold text-amber-300">AI sẽ tạo gì?</p>
              <div className="mt-5 space-y-5">
                <AiFeature number="01" title="Nội dung mới" text="Câu hỏi được tạo riêng theo kỳ thi, kỹ năng và chủ đề bạn chọn." />
                <AiFeature number="02" title="Có đáp án, giải thích" text="Trắc nghiệm có chấm điểm; câu viết có bài mẫu và checklist tự sửa." />
                <AiFeature number="03" title="Nghe theo giọng bạn chọn" text="Đổi giọng và tốc độ tại Phòng âm thanh TOPIK trước khi mở đề." />
              </div>
              <p className="mt-6 border-t border-slate-800 pt-5 text-xs leading-5 text-slate-500">Cần có GEMINI_API_KEY trong .env.local. Gemini có thể tạo nhiều đề nguyên gốc theo chủ đề của bạn; không cần thêm API TOPIK riêng.</p>
            </aside>
          </section>
        )}

        {workspace === "strategy" && (
          <section className="mt-8 grid gap-4 lg:grid-cols-3">
            <StrategyCard title="1. Nghe" eyebrow="LISTENING" color="sky" items={["Nghe câu hỏi trước, tìm từ khóa ai/cái gì/khi nào.", "Không dừng lại ở một câu; đánh dấu và đi tiếp.", "Luyện lại các câu sai bằng nút nghe."]} />
            <StrategyCard title="2. Đọc" eyebrow="READING" color="emerald" items={["Đọc yêu cầu trước rồi mới đọc đoạn văn.", "Khoanh liên từ: 하지만, 그래서, 따라서.", "Ưu tiên ý chính trước chi tiết nhỏ."]} />
            <StrategyCard title="3. Viết" eyebrow="WRITING" color="violet" items={["Lập khung: quan điểm → lý do → ví dụ → kết luận.", "Dành 2 phút cuối để sửa trợ từ và khoảng cách.", "Dùng checklist trong mỗi câu viết để tự rà bài."]} />
          </section>
        )}

        <StudyCanvas
          title="Bảng ghi chú khi làm TOPIK"
          storageKey="korean-study-topik-canvas"
        />

        {activeExam && current && (
          <section id="exam-room" className="mt-10 scroll-mt-5 rounded-[2rem] border border-amber-300/25 bg-slate-900 p-5 shadow-2xl shadow-black/20 md:p-8">
            <div className="flex flex-col justify-between gap-5 border-b border-slate-800 pb-6 md:flex-row md:items-start">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-3 py-1 text-xs font-bold ${activeExam.target === "TOPIK I" ? "border-sky-400/30 bg-sky-400/10 text-sky-300" : "border-violet-400/30 bg-violet-400/10 text-violet-300"}`}>{activeExam.target}</span>
                  <span className="text-xs text-slate-500">{activeExam.source === "ai" ? "Đề do AI tạo" : "Đề mô phỏng"}</span>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${examMode === "timed" ? "border-rose-400/30 bg-rose-400/10 text-rose-200" : "border-slate-600 bg-slate-800 text-slate-300"}`}>{examMode === "timed" ? "CHẾ ĐỘ THI" : "CHẾ ĐỘ LUYỆN"}</span>
                </div>
                <h2 className="mt-3 text-2xl font-bold text-white">{activeExam.title}</h2>
                <p className="mt-1 text-sm text-slate-400">{activeExam.estimatedMinutes} phút · {questions.length} câu · đã trả lời {answeredCount}/{questions.length}</p>
              </div>
              <div className="flex items-center gap-3 self-start"><span className={`rounded-xl px-3 py-2 font-mono text-lg font-black ${examMode === "timed" ? "bg-rose-400/15 text-rose-200" : "bg-slate-800 text-slate-300"}`}>{remainingSeconds === null ? "TỰ DO" : formatRemainingTime(remainingSeconds)}</span><button type="button" onClick={() => { window.speechSynthesis.cancel(); setActiveExam(null); }} className="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-400 transition hover:border-slate-500 hover:text-white">Đóng đề</button></div>
            </div>

            <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-amber-300 transition-all" style={{ width: `${((questionIndex + 1) / questions.length) * 100}%` }} />
            </div>

            <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_220px]">
              <ExamQuestionCard
                section={current.section}
                question={current.question}
                selectedAnswer={answers[current.question.id] || ""}
                submitted={submitted}
                onAnswer={chooseAnswer}
                voiceName={voiceName}
                speechRate={speechRate}
                autoPlaying={examMode === "timed"}
              />

              <aside className="order-first lg:order-none">
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Câu hỏi</p>
                <div className="grid grid-cols-6 gap-2 lg:grid-cols-4">
                  {questions.map(({ question }, index) => {
                    const answered = Boolean(answers[question.id]?.trim());
                    return <button key={question.id} type="button" onClick={() => setQuestionIndex(index)} className={`aspect-square rounded-lg text-sm font-bold transition ${index === questionIndex ? "bg-amber-300 text-slate-950" : answered ? "bg-emerald-400/20 text-emerald-300" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>{question.number}</button>;
                  })}
                </div>

                <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-xs leading-5 text-slate-500">
                  <p className="font-semibold text-slate-300">Lưu ý</p>
                  <p className="mt-1">Câu viết không được chấm tự động; hãy dùng bài mẫu và checklist để tự đối chiếu.</p>
                </div>
              </aside>
            </div>

            <div className="mt-8 flex flex-wrap justify-between gap-3 border-t border-slate-800 pt-6">
              <button type="button" disabled={questionIndex === 0} onClick={() => setQuestionIndex((index) => Math.max(0, index - 1))} className="rounded-xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-35">← Câu trước</button>
              {questionIndex < questions.length - 1 ? <button type="button" onClick={() => setQuestionIndex((index) => Math.min(questions.length - 1, index + 1))} className="rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-100">Câu tiếp →</button> : <button type="button" disabled={submitted} onClick={finishExam} className="rounded-xl bg-amber-300 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-200 disabled:opacity-50">{submitted ? "Đã nộp bài" : "Nộp và xem kết quả"}</button>}
            </div>

            {submitted && (
              <div className="mt-6 rounded-3xl border border-emerald-400/25 bg-emerald-400/10 p-5 md:flex md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-emerald-300">Kết quả trắc nghiệm</p>
                  <p className="mt-1 text-2xl font-black text-white">{correctCount}/{scoredQuestions.length} câu đúng · {scorePercent}%</p>
                </div>
                <p className="mt-3 max-w-md text-sm leading-6 text-slate-300 md:mt-0">Hãy mở lại các câu có đáp án sai để đọc giải thích. Với phần viết, đối chiếu từng tiêu chí trong checklist.</p>
              </div>
            )}
          </section>
        )}
      </div>
    </AppShell>
  );
}

function ExamQuestionCard({ section, question, selectedAnswer, submitted, onAnswer, voiceName, speechRate, autoPlaying }: { section: ExamSection; question: ExamQuestion; selectedAnswer: string; submitted: boolean; onAnswer: (questionId: string, answer: string) => void; voiceName: string; speechRate: number; autoPlaying: boolean }) {
  const details = skillInfo[section.skill];
  const isWriting = section.skill === "writing";
  const isCorrect = selectedAnswer === question.answer;

  return (
    <article>
      <div className="flex flex-wrap items-center gap-3">
        <span className={`rounded-full border px-3 py-1 text-xs font-bold ${details.color}`}>{details.icon} · {details.label}</span>
        <span className="text-sm text-slate-500">Câu {question.number} · {question.points} điểm</span>
      </div>
      <p className="mt-5 text-sm leading-6 text-slate-400">{section.instructions}</p>

      {question.audioText && (
        <div className="mt-6 rounded-2xl border border-sky-400/20 bg-sky-400/10 p-5">
          <p className="text-sm font-semibold text-sky-200">Nghe nội dung trước khi đọc câu hỏi.</p>
          <p className="mt-1 text-xs text-sky-100/70">{autoPlaying ? "Chế độ thi đã tự phát một lần khi mở câu hỏi." : "Bạn có thể nghe lại bất cứ lúc nào trong chế độ luyện."}</p>
          <button type="button" onClick={() => speakKorean(question.audioText, { rate: speechRate, voiceName })} className="mt-4 rounded-xl bg-sky-300 px-4 py-2.5 text-sm font-bold text-sky-950 transition hover:bg-sky-200">Nghe lại · {speechRate.toFixed(2)}×</button>
        </div>
      )}

      {question.supportText && <div className="korean-text mt-6 whitespace-pre-line rounded-2xl border border-slate-700 bg-slate-950/80 p-5 text-lg leading-8 text-slate-100">{question.supportText}</div>}

      <h3 className="korean-text mt-7 text-xl font-bold leading-8 text-white">{question.prompt}</h3>

      {isWriting ? (
        <div className="mt-5">
          <textarea value={selectedAnswer} onChange={(event) => onAnswer(question.id, event.target.value)} disabled={submitted} rows={8} placeholder="한국어로 답안을 작성하세요..." className="korean-text w-full resize-y rounded-2xl border border-slate-700 bg-slate-950 p-4 leading-7 text-white outline-none transition placeholder:text-slate-600 focus:border-violet-300 disabled:cursor-not-allowed disabled:opacity-75" />
          <p className="mt-2 text-xs text-slate-500">{selectedAnswer.trim() ? `${selectedAnswer.trim().split(/\s+/).length} từ đã viết` : "Viết bài bằng tiếng Hàn."}</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-3">
          {question.options.map((option, index) => {
            const isSelected = selectedAnswer === option;
            const optionState = !submitted
              ? isSelected ? "border-amber-300 bg-amber-300/10 text-white" : "border-slate-700 bg-slate-950/60 text-slate-300 hover:border-slate-500"
              : option === question.answer ? "border-emerald-300 bg-emerald-400/10 text-emerald-100" : isSelected ? "border-rose-300 bg-rose-400/10 text-rose-100" : "border-slate-800 bg-slate-950/45 text-slate-500";
            return <button key={option} type="button" disabled={submitted} onClick={() => onAnswer(question.id, option)} className={`korean-text flex items-center gap-3 rounded-2xl border p-4 text-left transition disabled:cursor-default ${optionState}`}><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-black/20 text-xs font-black">{String.fromCharCode(65 + index)}</span><span>{option}</span></button>;
          })}
        </div>
      )}

      {submitted && (
        <div className={`mt-6 rounded-2xl border p-5 ${isWriting ? "border-violet-400/30 bg-violet-400/10" : isCorrect ? "border-emerald-400/30 bg-emerald-400/10" : "border-rose-400/30 bg-rose-400/10"}`}>
          {!isWriting && <p className="text-sm font-bold text-white">{isCorrect ? "Đúng rồi" : "Đáp án cần ôn lại"}: <span className="korean-text">{question.answer}</span></p>}
          <p className="mt-2 text-sm leading-6 text-slate-300">{question.explanation}</p>
          {isWriting && (
            <>
              <div className="mt-4 border-t border-violet-300/15 pt-4">
                <p className="text-xs font-bold uppercase tracking-wider text-violet-200">Bài mẫu tham khảo</p>
                <p className="korean-text mt-2 leading-7 text-white">{question.answer}</p>
              </div>
              <ul className="mt-4 space-y-2 border-t border-violet-300/15 pt-4 text-sm text-slate-300">
                {question.writingGuide.map((guide) => <li key={guide}>□ {guide}</li>)}
              </ul>
            </>
          )}
        </div>
      )}
    </article>
  );
}

function WorkspaceButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return <button type="button" onClick={onClick} className={`rounded-xl px-3 py-3 text-sm font-bold transition ${active ? "bg-white text-slate-950" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}>{label}</button>;
}

function ReadinessStat({ label, value, note, highlight = false }: { label: string; value: number; note: string; highlight?: boolean }) {
  return <div className={`rounded-2xl border p-5 ${highlight ? "border-amber-300/35 bg-amber-300/10" : "border-slate-800 bg-slate-900"}`}><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-3xl font-black text-white">{value}</p><p className="mt-1 text-xs text-slate-500">{note}</p></div>;
}

function SkillBadge({ skill, count }: { skill: Skill; count: number }) {
  const details = skillInfo[skill];
  return <span className={`rounded-lg border px-2.5 py-1 text-xs font-bold ${details.color}`}>{details.label} · {count} câu</span>;
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-slate-300"><span className="mb-2 block">{label}</span>{children}</label>;
}

function AiFeature({ number, title, text }: { number: string; title: string; text: string }) {
  return <div className="flex gap-4"><span className="pt-0.5 text-sm font-black text-violet-300">{number}</span><div><h3 className="font-bold text-white">{title}</h3><p className="mt-1 text-sm leading-6 text-slate-400">{text}</p></div></div>;
}

function StrategyCard({ title, eyebrow, color, items }: { title: string; eyebrow: string; color: "sky" | "emerald" | "violet"; items: string[] }) {
  const colors = { sky: "border-sky-400/25 bg-sky-400/10 text-sky-300", emerald: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300", violet: "border-violet-400/25 bg-violet-400/10 text-violet-300" };
  return <article className="rounded-3xl border border-slate-800 bg-slate-900 p-6"><p className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${colors[color]}`}>{eyebrow}</p><h2 className="mt-4 text-xl font-bold text-white">{title}</h2><ul className="mt-5 space-y-3 text-sm leading-6 text-slate-400">{items.map((item) => <li key={item}>• {item}</li>)}</ul></article>;
}
