# 결재자를 단순하게

부산 동구청 위임전결규정 원문 후보를 기준으로 업무의 기안자·전결권자를 찾는 정적 웹앱입니다. 외부 LLM, API 키, 서버 API를 사용하지 않고 브라우저에 내장된 규정 데이터와 결정형 검색 로직만 사용합니다.

## 현재 범위

- 기존 호환 검색 데이터: `data/전결_검색테이블_통합.csv` 169행
- 전체 검토 데이터: `lib/fullData.generated.ts` 24개 시트·3,359개 원문 행
- 검색 범위: 기본은 기존 결정형 검색. 부서를 선택하면 전체 원문 후보 검색
- 결과: 전결권자, 기안권자, 원문 시트·행·셀 표시, 분기 조건, 비고
- 원문: 동구 사무전결처리 규칙(자치법규 시스템) 링크와 별표 2 안내
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

[운영 폴더] D:\00.hjr\빅데이터플랫폼\2026\운영\services\jeongyeol-finder\
  data/(별표 2) 사무전결사항(제4조관련) (1).xlsx   원본 엑셀
        │ scripts/normalize_workbook.py (Python)
        ▼
  data/normalized/records.json                   원문 정규화 원본
        │ npm run data:full (이 저장소, 로컬 전용)
        ▼
lib/fullData.generated.ts          원문 3,359행 — 첫 화면 뒤 별도 청크로 로딩
lib/fullDepartments.generated.ts   부서 목록 — 첫 화면에 포함
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
lib/fullData.ts             원문 지연 로딩·부서 목록
scripts/gen-table.mjs       CSV → TypeScript 배열 변환 (원문행 ★○ 대조 포함)
scripts/gen-full-data.mjs   records.json → 원문 생성물 (--check: 버전 확인)
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

데이터 원본은 종류별로 한 곳에만 둡니다.

| 데이터 | 원본 위치 | 반영 명령 |
|---|---|---|
| 169행 검색테이블 | 이 저장소 `data/전결_검색테이블_통합.csv` | `npm run data:build` (`build`에 포함) |
| 원문 3,359행 | 운영 폴더 `data/normalized/records.json` | `npm run data:full` (로컬 전용) |

운영 폴더의 같은 이름 CSV는 참고용 복사본이므로 고치지 않습니다. GitHub Actions 빌드는 운영 폴더를 볼 수 없어 커밋된 생성물만 사용하므로, 원문 생성물(`lib/fullData.generated.ts`, `lib/fullDepartments.generated.ts`)은 반드시 커밋합니다.

원문 개정 시 순서:

1. 운영 폴더에서 `normalize_workbook.py`·`verify_normalization.py`를 실행합니다(운영 폴더 README 참조).
2. `npm run data:full`로 생성물을 갱신합니다. 다른 위치의 JSON은 `node scripts/gen-full-data.mjs --input <경로>`를 사용합니다.
3. `npm run data:check`로 생성물과 원본의 해시가 같은지 확인합니다. 배포 전에도 실행합니다.
4. `npm test`와 `npm run build`를 실행하고, 변경된 데이터·생성 파일·검증 결과를 함께 기록합니다.

### 169행 검색테이블의 원문행·판단구분

169행 검색테이블은 별표 2 공통사항 시트를 AI로 전처리해 만든 표입니다. 각 줄의 `원문행`(예: `공통사항:62`)은 결과 화면의 원문 발췌로 그대로 쓰이고, `npm run data:build`(빌드에 포함)가 그 행이 전체 원문에 있고 ★○ 표시와 기안권자·전결권자가 맞는지 확인합니다. 어긋나면 빌드가 멈춥니다.

| 판단구분 | 뜻 | 대조 |
|---|---|---|
| 원문 | 원문 행 ★○ 그대로 | 기안·전결 모두 |
| 해석 | 원문에 없는 업무를 적힌 행에 준용(예: 관내출장 → 나목) | 기안·전결 모두 |
| 단독전결 | 원문은 ○만 있고 ★ 없음 | 전결만 |
| 셀 내 조건 | 원문 칸 글 속 예외(예: "정기물은 담당자") | 행 존재만 |

원문이 개정되어 행 번호가 바뀌면 이 검사에서 걸리므로 `원문행`을 함께 고칩니다.

## 배포

`next.config.mjs`의 정적 export와 `.github/workflows/deploy.yml`을 사용해 GitHub Pages에 배포합니다. 앱은 `/jeongyeol-finder/` base path를 사용합니다.

운영 전에는 정적 산출물의 검색 동작, 원문 링크, 모바일 화면, 데이터 행 수를 확인합니다.

## 운영 원칙

- 규정표에 없는 전결권자를 추정하지 않습니다.
- 규정 변경은 원본 확인 → 변환 → 테스트 → 정적 빌드 → 배포 검증 순서로 처리합니다.
- 이 저장소에는 API 키나 개인 인증정보를 저장하지 않습니다.
- 설계·구현의 역사적 LLM 기록은 `docs/superpowers/`에 남아 있지만 현재 실행 경로에서는 제거되었습니다.
