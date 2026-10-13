// 방언번역기의 두뇌
// 화면(public/index.html)의 부탁을 받아 제미나이 AI에게 대신 물어보고,
// 우리말샘 사전으로 방언 단어가 진짜인지 확인해요.
// API 키는 Cloudflare 비밀 설정(env)에만 있어서 화면 쪽에는 절대 보이지 않아요.

import CHEAT from "../커닝페이퍼.json";

export const DIALECTS = ["표준어", "경상도", "전라도", "충청도", "제주도", "강원도"];

// 먼저 앞의 AI에게 물어보고, 실패하면 다음 AI에게 다시 물어봐요 (모델 이름, 기다릴 밀리초)
const MODELS = [
  ["gemini-flash-lite-latest", 15000],
  ["gemini-3.8-flash", 20000],
];

// 우리말샘 지역 번호 (경상도 = 경남·경북·경상 처럼 같은 도의 번호를 모두)
const REGION_CODES = {
  경상도: "3,4,5",
  전라도: "6,7,8",
  충청도: "10,11,12",
  제주도: "9",
  강원도: "1",
};

// 단어 끝에 붙는 말(조사). 긴 것부터 떼 봐요.
const PARTICLES = "을 를 이 가 은 는 도 에 에서 으로 로 하고 랑 이랑 좀 만 의 까지 부터 보다 처럼 한테 께 요 유 이여 여 이유"
  .split(" ")
  .sort((a, b) => b.length - a.length);

export class QuotaError extends Error {
  // kind = "minute"(1분 한도) 또는 "day"(하루 한도)
  constructor(kind) {
    super(kind);
    this.kind = kind;
  }
}

// ── AI에게 보낼 부탁 글 ──

// 글에 그 단어가 들어 있나요? (먹다 → '먹'만 있어도 '먹었어'에서 찾을 수 있게 끝의 '다'는 떼고 봐요)
const appears = (text, word) => text.includes(word.length > 2 ? word.replace(/다$/, "") : word);

// 글에 나온 단어의 줄만 보여 줘요. 상관없는 줄까지 보여 주면 AI가 헷갈려요 (예: 고구마 → 감재)
// side = "src"면 방언 쪽(오른쪽)을, "dst"면 표준어 쪽(왼쪽)을 글에서 찾아요
// "all"이면 다 보여 줘요 (방언→방언 번역은 글에 표준어 단어가 없어서 골라낼 수 없어요)
function cheatText(dialect, text, side) {
  const sheet = CHEAT[dialect];
  if (!sheet) return "";
  const words = Object.entries(sheet["단어"])
    .filter(([std, dia]) => side === "all" || appears(text, side === "src" ? dia : std))
    .map(([std, dia]) => `${std}→${dia}`)
    .join(", ");
  return `[${dialect} 참고]\n단어: ${words}\n말투 예시: ${sheet["말끝"].join(" / ")}\n`;
}

// 이 글을 바꾸면 번역 스타일이 달라져요!
function makePrompt(text, src, dst, polite, hints) {
  let hintText = "";
  if (hints.length) {
    const lines = hints
      .map((h) => `- ${h.word}: 방언 뜻 = ${h.dialectDefs.join(" / ")}` + (h.standard ? ` | 표준어 뜻 = ${h.standard}` : ""))
      .join("\n");
    hintText =
      `[우리말샘 사전 힌트] 글 속 단어가 ${src}에서는 아래 방언 뜻으로도 쓰여.\n` +
      "표준어 뜻이 문맥에 자연스러우면 표준어 뜻 그대로 두고, 방언 뜻이어야 말이 될 때만 방언 뜻으로 번역해.\n" +
      "같은 단어가 여러 번 나오면 하나씩 따로 문맥을 보고 판단해.\n" +
      `${lines}\n`;
  }
  const speech = polite ? "존댓말(높임말)" : "반말";
  const style =
    dst === "표준어"
      ? "방언 단어와 사투리 말끝을 하나도 남기지 말고 모두 표준어로 바꿔. (예: 아따→와, 겁나→엄청)\n" +
        "- 이미 표준어인 단어(예: 시간, 학교, 밥)는 절대 다른 단어로 바꾸지 말고 그대로 둬."
      : `${dst} 사람이 실제로 말하는 것처럼 자연스럽게 써.`;

  return `너는 한국어 방언 전문가야.
아래 글을 [${src}]에서 [${dst}]로 바꿔 줘.
- 뜻은 그대로 두고, ${style}
- 말투는 ${speech}로 해.
- 아래 참고 목록에 있는 말을 우선 사용해. 확실하지 않은 방언은 지어내지 말고 표준어에 가깝게 써.
- 참고 목록의 방언은 화살표 왼쪽 표준어 단어가 글에 있을 때만 써. 비슷한 다른 단어(예: 고구마)에 갖다 쓰지 마.
- 말끝만 사투리로 바꿀 때는 그 앞 글자를 원문 그대로 둬. 받침·모음 하나도 바꾸지 마. (예: 쪘어→쪘드래요, 졌드래요는 틀림)
- notes에는 표준어와 다른 방언 단어를 최대 4개 골라 적어.
  word = 글에 나온 그대로의 방언, base = 그 방언 단어의 기본형(표준어로 바꾸지 말 것, 예: 뭇나→묵다), meaning = 표준어 뜻.
  ${dst}가 표준어면 원문에 있던 방언 단어를 풀이해.
- 반드시 아래 예시와 같은 JSON 모양으로만 대답해.
  예시: {"translation": "밥 뭇나?", "notes": [{"word": "뭇나", "base": "묵다", "meaning": "먹었니"}]}

${hintText}${cheatText(src, text, "src")}${cheatText(dst, text, src === "표준어" ? "dst" : "all")}
글: ${text}`;
}

