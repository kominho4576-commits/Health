# 오늘운동 — Routed PWA 버전

각 화면(홈/달력/랭크/설정)을 **분리된 모듈 + HTML 파셜**로 구성하고, 상단 탭 클릭 → **Hash Router**가 해당 화면을 로드합니다.  
오프라인 사용을 위해 Service Worker에서 각 `views/*.html`과 `js/*.js`를 캐시에 포함했습니다.

## 구조
```
index.html
styles.css
sw.js
manifest.webmanifest
views/
  home.html
  calendar.html
  rank.html
  settings.html
js/
  state.js      # 전역 상태/유틸
  home.js       # 홈 화면 로직
  calendar.js   # 달력 화면 로직
  rank.js       # 랭크 화면 로직
  settings.js   # 설정 화면 로직
icons/
  icon-192.png
  icon-512.png
```

## 배포 (GitHub Pages)
저장소 루트에 업로드 → Settings → Pages → Branch: main / folder: /(root)

## 라우팅
- 초기: `#/home`
- 탭: `#/home`, `#/calendar`, `#/rank`, `#/settings`
