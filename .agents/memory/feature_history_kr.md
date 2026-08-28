
### [FIX] 21:21:30
GitHub Actions standalone publisher 성공 경로에서 errorLog를 null로 초기화하고, /api/posts 응답에서 과거 PUBLISHED stale 오류를 숨기도록 정상화했습니다.
---

### [FIX] 21:21:32
Root cause: 게시 성공 경로가 두 갈래(API route vs scripts/publish-standalone.js)로 분기돼 있었고, standalone 경로만 FAILED 이후 재성공 시 errorLog를 지우지 않아 PUBLISHED + stale errorLog 조합이 남았습니다.
---
