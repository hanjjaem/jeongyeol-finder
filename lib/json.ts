// LLM 응답에서 JSON 객체만 안전하게 추출한다(앞뒤 잡텍스트 허용).
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) throw new Error("JSON 없음");
  return JSON.parse(text.slice(start, end + 1));
}
