# 오늘운동 — iPhone용 PWA 운동 관리 앱

- 오프라인 동작 (Service Worker)
- SPA 구조 (탭: 홈/달력/랭크/설정)
- LocalStorage에 기록/설정 저장
- 요일별 루틴, 주간 증가량 자동 계산
- 랭크 포인트 & 스트릭 보너스
- 타이머(플랭크 등) → 완료 시 자동 세트 체크 + 비프

## 로컬 실행
1) 정적 서버로 열어주세요(예: VSCode Live Server / `python -m http.server`)
2) `http://localhost:8000` 로 접속

## GitHub Pages 배포
- 저장소 루트에 본 파일들을 커밋/푸시 → Pages(Branch: main, /root) 설정

## 파일 구조
```
index.html
styles.css
app.js
sw.js
manifest.webmanifest
icons/
  ├─ icon-192.png
  └─ icon-512.png
```

---
최초 로드시 기본 운동 예시 데이터가 채워집니다. 설정 탭에서 시작일/휴식요일/운동을 원하는대로 바꾸세요.