// ── 제미나이 AI ──

async function askGemini(prompt, env) {
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0, // 주사위 끄기: 같은 글에는 같은 답
      responseMimeType: "application/json", // AI가 JSON 모양으로만 대답하게 해요
    },
  });
  const quota = []; // 한도에 걸린 AI들이 어떤 한도였는지 모아 둬요
  for (const [i, [model, wait]] of MODELS.entries()) {
    const last = i === MODELS.length - 1;
    let res;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
        body,
        signal: AbortSignal.timeout(wait),
      });
    } catch (e) {
      // 시간 초과 등으로 대답이 안 왔어요
      if (last || quota.length) throw e;
      quota.push("timeout");
      continue;
    }
    if (res.ok) {
      const data = await res.json();
      return JSON.parse(data.candidates[0].content.parts[0].text);
    }
    if (res.status === 429) {
      // 구글이 알려 주는 한도 이름에 'PerDay'가 있으면 하루 한도, 아니면 1분 한도
      quota.push((await res.text()).includes("PerDay") ? "day" : "minute");
    } else if (res.status === 400 || last) {
      throw new Error(`AI 서버 오류가 났어요 (${res.status}).`);
    }
  }
  if (quota.includes("timeout")) throw new Error("timeout"); // 한도 때문이 아니라 느려서 실패
  // 모든 AI가 한도에 걸렸어요. 하나라도 1분 한도면 금방 풀리니까 그걸 알려 줘요
  throw new QuotaError(quota.includes("minute") ? "minute" : "day");
}

// ── 우리말샘 사전 ──

async function searchDict(env, q, extra) {
  const params = new URLSearchParams({
    key: env.OPENDICT_API_KEY,
    q,
    req_type: "json",
    advanced: "y",
    method: "exact", // 글자가 똑같은 단어만
    num: "20",
    ...extra,
  });
  const url = `https://opendict.korean.go.kr/api/search?${params}`;
  let data;
  try {
    data = await (await fetch(url, { signal: AbortSignal.timeout(6000) })).json();
  } catch {
    // 사전 서버가 가끔 잠깐 늦어요. 한 번만 더 물어봐요
    data = await (await fetch(url, { signal: AbortSignal.timeout(6000) })).json();
  }
  return (data.channel?.item || []).flatMap((it) => it.sense.map((s) => ({ ...s, word: it.word })));
}

const clean = (def) => def.split("&lt;")[0].replace(/[-]/g, "").trim();

/**
 * 우리말샘에서 단어를 찾아 상태를 알려 줘요.
 * ok = 그 지역 방언 맞음 / other = 다른 지역 방언 / std = 표준어로만 있음 / none = 사전에 없음
 * 사전에 최대 2번만 물어봐요 (Cloudflare 무료는 한 번에 50번까지라서 아껴 써요)
 */
async function checkWord(env, base, region, { wantStandard = false } = {}) {
  const local = await searchDict(env, base, { type3: "dialect", region: REGION_CODES[region] });
  if (local.length) {
    // 그 지역 방언 뜻이 여러 개면 전부 모아요 (예: 고마 = 고구마 / 고만 / 그냥)
    const dialectDefs = [...new Set(local.map((s) => clean(s.definition)))];
    let standard = "";
    if (wantStandard) {
      // 표준어 뜻도 하나 찾아 둬요 (예: 시간 = 시각과 시각 사이)
      const general = await searchDict(env, base, { type3: "general" });
      standard = clean(general.find((s) => !s.definition.includes("어근"))?.definition || "");
    }
    return {
      status: "ok",
      definition: dialectDefs[0],
      dialectDefs,
      standard,
      regions: [region.slice(0, 2)],
      link: local[0].link,
    };
  }
  const all = await searchDict(env, base, {});
  const dialect = all.find((s) => s.type === "방언");
  if (dialect) return { status: "other", definition: clean(dialect.definition), regions: [], link: dialect.link };
  if (all.length) return { status: "std", definition: clean(all[0].definition), regions: [], link: all[0].link };
  return { status: "none" };
}

