import Enquirer from "enquirer";
import { asc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { shortcutCommands } from "../../db/schema.js";
import { logger } from "../../utils/logger.js";
import { formatCommandWorkspaceScope } from "../query-command/index.js";
import type { DeleteCommandArgs } from "./types.js";

type ShortcutCommandRow = typeof shortcutCommands.$inferSelect;

export function formatCommandManageChoice(command: ShortcutCommandRow): string {
  const description = command.description?.trim() || "无描述";
  return `${command.name} - ${description} - ${formatCommandWorkspaceScope(command.workspacePath)}`;
}

export function findCommandsByName(
  commands: ShortcutCommandRow[],
  name: string,
): ShortcutCommandRow[] {
  return commands.filter((command) => command.name === name);
}

export function formatSelectedCommand(command: ShortcutCommandRow): string[] {
  return [
    `  快捷命令: ${command.name}`,
    `  工作区路径: ${formatCommandWorkspaceScope(command.workspacePath)}`,
  ];
}

function printSelectedCommand(command: ShortcutCommandRow): void {
  for (const line of formatSelectedCommand(command)) {
    logger.highlight(line);
  }
}

async function getAllCommands(): Promise<ShortcutCommandRow[]> {
  return db
    .select()
    .from(shortcutCommands)
    .orderBy(asc(shortcutCommands.name), asc(shortcutCommands.workspacePath));
}

async function askCommandToDelete(
  commands: ShortcutCommandRow[],
): Promise<ShortcutCommandRow> {
  const answer = await Enquirer.prompt<{ commandId: string }>({
    type: "select",
    name: "commandId",
    message: "请选择要删除的快捷命令",
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

async function resolveCommandByName(
  commands: ShortcutCommandRow[],
  name: string,
): Promise<ShortcutCommandRow | null> {
  const matched = findCommandsByName(commands, name);
  if (matched.length === 0) return null;
  if (matched.length === 1) return matched[0];

  return askCommandToDelete(matched);
}

export async function deleteCommand(args?: DeleteCommandArgs) {
  const commands = await getAllCommands();
  const requestedName = args?.name?.trim();

  logger.highlight("可删除快捷命令");
  logger.muted(`  快捷命令数量: ${commands.length}`);

  if (requestedName) {
    const selected = await resolveCommandByName(commands, requestedName);
    if (!selected) {
      logger.info(`不存在快捷命令“${requestedName}”`);
      return null;
    }

    printSelectedCommand(selected);
    await db.delete(shortcutCommands).where(eq(shortcutCommands.id, selected.id));

    logger.success(`快捷命令已删除: ${selected.name}`);
    logger.highlight(`  ID: ${selected.id}`);
    logger.highlight(
      `  生效范围: ${selected.workspacePath ?? "全系统"}`,
    );

    return selected;
  }

  if (commands.length === 0) {
    logger.info("还没有快捷命令");
    return null;
  }

  const selected = await askCommandToDelete(commands);
  printSelectedCommand(selected);
  await db.delete(shortcutCommands).where(eq(shortcutCommands.id, selected.id));

  logger.success(`快捷命令已删除: ${selected.name}`);
  logger.highlight(`  ID: ${selected.id}`);
  logger.highlight(
    `  生效范围: ${selected.workspacePath ?? "全系统"}`,
  );

  return selected;
}
