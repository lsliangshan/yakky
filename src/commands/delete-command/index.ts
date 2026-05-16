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

export async function deleteCommand(_args?: DeleteCommandArgs) {
  const commands = await getAllCommands();

  logger.highlight("可删除快捷命令");
  logger.muted(`  快捷命令数量: ${commands.length}`);

  if (commands.length === 0) {
    logger.info("还没有快捷命令");
    return null;
  }

  const selected = await askCommandToDelete(commands);
  await db.delete(shortcutCommands).where(eq(shortcutCommands.id, selected.id));

  logger.success(`快捷命令已删除: ${selected.name}`);
  logger.highlight(`  ID: ${selected.id}`);
  logger.highlight(
    `  生效范围: ${selected.workspacePath ?? "全系统"}`,
  );

  return selected;
}