async function safeCheck(env, base, region, opts) {
  try {
    return await checkWord(env, base, region, opts);
  } catch {
    return { status: "error" };
  }
}

// 번역 전에 글 속 단어를 우리말샘에서 찾아, 그 지역 방언 뜻이 있으면 힌트로 모아요
async function dictionaryHints(env, text, region) {
  if (!env.OPENDICT_API_KEY) return [];
  const words = [];
  for (const token of text.match(/[가-힣]+/g) || []) {
    const cands = [token, ...PARTICLES.filter((p) => token.endsWith(p) && token.length > p.length).map((p) => token.slice(0, -p.length))];
    for (const c of cands) if (!words.includes(c)) words.push(c);
  }
  const picked = words.slice(0, 10); // 너무 많이 찾으면 느려지니까 앞에서 10개까지만
  const found = await Promise.all(picked.map((w) => safeCheck(env, w, region, { wantStandard: true })));
  return picked.map((word, i) => ({ word, ...found[i] })).filter((h) => h.status === "ok");
}

// ── 번역 기억 (Cloudflare KV: 인터넷 위의 작은 메모장) ──

async function memoryKey(src, dst, polite, text) {
  // 글이 길 수도 있어서, 글을 짧은 지문(해시)으로 바꿔서 이름표로 써요
  const raw = new TextEncoder().encode(`v6|${src}|${dst}|${polite ? 1 : 0}|${text}`);
  const hash = await crypto.subtle.digest("SHA-256", raw);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── 화면에서 오는 부탁 처리 ──

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });

export async function handleTranslate(request, env) {
  const req = await request.json().catch(() => ({}));
  const text = String(req.text || "").trim().slice(0, 2000);
  const { src, dst } = req;
  const polite = Boolean(req.polite);
  if (!text || !DIALECTS.includes(src) || !DIALECTS.includes(dst)) {
    return json({ error: "입력이 올바르지 않아요." }, 400);
  }

  const key = await memoryKey(src, dst, polite, text);
  const saved = env.MEMORY && (await env.MEMORY.get(key, "json"));
  if (saved) return json(saved);

  try {
    const hints = src !== "표준어" ? await dictionaryHints(env, text, src) : [];
    const answer = await askGemini(makePrompt(text, src, dst, polite, hints), env);
    // AI가 가끔 엉뚱한 풀이를 붙이니까, 짧고 제대로 된 것만 남겨요
    const notes = (answer.notes || [])
      // 뜻이 원래 단어와 똑같은 풀이(예: 시간 = 시간)는 방언이 아니니까 빼요
      .filter((n) => n && n.word && n.meaning && n.word.length <= 15 && n.word !== n.meaning && n.base !== n.meaning)
      .slice(0, 4)
      .map((n) => ({ word: n.word, base: n.base || n.word, meaning: n.meaning }));
    const result = { translation: answer.translation, notes };
    if (env.MEMORY) await env.MEMORY.put(key, JSON.stringify(result), { expirationTtl: 60 * 60 * 24 * 90 }); // 90일 동안 기억
    return json(result);
  } catch (e) {
    if (e instanceof QuotaError) {
      const msg =
        e.kind === "minute"
          ? "⏱️ 잠깐! 너무 빨리 여러 번 번역했어요. 1분 뒤에 다시 해 보세요."
          : "📅 오늘 무료 사용량을 다 썼어요. 매일 오후 4시에 다시 풀려요.";
      return json({ error: msg }, 429);
    }
    if (e.message?.startsWith("AI 서버 오류")) return json({ error: e.message }, 502);
    return json({ error: "번역 중 문제가 생겼어요. 다시 해 보세요." }, 502);
  }
}

export async function handleVerify(request, env) {
  const req = await request.json().catch(() => ({}));
  if (!DIALECTS.slice(1).includes(req.region)) return json({ error: "지역이 올바르지 않아요." }, 400);
  const notes = (req.notes || []).slice(0, 4);
  if (!env.OPENDICT_API_KEY) return json(notes.map(() => ({ status: "none" })));
  const checks = await Promise.all(notes.map((n) => safeCheck(env, String(n.base || n.word || ""), req.region)));
  return json(checks);
}
