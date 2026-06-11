# GitHub Pages 정적 전환 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** jeongyeol-finder를 서버 없는 완전 정적 BYOK 앱으로 바꿔 GitHub Pages에 배포한다.

**Architecture:** 서버 API(`app/api/lookup/route.ts`)의 오케스트레이션을 순수 함수 `lib/lookup.ts`로 옮겨 브라우저에서 직접 호출한다. LLM SDK를 브라우저용으로 설정하고(Claude 헤더, Gemini 그대로, OpenAI 제거), Next를 `output: 'export'` + `basePath`로 정적 빌드해 GitHub Actions로 Pages에 올린다.

**Tech Stack:** Next 16 (app router, static export), React 18, vitest, @anthropic-ai/sdk, @google/generative-ai, GitHub Actions(Pages).

**Branch:** `gh-pages-static` (체크포인트 커밋 `66df23f` 이후에서 작업)

**작업 디렉터리:** `D:\jeongyeol-finder` — 모든 명령은 이 폴더에서 실행. git은 `git -C D:\jeongyeol-finder ...`.

---

## File Structure

- **Create** `lib/lookup.ts` — query→결과 오케스트레이션(로컬 매칭→캐시→LLM 폴백→에러 분류). 순수 async, 브라우저/노드 공용.
- **Create** `lib/basePath.ts` — basePath 상수 + raw 자산 경로용 `withBase()` 헬퍼.
- **Create** `.github/workflows/deploy.yml` — main push 시 정적 빌드→Pages 배포.
- **Modify** `lib/llm.ts` — Anthropic 브라우저 헤더, Gemini 유지, OpenAI 분기·의존성 제거, `providerForKey` 미지원 처리.
- **Modify** `app/page.tsx` — `fetch("/api/lookup")` → `lookup()` 직접 호출, OpenAI UI 제거, 자산 경로 `withBase()`.
- **Modify** `next.config.mjs` — `output:'export'` + `basePath` + `images.unoptimized`, CF 분기 제거.
- **Modify** `package.json` — `cf:*`/`start` 스크립트, `openai`/`@opennextjs/cloudflare`/`wrangler` 의존성 제거.
- **Rewrite** `test/lookup.test.ts` — `POST` 라우트 대신 `lookup()` 테스트.
- **Modify** `test/llm.test.ts` — `buildOpenAIParams` 테스트 제거, `providerForKey` 기대값 `unsupported`.
- **Delete** `app/api/`(디렉터리), `wrangler.jsonc`, `open-next.config.ts`, `scripts/cf-build.mjs`, `.vercel/`.

---

## Task 1: `lib/lookup.ts` — 오케스트레이션 추출

**Files:**
- Create: `D:\jeongyeol-finder\lib\lookup.ts`
- Rewrite: `D:\jeongyeol-finder\test\lookup.test.ts`

- [ ] **Step 1: 기존 테스트를 `lookup()` 대상으로 재작성 (failing)**

`test/lookup.test.ts` 전체를 아래로 교체:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/llm", () => ({
  callLLM: vi.fn(
    async () =>
      '여기 결과입니다: {"found":true,"task":"예산의 변경","needsChoice":false,"question":"","options":[],"approver":"국·소장","drafter":"담당자","reason":"예산운영","note":""} 끝.'
  ),
}));

import { lookup } from "../lib/lookup";

