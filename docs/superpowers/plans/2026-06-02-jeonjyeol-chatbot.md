# 전결 자연어 챗봇 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 위임전결규정(169행 CSV)을 자연어로 물어 전결권자를 안내하는 멀티턴 웹 챗봇을 Next.js로 만들고 Vercel+GitHub 자동배포한다.

**Architecture:** Next.js(App Router) 단일 앱. 브라우저 챗 UI → `/api/chat`(서버, API키 보관) → LLM(Claude/OpenAI, env 전환). 169행 표 전체를 시스템 프롬프트에 주입(Anthropic은 캐싱). 무상태(대화 히스토리 매 요청 전달).

**Tech Stack:** Next.js 14 (App Router, TypeScript), Vitest, `@anthropic-ai/sdk`, `openai`, `csv-parse`. 배포: Vercel.

---

## 작업 환경
- 프로젝트 루트: `C:\Users\user\jeonjyeol-chatbot` (git 초기화됨, 브랜치 main)
- 데이터 원본: `C:\Users\user\downloads\전결_검색테이블_통합.csv` (169행)
- 명령은 프로젝트 루트에서 실행. Windows + Node 18+ 가정. 테스트 러너는 vitest.

---

## File Structure
- `package.json` / `tsconfig.json` / `next.config.mjs` / `vitest.config.ts` / `.gitignore` — 스캐폴드
- `data/전결_검색테이블_통합.csv` — 데이터(원본 복사)
- `lib/table.ts` — CSV 파싱(`parseTable`) + 프롬프트 텍스트화(`buildTablePrompt`)
- `lib/systemPrompt.ts` — 시스템 프롬프트 조립(`buildSystemPrompt`)
- `lib/llm.ts` — 파라미터 빌더(`buildAnthropicParams`/`buildOpenAIParams`) + `callLLM`
- `app/api/chat/route.ts` — POST 핸들러
- `app/layout.tsx` / `app/page.tsx` / `app/globals.css` — UI + 고지 푸터
- `test/table.test.ts` / `test/systemPrompt.test.ts` / `test/llm.test.ts` / `test/route.test.ts` / `test/golden.test.ts`
- `.env.example` / `README.md`

---

### Task 1: 프로젝트 스캐폴드

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `vitest.config.ts`, `.gitignore`, `app/globals.css`

- [ ] **Step 1: package.json 작성**

```json
{
  "name": "jeonjyeol-chatbot",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 8000",
    "build": "next build",
    "start": "next start",
    "test": "vitest run"
  },
  "dependencies": {
    "next": "14.2.5",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "@anthropic-ai/sdk": "^0.27.0",
    "openai": "^4.56.0",
    "csv-parse": "^5.5.6"
  },
  "devDependencies": {
    "typescript": "^5.5.4",
    "@types/node": "^20.14.0",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: tsconfig.json 작성**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "ES2020"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "paths": { "@/*": ["./*"] },
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: next.config.mjs, vitest.config.ts, .gitignore, app/globals.css 작성**

`next.config.mjs`:
```js
/** @type {import('next').NextConfig} */
const nextConfig = {};
export default nextConfig;
```

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { environment: "node", include: ["test/**/*.test.ts"] },
});
```

`.gitignore`:
```
node_modules/
.next/
.env
.env.local
*.log
```

`app/globals.css`:
```css
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, "Malgun Gothic", sans-serif; background: #f5f6f8; color: #1a1a1a; }
```

- [ ] **Step 4: 의존성 설치**

Run: `npm install`
Expected: `node_modules/` 생성, 에러 없이 완료.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: Next.js + vitest 스캐폴드"
```

---

### Task 2: 데이터 로딩 (`lib/table.ts`) — TDD

**Files:**
- Create: `data/전결_검색테이블_통합.csv` (복사), `lib/table.ts`, `test/table.test.ts`

- [ ] **Step 1: 데이터 파일 복사**

Run: `cp ~/downloads/전결_검색테이블_통합.csv data/전결_검색테이블_통합.csv`
Expected: `data/전결_검색테이블_통합.csv` 존재(169 데이터행 + 헤더).

- [ ] **Step 2: 실패 테스트 작성** — `test/table.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { parseTable, buildTablePrompt } from "../lib/table";

