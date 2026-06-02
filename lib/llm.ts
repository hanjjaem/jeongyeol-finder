import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export type ChatMessage = { role: "user" | "assistant"; content: string };

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
    messages: [{ role: "system" as const, content: system }, ...messages],
  };
}

export async function callLLM(system: string, messages: ChatMessage[]): Promise<string> {
  const provider = process.env.LLM_PROVIDER ?? "anthropic";
  if (provider === "openai") {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL ?? "gpt-4o";
    const res = await client.chat.completions.create(buildOpenAIParams(system, messages, model));
    return res.choices[0]?.message?.content ?? "";
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
  const res = await client.messages.create(buildAnthropicParams(system, messages, model));
  const block = res.content[0];
  return block && block.type === "text" ? block.text : "";
}
