# 동구 전결 도우미 (자연어 챗봇)

부산 동구청 **위임전결규정(169개 항목)** 을 자연어로 물어, *"내가 이 업무를 할 때 누구에게 전결(결재)받는지"* 를 안내하는 웹 챗봇입니다.

라이브: https://jeonjyeol-chatbot.vercel.app

---

## 어떻게 동작하나 (원리)

### 1) 핵심 아이디어
전결규정 원문(표)을 사람이 매번 뒤지는 대신, **검색하기 좋은 구조의 표 1개**로 정규화해 두고, LLM이 그 표만 근거로 답하게 했습니다. 규정이 169행으로 작기 때문에 **표 전체를 통째로 LLM 프롬프트에 넣는** 단순한 방식(벡터DB/RAG 불필요)으로 충분히 정확합니다.

### 2) 데이터 구조 (`data/전결_검색테이블_통합.csv`)
원문 전결규정을 "안건 1건 = 1행"으로 풀고, 챗봇이 되물을 조건을 컬럼으로 만들었습니다.

| 컬럼 | 역할 |
|---|---|
| 검색키 / 검색키워드 | 업무 검색(동의어 포함) |
| **분기기준** | 전결권자가 무엇으로 갈리는지: `없음 / 금액 / 직급 / 중요도 / 부서수 / 기간` |
| 분기조건 · 금액하한 · 금액상한 | 되물어 좁히는 값(금액은 **구간**으로 저장) |
| 기안권자 · **전결권자** | 누가 올리고, 누구한테 받는지(=핵심 답) |
| 비고 | 준용·단독전결·원문미규정(gap) 등 |

> 예) "공사 집행"은 `분기기준=금액`이라, 챗봇이 금액을 되묻고 `금액하한~상한` 구간으로 전결권자를 찾습니다. "이하"를 글자대로 읽으면 틀리기 때문에 구간으로 인코딩했습니다.

### 3) 처리 흐름
```
브라우저(챗 UI)
   │  POST /api/chat  (대화 히스토리 전체 전달, 무상태)
   ▼
Next.js 서버 (Vercel) ── API 키 보관
   │  시스템 프롬프트 = [근거 규칙] + [표 169행 전체]  (Anthropic은 캐싱)
   ▼
LLM (Claude 또는 OpenAI)  →  답하거나, 부족하면 분기 되물음
```

### 4) 정확성·감사 안전 규칙 (`lib/systemPrompt.ts`)
시스템 프롬프트에 다음을 강제합니다.
- 표에 **있는 것만** 답한다. 없으면 "원문 미규정"이라 하고 **전결권자를 지어내지 않는다**.
- `분기기준`이 '없음'이 아니면 **먼저 되묻는다**(금액/직급/중요도/부서수/기간).
- 금액은 `금액하한~상한` **구간**으로 판단한다.
- `비고`의 **준용/단독전결/gap** 을 안내한다.

---

## 기술 스택 / 구조
- **Next.js 14 (App Router) + TypeScript**, 배포는 **Vercel**(GitHub push 시 자동배포)
- LLM: **Claude(Anthropic) / OpenAI 둘 다 지원**, `LLM_PROVIDER` 환경변수로 전환

```
app/page.tsx            챗 UI(소개·예시칩·사용법 안내)
app/api/chat/route.ts   POST 핸들러(표 주입·무상태)
lib/table.ts            CSV 로딩 → 프롬프트 텍스트화
lib/systemPrompt.ts     근거 규칙 + 표 조립
lib/llm.ts              Anthropic/OpenAI 어댑터(+프롬프트 캐싱)
data/...통합.csv        검색테이블(169행)
test/                   table·systemPrompt·llm·route·golden 테스트
```

---

## 로컬 실행
```bash
npm install
cp .env.example .env.local   # 키 채우기
npm run dev                  # http://localhost:3000
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
(골든 회귀 테스트는 API 키가 있을 때만 실제 LLM 호출, 없으면 자동 skip)

---

## 한계 · 주의
- **참고용**입니다. 최종 확인은 원규정·담당부서.
- 규정 표에 없는 사항, 준용(해석)으로 채운 항목은 그 사실을 함께 안내합니다.
- 표가 수천 행 이상으로 커지면 "표 전체 주입" 대신 함수호출(조회)·RAG 방식으로 바꿔야 합니다(현재 169행이라 불필요).
