import Enquirer from "enquirer";
import { asc } from "drizzle-orm";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { db } from "../../db/index.js";
import { shortcutCommands } from "../../db/schema.js";
import { logger } from "../../utils/logger.js";
import { isWorkspaceCommandEffective } from "../query-command/index.js";
import type { RunCommandArgs } from "./types.js";
import chalk from "chalk";

type ShortcutCommandRow = typeof shortcutCommands.$inferSelect;
type CommandOutputStream = "stdout" | "stderr";

type CommandOutputState = {
  pending: string;
};

function resolveDirectory(input: string): string {
  return path.resolve(input.trim());
}

function assertDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    throw new Error(`工作区路径不存在: ${dirPath}`);
  }

  if (!fs.statSync(dirPath).isDirectory()) {
    throw new Error(`工作区路径不是目录: ${dirPath}`);
  }
}

function resolveWorkspace(workspace?: string): string {
  if (workspace === undefined) return process.cwd();

  const cleaned = workspace.trim();
  if (!cleaned) return process.cwd();

  const resolved = resolveDirectory(cleaned);
  assertDirectory(resolved);
  return resolved;
}

export function getAvailableCommandsForWorkspace(
  commands: ShortcutCommandRow[],
  workspacePath: string,
): ShortcutCommandRow[] {
  return commands.filter((command) =>
    isWorkspaceCommandEffective(command.workspacePath, workspacePath),
  );
}

export function formatRunCommandChoice(command: ShortcutCommandRow): string {
  const description = command.description?.trim() || "无描述";
  return `${command.name} - ${description}`;
}

export function formatCommandOutputLine(
  line: string,
  stream: CommandOutputStream,
): string {
  // const label = stream === "stderr" ? "err" : "out";
  const label = "";
  const lineStyle = stream === "stderr" ? chalk.yellow : chalk.white;
  return `${chalk.cyan(`  │ ${label} `)}${lineStyle(line)}`;
}

async function getAvailableCommands(
  workspacePath: string,
): Promise<ShortcutCommandRow[]> {
  const commands = await db
    .select()
    .from(shortcutCommands)
    .orderBy(asc(shortcutCommands.name), asc(shortcutCommands.workspacePath));

  return getAvailableCommandsForWorkspace(commands, workspacePath);
}

async function askCommandToRun(
  commands: ShortcutCommandRow[],
): Promise<ShortcutCommandRow> {
  const answer = await Enquirer.prompt<{ commandId: string }>({
    type: "select",
    name: "commandId",
    message: "请选择要运行的快捷命令",
    choices: commands.map((command) => ({
      name: String(command.id),
      message: formatRunCommandChoice(command),
    })),
  });

  const selected = commands.find(
    (command) => String(command.id) === answer.commandId,
  );
  if (!selected) {
    throw new Error("未找到选择的快捷命令");
  }

  return selected;
}

function writeCommandOutputChunk(
  chunk: Buffer,
  stream: CommandOutputStream,
  state: CommandOutputState,
): void {
  const content = state.pending + chunk.toString("utf-8");
  const lines = content.split(/\r?\n/);
  state.pending = lines.pop() ?? "";

  for (const line of lines) {
    const output = formatCommandOutputLine(line, stream);
    if (stream === "stderr") {
      console.error(output);
    } else {
      console.log(output);
    }
  }
}

function flushCommandOutput(
  stream: CommandOutputStream,
  state: CommandOutputState,
): void {
  if (!state.pending) return;

  const output = formatCommandOutputLine(state.pending, stream);
  if (stream === "stderr") {
    console.error(output);
  } else {
    console.log(output);
  }
  state.pending = "";
}

async function runShortcutCommand(
  command: ShortcutCommandRow,
  cwd: string,
): Promise<void> {
  logger.log("\n");
  logger.info(`正在运行快捷命令: ${command.name}`);
  logger.log(chalk.cyan(`\n  ╭─ 脚本输出：${command.name}`));
  logger.log(chalk.cyan(`  │ `));

  const stdoutState: CommandOutputState = { pending: "" };
  const stderrState: CommandOutputState = { pending: "" };
  const child = spawn("bash", ["-c", command.script], {
    cwd,
    env: process.env,
    stdio: ["inherit", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk: Buffer) => {
    writeCommandOutputChunk(chunk, "stdout", stdoutState);
  });

  child.stderr.on("data", (chunk: Buffer) => {
    writeCommandOutputChunk(chunk, "stderr", stderrState);
  });

  const result = await new Promise<{
    status: number | null;
    signal: NodeJS.Signals | null;
  }>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (status, signal) => {
      resolve({ status, signal });
    });
  }).finally(() => {
    flushCommandOutput("stdout", stdoutState);
    flushCommandOutput("stderr", stderrState);
    logger.log(chalk.cyan("  │ "));
    logger.log(chalk.cyan("  ╰─ 输出结束\n"));
  });

  if (result.signal) {
    throw new Error(`快捷命令被信号终止: ${result.signal}`);
  }

  if (result.status !== 0) {
    throw new Error(`快捷命令执行失败，状态码: ${result.status}`);
  }
}

export async function runCommand(args?: RunCommandArgs) {
  const workspacePath = resolveWorkspace(args?.workspace);
  const commands = await getAvailableCommands(workspacePath);

  logger.muted(
    `\n  当前工作区可用快捷命令: ${chalk.green(commands.length)} 个`,
  );
  logger.muted(`  工作区: ${workspacePath}\n`);

  if (commands.length === 0) {
    logger.info("当前工作区无可用快捷命令");
    return null;
  }

  // for (const command of commands) {
  //   logger.log(`  ${formatRunCommandChoice(command)}`);
  // }

  const selected = await askCommandToRun(commands);
  await runShortcutCommand(selected, workspacePath);
  return selected;
}
