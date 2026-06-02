# 동구 전결 도우미 (자연어 챗봇)

위임전결규정(169행)을 자연어로 물어 전결권자를 안내합니다.

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
