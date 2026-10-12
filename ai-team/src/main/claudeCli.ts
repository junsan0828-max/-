// Claude Code(공식 CLI)의 print 모드를 호출해서 글을 쓰게 한다.
// - 대표님의 Claude 구독(Pro) 로그인으로 동작한다 (API 키 요금이 따로 나가지 않는다).
// - 토큰을 꺼내 쓰지 않고 공식 CLI 프로그램을 그대로 실행만 한다.
// - ANTHROPIC_API_KEY 가 환경에 있으면 CLI가 구독 대신 API 요금으로 동작하므로 자식 프로세스에서는 제거한다.
// - 프로젝트 폴더의 CLAUDE.md(CAOO 지침)가 글 형식에 섞이지 않도록 빈 임시 폴더에서 실행한다.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** AI_TEAM_LLM=api 로 두면 구독을 쓰지 않고 기존 API 키 방식만 쓴다. 기본은 claude-code. */
export function claudeCodeEnabled(): boolean {
  return (process.env.AI_TEAM_LLM ?? "claude-code").toLowerCase() !== "api";
}

function resolveBin(): string {
  if (process.env.CLAUDE_CODE_BIN) return process.env.CLAUDE_CODE_BIN;
  const appdata = process.env.APPDATA;
  if (appdata) {
    const p = join(appdata, "npm", "node_modules", "@anthropic-ai", "claude-code", "bin", "claude.exe");
    if (existsSync(p)) return p;
  }
  return "claude";
}

export interface AskClaudeCodeOptions {
  system: string;
  prompt: string;
  /** 비워 두면 CLI의 기본 모델을 쓴다. */
  model?: string;
  timeoutMs?: number;
  /** 허용할 도구 (예: ["Read"]). 비우면 도구 없이 글만 쓴다. */
  tools?: string[];
  /** 도구가 읽을 수 있게 열어 둘 폴더 (예: PDF가 있는 폴더). */
  addDirs?: string[];
}

export function askClaudeCode(opts: AskClaudeCodeOptions): Promise<string> {
  const workDir = join(tmpdir(), "ai-team-claude-code");
  mkdirSync(workDir, { recursive: true });

  const toolList = (opts.tools ?? []).join(",");
  const args = ["-p", "--output-format", "text", "--tools", toolList, "--no-session-persistence", "--system-prompt", opts.system];
  if (toolList) args.push("--allowedTools", toolList);
  for (const d of opts.addDirs ?? []) args.push("--add-dir", d);
  const model = opts.model ?? process.env.AI_TEAM_CLAUDE_CODE_MODEL;
  if (model) args.push("--model", model);

  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  delete env.ANTHROPIC_AUTH_TOKEN;

  return new Promise((resolve, reject) => {
    const child = spawn(resolveBin(), args, { cwd: workDir, env, windowsHide: true });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Claude Code 응답 시간 초과 (${(opts.timeoutMs ?? 180000) / 1000}초)`));
    }, opts.timeoutMs ?? 180000);

    child.stdout.on("data", (d) => (out += d.toString("utf-8")));
    child.stderr.on("data", (d) => (err += d.toString("utf-8")));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(new Error(`Claude Code 실행 실패: ${e.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const text = out.trim();
      if (code === 0 && text) return resolve(text);
      reject(new Error(`Claude Code 종료 코드 ${code}: ${(err || text).slice(0, 300)}`));
    });
    child.stdin.write(opts.prompt);
    child.stdin.end();
  });
}
