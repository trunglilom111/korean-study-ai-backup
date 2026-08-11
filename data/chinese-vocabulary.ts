export type ChineseVocabularyLevel = "foundation" | "hsk1" | "hsk2" | "hsk3" | "hsk4";

export type ChineseVocabularyWord = {
  id: string;
  level: ChineseVocabularyLevel;
  topic: string;
  hanzi: string;
  pinyin: string;
  meaning: string;
  example: string;
  translation: string;
};

export const chineseLevelOptions: Array<{
  id: ChineseVocabularyLevel;
  label: string;
  description: string;
}> = [
  { id: "foundation", label: "Nền tảng", description: "Chào hỏi, đại từ và mẫu câu sống còn" },
  { id: "hsk1", label: "HSK 1", description: "Gia đình, thời gian và sinh hoạt cơ bản" },
  { id: "hsk2", label: "HSK 2", description: "Đời sống, đi lại, sức khỏe và câu nối" },
  { id: "hsk3", label: "HSK 3", description: "Kế hoạch, trải nghiệm và giao tiếp độc lập" },
  { id: "hsk4", label: "HSK 4", description: "Công việc, quan điểm và ý tưởng trừu tượng" },
];

export const chineseVocabulary: ChineseVocabularyWord[] = [
  { id: "f-nihao", level: "foundation", topic: "Chào hỏi", hanzi: "你好", pinyin: "nǐ hǎo", meaning: "xin chào", example: "你好，很高兴认识你。", translation: "Xin chào, rất vui được gặp bạn." },
  { id: "f-xiexie", level: "foundation", topic: "Chào hỏi", hanzi: "谢谢", pinyin: "xiè xie", meaning: "cảm ơn", example: "谢谢你的帮助。", translation: "Cảm ơn sự giúp đỡ của bạn." },
  { id: "f-duibuqi", level: "foundation", topic: "Chào hỏi", hanzi: "对不起", pinyin: "duì bu qǐ", meaning: "xin lỗi", example: "对不起，我来晚了。", translation: "Xin lỗi, tôi đến muộn." },
  { id: "f-meiguanxi", level: "foundation", topic: "Chào hỏi", hanzi: "没关系", pinyin: "méi guān xi", meaning: "không sao", example: "没关系，下次注意。", translation: "Không sao, lần sau chú ý nhé." },
  { id: "f-zaijian", level: "foundation", topic: "Chào hỏi", hanzi: "再见", pinyin: "zài jiàn", meaning: "tạm biệt", example: "明天见，再见！", translation: "Hẹn mai gặp, tạm biệt!" },
  { id: "f-qing", level: "foundation", topic: "Giao tiếp", hanzi: "请", pinyin: "qǐng", meaning: "mời / xin vui lòng", example: "请坐。", translation: "Mời ngồi." },
  { id: "f-wo", level: "foundation", topic: "Con người", hanzi: "我", pinyin: "wǒ", meaning: "tôi / mình", example: "我是越南人。", translation: "Tôi là người Việt Nam." },
  { id: "f-ni", level: "foundation", topic: "Con người", hanzi: "你", pinyin: "nǐ", meaning: "bạn", example: "你叫什么名字？", translation: "Bạn tên là gì?" },
  { id: "f-ta-m", level: "foundation", topic: "Con người", hanzi: "他", pinyin: "tā", meaning: "anh ấy", example: "他是我的朋友。", translation: "Anh ấy là bạn của tôi." },
  { id: "f-ta-f", level: "foundation", topic: "Con người", hanzi: "她", pinyin: "tā", meaning: "cô ấy", example: "她会说中文。", translation: "Cô ấy biết nói tiếng Trung." },
  { id: "f-shi", level: "foundation", topic: "Mẫu câu", hanzi: "是", pinyin: "shì", meaning: "là / phải", example: "这是我的书。", translation: "Đây là sách của tôi." },
  { id: "f-bu", level: "foundation", topic: "Mẫu câu", hanzi: "不", pinyin: "bù", meaning: "không", example: "我不喝咖啡。", translation: "Tôi không uống cà phê." },
  { id: "f-ma", level: "foundation", topic: "Mẫu câu", hanzi: "吗", pinyin: "ma", meaning: "trợ từ nghi vấn", example: "你是学生吗？", translation: "Bạn là học sinh phải không?" },
  { id: "f-you", level: "foundation", topic: "Mẫu câu", hanzi: "有", pinyin: "yǒu", meaning: "có", example: "我有一个问题。", translation: "Tôi có một câu hỏi." },
  { id: "f-meiyou", level: "foundation", topic: "Mẫu câu", hanzi: "没有", pinyin: "méi yǒu", meaning: "không có / chưa", example: "今天我没有课。", translation: "Hôm nay tôi không có tiết học." },

  { id: "h1-jia", level: "hsk1", topic: "Gia đình", hanzi: "家", pinyin: "jiā", meaning: "nhà / gia đình", example: "我家有四个人。", translation: "Nhà tôi có bốn người." },
  { id: "h1-baba", level: "hsk1", topic: "Gia đình", hanzi: "爸爸", pinyin: "bà ba", meaning: "bố", example: "我爸爸是医生。", translation: "Bố tôi là bác sĩ." },
  { id: "h1-mama", level: "hsk1", topic: "Gia đình", hanzi: "妈妈", pinyin: "mā ma", meaning: "mẹ", example: "妈妈在家做饭。", translation: "Mẹ đang nấu cơm ở nhà." },
  { id: "h1-pengyou", level: "hsk1", topic: "Con người", hanzi: "朋友", pinyin: "péng you", meaning: "bạn bè", example: "他是我的好朋友。", translation: "Anh ấy là bạn tốt của tôi." },
  { id: "h1-xuesheng", level: "hsk1", topic: "Học tập", hanzi: "学生", pinyin: "xué sheng", meaning: "học sinh / sinh viên", example: "我是大学生。", translation: "Tôi là sinh viên đại học." },
  { id: "h1-laoshi", level: "hsk1", topic: "Học tập", hanzi: "老师", pinyin: "lǎo shī", meaning: "giáo viên", example: "老师说得很慢。", translation: "Giáo viên nói rất chậm." },
  { id: "h1-zhongguo", level: "hsk1", topic: "Địa điểm", hanzi: "中国", pinyin: "Zhōng guó", meaning: "Trung Quốc", example: "我想去中国旅行。", translation: "Tôi muốn đi du lịch Trung Quốc." },
  { id: "h1-yuenan", level: "hsk1", topic: "Địa điểm", hanzi: "越南", pinyin: "Yuè nán", meaning: "Việt Nam", example: "越南菜很好吃。", translation: "Món Việt Nam rất ngon." },
  { id: "h1-jintian", level: "hsk1", topic: "Thời gian", hanzi: "今天", pinyin: "jīn tiān", meaning: "hôm nay", example: "今天天气很好。", translation: "Hôm nay thời tiết rất đẹp." },
  { id: "h1-mingtian", level: "hsk1", topic: "Thời gian", hanzi: "明天", pinyin: "míng tiān", meaning: "ngày mai", example: "我们明天见。", translation: "Ngày mai chúng ta gặp nhau." },
  { id: "h1-xianzai", level: "hsk1", topic: "Thời gian", hanzi: "现在", pinyin: "xiàn zài", meaning: "bây giờ", example: "你现在忙吗？", translation: "Bây giờ bạn có bận không?" },
  { id: "h1-jidian", level: "hsk1", topic: "Thời gian", hanzi: "几点", pinyin: "jǐ diǎn", meaning: "mấy giờ", example: "现在几点？", translation: "Bây giờ là mấy giờ?" },
  { id: "h1-chi", level: "hsk1", topic: "Ăn uống", hanzi: "吃", pinyin: "chī", meaning: "ăn", example: "我们一起吃饭吧。", translation: "Chúng ta cùng ăn cơm nhé." },
  { id: "h1-he", level: "hsk1", topic: "Ăn uống", hanzi: "喝", pinyin: "hē", meaning: "uống", example: "我想喝一杯茶。", translation: "Tôi muốn uống một tách trà." },
  { id: "h1-xihuan", level: "hsk1", topic: "Sở thích", hanzi: "喜欢", pinyin: "xǐ huan", meaning: "thích", example: "我喜欢听音乐。", translation: "Tôi thích nghe nhạc." },

  { id: "h2-qichuang", level: "hsk2", topic: "Sinh hoạt", hanzi: "起床", pinyin: "qǐ chuáng", meaning: "thức dậy", example: "我每天六点起床。", translation: "Mỗi ngày tôi thức dậy lúc sáu giờ." },
  { id: "h2-shangban", level: "hsk2", topic: "Công việc", hanzi: "上班", pinyin: "shàng bān", meaning: "đi làm", example: "她坐地铁上班。", translation: "Cô ấy đi tàu điện ngầm đến chỗ làm." },
  { id: "h2-xiaban", level: "hsk2", topic: "Công việc", hanzi: "下班", pinyin: "xià bān", meaning: "tan làm", example: "我五点半下班。", translation: "Tôi tan làm lúc năm rưỡi." },
  { id: "h2-yundong", level: "hsk2", topic: "Sức khỏe", hanzi: "运动", pinyin: "yùn dòng", meaning: "vận động / thể thao", example: "周末我常去运动。", translation: "Cuối tuần tôi thường đi tập thể thao." },
  { id: "h2-shengbing", level: "hsk2", topic: "Sức khỏe", hanzi: "生病", pinyin: "shēng bìng", meaning: "bị bệnh", example: "他生病了，今天没来。", translation: "Anh ấy bị bệnh nên hôm nay không đến." },
  { id: "h2-yiyuan", level: "hsk2", topic: "Sức khỏe", hanzi: "医院", pinyin: "yī yuàn", meaning: "bệnh viện", example: "这家医院离这里不远。", translation: "Bệnh viện này không xa đây." },
  { id: "h2-jichang", level: "hsk2", topic: "Đi lại", hanzi: "机场", pinyin: "jī chǎng", meaning: "sân bay", example: "我们去机场接朋友。", translation: "Chúng tôi ra sân bay đón bạn." },
  { id: "h2-huochezhan", level: "hsk2", topic: "Đi lại", hanzi: "火车站", pinyin: "huǒ chē zhàn", meaning: "ga tàu", example: "火车站怎么走？", translation: "Đi đến ga tàu thế nào?" },
  { id: "h2-zuobian", level: "hsk2", topic: "Phương hướng", hanzi: "左边", pinyin: "zuǒ bian", meaning: "bên trái", example: "银行在超市左边。", translation: "Ngân hàng ở bên trái siêu thị." },
  { id: "h2-youbian", level: "hsk2", topic: "Phương hướng", hanzi: "右边", pinyin: "yòu bian", meaning: "bên phải", example: "请看右边的照片。", translation: "Xin hãy nhìn bức ảnh bên phải." },
  { id: "h2-yinwei", level: "hsk2", topic: "Mẫu câu", hanzi: "因为", pinyin: "yīn wèi", meaning: "bởi vì", example: "因为下雨，我没出去。", translation: "Vì trời mưa nên tôi không ra ngoài." },
  { id: "h2-suoyi", level: "hsk2", topic: "Mẫu câu", hanzi: "所以", pinyin: "suǒ yǐ", meaning: "cho nên", example: "我很累，所以想休息。", translation: "Tôi rất mệt nên muốn nghỉ ngơi." },
  { id: "h2-yijing", level: "hsk2", topic: "Thời gian", hanzi: "已经", pinyin: "yǐ jīng", meaning: "đã", example: "我已经吃过饭了。", translation: "Tôi đã ăn cơm rồi." },
  { id: "h2-danshi", level: "hsk2", topic: "Mẫu câu", hanzi: "但是", pinyin: "dàn shì", meaning: "nhưng", example: "这件衣服很好看，但是有点贵。", translation: "Bộ đồ này đẹp nhưng hơi đắt." },
  { id: "h2-juede", level: "hsk2", topic: "Cảm xúc", hanzi: "觉得", pinyin: "jué de", meaning: "cảm thấy / cho rằng", example: "我觉得中文很有意思。", translation: "Tôi thấy tiếng Trung rất thú vị." },

  { id: "h3-xiguan", level: "hsk3", topic: "Sinh hoạt", hanzi: "习惯", pinyin: "xí guàn", meaning: "thói quen / quen với", example: "我习惯早上学习。", translation: "Tôi quen học vào buổi sáng." },
  { id: "h3-jihua", level: "hsk3", topic: "Kế hoạch", hanzi: "计划", pinyin: "jì huà", meaning: "kế hoạch / lên kế hoạch", example: "你周末有什么计划？", translation: "Cuối tuần bạn có kế hoạch gì?" },
  { id: "h3-canjia", level: "hsk3", topic: "Hoạt động", hanzi: "参加", pinyin: "cān jiā", meaning: "tham gia", example: "我想参加汉语比赛。", translation: "Tôi muốn tham gia cuộc thi tiếng Trung." },
  { id: "h3-yingxiang", level: "hsk3", topic: "Giao tiếp", hanzi: "影响", pinyin: "yǐng xiǎng", meaning: "ảnh hưởng", example: "睡眠会影响学习效率。", translation: "Giấc ngủ ảnh hưởng đến hiệu quả học tập." },
  { id: "h3-jiejue", level: "hsk3", topic: "Công việc", hanzi: "解决", pinyin: "jiě jué", meaning: "giải quyết", example: "我们一起解决这个问题。", translation: "Chúng ta cùng giải quyết vấn đề này." },
  { id: "h3-xuyao", level: "hsk3", topic: "Giao tiếp", hanzi: "需要", pinyin: "xū yào", meaning: "cần", example: "你需要我帮忙吗？", translation: "Bạn có cần tôi giúp không?" },
  { id: "h3-xuanze", level: "hsk3", topic: "Quyết định", hanzi: "选择", pinyin: "xuǎn zé", meaning: "lựa chọn", example: "你可以选择喜欢的课程。", translation: "Bạn có thể chọn khóa học mình thích." },
  { id: "h3-faxian", level: "hsk3", topic: "Trải nghiệm", hanzi: "发现", pinyin: "fā xiàn", meaning: "phát hiện / nhận ra", example: "我发现他进步很快。", translation: "Tôi nhận ra anh ấy tiến bộ rất nhanh." },
  { id: "h3-dangran", level: "hsk3", topic: "Giao tiếp", hanzi: "当然", pinyin: "dāng rán", meaning: "đương nhiên", example: "当然可以，没问题。", translation: "Đương nhiên là được, không vấn đề gì." },
  { id: "h3-turan", level: "hsk3", topic: "Trải nghiệm", hanzi: "突然", pinyin: "tū rán", meaning: "đột nhiên", example: "天突然下起雨来。", translation: "Trời đột nhiên đổ mưa." },
  { id: "h3-fujin", level: "hsk3", topic: "Địa điểm", hanzi: "附近", pinyin: "fù jìn", meaning: "gần đây / khu vực gần", example: "这附近有咖啡店吗？", translation: "Gần đây có quán cà phê không?" },
  { id: "h3-huanjing", level: "hsk3", topic: "Đời sống", hanzi: "环境", pinyin: "huán jìng", meaning: "môi trường", example: "这里的学习环境很好。", translation: "Môi trường học tập ở đây rất tốt." },
  { id: "h3-wenhua", level: "hsk3", topic: "Văn hóa", hanzi: "文化", pinyin: "wén huà", meaning: "văn hóa", example: "我对中国文化很感兴趣。", translation: "Tôi rất quan tâm đến văn hóa Trung Quốc." },
  { id: "h3-zhongyao", level: "hsk3", topic: "Giao tiếp", hanzi: "重要", pinyin: "zhòng yào", meaning: "quan trọng", example: "每天复习很重要。", translation: "Ôn tập mỗi ngày rất quan trọng." },
  { id: "h3-renzhen", level: "hsk3", topic: "Học tập", hanzi: "认真", pinyin: "rèn zhēn", meaning: "nghiêm túc / chăm chỉ", example: "她学习非常认真。", translation: "Cô ấy học rất chăm chỉ." },

  { id: "h4-jingyan", level: "hsk4", topic: "Công việc", hanzi: "经验", pinyin: "jīng yàn", meaning: "kinh nghiệm", example: "这份工作需要相关经验。", translation: "Công việc này cần kinh nghiệm liên quan." },
  { id: "h4-jihui", level: "hsk4", topic: "Công việc", hanzi: "机会", pinyin: "jī huì", meaning: "cơ hội", example: "这是一次很好的学习机会。", translation: "Đây là một cơ hội học tập rất tốt." },
  { id: "h4-shihe", level: "hsk4", topic: "Quyết định", hanzi: "适合", pinyin: "shì hé", meaning: "phù hợp", example: "这个方法很适合初学者。", translation: "Phương pháp này rất hợp với người mới." },
  { id: "h4-fuze", level: "hsk4", topic: "Công việc", hanzi: "负责", pinyin: "fù zé", meaning: "phụ trách / có trách nhiệm", example: "她负责这个项目。", translation: "Cô ấy phụ trách dự án này." },
  { id: "h4-jianyi", level: "hsk4", topic: "Giao tiếp", hanzi: "建议", pinyin: "jiàn yì", meaning: "đề nghị / lời khuyên", example: "谢谢你给我的建议。", translation: "Cảm ơn lời khuyên bạn dành cho tôi." },
  { id: "h4-taolun", level: "hsk4", topic: "Giao tiếp", hanzi: "讨论", pinyin: "tǎo lùn", meaning: "thảo luận", example: "我们明天再讨论这个问题。", translation: "Ngày mai chúng ta thảo luận tiếp vấn đề này." },
  { id: "h4-jieguo", level: "hsk4", topic: "Lập luận", hanzi: "结果", pinyin: "jié guǒ", meaning: "kết quả", example: "考试结果下周公布。", translation: "Kết quả thi sẽ được công bố tuần sau." },
  { id: "h4-yuanyin", level: "hsk4", topic: "Lập luận", hanzi: "原因", pinyin: "yuán yīn", meaning: "nguyên nhân", example: "你知道失败的原因吗？", translation: "Bạn có biết nguyên nhân thất bại không?" },
  { id: "h4-tigao", level: "hsk4", topic: "Học tập", hanzi: "提高", pinyin: "tí gāo", meaning: "nâng cao", example: "我想提高口语水平。", translation: "Tôi muốn nâng cao trình độ nói." },
  { id: "h4-gaibian", level: "hsk4", topic: "Phát triển", hanzi: "改变", pinyin: "gǎi biàn", meaning: "thay đổi", example: "学习改变了他的生活。", translation: "Việc học đã thay đổi cuộc sống của anh ấy." },
  { id: "h4-jianchi", level: "hsk4", topic: "Phát triển", hanzi: "坚持", pinyin: "jiān chí", meaning: "kiên trì", example: "只要坚持，就会进步。", translation: "Chỉ cần kiên trì thì sẽ tiến bộ." },
  { id: "h4-lijie", level: "hsk4", topic: "Giao tiếp", hanzi: "理解", pinyin: "lǐ jiě", meaning: "hiểu / thông cảm", example: "我能理解你的想法。", translation: "Tôi có thể hiểu suy nghĩ của bạn." },
  { id: "h4-biaoda", level: "hsk4", topic: "Giao tiếp", hanzi: "表达", pinyin: "biǎo dá", meaning: "biểu đạt", example: "请清楚地表达你的意见。", translation: "Hãy trình bày rõ ý kiến của bạn." },
  { id: "h4-guanxi", level: "hsk4", topic: "Con người", hanzi: "关系", pinyin: "guān xi", meaning: "mối quan hệ", example: "他们的关系一直很好。", translation: "Mối quan hệ của họ luôn rất tốt." },
  { id: "h4-fazhan", level: "hsk4", topic: "Phát triển", hanzi: "发展", pinyin: "fā zhǎn", meaning: "phát triển", example: "这个城市发展得很快。", translation: "Thành phố này phát triển rất nhanh." },
];
