import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
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

export function buildOpenAIParams(system: string, messages: ChatMessage[], model: string) {
  return {
    model,
    response_format: { type: "json_object" as const },
    messages: [{ role: "system" as const, content: system }, ...messages],
  };
}

// 키 접두로 제공자 자동 판별 (sk-ant-… → Anthropic, AIza… → Gemini, 그 외 → OpenAI)
export function providerForKey(key: string): "anthropic" | "openai" | "gemini" {
  if (key.startsWith("sk-ant-")) return "anthropic";
  if (key.startsWith("AIza")) return "gemini";
  return "openai";
}

// BYOK: 호출자가 넘긴 사용자 키로만 호출한다(서버 키 사용 안 함).
export async function callLLM(
  system: string,
  messages: ChatMessage[],
  userKey: string
): Promise<string> {
  if (!userKey) throw new Error("API 키가 없습니다");
  const provider = providerForKey(userKey);

  if (provider === "openai") {
    const client = new OpenAI({ apiKey: userKey });
    const model = process.env.OPENAI_MODEL ?? "gpt-4o";
    const res = await client.chat.completions.create(buildOpenAIParams(system, messages, model));
    return res.choices[0]?.message?.content ?? "";
  }

  if (provider === "gemini") {
    const genAI = new GoogleGenerativeAI(userKey);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
      systemInstruction: system,
      generationConfig: { responseMimeType: "application/json" },
    });
    const res = await model.generateContent({ contents: toGeminiContents(messages) });
    return res.response.text();
  }

  const client = new Anthropic({ apiKey: userKey });
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
  const res = await client.messages.create(buildAnthropicParams(system, messages, model));
  const block = res.content[0];
  return block && block.type === "text" ? block.text : "";
}
