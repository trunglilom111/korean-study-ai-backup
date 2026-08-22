import { GoogleGenAI } from "@google/genai";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type AudioItem = {
  key: string;
  transcript: string;
  speakers: Array<{ name: string; gender: "female" | "male"; voice: string }>;
};

const items: AudioItem[] = [
  { key: "tm-original-listening-001", transcript: "여자: 안녕하세요. 다음 주 제주도 여행을 예약했는데요. 비가 와도 출발하나요? 그리고 따로 준비해야 할 물건이 있습니까?\n남자: 네, 우산과 편한 신발을 준비해 주세요.", speakers: [{ name: "여자", gender: "female", voice: "Kore" }, { name: "남자", gender: "male", voice: "Charon" }] },
  { key: "tm-original-listening-002", transcript: "여자: 오늘 길이 많이 막히네요. 회의에 늦지 않을까요?\n남자: 지하철로 갈아타면 시간을 줄일 수 있을 거예요.", speakers: [{ name: "여자", gender: "female", voice: "Aoede" }, { name: "남자", gender: "male", voice: "Iapetus" }] },
  { key: "tm-original-listening-003", transcript: "여자: 보고서 정리가 아직 많이 남았어요.\n남자: 중요한 부분부터 처리하면 시간을 아낄 수 있어요.", speakers: [{ name: "여자", gender: "female", voice: "Kore" }, { name: "남자", gender: "male", voice: "Charon" }] },
  { key: "tm-original-listening-004", transcript: "남자: 이 소포를 부산으로 보내려고 하는데요.\n여자: 내용물을 확인한 뒤에 무게를 재겠습니다. 우표는 여기에서 사시면 됩니다.", speakers: [{ name: "남자", gender: "male", voice: "Iapetus" }, { name: "여자", gender: "female", voice: "Kore" }] },
  { key: "tm-original-listening-005", transcript: "남자: 회의 자료를 다 정리했어요?\n여자: 네. 지금 바로 자료를 가지고 회의실로 가겠습니다.", speakers: [{ name: "남자", gender: "male", voice: "Charon" }, { name: "여자", gender: "female", voice: "Aoede" }] },
  { key: "tm-original-listening-006", transcript: "이번 문화 행사 신청 기간이 금요일까지 연장되었습니다. 장소와 참가비는 이전과 같습니다.", speakers: [{ name: "안내자", gender: "female", voice: "Kore" }] },
  { key: "tm-original-listening-007", transcript: "여자: 방학에도 회사에서 일해요?\n남자: 네. 전공과 관련된 경험을 쌓기 위해서 인턴으로 일하고 있어요.", speakers: [{ name: "여자", gender: "female", voice: "Aoede" }, { name: "남자", gender: "male", voice: "Iapetus" }] },
  { key: "tm-original-listening-008", transcript: "남자: 새로 이용한 도서관은 어땠어요?\n여자: 공간도 넓고 필요한 자료도 많아서 아주 만족스러웠어요.", speakers: [{ name: "남자", gender: "male", voice: "Charon" }, { name: "여자", gender: "female", voice: "Kore" }] },
  { key: "tm-original-topik-i-listening-001", transcript: "안녕하세요? 처음 뵙겠습니다. 저는 수진입니다.", speakers: [{ name: "여자", gender: "female", voice: "Aoede" }] },
  { key: "tm-original-topik-i-listening-002", transcript: "남자: 이 책을 일주일 더 빌릴 수 있어요?\n여자: 네, 회원증을 보여 주세요.", speakers: [{ name: "남자", gender: "male", voice: "Iapetus" }, { name: "여자", gender: "female", voice: "Kore" }] },
  { key: "tm-original-topik-i-listening-003", transcript: "여자: 민수 씨, 비가 많이 와요. 우산이 있어요?\n남자: 없어요. 편의점에서 하나 사야겠어요.", speakers: [{ name: "여자", gender: "female", voice: "Aoede" }, { name: "남자", gender: "male", voice: "Charon" }] },
  { key: "tm-original-topik-i-listening-004", transcript: "내일 한국어 수업은 오전 열 시가 아니라 오후 두 시에 시작합니다. 교실은 삼 층 삼백이 호입니다.", speakers: [{ name: "안내자", gender: "female", voice: "Kore" }] },
];

function readApiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const envPath = join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return "";
  const match = readFileSync(envPath, "utf8").match(/^GEMINI_API_KEY=(.*)$/m);
  return match?.[1]?.trim().replace(/^['"]|['"]$/g, "") || "";
}

function wavFromPcm(pcm: Buffer, sampleRate = 24_000) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

async function main() {
  const apiKey = readApiKey();
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing.");
  const outputDirectory = join(process.cwd(), "public", "topik-master", "audio");
  mkdirSync(outputDirectory, { recursive: true });
  const ai = new GoogleGenAI({ apiKey });
  const manifest: Array<Record<string, unknown>> = [];

  for (const item of items) {
    const outputPath = join(outputDirectory, `${item.key}.wav`);
    if (!existsSync(outputPath)) {
      const multiSpeaker = item.speakers.length === 2;
      const namedTranscript = multiSpeaker
        ? item.speakers.reduce((text, speaker, index) => text.replaceAll(`${speaker.name}:`, `Speaker${index + 1}:`), item.transcript)
        : item.transcript.replace(/^[^:]+:\s*/, "");
      const prompt = multiSpeaker
        ? `TTS the following Korean TOPIK listening conversation. Read only the transcript, clearly and naturally at normal exam speed, without adding words:\n${namedTranscript}`
        : `Say clearly and naturally in Korean at normal TOPIK listening exam speed, without adding words: ${namedTranscript}`;
      const response = await ai.interactions.create({
        model: "gemini-3.1-flash-tts-preview",
        input: prompt,
        response_format: { type: "audio" },
        generation_config: {
          speech_config: item.speakers.map((speaker, index) => ({
            language: "ko",
            speaker: multiSpeaker ? `Speaker${index + 1}` : undefined,
            voice: speaker.voice,
          })),
        },
      });
      const data = response.output_audio?.data;
      if (!data) throw new Error(`No audio returned for ${item.key}`);
      writeFileSync(outputPath, wavFromPcm(Buffer.from(data, "base64")));
    }
    const wav = readFileSync(outputPath);
    const durationSeconds = Math.round(((wav.length - 44) / 2 / 24_000) * 10) / 10;
    manifest.push({
      key: item.key,
      url: `/topik-master/audio/${item.key}.wav`,
      durationSeconds,
      speakers: item.speakers,
      synthetic: true,
      provider: "Gemini 3.1 Flash TTS",
    });
    console.log(`${item.key}: ${durationSeconds}s`);
  }

  writeFileSync(join(outputDirectory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

await main();
