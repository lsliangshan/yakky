import Enquirer from "enquirer";
import { asc, eq } from "drizzle-orm";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { db } from "../../db/index.js";
import { shortcutCommands } from "../../db/schema.js";
import { logger } from "../../utils/logger.js";
import {
  buildEditorCommand,
  getLastEmptyLineNumber,
  isShortcutCommandScopeConflict,
  normalizeCommandDescription,
  persistEditedScript,
  ShortcutCommandExistsError,
  validateShortcutCommandName,
} from "../add-command/index.js";
import {
  findCommandsByName,
  formatCommandManageChoice,
  formatSelectedCommand,
} from "../delete-command/index.js";
import type { EditCommandArgs } from "./types.js";

type ShortcutCommandRow = typeof shortcutCommands.$inferSelect;

function resolveDirectory(input: string): string {
  return path.resolve(input.trim());
}

async function getAllCommands(): Promise<ShortcutCommandRow[]> {
  return db
    .select()
    .from(shortcutCommands)
    .orderBy(asc(shortcutCommands.name), asc(shortcutCommands.workspacePath));
}

async function askCommandToEdit(
  commands: ShortcutCommandRow[],
): Promise<ShortcutCommandRow> {
  const answer = await Enquirer.prompt<{ commandId: string }>({
    type: "select",
    name: "commandId",
    message: "请选择要修改的快捷命令",
    choices: commands.map((command) => ({
      name: String(command.id),
      message: formatCommandManageChoice(command),
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

function printSelectedCommand(command: ShortcutCommandRow): void {
  for (const line of formatSelectedCommand(command)) {
    logger.highlight(line);
  }
}

async function resolveCommandByName(
  commands: ShortcutCommandRow[],
  name: string,
): Promise<ShortcutCommandRow | null> {
  const matched = findCommandsByName(commands, name);
  if (matched.length === 0) return null;
  if (matched.length === 1) return matched[0];

  return askCommandToEdit(matched);
}

async function askCommandName(defaultName: string): Promise<string> {
  const answer = await Enquirer.prompt<{ name: string }>({
    type: "input",
    name: "name",
    message: "请输入快捷命令名称",
    initial: defaultName,
    validate: validateShortcutCommandName,
  });

  return answer.name;
}

async function askWorkspacePath(
  defaultWorkspacePath: string | null,
): Promise<string | null> {
  const answer = await Enquirer.prompt<{ workspacePath: string }>({
    type: "input",
    name: "workspacePath",
    message: "请输入工作区系统路径（留空表示全系统生效）",
    initial: defaultWorkspacePath ?? "",
    validate: (value: string) => {
      const cleaned = value.trim();
      if (!cleaned) return true;

      const resolved = resolveDirectory(cleaned);
      if (!fs.existsSync(resolved)) return `路径不存在: ${resolved}`;
      if (!fs.statSync(resolved).isDirectory()) return `路径不是目录: ${resolved}`;
      return true;
    },
  });

  const cleaned = answer.workspacePath.trim();
  if (!cleaned) return null;

  return resolveDirectory(cleaned);
}

async function askDescription(
  defaultDescription: string | null,
): Promise<string | null> {
  const answer = await Enquirer.prompt<{ description: string }>({
    type: "input",
    name: "description",
    message: "请输入命令描述（可选）",
    initial: defaultDescription ?? "",
  });

  return normalizeCommandDescription(answer.description);
}

function ensureTrailingLineBreak(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
}

function readScriptFromEditor(initialScript: string): string {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("当前终端无法打开编辑器修改 bash 脚本");
  }

  const editor = process.env.VISUAL || process.env.EDITOR || "vi";
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "yakky-edit-command-"));
  const tempFile = path.join(tempDir, "script.sh");
  const editableScript = ensureTrailingLineBreak(initialScript);

  fs.writeFileSync(tempFile, editableScript, "utf-8");
  logger.info(`正在使用 ${editor} 编辑快捷命令脚本...`);

  try {
    const result = spawnSync(
      buildEditorCommand(
        editor,
        tempFile,
        getLastEmptyLineNumber(editableScript),
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

    const script = fs.readFileSync(tempFile, "utf-8").trim();
    if (!script) {
      throw new Error("执行脚本不能为空");
    }

    return script;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

export function isEditCommandScopeConflict(
  existing: Pick<ShortcutCommandRow, "id" | "workspacePath">,
  requestedId: number,
  requestedWorkspacePath: string | null,
): boolean {
  return (
    existing.id !== requestedId &&
    isShortcutCommandScopeConflict(
      existing.workspacePath,
      requestedWorkspacePath,
    )
  );
}

async function ensureEditableCommandDoesNotExist(
  id: number,
  name: string,
  workspacePath: string | null,
): Promise<void> {
  const existing = await db
    .select({ id: shortcutCommands.id, workspacePath: shortcutCommands.workspacePath })
    .from(shortcutCommands)
    .where(eq(shortcutCommands.name, name));

  const conflict = existing.find((command) =>
    isEditCommandScopeConflict(command, id, workspacePath),
  );

  if (conflict) {
    throw new ShortcutCommandExistsError(conflict.workspacePath);
  }
}

export async function editCommand(args?: EditCommandArgs) {
  const commands = await getAllCommands();
  const requestedName = args?.name?.trim();

  logger.highlight("可修改快捷命令");
  logger.muted(`  快捷命令数量: ${commands.length}`);

  if (requestedName) {
    const selected = await resolveCommandByName(commands, requestedName);
    if (!selected) {
      logger.info(`不存在快捷命令“${requestedName}”`);
      return null;
    }

    printSelectedCommand(selected);
    return editSelectedCommand(selected);
  }

  if (commands.length === 0) {
    logger.info("还没有快捷命令");
    return null;
  }

  const selected = await askCommandToEdit(commands);
  printSelectedCommand(selected);
  return editSelectedCommand(selected);
}

async function editSelectedCommand(selected: ShortcutCommandRow) {
  const name = await askCommandName(selected.name);
  const workspacePath = await askWorkspacePath(selected.workspacePath);
  const description = await askDescription(selected.description);
  const script = readScriptFromEditor(selected.script);

  await ensureEditableCommandDoesNotExist(selected.id, name, workspacePath);

  const scriptPath = persistEditedScript(script);
  const [updated] = await db
    .update(shortcutCommands)
    .set({
      name,
      description,
      workspacePath,
      script,
      scriptPath,
      updatedAt: new Date(),
    })
    .where(eq(shortcutCommands.id, selected.id))
    .returning();

  logger.success(`快捷命令已修改: ${updated.name}`);
  logger.highlight(`  ID: ${updated.id}`);
  logger.highlight(`  生效范围: ${updated.workspacePath ?? "全系统"}`);
  if (updated.description) {
    logger.highlight(`  描述: ${updated.description}`);
  }
  if (updated.scriptPath) {
    logger.highlight(`  脚本来源: ${updated.scriptPath}`);
  }

  return updated;
}
