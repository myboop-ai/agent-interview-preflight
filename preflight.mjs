import net from "node:net";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { query } from "@anthropic-ai/claude-agent-sdk";

const failures = [];
const fail = (what, fix) => failures.push(`FAIL ${what}\n     Fix: ${fix}`);

let fileEnv = {};
try {
  fileEnv = parseEnv(readFileSync(".env", "utf8"));
} catch {} // a missing .env is fine when the key is exported
const shellKey = process.env.ANTHROPIC_API_KEY;
if (shellKey && fileEnv.ANTHROPIC_API_KEY && shellKey !== fileEnv.ANTHROPIC_API_KEY) {
  fail("ANTHROPIC_API_KEY is set in your shell and differs from .env; the shell one wins", "run `unset ANTHROPIC_API_KEY` (and remove it from your shell profile), then run this again");
}
for (const [k, v] of Object.entries(fileEnv)) process.env[k] ??= v;

if (Number(process.versions.node.split(".")[0]) < 22) {
  fail(`Node ${process.version} is older than 22`, "install Node 22 or later from https://nodejs.org");
}

const cloudVars = ["CLAUDE_CODE_USE_BEDROCK", "CLAUDE_CODE_USE_VERTEX", "CLAUDE_CODE_USE_FOUNDRY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_BASE_URL"].filter((v) => process.env[v]);
if (cloudVars.length) fail(`${cloudVars.join(", ")} is set, which sends model calls somewhere other than the key`, `unset ${cloudVars.join(" ")} in this shell`);

const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);
if (!hasKey) fail("ANTHROPIC_API_KEY is not set", "in .env, set the line to ANTHROPIC_API_KEY=<the key we sent you> (if there is no .env yet, run cp .env.example .env first)");

async function checkModel(model) {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 60_000);
  try {
    for await (const m of query({
      prompt: "Reply with the word ok.",
      options: { model, tools: [], settingSources: [], persistSession: false, maxTurns: 1, abortController: abort },
    })) {
      if (m.type === "result" && m.is_error) throw new Error(String(m.errors?.[0] ?? m.result ?? m.subtype));
    }
  } catch (e) {
    const msg = e.message.split("\n")[0];
    if (abort.signal.aborted) {
      fail(`model ${model}: no answer within 60 seconds`, "check your network, VPN or proxy lets https://api.anthropic.com through");
    } else if (/invalid api key|401|authentication/i.test(msg)) {
      fail(`model ${model}: the API key was rejected`, shellKey ? "the key in your shell was used; run `unset ANTHROPIC_API_KEY` so the one in .env is read" : "open .env and check the line reads ANTHROPIC_API_KEY=<the full key we sent you> (it starts with sk-ant-, no quotes or spaces)");
    } else {
      fail(`model ${model}: ${msg}`, "send us this output and we'll sort it out");
    }
  } finally {
    clearTimeout(timer);
  }
}
if (hasKey) for (const model of ["claude-haiku-4-5", "claude-sonnet-5"]) await checkModel(model);

try {
  const res = await fetch("https://api.weather.gov/", {
    headers: { "User-Agent": "interview-preflight (setup check)" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
} catch (e) {
  fail(`api.weather.gov did not answer (${e.message})`, "check your network, VPN or proxy lets https://api.weather.gov through");
}

await new Promise((resolve) => {
  const server = net.createServer();
  server.once("error", (e) => {
    fail(`port 3000 is not free (${e.code})`, "stop whatever is using port 3000 (on macOS or Linux, `lsof -i :3000` shows it)");
    resolve();
  });
  server.listen(3000, () => server.close(resolve));
});

if (failures.length) {
  console.error(`\nSetup check failed:\n\n${failures.join("\n")}\n`);
  process.exitCode = 1;
} else {
  console.log("\nSetup works.\n");
}
