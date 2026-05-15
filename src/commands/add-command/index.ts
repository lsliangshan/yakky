import { eq } from "drizzle-orm";
import Enquirer from "enquirer";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { db } from "../../db/index.js";
import { shortcutCommands } from "../../db/schema.js";
import { logger } from "../../utils/logger.js";
import { dataPath } from "../../utils/paths.js";
import type { AddCommandArgs } from "./types.js";

type WorkspaceChoice = "global" | "cwd" | "manual";

const shortcutCommandNamePattern =
  /^[\p{Script=Han}A-Za-z][\p{Script=Han}A-Za-z0-9_-]*$/u;
const shortcutCommandNameRuleMessage =
  "快捷命令名称只能包括中文、字母、数字、-、_，且只能以中文或字母开头";

export class ShortcutCommandExistsError extends Error {
  constructor(public readonly workspacePath: string | null) {
    super("快捷命令已经存在");
    this.name = "ShortcutCommandExistsError";
  }
}

export function validateShortcutCommandName(name: string): string | true {
  if (!name) {
    return "快捷命令名称不能为空";
  }

  if (!shortcutCommandNamePattern.test(name)) {
    return shortcutCommandNameRuleMessage;
  }

  return true;
}

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

function assertReadableFile(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    throw new Error(`脚本文件不存在: ${filePath}`);
  }

  if (!fs.statSync(filePath).isFile()) {
    throw new Error(`脚本路径不是文件: ${filePath}`);
  }
}

export function isShortcutCommandScopeConflict(
  existingWorkspacePath: string | null,
  requestedWorkspacePath: string | null,
): boolean {
  return (
    existingWorkspacePath === null ||
    requestedWorkspacePath === null ||
    existingWorkspacePath === requestedWorkspacePath
  );
}

function quoteShellArg(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export function getLastEmptyLineNumber(content: string): number {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  if (lines.length > 1 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index].trim() === "") {
      return index + 1;
    }
  }

  return lines.length;
}

function getEditorName(editor: string): string {
  const commandMatch = editor.trim().match(/^"([^"]+)"|^'([^']+)'|^(\S+)/);
  const command =
    commandMatch?.[1] ?? commandMatch?.[2] ?? commandMatch?.[3] ?? editor;

  return path.basename(command).replace(/\.exe$/i, "").toLowerCase();
}

export function buildEditorCommand(
  editor: string,
  filePath: string,
  lineNumber: number,
): string {
  const quotedFilePath = quoteShellArg(filePath);
  const editorName = getEditorName(editor);

  if (["vi", "vim", "nvim", "view", "gvim", "mvim"].includes(editorName)) {
    return `${editor} +${lineNumber} ${quotedFilePath}`;
  }

  if (["nano", "pico"].includes(editorName)) {
    return `${editor} +${lineNumber},1 ${quotedFilePath}`;
  }

  if (["emacs", "emacsclient"].includes(editorName)) {
    return `${editor} +${lineNumber}:1 ${quotedFilePath}`;
  }

  if (
    ["code", "code-insiders", "codium", "cursor", "windsurf"].includes(
      editorName,
    )
  ) {
    return `${editor} --goto ${quoteShellArg(`${filePath}:${lineNumber}:1`)}`;
  }

  if (["subl", "zed"].includes(editorName)) {
    return `${editor} ${quoteShellArg(`${filePath}:${lineNumber}:1`)}`;
  }

  return `${editor} ${quotedFilePath}`;
}

function persistEditedScript(script: string): string {
  const scriptPath = dataPath("data", `${randomUUID()}.sh`);
  fs.writeFileSync(scriptPath, script, "utf-8");
  fs.chmodSync(scriptPath, 0o700);
  return scriptPath;
}