describe("parseTable", () => {
  it("169개 행을 파싱한다", () => {
    const rows = parseTable();
    expect(rows.length).toBe(169);
  });
  it("각 행에 핵심 컬럼이 있다", () => {
    const r = parseTable()[0];
    expect(r).toHaveProperty("검색키");
    expect(r).toHaveProperty("분기기준");
    expect(r).toHaveProperty("전결권자");
  });
  it("예산의 변경은 국·소장 전결", () => {
    const rows = parseTable();
    const hit = rows.find((r) => r["검색키"] === "예산의 변경");
    expect(hit?.["전결권자"]).toBe("국·소장");
  });
});

describe("buildTablePrompt", () => {
  it("전결권자 값을 포함한 텍스트를 만든다", () => {
    const text = buildTablePrompt(parseTable());
    expect(text).toContain("국·소장");
    expect(text).toContain("관내출장");
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `npm test -- test/table.test.ts`
Expected: FAIL ("Cannot find module '../lib/table'").

- [ ] **Step 4: 최소 구현** — `lib/table.ts`

```ts
import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";

export type Row = Record<string, string>;

const CSV_PATH = path.join(process.cwd(), "data", "전결_검색테이블_통합.csv");

export function parseTable(): Row[] {
  const csv = fs.readFileSync(CSV_PATH, "utf-8");
  return parse(csv, { columns: true, skip_empty_lines: true, bom: true }) as Row[];
}

export function buildTablePrompt(rows: Row[]): string {
  // 한 행 = 한 줄. 챗봇이 표를 직접 읽고 분기·전결을 판단한다.
  const header =
    "대분류번호|대분류명|검색키|검색키워드|분기기준|분기조건|금액하한|금액상한|기안권자|전결권자|비고";
  const lines = rows.map((r) =>
    [
      r["대분류번호"], r["대분류명"], r["검색키"], r["검색키워드"],
      r["분기기준"], r["분기조건"], r["금액하한"], r["금액상한"],
      r["기안권자"], r["전결권자"], r["비고"],
    ].join("|")
  );
  return [header, ...lines].join("\n");
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test -- test/table.test.ts`
Expected: PASS (4 passed).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: CSV 표 로딩·프롬프트 텍스트화 (lib/table)"
```

---

### Task 3: 시스템 프롬프트 (`lib/systemPrompt.ts`) — TDD

**Files:**
- Create: `lib/systemPrompt.ts`, `test/systemPrompt.test.ts`

- [ ] **Step 1: 실패 테스트 작성** — `test/systemPrompt.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "../lib/systemPrompt";

describe("buildSystemPrompt", () => {
  const sp = buildSystemPrompt("대분류번호|...표내용...");
  it("표 내용을 포함한다", () => {
    expect(sp).toContain("표내용");
  });
  it("근거 규칙(지어내지 않기)을 명시한다", () => {
    expect(sp).toContain("지어내지");
  });
  it("금액 구간 규칙을 명시한다", () => {
    expect(sp).toContain("금액하한");
  });
  it("분기 되물음 지시가 있다", () => {
    expect(sp).toContain("되묻");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- test/systemPrompt.test.ts`
Expected: FAIL ("Cannot find module '../lib/systemPrompt'").

- [ ] **Step 3: 최소 구현** — `lib/systemPrompt.ts`

```ts
export function buildSystemPrompt(tableText: string): string {
  return `당신은 부산 동구청 위임전결규정 안내 도우미입니다.
사용자의 질문은 대부분 "내가 ○○ 업무를 할 때 누구한테 결재(전결)를 받아야 하나요?"입니다.
아래 [전결표]만을 근거로 답하세요.

# 답변 규칙
1. 반드시 [전결표]에 있는 내용만 답한다. 표에 없으면 "원문에 규정이 없습니다(담당부서 확인 필요)"라고 답하고, 전결권자를 절대 지어내지 않는다.
2. 해당 업무의 '분기기준'이 '없음'이 아니면, 답하기 전에 부족한 정보를 먼저 되묻는다.
   - 금액: "금액이 얼마인가요?"  · 직급: "대상(또는 본인) 직급이 어떻게 되나요?"
   - 중요도: "중요 사안인가요, 경미한가요?"  · 부서수: "관련 부서가 2개 이상인가요?"  · 기간: "1일 이상인가요, 미만인가요?"
3. 금액 질문은 '금액하한'(초과)~'금액상한'(이하) 구간으로 판단한다. 문자열을 직역하지 않는다. 상한이 비어있으면 상한 없음(초과 전체)이다.
4. '비고'의 준용/gap/단독전결을 반드시 안내한다.
   - "준용"이면 "원문에 명시되진 않았으나 ~ 기준 준용" 임을 밝힌다.
   - "단독전결"이면 "별도 상신 없이 담당자 본인 전결"임을 알린다.
   - 금액 상한 초과 등 gap이면 "해당 구간은 원문 미규정"이라 안내한다.
5. 직급분기에서 '비고'에 직급대상(예: 표창 대상자, 회의 참석자, 위원장)이 있으면, 본인이 아니라 그 대상 기준임을 구분해 되묻는다.
6. 출력: "○○ 업무는 **△△께 전결(결재) 받으시면 됩니다.**" + 근거 한 줄(대분류·세부조건). 기안자가 따로 있으면 함께 안내한다.
7. 항상 한국어 존댓말. 간결하게.

# [전결표] (| 구분)
${tableText}`;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- test/systemPrompt.test.ts`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: 시스템 프롬프트 조립 (근거 규칙 포함)"
```

---

### Task 4: LLM 어댑터 (`lib/llm.ts`) — TDD (파라미터 빌더)

**Files:**
- Create: `lib/llm.ts`, `test/llm.test.ts`

- [ ] **Step 1: 실패 테스트 작성** — `test/llm.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { buildAnthropicParams, buildOpenAIParams, type ChatMessage } from "../lib/llm";

const msgs: ChatMessage[] = [{ role: "user", content: "출장보고 누구 전결?" }];

describe("buildAnthropicParams", () => {
  const p = buildAnthropicParams("SYS", msgs, "claude-sonnet-4-6");
  it("system을 캐시 블록으로 넣는다", () => {
    expect(p.system?.[0]).toMatchObject({
      type: "text", text: "SYS", cache_control: { type: "ephemeral" },
    });
  });
  it("messages를 그대로 전달한다", () => {
    expect(p.messages[0]).toEqual({ role: "user", content: "출장보고 누구 전결?" });
  });
});

describe("buildOpenAIParams", () => {
  const p = buildOpenAIParams("SYS", msgs, "gpt-4o");
  it("system을 첫 메시지로 넣는다", () => {
    expect(p.messages[0]).toEqual({ role: "system", content: "SYS" });
    expect(p.messages[1]).toEqual({ role: "user", content: "출장보고 누구 전결?" });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- test/llm.test.ts`
Expected: FAIL ("Cannot find module '../lib/llm'").

- [ ] **Step 3: 최소 구현** — `lib/llm.ts`

```ts
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- test/llm.test.ts`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: LLM 어댑터 (Anthropic/OpenAI 전환 + 캐싱)"
```

---

### Task 5: 채팅 API 라우트 (`app/api/chat/route.ts`) — TDD (llm 목)

**Files:**
- Create: `app/api/chat/route.ts`, `test/route.test.ts`

- [ ] **Step 1: 실패 테스트 작성** — `test/route.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/llm", () => ({
  callLLM: vi.fn(async () => "실·단·과장께 전결 받으시면 됩니다."),
}));

import { POST } from "../app/api/chat/route";

function req(body: unknown) {
  return new Request("http://localhost/api/chat", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
}

describe("POST /api/chat", () => {
  beforeEach(() => vi.clearAllMocks());
  it("messages를 받아 reply를 반환한다", async () => {
    const res = await POST(req({ messages: [{ role: "user", content: "출장보고?" }] }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.reply).toContain("실·단·과장");
  });
  it("messages가 없으면 400", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- test/route.test.ts`
Expected: FAIL ("Cannot find module '../app/api/chat/route'").

- [ ] **Step 3: 최소 구현** — `app/api/chat/route.ts`

```ts
import { NextResponse } from "next/server";
import { callLLM, type ChatMessage } from "../../../lib/llm";
import { parseTable, buildTablePrompt } from "../../../lib/table";
import { buildSystemPrompt } from "../../../lib/systemPrompt";

export const runtime = "nodejs";

let cachedSystem: string | null = null;
function systemPrompt(): string {
  if (!cachedSystem) cachedSystem = buildSystemPrompt(buildTablePrompt(parseTable()));
  return cachedSystem;
}

export async function POST(request: Request) {
  let body: { messages?: ChatMessage[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }
  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages가 필요합니다" }, { status: 400 });
  }
  try {
    const reply = await callLLM(systemPrompt(), messages);
    return NextResponse.json({ reply });
  } catch (e) {
    console.error("LLM 오류:", e);
    return NextResponse.json({ error: "응답 생성 실패. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- test/route.test.ts`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: /api/chat 라우트 (표 주입·무상태)"
```

---

### Task 6: 챗 UI (`app/layout.tsx`, `app/page.tsx`)

**Files:**
- Create: `app/layout.tsx`, `app/page.tsx`

- [ ] **Step 1: 루트 레이아웃 + 고지 푸터** — `app/layout.tsx`

```tsx
import "./globals.css";
export const metadata = { title: "동구 전결 도우미", description: "위임전결규정 안내 챗봇" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        {children}
        <footer style={{ textAlign: "center", fontSize: 12, color: "#888", padding: "12px" }}>
          위임전결규정 기반 참고용입니다. 최종 확인은 원규정/담당부서.
        </footer>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: 챗 화면** — `app/page.tsx`

```tsx
"use client";
import { useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

export default function Home() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "안녕하세요. 어떤 업무의 전결권자를 찾으세요? (예: 출장보고, 3천만원 공사, 병가)" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const json = await res.json();
      const reply = json.reply ?? json.error ?? "오류가 발생했습니다.";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "네트워크 오류. 다시 시도해 주세요." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 680, margin: "0 auto", padding: 16, minHeight: "90vh", display: "flex", flexDirection: "column" }}>
      <h1 style={{ fontSize: 20 }}>동구 전결 도우미</h1>
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, padding: "8px 0" }}>
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%",
            background: m.role === "user" ? "#2563eb" : "#fff", color: m.role === "user" ? "#fff" : "#1a1a1a",
            border: "1px solid #e5e7eb", borderRadius: 12, padding: "8px 12px", whiteSpace: "pre-wrap" }}>
            {m.content}
          </div>
        ))}
        {loading && <div style={{ color: "#888", fontSize: 13 }}>답변 작성 중…</div>}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()} placeholder="업무를 입력하세요"
          style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db" }} />
        <button onClick={send} disabled={loading}
          style={{ padding: "10px 16px", borderRadius: 8, border: 0, background: "#2563eb", color: "#fff", cursor: "pointer" }}>
          전송
        </button>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: 로컬 빌드 확인**

Run: `npm run build`
Expected: 빌드 성공(타입 에러 0). API 키 없이도 빌드는 통과한다(런타임에만 키 필요).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: 챗 UI + 고지 푸터"
```

---

### Task 7: 환경설정·문서 (`.env.example`, `README.md`)

**Files:**
- Create: `.env.example`, `README.md`

- [ ] **Step 1: `.env.example` 작성**

```
# anthropic | openai
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-6
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
```

- [ ] **Step 2: `README.md` 작성**

````markdown
# 동구 전결 도우미 (자연어 챗봇)

위임전결규정(169행)을 자연어로 물어 전결권자를 안내합니다.

## 로컬 실행
```bash
npm install
cp .env.example .env.local   # 키 채우기
npm run dev                  # http://localhost:8000
```

## 환경변수
- `LLM_PROVIDER`: `anthropic` 또는 `openai`
- `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`: 선택한 제공자 키
- `ANTHROPIC_MODEL`(기본 claude-sonnet-4-6) / `OPENAI_MODEL`(기본 gpt-4o)

## 배포 (Vercel + GitHub 자동배포)
1. GitHub에 이 리포 push
2. vercel.com → New Project → 이 리포 import
3. Environment Variables에 위 키 입력
4. Deploy. 이후 main에 push할 때마다 자동 재배포.

## 데이터 갱신
원규정 변경 시 별도 프로젝트의 `build_검색테이블.py` 재실행 → 생성된
`전결_검색테이블_통합.csv`를 `data/`에 덮어쓰고 commit·push.

## 테스트
```bash
npm test
```
````

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: README + .env.example"
```

---

### Task 8: 골든 회귀 테스트 (라이브, 키 없으면 skip)

**Files:**
- Create: `test/golden.test.ts`

- [ ] **Step 1: 골든 테스트 작성** — `test/golden.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { callLLM } from "../lib/llm";
import { parseTable, buildTablePrompt } from "../lib/table";
import { buildSystemPrompt } from "../lib/systemPrompt";

const hasKey = !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);
const sys = buildSystemPrompt(buildTablePrompt(parseTable()));

// 키가 없으면 라이브 호출 skip (CI/로컬 키 없을 때 통과)
describe.skipIf(!hasKey)("골든 회귀 (라이브 LLM)", () => {
  const cases: Array<[string, string]> = [
    ["출장 다녀와서 경미한 출장보고 올리는데 누구 전결이야?", "실·단·과장"],
    ["예산 변경 결재 누구한테 받아?", "국·소장"],
    ["3천만원짜리 공사 집행(추정금액) 전결권자?", "국·소장"],
  ];
  it.each(cases)("%s → %s", async (q, expected) => {
    const reply = await callLLM(sys, [{ role: "user", content: q }]);
    expect(reply).toContain(expected);
  }, 30000);
});
```

- [ ] **Step 2: 키 없이 실행 → skip 확인**

Run: `npm test -- test/golden.test.ts`
Expected: 골든 describe는 skip, 전체 PASS(또는 0 failed).

- [ ] **Step 3: (선택) 키 넣고 라이브 확인**

`.env.local`에 키가 있으면: `npm test`
Expected: 골든 3케이스 PASS. 실패 시 시스템 프롬프트 규칙을 보강(분기 되물음이 답을 막으면, 질문에 조건을 포함했으므로 직접 답하도록 프롬프트 6항을 조정).

- [ ] **Step 4: 전체 테스트 + 커밋**

Run: `npm test`
Expected: table/systemPrompt/llm/route PASS, golden skip(또는 PASS).

```bash
git add -A
git commit -m "test: 골든 회귀 케이스(라이브, skipIf)"
```

---

### Task 9: GitHub 푸시 + Vercel 배포 (수동 단계 문서화)

**Files:** 없음(외부 작업). 아래는 사용자가 직접 수행.

- [ ] **Step 1: GitHub 리포 생성·푸시**

```bash
gh repo create jeonjyeol-chatbot --private --source=. --remote=origin --push
```
(gh 미설치 시: github.com에서 빈 리포 생성 후 `git remote add origin <URL>` → `git push -u origin main`)

- [ ] **Step 2: Vercel 연결**

vercel.com → Add New Project → GitHub의 `jeonjyeol-chatbot` import → Framework "Next.js" 자동 감지.

- [ ] **Step 3: 환경변수 입력**

Vercel 프로젝트 Settings → Environment Variables: `LLM_PROVIDER`, `ANTHROPIC_API_KEY`(또는 OPENAI), 모델명. → Deploy.

- [ ] **Step 4: 동작 확인**

배포 URL 접속 → "경미한 출장보고 누구 전결?" 입력 → "실·단·과장" 응답 확인. 이후 main push마다 자동 재배포.

---

## Self-Review (작성자 점검 결과)
- **스펙 커버리지:** LLM 멀티프로바이더(Task4) / 멀티턴·표주입(Task3,5) / 캐싱(Task4) / 근거규칙·감사안전(Task3) / 공개 UI·고지(Task6) / Vercel+GitHub(Task7,9) / 골든테스트(Task8) — 스펙 1~12 항목 모두 태스크 대응됨.
- **플레이스홀더:** 없음(모든 코드 단계에 실제 코드 포함).
- **타입 일관성:** `ChatMessage`(lib/llm) 를 route/golden에서 동일 사용. `parseTable`/`buildTablePrompt`/`buildSystemPrompt`/`callLLM` 시그니처가 태스크 간 일치.
- **주의:** 골든 테스트는 LLM 비결정성으로 간헐 실패 가능 → `toContain`(정확 일치 아님) + 질문에 조건 포함으로 되물음 회피. 키 없으면 skip.
