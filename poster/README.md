# 런칭 포스터 배너

루트 `README.md` 최상단에 들어가는 히어로 배너의 소스.

- `poster.html` — 포스터 디자인(앱 `app/globals.css` 토큰 재사용, 자급식 standalone)
- 출력물: `../public/poster.png` (2400×1260, 2배 렌더)

## 재생성

디자인을 고친 뒤 아래 명령으로 PNG를 다시 뽑고 커밋한다. (설치된 Chrome 헤드리스 사용, npm 의존성 없음)

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --headless=new --disable-gpu --hide-scrollbars `
  --force-device-scale-factor=2 --window-size=1200,630 --virtual-time-budget=5000 `
  --screenshot="public\poster.png" "poster\poster.html"
```

`--virtual-time-budget`은 Pretendard 웹폰트가 CDN에서 로드될 시간을 준다(빼면 폰트가 기본체로 깨질 수 있음).
