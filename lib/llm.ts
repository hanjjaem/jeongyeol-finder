import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

export type ChatMessage = { role: "user" | "assistant"; content: string };

// Gemini는 messages를 contents 형식으로 변환(assistant → model)
export function toGeminiContents(messages: ChatMessage[]) {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

export function buildAnthropicParams(system: string, messages: ChatMessage[], model: string) {
  return {
    model,
    max_tokens: 1024,
    system: [{ type: "text" as const, text: system, cache_control: { type: "ephemeral" as const } }],
    messages,
  };
}

// 키 접두로 제공자 판별. sk-ant-… → Anthropic, AIza… → Gemini,
// 그 외(OpenAI 등) → 미지원: 브라우저에서 CORS로 직접 호출 불가.
export function providerForKey(key: string): "anthropic" | "gemini" | "unsupported" {
  if (key.startsWith("sk-ant-")) return "anthropic";
  if (key.startsWith("AIza")) return "gemini";
  return "unsupported";
}

// BYOK: 호출자가 넘긴 사용자 키로만 호출(서버 키 없음). 정적 앱이므로 브라우저에서 직접 호출.
export async function callLLM(
  system: string,
  messages: ChatMessage[],
  userKey: string
): Promise<string> {
  if (!userKey) throw new Error("API 키가 없습니다");
  const provider = providerForKey(userKey);

  if (provider === "gemini") {
    const genAI = new GoogleGenerativeAI(userKey);
    const model = genAI.getGenerativeModel({
      model: process.env.NEXT_PUBLIC_GEMINI_MODEL ?? "gemini-2.5-flash",
      systemInstruction: system,
      generationConfig: { responseMimeType: "application/json" },
    });
    const res = await model.generateContent({ contents: toGeminiContents(messages) });
    return res.response.text();
  }

  if (provider === "anthropic") {
    const client = new Anthropic({
      apiKey: userKey,
      dangerouslyAllowBrowser: true,
      defaultHeaders: { "anthropic-dangerous-direct-browser-access": "true" },
    });
    const model = process.env.NEXT_PUBLIC_ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
    const res = await client.messages.create(buildAnthropicParams(system, messages, model));
    const block = res.content[0];
    return block && block.type === "text" ? block.text : "";
  }

  throw Object.assign(
    new Error("이 배포에선 Claude(sk-ant-)·Gemini(AIza) 키만 쓸 수 있어요. OpenAI 키는 브라우저에서 직접 호출이 막혀요."),
    { code: "unsupported_provider" }
  );
}
