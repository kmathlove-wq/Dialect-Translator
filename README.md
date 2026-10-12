# 🗣️ 방언번역기 (Dialect Translator)

표준어와 지역 방언(경상도·전라도·충청도·제주도·강원도)을 서로 번역하는 파파고 스타일 번역기예요.
방언끼리도 번역할 수 있어요. (예: 충청도 `졸` → 경상도 `정구지`)

👉 **https://방언번역기.kro.kr**

## 이렇게 동작해요

```
글 입력
 → ① 우리말샘 사전에서 글 속 방언 단어를 먼저 찾아 힌트로 모음
 → ② 제미나이 AI가 힌트 + 커닝페이퍼를 보고 번역
 → ③ 번역 결과의 방언 단어를 우리말샘에서 다시 확인해 ✅ 표시
```

- **커닝페이퍼** (`커닝페이퍼.json`): 우리말샘에서 그 지역 방언으로 확인된 단어만 모은 목록
- **번역기억**: 한 번 번역한 문장은 Cloudflare KV에 90일 동안 기억해서 같은 답을 바로 보여 줌
- **사전 확인 표시**: ✅ 그 지역 방언 맞음 · 🟡 다른 지역 방언 · 📘 표준어로만 있음 · ❔ 사전에 없음

## 폴더 구조

| 경로 | 하는 일 |
|---|---|
| `public/index.html` | 번역 화면 |
| `functions/api/translate.js` | 번역 부탁 받는 곳 (`/api/translate`) |
| `functions/api/verify.js` | 사전 확인 부탁 받는 곳 (`/api/verify`) |
| `lib/core.js` | 번역·사전 확인의 실제 내용 |
| `커닝페이퍼.json` | 지역별 확인된 방언 단어 |
| `wrangler.toml` | Cloudflare 설정 |
| `실행.bat`, `scripts/local.mjs` | 내 컴퓨터에서 켜기 |

## 내 컴퓨터에서 켜기

1. `~/.claude/secrets/.env` 에 `GEMINI_API_KEY`, `OPENDICT_API_KEY` 를 넣어요.
2. `실행.bat` 을 더블클릭해요. → <http://127.0.0.1:8765/>

## 배포 (Cloudflare Pages)

```bash
npx wrangler pages deploy
```

비밀 키는 코드에 넣지 않고 Cloudflare 비밀 설정에 넣어요.

```bash
npx wrangler pages secret put GEMINI_API_KEY --project-name dialect-translator
npx wrangler pages secret put OPENDICT_API_KEY --project-name dialect-translator
```

## 한계

- 방언은 같은 도 안에서도 동네마다 달라서 100% 정답은 없어요.
- 제주 말은 사전에 옛 글자(아래아 ㆍ)로 실린 게 많아서 검색이 안 될 때가 있어요.
- 제미나이 무료 사용량을 넘으면 잠시 기다려야 해요. (1분 한도 / 하루 한도는 매일 오후 4시에 풀림)

## 사용한 것

- [Google Gemini API](https://ai.google.dev/) — 번역
- [국립국어원 우리말샘 Open API](https://opendict.korean.go.kr/service/openApiInfo) — 방언 확인
- [Cloudflare Pages](https://pages.cloudflare.com/) — 배포
