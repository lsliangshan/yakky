#!/usr/bin/env node

import { Command } from "commander";
import { version } from "../package.json";
import {
  ShortcutCommandExistsError,
  addCommand,
} from "./commands/add-command/index.js";
import { tryInitializeDatabase } from "./db/index.js";
import { dataPaths } from "./utils/paths.js";
import { logger } from "./utils/logger.js";

dataPaths.ensure();

const program = new Command();

program
  .name("添加命令")
  .description("创建快捷命令")
  .version(version, "-v, --version", "显示版本号")
  .helpOption("-h, --help", "显示帮助信息")
  .option("-n, --name <name>", "快捷命令名称")
  .option("-d, --description <description>", "快捷命令描述")
  .option("-w, --workspace <path>", "快捷命令生效的工作区系统路径；留空表示全系统生效")
  .option("-f, --file <path>", "包含 bash 脚本内容的系统路径")
  .action(async (args) => {
    await addCommand(args);
  });

async function main() {
  try {
    await tryInitializeDatabase();
    await program.parseAsync(process.argv);
  } catch (error) {
    if (error instanceof ShortcutCommandExistsError) {
      logger.error("添加命令失败");
      logger.highlight("  原因: 快捷命令已经存在");
      logger.highlight(`  已存在工作区: ${error.workspacePath ?? "全系统"}`);
    } else {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("添加命令失败");
      logger.highlight(`  原因: ${message}`);
    }
    process.exit(1);
  }
}

main();
