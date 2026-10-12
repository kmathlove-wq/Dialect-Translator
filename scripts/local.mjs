// 내 컴퓨터에서 방언번역기를 켜는 도우미 (실행.bat 이 불러요)
// 비밀 키 파일(~/.claude/secrets/.env)에서 키를 읽어 Cloudflare 개발 서버에 몰래 건네줘요.

import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { join } from "node:path";

const PORT = Number(process.env.PORT) || 8765;
const envFile = join(process.env.USERPROFILE, ".claude", "secrets", ".env");
const keys = Object.fromEntries(
  readFileSync(envFile, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("="))
    .map((line) => line.split(/=(.*)/s).map((s) => s.trim())),
);

const args = ["wrangler", "pages", "dev", "--port", String(PORT)];
for (const name of ["GEMINI_API_KEY", "OPENDICT_API_KEY"]) {
  if (!keys[name]) {
    console.log(`키 파일에 ${name}가 없어요!`);
    process.exit(1);
  }
  args.push("--binding", `${name}=${keys[name]}`);
}

console.log(`방언번역기를 켜는 중이에요... 잠시 뒤 http://127.0.0.1:${PORT}/ 이 열려요.`);
console.log("끄려면 이 까만 창을 닫으세요.");
const child = spawn(["npx", ...args].join(" "), { shell: true, stdio: ["inherit", "pipe", "inherit"] });

let opened = false;
child.stdout.on("data", (chunk) => {
  const text = chunk.toString();
  // 키가 화면에 찍히지 않게 가려요
  let safe = text;
  for (const name of ["GEMINI_API_KEY", "OPENDICT_API_KEY"]) safe = safe.split(keys[name]).join("(비밀)");
  process.stdout.write(safe);
  if (!opened && !process.env.NO_BROWSER && text.includes("Ready on")) {
    opened = true;
    spawn("cmd", ["/c", "start", "", `http://127.0.0.1:${PORT}/`]);
  }
});
child.on("exit", (code) => process.exit(code ?? 0));
