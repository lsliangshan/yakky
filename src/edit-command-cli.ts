#!/usr/bin/env node

import { Command } from "commander";
import { version } from "../package.json";
import { ShortcutCommandExistsError } from "./commands/add-command/index.js";
import { editCommand } from "./commands/edit-command/index.js";
import { tryInitializeDatabase } from "./db/index.js";
import { dataPaths } from "./utils/paths.js";
import { logger } from "./utils/logger.js";

dataPaths.ensure();

const program = new Command();

program
  .name("edit")
  .alias("修改命令")
  .description("修改快捷命令")
  .version(version, "-v, --version", "显示版本号")
  .helpOption("-h, --help", "显示帮助信息")
  .argument("[name]", "快捷命令名称")
  .action(async (name) => {
    await editCommand({ name });
  });

async function main() {
  try {
    await tryInitializeDatabase();
    await program.parseAsync(process.argv);
  } catch (error) {
    if (error instanceof ShortcutCommandExistsError) {
      logger.error("修改命令失败");
      logger.highlight("  原因: 快捷命令已经存在");
      logger.highlight(`  已存在工作区: ${error.workspacePath ?? "全系统"}`);
    } else {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("修改命令失败");
      logger.highlight(`  原因: ${message}`);
    }
    process.exit(1);
  }
}

main();
