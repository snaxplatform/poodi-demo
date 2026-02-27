import express from "express";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "1mb" }));

app.use(express.static(__dirname));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

if (!process.env.OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY가 설정되지 않았어요.");
  console.error("   Windows cmd 예: set OPENAI_API_KEY=너의키");
  console.error("   PowerShell 예: $env:OPENAI_API_KEY='너의키'");
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// =========================
// 펫 프로필 (서버용: 사전정보/규칙)
// =========================
const PET_PROFILES = {
  mungchi: {
    name: "뭉치",
    profile: "피부염이 있는 4세 남자 시츄",
    notes: [
      "주요 고민: 피부염/가려움/피부 컨디션",
      "답변은 일상관리(샴푸/보습/환경/식이) 중심으로",
    ],
  },
  gwangsu: {
    name: "광수",
    profile: "1세 베들링턴 테리어, 관절이 안 좋음",
    notes: [
      "주요 고민: 관절/운동/미끄럼/체중관리",
      "답변은 무리 없는 운동/환경개선/영양 중심으로",
    ],
  },
  loui: {
    name: "루이",
    profile: "6세 러시안블루 고양이",
    notes: [
      "주요 고민: 식단/생활습관/일반 건강",
      "답변은 고양이 특성(수분/스트레스/환경) 중심으로",
    ],
  },
};

function buildInstructions(petIdRaw) {
  const petId = String(petIdRaw || "").toLowerCase();
  const pet = PET_PROFILES[petId] || PET_PROFILES.mungchi;

  return `
너는 반려동물 상담용 챗봇 "POODi(푸디)"다. 한국어로 답한다.

[현재 선택된 대상]
- 이름: ${pet.name}
- 설정: ${pet.profile}
- 추가 메모:
  - ${pet.notes.join("\n  - ")}

[중요 규칙]
1) 사용자가 ${pet.name}와 무관한 질문(다른 동물/일반상식/잡담/다른 반려동물)에 대해 묻는다면,
   정중하게 "현재는 ${pet.name} 상담만 가능하다"라고 안내하고,
   ${pet.name}에게 적용하는 형태로 질문을 바꿔달라고 제안한다.
2) ${pet.name} 관련 질문(건강, 식단, 습관, 환경, 체중, 증상 등)에는 구체적으로 답한다.
3) 의학적 진단/처방은 단정하지 말고, 위험 신호(심한 무기력/호흡곤란/출혈·고름/심한 통증/구토·설사 지속/경련 등)가 있으면
   즉시 병원/수의사 상담을 권한다.
4) 답변 형식은 짧고 실용적으로:
   (1)핵심 결론
   (2)권장 행동 3가지
   (3)주의할 점
`.trim();
}

app.post("/api/chat", async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).send("OPENAI_API_KEY missing on server");
    }

    const userMessage = String(req.body?.message ?? "").trim();
    if (!userMessage) return res.status(400).send("message is required");

    const petId = req.body?.petId || "mungchi";
    const instructions = buildInstructions(petId);

    const response = await client.responses.create({
      model: "gpt-4o-mini", // 데모/테스트용 추천(저렴). 원하면 gpt-4o 등으로 변경
      instructions,
      input: userMessage.slice(0, 2000),
    });

    res.json({ reply: response.output_text ?? "" });
  } catch (e) {
    console.error("❌ OpenAI call failed:", e);

    const status = e?.status || e?.response?.status || 500;
    const message =
      e?.message ||
      e?.error?.message ||
      e?.response?.data?.error?.message ||
      "unknown_error";

    res.status(status).send(message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Open: http://localhost:${PORT}`));