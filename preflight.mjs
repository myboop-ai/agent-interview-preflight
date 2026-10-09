import net from "node:net";
import { query } from "@anthropic-ai/claude-agent-sdk";

try {
  process.loadEnvFile();
} catch {} // a missing .env is fine when the key is exported

const failures = [];
const fail = (what, fix) => failures.push(`FAIL ${what}\n     Fix: ${fix}`);

if (Number(process.versions.node.split(".")[0]) < 22) {
  fail(`Node ${process.version} is older than 22`, "install Node 22 or later from https://nodejs.org");
}

const cloudVars = ["CLAUDE_CODE_USE_BEDROCK", "CLAUDE_CODE_USE_VERTEX", "CLAUDE_CODE_USE_FOUNDRY"].filter((v) => process.env[v]);
if (cloudVars.length) fail(`${cloudVars.join(", ")} is set, which sends model calls to a cloud provider instead of the key`, `unset ${cloudVars.join(" ")} in this shell`);

const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);
if (!hasKey) fail("ANTHROPIC_API_KEY is not set", "copy .env.example to .env and paste the key we sent you into it");

async function checkModel(model) {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 60_000);
  try {
    for await (const m of query({
      prompt: "Reply with the word ok.",
      options: { model, tools: [], settingSources: [], persistSession: false, maxTurns: 1, abortController: abort },
    })) {
      if (m.type === "result" && m.is_error) throw new Error(String(m.result).split("\n")[0]);
    }
  } catch (e) {
    const msg = e.message.split("\n")[0];
    if (abort.signal.aborted) {
      fail(`model ${model}: no answer within 60 seconds`, "check your network, VPN or proxy lets https://api.anthropic.com through");
    } else if (/invalid api key|401|authentication/i.test(msg)) {
      fail(`model ${model}: the API key was rejected`, "open .env and check the line reads ANTHROPIC_API_KEY=<the full key we sent you> (it starts with sk-ant-, no quotes or spaces)");
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
