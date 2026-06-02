# 결재자를 단순하게 (jeonjyeol-chatbot)

부산 동구청 위임전결규정(169행 검색테이블)을 자연어로 검색해 **결재자(전결권자)** 를 알려주는 웹앱.
UX는 **단일 검색 → 결과 모달**(채팅 아님). 분기(금액·직급·중요도)는 모달 안 버튼으로 한 번 더 선택.
Next.js(App Router) + Vercel, LLM은 Claude/OpenAI 전환(`LLM_PROVIDER`). 표 전체를 시스템 프롬프트에 주입해 **JSON 결과**를 받음.

핵심 파일: `app/page.tsx`(검색 UI+모달) · `app/api/lookup/route.ts`(질의→JSON) · `lib/{table,systemPrompt,llm,json}.ts` · `data/전결_검색테이블_통합.csv`
원리/구조는 `README.md`, 작업 기록은 `docs/superpowers/`. 디자인 컨텍스트는 `.impeccable.md`.

## Design Context

### Users
부산 동구청 공무원. 결재 올리기 직전, PC·휴대폰에서 "이 업무는 누구에게 전결받나"를 빠르게 확인. **신속·정확**이 최우선.

### Brand Personality
**단순한 · 명확한 · 빠른**. 앱 이름 "결재자를 단순하게"가 곧 약속. 군더더기 없는 도구.

### Aesthetic Direction
밝은 **글래스/그라데이션** 랜딩(컬러 글로우 + 미세 그리드, backdrop-blur 카드). **라이트 전용(다크모드 없음).** 강조 그라데이션 블루→퍼플→핑크.
- **단일 검색 → 결과 모달** UX. 큰 검색창 하나가 주인공. 결재자를 큰 글씨로, 분기는 모달 내 선택 버튼.
- 넣지 않음: 다크모드, 사용법 박스, 언어 전환, 연락처, 예시 칩.

### Design Principles
1. 검색창 하나에 집중(부가 UI 최소화). 2. 결재자를 가장 크게. 3. 분기는 결과창 안 버튼으로. 4. 근거(대분류·세부)·참고(준용/단독전결/미규정) 함께. 5. 모바일 동등(폰 우선).
