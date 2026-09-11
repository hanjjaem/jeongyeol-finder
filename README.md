# 결재자를 단순하게

부산 동구청 위임전결규정 원문 후보를 기준으로 업무의 기안자·전결권자를 찾는 정적 웹앱입니다. 외부 LLM, API 키, 서버 API를 사용하지 않고 브라우저에 내장된 규정 데이터와 결정형 검색 로직만 사용합니다.

## 현재 범위

- 기존 호환 검색 데이터: `data/전결_검색테이블_통합.csv` 169행
- 전체 검토 데이터: `lib/fullData.generated.ts` 24개 시트·3,359개 원문 행
- 검색 범위: 기본은 기존 결정형 검색. 부서를 선택하면 전체 원문 후보 검색
- 결과: 전결권자, 기안권자, 원문 시트·행·셀 표시, 분기 조건, 비고
- 원문: `public/byeolpyo2-samujeongyeol.xlsx` 정적 다운로드 링크
- 검색 실패: 규정표에 없는 업무로 안내하고 예시 검색을 제시

## 처리 흐름

```text
data/전결_검색테이블_통합.csv
        │ npm run data:build
        ▼
lib/tableData.generated.ts
        │ buildIndex()
        ▼
lib/resolve.ts 결정형 검색

services/jeongyeol-finder/data/normalized/records.json
        │ scripts/gen-full-data.mjs --input <path>
        ▼
lib/fullData.generated.ts
        │ 부서 선택 또는 기존 검색 보강
        ▼
lib/lookup.ts 전체 원문 후보·근거 검색
        │
        ▼
app/page.tsx 결과 모달·엑셀형 원문 발췌
```

`lib/table.ts`는 생성된 TypeScript 배열을 읽습니다. 앱 실행 중 XLSX를 파싱하거나 새로운 XLSX를 생성하지 않습니다. 원본 XLSX 변환은 별도의 데이터 변환 파이프라인에서 수행해야 합니다.

## 주요 파일

```text
app/page.tsx                 검색 UI와 결과 모달
lib/lookup.ts               로컬 검색 오케스트레이션·캐시
lib/resolve.ts              키워드·금액·직급·조건 분기 결정 로직
lib/table.ts                생성 데이터 로딩
lib/tableData.generated.ts  CSV에서 생성되는 파일
scripts/gen-table.mjs       CSV → TypeScript 배열 변환
data/전결_검색테이블_통합.csv 검색 데이터 원천
test/                       로컬 검색·분기·데이터 테스트
```

## 로컬 실행

```bash
npm install
npm run dev       # 개발 서버
npm test          # 단위 테스트
npm run build     # 정적 산출물(out/) 생성
```

## 데이터 갱신

1. 원본 변환 절차로 `data/전결_검색테이블_통합.csv`를 생성합니다.
2. `npm run data:build`로 `lib/tableData.generated.ts`를 재생성합니다.
3. `npm test`와 `npm run build`를 실행합니다.
4. 변경된 CSV·생성 파일·검증 결과를 함께 기록합니다.

전체 24개 시트를 추가할 때는 시트명, 부서명, 원문 행 번호, 기안·전결 표시 근거를 데이터에 보존해야 합니다. 같은 업무명이 여러 부서에 존재할 수 있으므로 부서 범위와 중복 처리 규칙도 함께 정의해야 합니다.

## 배포

`next.config.mjs`의 정적 export와 `.github/workflows/deploy.yml`을 사용해 GitHub Pages에 배포합니다. 앱은 `/jeongyeol-finder/` base path를 사용합니다.

운영 전에는 정적 산출물의 검색 동작, 원문 링크, 모바일 화면, 데이터 행 수를 확인합니다.

## 운영 원칙

- 규정표에 없는 전결권자를 추정하지 않습니다.
- 규정 변경은 원본 확인 → 변환 → 테스트 → 정적 빌드 → 배포 검증 순서로 처리합니다.
- 이 저장소에는 API 키나 개인 인증정보를 저장하지 않습니다.
- 설계·구현의 역사적 LLM 기록은 `docs/superpowers/`에 남아 있지만 현재 실행 경로에서는 제거되었습니다.