function readScriptFromEditor(): {
  script: string;
  scriptPath: string;
} {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("当前终端无法打开编辑器，请使用 -f/--file 指定 bash 脚本文件");
  }

  const editor = process.env.VISUAL || process.env.EDITOR || "vi";
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "yakky-add-command-"));
  const tempFile = path.join(tempDir, "script.sh");
  const initialScript = "#!/usr/bin/env bash\n\n";

  fs.writeFileSync(tempFile, initialScript, "utf-8");
  logger.info(`正在使用 ${editor} 编辑快捷命令脚本...`);

  try {
    const result = spawnSync(
      buildEditorCommand(
        editor,
        tempFile,
        getLastEmptyLineNumber(initialScript),
      ),
      {
        shell: true,
        stdio: "inherit",
      },
    );

    if (result.error) {
      throw result.error;
    }

    if (result.status !== 0) {
      throw new Error(`编辑器退出失败，状态码: ${result.status}`);
    }

    const script = fs.readFileSync(tempFile, "utf-8");
    if (!script.trim()) {
      throw new Error("执行脚本不能为空");
    }

    const scriptPath = persistEditedScript(script);
    return { script: script.trim(), scriptPath };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function askName(name?: string): Promise<string> {
  if (name !== undefined) {
    const valid = validateShortcutCommandName(name);
    if (valid !== true) {
      throw new Error(valid);
    }

    return name;
  }

  const answer = await Enquirer.prompt<{ name: string }>({
    type: "input",
    name: "name",
    message: "请输入快捷命令名称",
    validate: validateShortcutCommandName,
  });

  return answer.name;
}

async function askWorkspace(workspace?: string): Promise<string | null> {
  if (workspace !== undefined) {
    const cleaned = workspace.trim();
    if (!cleaned) return null;

    const resolved = resolveDirectory(cleaned);
    assertDirectory(resolved);
    return resolved;
  }

  const answer = await Enquirer.prompt<{ workspaceChoice: WorkspaceChoice }>({
    type: "select",
    name: "workspaceChoice",
    message: "请选择快捷命令生效范围",
    choices: [
      { name: "global", message: "全系统生效（不指定工作区路径）" },
      { name: "cwd", message: `当前工作区：${process.cwd()}` },
      { name: "manual", message: "手动输入工作区路径" },
    ],
  });

  if (answer.workspaceChoice === "global") return null;
  if (answer.workspaceChoice === "cwd") return process.cwd();

  const manual = await Enquirer.prompt<{ workspacePath: string }>({
    type: "input",
    name: "workspacePath",
    message: "请输入工作区系统路径（留空表示全系统生效）",
    validate: (value: string) => {
      const cleaned = value.trim();
      if (!cleaned) return true;

      const resolved = resolveDirectory(cleaned);
      if (!fs.existsSync(resolved)) return `路径不存在: ${resolved}`;
      if (!fs.statSync(resolved).isDirectory()) return `路径不是目录: ${resolved}`;
      return true;
    },
  });

  const cleaned = manual.workspacePath.trim();
  if (!cleaned) return null;

  return resolveDirectory(cleaned);
}

async function askDescription(description?: string): Promise<string | null> {
  if (description !== undefined) {
    const cleaned = description.trim();
    return cleaned || null;
  }

  const answer = await Enquirer.prompt<{ description: string }>({
    type: "input",
    name: "description",
    message: "请输入命令描述（可选）",
  });

  const cleaned = answer.description.trim();
  return cleaned || null;
}

async function askScript(file?: string): Promise<{
  script: string;
  scriptPath: string | null;
}> {
  if (file) {
    const scriptPath = path.resolve(file);
    assertReadableFile(scriptPath);
    const script = fs.readFileSync(scriptPath, "utf-8").trim();
    if (!script) {
      throw new Error(`脚本文件内容不能为空: ${scriptPath}`);
    }
    return { script, scriptPath };
  }

  return readScriptFromEditor();
}

async function ensureCommandDoesNotExist(
  name: string,
  workspacePath: string | null,
): Promise<void> {
  const existing = await db
    .select({ workspacePath: shortcutCommands.workspacePath })
    .from(shortcutCommands)
    .where(eq(shortcutCommands.name, name));

  const conflict = existing.find((command) =>
    isShortcutCommandScopeConflict(command.workspacePath, workspacePath),
  );

  if (conflict) {
    throw new ShortcutCommandExistsError(conflict.workspacePath);
  }
}

export async function addCommand(args?: AddCommandArgs) {
  const name = await askName(args?.name);
  const workspacePath = await askWorkspace(args?.workspace);
  await ensureCommandDoesNotExist(name, workspacePath);

  const description = await askDescription(args?.description);
  const { script, scriptPath } = await askScript(args?.file);

  const [created] = await db
    .insert(shortcutCommands)
    .values({
      name,
      description,
      workspacePath,
      script,
      scriptPath,
    })
    .returning();

  logger.success(`快捷命令已创建: ${created.name}`);
  logger.highlight(`  ID: ${created.id}`);
  logger.highlight(
    `  生效范围: ${created.workspacePath ?? "全系统"}`,
  );
  if (created.description) {
    logger.highlight(`  描述: ${created.description}`);
  }
  if (created.scriptPath) {
    logger.highlight(`  脚本来源: ${created.scriptPath}`);
  }

  return created;
}
