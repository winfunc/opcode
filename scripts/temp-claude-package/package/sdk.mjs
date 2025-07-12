// (c) Anthropic PBC. All rights reserved. Use is subject to Anthropic's Commercial Terms of Service (https://www.anthropic.com/legal/commercial-terms).

// Version: 1.0.41

// src/entrypoints/sdk.ts
import { spawn } from "child_process";
import { join } from "path";
import { fileURLToPath } from "url";
import { createInterface } from "readline";
import { existsSync } from "fs";
var __filename2 = fileURLToPath(import.meta.url);
var __dirname2 = join(__filename2, "..");
async function* query({
  prompt,
  options: {
    abortController = new AbortController,
    allowedTools = [],
    appendSystemPrompt,
    customSystemPrompt,
    cwd,
    disallowedTools = [],
    executable = isRunningWithBun() ? "bun" : "node",
    executableArgs = [],
    maxTurns,
    mcpServers,
    pathToClaudeCodeExecutable = join(__dirname2, "cli.js"),
    permissionMode = "default",
    permissionPromptToolName,
    continue: continueConversation,
    resume,
    model,
    fallbackModel
  } = {}
}) {
  if (!process.env.CLAUDE_CODE_ENTRYPOINT) {
    process.env.CLAUDE_CODE_ENTRYPOINT = "sdk-ts";
  }
  const args = ["--output-format", "stream-json", "--verbose"];
  if (customSystemPrompt)
    args.push("--system-prompt", customSystemPrompt);
  if (appendSystemPrompt)
    args.push("--append-system-prompt", appendSystemPrompt);
  if (maxTurns)
    args.push("--max-turns", maxTurns.toString());
  if (model)
    args.push("--model", model);
  if (permissionPromptToolName)
    args.push("--permission-prompt-tool", permissionPromptToolName);
  if (continueConversation)
    args.push("--continue");
  if (resume)
    args.push("--resume", resume);
  if (allowedTools.length > 0) {
    args.push("--allowedTools", allowedTools.join(","));
  }
  if (disallowedTools.length > 0) {
    args.push("--disallowedTools", disallowedTools.join(","));
  }
  if (mcpServers && Object.keys(mcpServers).length > 0) {
    args.push("--mcp-config", JSON.stringify({ mcpServers }));
  }
  if (permissionMode !== "default") {
    args.push("--permission-mode", permissionMode);
  }
  if (fallbackModel) {
    if (model && fallbackModel === model) {
      throw new Error("Fallback model cannot be the same as the main model. Please specify a different model for fallbackModel option.");
    }
    args.push("--fallback-model", fallbackModel);
  }
  if (typeof prompt === "string") {
    args.push("--print", prompt.trim());
  } else {
    args.push("--input-format", "stream-json");
  }
  if (!existsSync(pathToClaudeCodeExecutable)) {
    throw new ReferenceError(`Claude Code executable not found at ${pathToClaudeCodeExecutable}. Is options.pathToClaudeCodeExecutable set?`);
  }
  logDebug(`Spawning Claude Code process: ${executable} ${[...executableArgs, pathToClaudeCodeExecutable, ...args].join(" ")}`);
  const child = spawn(executable, [...executableArgs, pathToClaudeCodeExecutable, ...args], {
    cwd,
    stdio: ["pipe", "pipe", "pipe"],
    signal: abortController.signal,
    env: {
      ...process.env
    }
  });
  if (typeof prompt === "string") {
    child.stdin.end();
  } else {
    streamToStdin(prompt, child.stdin, abortController);
  }
  if (process.env.DEBUG) {
    child.stderr.on("data", (data) => {
      console.error("Claude Code stderr:", data.toString());
    });
  }
  const cleanup = () => {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  };
  abortController.signal.addEventListener("abort", cleanup);
  process.on("exit", cleanup);
  try {
    let processError = null;
    child.on("error", (error) => {
      processError = new Error(`Failed to spawn Claude Code process: ${error.message}`);
    });
    const processExitPromise = new Promise((resolve, reject) => {
      child.on("close", (code) => {
        if (abortController.signal.aborted) {
          reject(new AbortError("Claude Code process aborted by user"));
        }
        if (code !== 0) {
          reject(new Error(`Claude Code process exited with code ${code}`));
        } else {
          resolve();
        }
      });
    });
    const rl = createInterface({ input: child.stdout });
    try {
      for await (const line of rl) {
        if (processError) {
          throw processError;
        }
        if (line.trim()) {
          yield JSON.parse(line);
        }
      }
    } finally {
      rl.close();
    }
    await processExitPromise;
  } finally {
    cleanup();
    abortController.signal.removeEventListener("abort", cleanup);
    if (process.env.CLAUDE_SDK_MCP_SERVERS) {
      delete process.env.CLAUDE_SDK_MCP_SERVERS;
    }
  }
}
async function streamToStdin(stream, stdin, abortController) {
  for await (const message of stream) {
    if (abortController.signal.aborted)
      break;
    stdin.write(JSON.stringify(message) + `
`);
  }
  stdin.end();
}
function logDebug(message) {
  if (process.env.DEBUG) {
    console.debug(message);
  }
}
function isRunningWithBun() {
  return process.versions.bun !== undefined || process.env.BUN_INSTALL !== undefined;
}

class AbortError extends Error {
}
export {
  query,
  AbortError
};
