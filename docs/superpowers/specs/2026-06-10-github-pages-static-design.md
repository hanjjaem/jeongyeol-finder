# jeongyeol-finder → GitHub Pages 정적 전환 설계

- 날짜: 2026-06-10
- 브랜치: `gh-pages-static`
- 목표: Vercel/Cloudflare 서버 의존을 제거하고, 앱을 **완전 정적(클라이언트 전용) BYOK 앱**으로 전환해 GitHub Pages 단일 호스팅으로 운영한다.

## 배경 / 근거

이 앱은 이미 BYOK 구조라 **서버가 비밀키를 들고 있지 않다.** 서버 API(`app/api/lookup/route.ts`)가 하는 일은:

1. 로컬 표 매칭(`resolveLocal`) — 순수 JS, 비밀 없음
2. 사용자 키로 LLM 폴백 호출(`callLLM`) — 서버 키 미사용

둘 다 브라우저에서 실행 가능하므로 서버는 군더더기다. 정적 앱으로 바꾸면 외부 호스팅 계정(Vercel/Cloudflare) 없이 GitHub만으로 코드+호스팅이 통일되고, 향후 BYOK LLM 앱 시리즈의 재사용 골격이 된다.

## 결정 사항 (확정)

- **호스팅 주소:** GitHub Pages 프로젝트 페이지 `https://hanjjaem.github.io/jeongyeol-finder/` → `basePath: '/jeongyeol-finder'`
- **OpenAI:** 브라우저에서 `api.openai.com` CORS 차단 → UI에서 OpenAI 제거, Claude·Gemini만 지원
- **기존 서버/배포 설정:** 깔끔히 제거 (Vercel/Cloudflare 잔재 삭제)

## 아키텍처

### 데이터/제어 흐름 (변경 후)

```
page.tsx (client)
  └─ lookup(query, userKey)         ← lib/lookup.ts (신규, 순수 async)
       ├─ resolveLocal(...)         ← lib/resolve.ts (변경 없음)
       ├─ (module cache Map)
       └─ callLLM(system, msgs, key) ← lib/llm.ts (브라우저화)
            ├─ Anthropic  (dangerouslyAllowBrowser + 헤더)
            └─ Gemini     (그대로)
```

서버 라우트(`app/api/`)는 제거된다. 네트워크 호출은 브라우저 → LLM 제공자로 직접 발생한다.

## 컴포넌트별 변경

### 1. `lib/lookup.ts` (신규)

`route.ts` POST 핸들러의 오케스트레이션을 순수 async 함수로 이동. 인터페이스:

```ts
export type LookupResponse =
  | { ok: true; result: Result; source: "local" | "llm" | "cache" }
  | { ok: false; error: string; needsKey?: boolean; status: number };

export async function lookup(query: string, userKey: string): Promise<LookupResponse>;
```

- 로컬 우선(`resolveLocal`) → 모듈 레벨 캐시 `Map` → 키 없으면 `{ ok:false, needsKey:true, status:401 }` → 있으면 `callLLM` → `extractJson`
- `route.ts`의 에러 분류(401/403 키오류, 402 크레딧, 429 레이트리밋, 404/미지원 모델, 502 기타)를 그대로 이식하되 `NextResponse.json` 대신 `LookupResponse` 객체 반환
- 인덱스/시스템프롬프트 메모이제이션(`getIndex`, `systemPrompt`)도 이 모듈로 이동

### 2. `app/api/lookup/route.ts` (삭제)

정적 export(`output: 'export'`)는 라우트 핸들러를 허용하지 않음.

### 3. `lib/llm.ts` (브라우저화)

- Anthropic: `new Anthropic({ apiKey, dangerouslyAllowBrowser: true, defaultHeaders: { "anthropic-dangerous-direct-browser-access": "true" } })`
- Gemini: 수정 없음
- OpenAI: 분기 및 `openai` import 제거
- `providerForKey`: `sk-ant-`→anthropic, `AIza`→gemini, **그 외→`"unsupported"`**
- `callLLM`: provider가 unsupported면 `throw` (메시지: "이 배포에선 Claude(sk-ant-)·Gemini(AIza) 키만 쓸 수 있어요.")
- 모델명: 기존 기본값 상수 유지(`claude-sonnet-4-6`, `gemini-2.5-flash`). 빌드타임 override가 필요하면 `NEXT_PUBLIC_*` 환경변수 사용(선택)

