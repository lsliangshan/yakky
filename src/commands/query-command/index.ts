import Enquirer from "enquirer";
import fs from "node:fs";
import path from "node:path";
import { asc } from "drizzle-orm";
import { db } from "../../db/index.js";
import { shortcutCommands } from "../../db/schema.js";
import { logger } from "../../utils/logger.js";
import type { QueryCommandArgs } from "./types.js";

type WorkspaceChoice = "all" | "cwd" | "manual";

type ShortcutCommandRow = typeof shortcutCommands.$inferSelect;

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

export function isWorkspaceCommandEffective(
  commandWorkspacePath: string | null,
  requestedWorkspacePath: string,
): boolean {
  if (commandWorkspacePath === null) return true;

  const commandPath = path.resolve(commandWorkspacePath.trim());
  const requestedPath = path.resolve(requestedWorkspacePath.trim());
  return commandPath === requestedPath;
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
    message: "请选择查询范围",
    choices: [
      { name: "all", message: "全部快捷命令" },
      { name: "cwd", message: `当前工作区内生效：${process.cwd()}` },
      { name: "manual", message: "手动输入工作区路径" },
    ],
  });

  if (answer.workspaceChoice === "all") return null;
  if (answer.workspaceChoice === "cwd") return process.cwd();

  const manual = await Enquirer.prompt<{ workspacePath: string }>({
    type: "input",
    name: "workspacePath",
    message: "请输入工作区系统路径（留空表示查询全部）",
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

async function getCommands(workspacePath: string | null): Promise<ShortcutCommandRow[]> {
  const commands = await db
    .select()
    .from(shortcutCommands)
    .orderBy(asc(shortcutCommands.name), asc(shortcutCommands.workspacePath));

  if (!workspacePath) return commands;

  return commands.filter((command) =>
    isWorkspaceCommandEffective(command.workspacePath, workspacePath),
  );
}

function formatDate(value: Date): string {
  return value.toLocaleString("zh-CN", { hour12: false });
}

function getScriptPreview(script: string): string[] {
  const lines = script.trim().split(/\r?\n/);
  const preview = lines.slice(0, 4);
  if (lines.length > preview.length) {
    preview.push(`... 还有 ${lines.length - preview.length} 行`);
  }
  return preview;
}

function getDisplayWidth(value: string): number {
  return Array.from(value).reduce((width, char) => {
    const code = char.codePointAt(0) ?? 0;
    const isWide =
      (code >= 0x1100 && code <= 0x115f) ||
      (code >= 0x2e80 && code <= 0xa4cf) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe10 && code <= 0xfe19) ||
      (code >= 0xfe30 && code <= 0xfe6f) ||
      (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6);

    return width + (isWide ? 2 : 1);
  }, 0);
}

function sliceByDisplayWidth(value: string, maxWidth: number): string {
  let result = "";
  let width = 0;

  for (const char of Array.from(value)) {
    const charWidth = getDisplayWidth(char);
    if (width + charWidth > maxWidth) break;
    result += char;
    width += charWidth;
  }

  return result;
}

function padDisplayEnd(value: string, width: number): string {
  return value + " ".repeat(Math.max(0, width - getDisplayWidth(value)));
}

export function truncateText(value: string, maxWidth: number): string {
  if (getDisplayWidth(value) <= maxWidth) return value;
  if (maxWidth <= 3) return ".".repeat(maxWidth);
  return `${sliceByDisplayWidth(value, maxWidth - 3)}...`;
}

export function wrapText(value: string, width: number): string[] {
  const normalized = value.trim();
  if (!normalized) return ["-"];

  const lines: string[] = [];

  for (const sourceLine of normalized.split(/\r?\n/)) {
    let remaining = sourceLine;
    while (getDisplayWidth(remaining) > width) {
      const line = sliceByDisplayWidth(remaining, width);
      lines.push(line);
      remaining = Array.from(remaining).slice(Array.from(line).length).join("");
    }
    lines.push(remaining || " ");
  }

  return lines;
}

export function formatCommandWorkspaceScope(workspacePath: string | null): string {
  return workspacePath ? `工作区: ${workspacePath}` : "全系统生效";
}

function logWrappedField(label: string, value: string, width = 72): void {
  const lines = wrapText(value, width);
  logger.log(`  ${label}: ${lines[0]}`);

  for (const line of lines.slice(1)) {
    logger.log(`  ${" ".repeat(label.length)}  ${line}`);
  }
}

function logWrappedMeta(label: string, value: string, width = 72): void {
  const lines = wrapText(value, width);
  logger.muted(`  ${label}: ${lines[0]}`);

  for (const line of lines.slice(1)) {
    logger.muted(`  ${" ".repeat(label.length)}  ${line}`);
  }
}

function printCommandDetail(command: ShortcutCommandRow): void {
  logger.highlight(command.name);
  logger.log(`  ID: ${command.id}`);
  logWrappedField("生效范围", formatCommandWorkspaceScope(command.workspacePath));
  logWrappedField("描述", command.description || "-");
  logWrappedField("脚本路径", command.scriptPath ?? "未记录");
  logger.log(`  创建时间: ${formatDate(command.createdAt)}`);
  logger.log("  脚本预览:");

  for (const line of getScriptPreview(command.script)) {
    logger.muted(`    ${line}`);
  }
}

function printCommandList(commands: ShortcutCommandRow[]): void {
  const columns = [
    { key: "index", title: "#", width: 4 },
    { key: "name", title: "名称", width: 18 },
    { key: "description", title: "描述", width: 28 },
    { key: "scope", title: "生效范围", width: 36 },
    { key: "scriptPath", title: "脚本路径", width: 42 },
    { key: "createdAt", title: "创建时间", width: 20 },
  ] as const;

  const rows = commands.map((command, index) => ({
    index: [String(index + 1)],
    name: [truncateText(command.name, 18)],
    description: wrapText(command.description ?? "", 28),
    scope: wrapText(formatCommandWorkspaceScope(command.workspacePath), 36),
    scriptPath: wrapText(command.scriptPath ?? "未记录", 42),
    createdAt: [truncateText(formatDate(command.createdAt), 20)],
  }));

  const columnWidths = columns.map((column) => column.width);

  const separator = columns
    .map((_column, index) => "-".repeat(columnWidths[index]))
    .join("-+-");
  const header = columns
    .map((column, index) => padDisplayEnd(column.title, columnWidths[index]))
    .join(" | ");

  logger.highlight(header);
  logger.muted(separator);

  for (const [rowIndex, row] of rows.entries()) {
    if (rowIndex > 0) {
      logger.muted(separator);
    }

    const rowHeight = Math.max(
      ...columns.map((column) => row[column.key].length),
    );

    for (let lineIndex = 0; lineIndex < rowHeight; lineIndex += 1) {
      logger.log(
        columns
          .map((column, columnIndex) =>
            padDisplayEnd(
              row[column.key][lineIndex] ?? "",
              columnWidths[columnIndex],
            ),
          )
          .join(" | "),
      );
    }
  }
}

function printCommands(commands: ShortcutCommandRow[], workspacePath: string | null): void {
  logger.highlight("快捷命令查询结果");
  logWrappedMeta("查询范围", workspacePath ?? "全部快捷命令");
  logger.muted(`  匹配数量: ${commands.length}`);

  if (commands.length === 0) {
    logger.info("没有找到符合条件的快捷命令");
    return;
  }

  logger.log("");
  if (commands.length === 1) {
    printCommandDetail(commands[0]);
    return;
  }

  printCommandList(commands);
}

export async function queryCommand(args?: QueryCommandArgs) {
  const workspacePath = await askWorkspace(args?.workspace);
  const commands = await getCommands(workspacePath);
  printCommands(commands, workspacePath);
  return commands;
}
