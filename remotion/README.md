# 사용 플로우 데모 GIF (Remotion)

루트 `README.md`에 들어가는 사용 플로우 데모(`../public/demo.gif`)의 소스.
배포되는 Next 앱과 **완전히 분리된** 독립 프로젝트다(자체 `package.json`/`node_modules`, gitignore). 루트 빌드·Vercel에 영향 없음.

- `src/Demo.tsx` — 컴포지션(등장→타이핑→검색→결과 모달). 앱 디자인 토큰 재사용, 프레임 기반 `interpolate`/`spring`.
- `src/Root.tsx` — Composition 등록(1080×1350, 30fps, 270프레임).
- 예시는 실제 규정대로: "예산의 변경" → 전결권자 **국·소장**(기안 담당자).

## 미리보기(스튜디오)

```bash
cd remotion
npm install      # 최초 1회
npm run studio   # 브라우저에서 타임라인 확인
```

## 렌더(GIF 재생성)

```bash
cd remotion
npm run render   # = remotion render Demo ../public/demo.gif --codec=gif --every-nth-frame=2 --scale=0.66
```

- `--every-nth-frame=2` → 15fps로 용량 절반, `--scale=0.66` → 713×891. 둘로 약 3~4MB 유지(README 적정).
- 인코딩은 `@remotion/renderer` 내장(ffmpeg 별도 설치 불필요).
- 폰트(Pretendard)는 `src/Demo.tsx`에서 `FontFace`로 로드 후 `continueRender` — 네트워크 필요.

스토리보드/규격 상세: `../docs/superpowers/specs/2026-06-04-readme-demo-gif-design.md`