describe("lookup()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("로컬에서 못 풀고 키가 있으면 LLM 폴백으로 구조화 결과를 반환한다", async () => {
    const r = await lookup("도무지모르겠는 xyz123 질의", "sk-ant-test");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.source).toBe("llm");
      expect(r.result.approver).toBe("국·소장");
    }
  });

  it("로컬에서 못 풀고 키가 없으면 needsKey(401)", async () => {
    const r = await lookup("또다른 모르는 abc987 질의", "");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(401);
      expect(r.needsKey).toBe(true);
    }
  });

  it("정확히 일치하면 로컬에서 처리하고 LLM을 호출하지 않는다", async () => {
    const r = await lookup("예산의 변경", "");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.source).toBe("local");
      expect(r.result.approver).toBe("국·소장");
    }
  });

  it("query가 없으면 400", async () => {
    const r = await lookup("", "");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- lookup`
Expected: FAIL — `Cannot find module '../lib/lookup'` (아직 생성 안 함)

- [ ] **Step 3: `lib/lookup.ts` 생성**

```ts
// query → 결과 오케스트레이션. route.ts에서 이식한 순수 async 함수(브라우저/노드 공용).
// 로컬 표 매칭 우선 → 모듈 캐시 → BYOK LLM 폴백 → 에러 분류.
import { callLLM } from "./llm";
import { parseTable, buildTablePrompt } from "./table";
import { buildSystemPrompt } from "./systemPrompt";
import { extractJson } from "./json";
import { buildIndex, resolveLocal, type Index, type Result } from "./resolve";

export type LookupResponse =
  | { ok: true; result: Result; source: "local" | "llm" | "cache" }
  | { ok: false; error: string; needsKey?: boolean; status: number };

let _index: Index | null = null;
let _system: string | null = null;
function getIndex(): Index {
  if (!_index) _index = buildIndex(parseTable());
  return _index;
}
function systemPrompt(): string {
  if (!_system) _system = buildSystemPrompt(buildTablePrompt(parseTable()));
  return _system;
}

const cache = new Map<string, Result>();
const keyOf = (q: string) => q.trim().toLowerCase().replace(/\s+/g, "");

export async function lookup(query: string, userKey: string): Promise<LookupResponse> {
  const q = (query ?? "").trim();
  if (!q) return { ok: false, error: "query가 필요합니다", status: 400 };

  const ck = keyOf(q);
  const cached = cache.get(ck);
  if (cached) return { ok: true, result: cached, source: "cache" };

  // 1) 로컬 우선 — 표에서 바로 해결되면 LLM 안 씀
  const local = resolveLocal(q, getIndex());
  if (local) {
    cache.set(ck, local);
    return { ok: true, result: local, source: "local" };
  }

  // 2) 표에서 못 푼 모호 질의만 LLM 폴백 — 사용자 키로만 호출(BYOK)
  const key = (userKey ?? "").trim();
  if (!key) {
    return {
      ok: false,
      error: "이 질문은 정밀 분석(LLM)이 필요해요. 본인 API 키를 입력해 주세요.",
      needsKey: true,
      status: 401,
    };
  }

  try {
    const raw = await callLLM(systemPrompt(), [{ role: "user", content: q }], key);
    const result = extractJson(raw) as Result;
    if (cache.size > 500) cache.clear();
    cache.set(ck, result);
    return { ok: true, result, source: "llm" };
  } catch (e) {
    const err = e as { status?: number; code?: string; message?: string };
    const status = err?.status;
    const code = (err?.code ?? "").toLowerCase();
    const msg = (err?.message ?? "").toLowerCase();

    // 미지원 제공자(OpenAI 등) — llm.ts가 code:"unsupported_provider"로 throw
    if (code === "unsupported_provider") {
      return { ok: false, error: err.message ?? "지원하지 않는 키", needsKey: true, status: 400 };
    }
    // 잘못된/권한 없는 키
    if (status === 401 || status === 403 || msg.includes("api key not valid") || msg.includes("api_key_invalid")) {
      return { ok: false, error: "API 키가 올바르지 않거나 권한이 없어요. 키를 다시 확인해 주세요.", needsKey: true, status: 401 };
    }
    // 크레딧·잔액 없음
    if (code === "insufficient_quota" || msg.includes("insufficient_quota") || msg.includes("credit balance") || msg.includes("billing")) {
      return { ok: false, error: "이 키는 크레딧(잔액)이 없어요. 결제·충전 후 쓰거나, 잔액 있는 다른 키를 넣어주세요.", needsKey: true, status: 402 };
    }
    // 레이트리밋
    if (status === 429) {
      return { ok: false, error: "요청이 잠깐 몰렸어요. 몇 초 뒤 다시 시도해 주세요.", status: 429 };
    }
    // 모델 없음/미지원
    if (status === 404 || msg.includes("not found") || msg.includes("is not supported") || msg.includes("not supported for")) {
      return { ok: false, error: "지금 설정된 AI 모델을 쓸 수 없어요(관리자 확인 필요). 키 문제는 아닙니다.", status: 502 };
    }
    return { ok: false, error: "결과 생성 실패. 잠시 후 다시 시도해 주세요.", status: 502 };
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- lookup`
Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

```bash
git -C D:/jeongyeol-finder add lib/lookup.ts test/lookup.test.ts
git -C D:/jeongyeol-finder commit -m "feat: lib/lookup.ts로 조회 오케스트레이션 추출 + 테스트 이전"
```

---

## Task 2: `lib/llm.ts` 브라우저화 + OpenAI 제거

**Files:**
- Modify: `D:\jeongyeol-finder\lib\llm.ts`
- Modify: `D:\jeongyeol-finder\test\llm.test.ts`

- [ ] **Step 1: `test/llm.test.ts` 수정 (failing)**

`test/llm.test.ts` 전체를 아래로 교체 (`buildOpenAIParams` 블록 제거, `providerForKey` 기대값 변경):

```ts
import { describe, it, expect } from "vitest";
import {
  buildAnthropicParams,
  toGeminiContents,
  providerForKey,
  type ChatMessage,
} from "../lib/llm";

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

describe("providerForKey", () => {
  it("키 접두로 제공자를 판별하고, 그 외는 unsupported", () => {
    expect(providerForKey("sk-ant-abc")).toBe("anthropic");
    expect(providerForKey("AIzaSyAbc")).toBe("gemini");
    expect(providerForKey("sk-proj-xyz")).toBe("unsupported");
  });
});

describe("toGeminiContents", () => {
  it("assistant는 model로, user는 user로 매핑하고 parts에 텍스트를 담는다", () => {
    const c = toGeminiContents([
      { role: "user", content: "안녕" },
      { role: "assistant", content: "응" },
    ]);
    expect(c[0]).toEqual({ role: "user", parts: [{ text: "안녕" }] });
    expect(c[1]).toEqual({ role: "model", parts: [{ text: "응" }] });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- llm`
Expected: FAIL — `providerForKey("sk-proj-xyz")` 가 아직 `"openai"` 반환

- [ ] **Step 3: `lib/llm.ts` 교체**

`lib/llm.ts` 전체를 아래로 교체:

```ts
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- llm lookup`
Expected: PASS (llm + lookup 모두 통과; lookup 테스트의 callLLM 모킹은 그대로 동작)

- [ ] **Step 5: 커밋**

```bash
git -C D:/jeongyeol-finder add lib/llm.ts test/llm.test.ts
git -C D:/jeongyeol-finder commit -m "feat: llm.ts 브라우저화(Claude 헤더) + OpenAI 제거"
```

---

## Task 3: `lib/basePath.ts` + `app/page.tsx` 배선

**Files:**
- Create: `D:\jeongyeol-finder\lib\basePath.ts`
- Modify: `D:\jeongyeol-finder\app\page.tsx`

- [ ] **Step 1: `lib/basePath.ts` 생성**

```ts
// GitHub Pages 프로젝트 경로. next/link·next/image는 basePath를 자동 처리하지만
// raw <img src>/<a href> 문자열은 안 되므로 이 헬퍼로 명시 접두한다.
export const BASE_PATH = "/jeongyeol-finder";
export const withBase = (p: string) => `${BASE_PATH}${p.startsWith("/") ? p : "/" + p}`;
```

- [ ] **Step 2: `page.tsx` 임포트 추가**

`app/page.tsx` 상단(line 2 `import { useState, useEffect } ...` 아래)에 추가:

```ts
import { lookup } from "../lib/lookup";
import { withBase } from "../lib/basePath";
```

- [ ] **Step 3: `search()`의 fetch 블록을 `lookup()` 호출로 교체**

`app/page.tsx`의 `try { ... } catch { ... } finally { ... }` 블록(현재 `const res = await fetch("/api/lookup" ...` 부터 `finally { setLoading(false); }` 까지)을 아래로 교체:

```ts
    try {
      const r = await lookup(text, useKey);
      if (r.ok) {
        setResult(r.result as Result);
      } else if (r.needsKey) {
        setNeedKey(true);
        setError(r.error);
      } else {
        setError(r.error);
      }
    } catch {
      setError("네트워크 오류. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
```

- [ ] **Step 4: PROVIDERS에서 OpenAI 제거**

`app/page.tsx`의 `PROVIDERS` 배열에서 OpenAI 객체(`label: "OpenAI"` 항목 `{ src: "/logos/openai.svg", label: "OpenAI", hint: "sk-…", url: "https://platform.openai.com/api-keys" },`) 한 블록을 삭제. 결과는 Claude·Gemini 2개만 남김.

- [ ] **Step 5: 자산 경로 `withBase()` 적용 + 안내 문구에서 OpenAI 제거**

`app/page.tsx`에서 아래 4곳을 수정:

1. 제공자 로고 `<img>` — `src={p.src}` → `src={withBase(p.src)}`
2. 원문 엑셀 링크 — `href="/byeolpyo2-samujeongyeol.xlsx"` → `href={withBase("/byeolpyo2-samujeongyeol.xlsx")}`
3. 키 모달 placeholder — `placeholder="키 붙여넣기 (sk-ant-… / sk-… / AIza…)"` → `placeholder="키 붙여넣기 (sk-ant-… / AIza…)"`
4. 결과 모달 키 입력 placeholder/안내 두 곳:
   - `placeholder="sk-ant-… (Claude) / sk-… (OpenAI) / AIza… (Gemini)"` → `placeholder="sk-ant-… (Claude) / AIza… (Gemini)"`
   - 문구 `키는 이 브라우저에만 저장돼요(서버 저장 안 함). Claude · OpenAI · Gemini 지원.` → `키는 이 브라우저에만 저장돼요(서버 저장 안 함). Claude · Gemini 지원.`
   - 키 모달 설명 `표에 없는 모호한 질문은 LLM(Claude·GPT·Gemini)이 답해요` → `…LLM(Claude·Gemini)이 답해요`

- [ ] **Step 6: 타입체크 통과 확인**

Run: `npx -y tsc --noEmit -p D:/jeongyeol-finder/tsconfig.json`
Expected: 에러 없음 (특히 `/api/lookup` 참조·OpenAI 참조 없음, `lookup`/`withBase` 정상 해석)

- [ ] **Step 7: 단위 테스트 회귀 확인**

Run: `npm test`
Expected: 전체 PASS (lookup, llm, resolve, table, systemPrompt, golden)

- [ ] **Step 8: 커밋**

```bash
git -C D:/jeongyeol-finder add lib/basePath.ts app/page.tsx
git -C D:/jeongyeol-finder commit -m "feat: page.tsx가 lookup() 직접 호출 + basePath 자산 경로 + OpenAI UI 제거"
```

---

## Task 4: 정적 export 설정 + 서버/CF 잔재 제거

**Files:**
- Modify: `D:\jeongyeol-finder\next.config.mjs`
- Modify: `D:\jeongyeol-finder\package.json`
- Delete: `app/api/`(디렉터리), `wrangler.jsonc`, `open-next.config.ts`, `scripts/cf-build.mjs`, `.vercel/`

- [ ] **Step 1: `next.config.mjs` 교체**

`next.config.mjs` 전체를 아래로 교체:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",            // 정적 HTML/JS만 생성(out/)
  basePath: "/jeongyeol-finder", // GitHub Pages 프로젝트 경로
  images: { unoptimized: true }, // 정적 export는 이미지 최적화 서버 없음
  trailingSlash: true,         // /path/ → /path/index.html (Pages 디렉터리 서빙)
};
export default nextConfig;
```

- [ ] **Step 2: 서버/CF 파일 삭제**

```powershell
Remove-Item -Recurse -Force D:/jeongyeol-finder/app/api
Remove-Item -Force D:/jeongyeol-finder/wrangler.jsonc, D:/jeongyeol-finder/open-next.config.ts, D:/jeongyeol-finder/scripts/cf-build.mjs
if (Test-Path D:/jeongyeol-finder/.vercel) { Remove-Item -Recurse -Force D:/jeongyeol-finder/.vercel }
```

- [ ] **Step 3: `package.json` 스크립트/의존성 정리**

`package.json`의 `scripts`를 아래로 교체 (`cf:*`, `start` 제거):

```json
  "scripts": {
    "data:build": "node scripts/gen-table.mjs",
    "dev": "next dev -p 8000",
    "build": "node scripts/gen-table.mjs && next build",
    "test": "vitest run"
  },
```

`dependencies`에서 `"openai": "^4.56.0",` 줄 삭제.
`devDependencies`에서 `"@opennextjs/cloudflare": "^1.19.11",` 와 `"wrangler": "^4.97.0"` 줄 삭제.

- [ ] **Step 4: 의존성 재설치(lockfile 갱신)**

Run: `npm install --prefix D:/jeongyeol-finder`
Expected: 성공, `openai`/`@opennextjs/cloudflare`/`wrangler` 제거 반영

- [ ] **Step 5: 정적 빌드 검증**

Run: `npm run build --prefix D:/jeongyeol-finder`
Expected: 성공. `out/` 디렉터리 생성, `out/index.html` 존재(basePath로 `/jeongyeol-finder/` 자산 참조).

검증:
```powershell
Test-Path D:/jeongyeol-finder/out/index.html
Select-String -Path D:/jeongyeol-finder/out/index.html -Pattern "/jeongyeol-finder/_next" -Quiet
```
Expected: 둘 다 `True`

- [ ] **Step 6: 테스트 회귀 확인**

Run: `npm test --prefix D:/jeongyeol-finder`
Expected: 전체 PASS

- [ ] **Step 7: 커밋**

```bash
git -C D:/jeongyeol-finder add -A
git -C D:/jeongyeol-finder commit -m "feat: output:export+basePath 정적 전환, 서버/Cloudflare 잔재 제거"
```

---

## Task 5: GitHub Actions Pages 배포 워크플로

**Files:**
- Create: `D:\jeongyeol-finder\.github\workflows\deploy.yml`

- [ ] **Step 1: 워크플로 작성**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - run: touch out/.nojekyll
      - uses: actions/upload-pages-artifact@v3
        with:
          path: out

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: 커밋**

```bash
git -C D:/jeongyeol-finder add .github/workflows/deploy.yml
git -C D:/jeongyeol-finder commit -m "ci: GitHub Pages 정적 배포 워크플로"
```

---

## Task 6: 통합 검증 + 머지 + Pages 활성화

**Files:** 없음(검증·운영)

- [ ] **Step 1: 클린 빌드 + 전체 테스트 최종 확인**

```powershell
Remove-Item -Recurse -Force D:/jeongyeol-finder/.next, D:/jeongyeol-finder/out -ErrorAction SilentlyContinue
npm run build --prefix D:/jeongyeol-finder
npm test --prefix D:/jeongyeol-finder
```
Expected: 빌드 성공(`out/` 재생성), 테스트 전체 PASS

- [ ] **Step 2: 로컬 정적 서빙으로 육안 확인(선택)**

Run: `npx -y serve D:/jeongyeol-finder/out -l 5050`
브라우저: `http://localhost:5050/jeongyeol-finder/` — "병가" 검색이 로컬로 즉시 동작, 로고/원문 엑셀 링크가 깨지지 않는지 확인. (LLM 폴백은 실제 키로만)

- [ ] **Step 3: main 머지 (배포 트리거)**

```bash
git -C D:/jeongyeol-finder checkout main
git -C D:/jeongyeol-finder merge --no-ff gh-pages-static -m "feat: GitHub Pages 정적 BYOK 앱으로 전환"
git -C D:/jeongyeol-finder push origin main
```

- [ ] **Step 4: 레포 Pages 설정(수동 1회)**

GitHub → `hanjjaem/jeongyeol-finder` → Settings → Pages → **Source = "GitHub Actions"** 선택.
그 후 Actions 탭에서 `Deploy to GitHub Pages` 실행 성공 확인 → `https://hanjjaem.github.io/jeongyeol-finder/` 접속.

- [ ] **Step 5: 배포본 실검증**

배포 URL에서 (1) "병가" 로컬 검색, (2) Claude(`sk-ant-`) 또는 Gemini(`AIza`) 키로 모호 질의 LLM 폴백, (3) `sk-proj-` 같은 키 입력 시 "Claude·Gemini만" 안내가 뜨는지 확인.

---

## 미해결/주의

- **Pages 첫 배포 전까지** `https://hanjjaem.github.io/jeongyeol-finder/`는 404. Step 4 수동 설정 후 동작.
- Anthropic 브라우저 직접 호출은 `anthropic-dangerous-direct-browser-access` 헤더에 의존 — Anthropic이 정책을 바꾸면 Claude 경로가 막힐 수 있음(그때 Gemini로 안내).
- `.env.local`의 서버 키는 더 이상 사용 안 함(BYOK·정적). 빌드타임 모델 override가 필요하면 `NEXT_PUBLIC_ANTHROPIC_MODEL`/`NEXT_PUBLIC_GEMINI_MODEL` 사용.
