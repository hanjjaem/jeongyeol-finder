# README 런칭 포스터 배너 — 설계

작성일: 2026-06-04

## 목표
GitHub README 최상단에 jeongyeol-finder를 소개하는 **정적 포스터 배너(PNG)** 1장을 넣는다.
클릭 시 라이브 사이트로 이동. (라이브 임베드는 GitHub README에서 불가 → 정적 이미지로.)
이번 범위는 정적 포스터만. 사용 플로우 영상(B안)은 후속 작업으로 분리.

## 산출물
- `poster/poster.html` — 포스터 소스(재생성용). 앱 `app/globals.css`의 디자인 토큰 재사용.
- `poster/render.(ps1|sh)` 또는 README에 기록된 1줄 명령 — Chrome 헤드리스로 PNG 렌더.
- `public/poster.png` — 결과물(2400×1260, 2배 렌더). 커밋.
- `README.md` 최상단에 배너 삽입, 링크 → https://jeongyeol-finder.vercel.app

## 제작 방식
설치된 Chrome 헤드리스로 HTML을 스크린샷. npm 의존성 추가 없음. 재생성 가능.
```
chrome --headless --screenshot=public/poster.png --window-size=1200,630 \
       --force-device-scale-factor=2 --hide-scrollbars poster/poster.html
```
(대안 기각: Next에 /poster 라우트 추가 — 배포 앱을 오염시켜 불필요.)

## 규격
- 1200×630 논리 크기, 2배 렌더 → 2400×1260 PNG. OG 이미지 표준 비율(후일 og:image 재활용 가능).

## 디자인
배경: 앱과 동일한 블루→퍼플→핑크 radial 글로우 + 미세 그리드(42px) + 라이트 톤.
폰트: Pretendard. 다크모드 없음(앱 정책 일치).

레이아웃 — 좌(카피) / 우(브라우저 기기목업):
- 좌상단: 브랜드마크 "결"(그라데이션 ink→#2563eb) + 워드마크 "결재자를 단순하게"
- 헤드라인: **"누가 결재받지?"** / **"검색 한 번이면 끝."** (히어로 그라데이션 텍스트)
- 불릿 3개:
  - 위임전결규정 169항목 자연어 검색
  - 결재(전결권자) 즉시 + 별표2 원문 근거
  - 감사 안전: 표에 있는 것만 답 (지어내지 않음)
- 하단: `jeongyeol-finder.vercel.app`
- 우: 브라우저 프레임 목업. 안에 히어로를 **HTML로 재현**(스샷의 스샷 금지). "결" 마크 + "누가 결재?" 타이틀 + 글래스 검색창 + 예시 칩.

## 비범위 (YAGNI)
- 애니메이션/영상(B안)·다국어·다크모드 포스터·기기(폰) 목업 추가본.

## 검증
- 렌더된 `public/poster.png`를 직접 열어 확인(텍스트 잘림/색·정렬/그리드 마스크/목업 또렷함).
- README 미리보기에서 배너 표시 + 링크 동작.