### 4. `app/page.tsx`

- `fetch("/api/lookup", ...)` → `await lookup(text, useKey)` 직접 호출
- 반환 `LookupResponse`를 기존 state로 매핑: `ok:false && needsKey` → `setNeedKey`; `ok:false` → `setError`; `ok:true` → `setResult(result)`
- `PROVIDERS` 배열에서 OpenAI 항목 제거, 키 입력 placeholder/안내 문구에서 `sk-…(OpenAI)` 제거
- 하드코딩 절대경로(`/logos/*.svg`의 `img src`, `/byeolpyo2-samujeongyeol.xlsx`의 `a href`)를 `withBase(...)`로 감싸기

### 5. `lib/basePath.ts` (신규)

```ts
export const BASE_PATH = "/jeongyeol-finder";
export const withBase = (p: string) => `${BASE_PATH}${p.startsWith("/") ? p : "/" + p}`;
```

`next/link`·`next/image`는 basePath를 자동 처리하지만 raw `<img src>`/`<a href>` 문자열은 안 되므로 헬퍼로 명시 처리.

### 6. `next.config.mjs`

```js
const nextConfig = {
  output: "export",
  basePath: "/jeongyeol-finder",
  images: { unoptimized: true },
  trailingSlash: true,
};
```

CF 분기(`CF_BUILD`, `output:standalone`, `outputFileTracingRoot`)와 `initOpenNextCloudflareForDev()` import 전부 제거.

### 7. 정리(삭제)

- `app/api/` 디렉터리
- `wrangler.jsonc`, `open-next.config.ts`, `scripts/cf-build.mjs`, `.vercel/`
- `package.json`: `cf:build`/`cf:preview`/`cf:deploy` 스크립트, devDeps `@opennextjs/cloudflare`·`wrangler`, deps `openai`
- `docs/배포-트러블슈팅.md`는 기록용으로 **보존**

### 8. `.github/workflows/deploy.yml` (신규)

- 트리거: `push` to `main`
- 권한: `pages: write`, `id-token: write`, `contents: read`
- 잡:
  1. checkout → setup-node(20) → `npm ci`
  2. `npm run build` (`gen-table.mjs` + `next build` → `out/` 정적 출력)
  3. `out/.nojekyll` 생성 (`_next` 폴더가 Jekyll에 무시되지 않도록)
  4. `actions/upload-pages-artifact@v3` (path: `out`)
  5. `actions/deploy-pages@v4`
- **수동 1회 설정:** 레포 Settings → Pages → Source = "GitHub Actions"

### 9. `package.json` 스크립트 (정리 후)

- `dev`: `next dev -p 8000` (유지) — 로컬은 `http://localhost:8000/jeongyeol-finder`로 뜸
- `build`: `node scripts/gen-table.mjs && next build` (유지, export 출력)
- `data:build`, `test`: 유지
- `cf:*`, `start`: 제거

## 에러 처리

- 키 미입력 + 모호 질문: `needsKey` → 키 입력 UI (기존 동작 보존)
- 잘못된 키/크레딧 없음/레이트리밋/미지원 모델: 기존 분류 메시지 보존(이식)
- unsupported 키(OpenAI 등): "Claude·Gemini 키만 가능" 친절 에러
- 네트워크 오류: try/catch로 "네트워크 오류" (기존)

## 테스트

- 기존 vitest(`test/`의 resolve 테스트) 유지
- `lib/lookup.ts` 신규 테스트 2개:
  1. 키 없이 로컬로 풀리는 질의(예: "병가") → `ok:true, source:"local"`
  2. 표에 없는 모호 질의 + 키 없음 → `ok:false, needsKey:true, status:401`
- LLM 실제 호출은 테스트하지 않음(키·네트워크 필요)

## 안전점 / 롤백

- 작업 전 체크포인트 커밋 완료: `gh-pages-static` 브랜치 `checkpoint: BYOK + Cloudflare WIP 스냅샷`
- 구현은 동일 브랜치에서 진행, 완료·검증 후 `main` 머지 → 머지가 배포 트리거

## 비목표 (YAGNI)

- OpenAI 프록시/서버리스 함수 부활 (불필요)
- 커스텀 도메인 (basePath로 충분)
- 다중 배포 타겟 유지 (GitHub Pages 단일)
