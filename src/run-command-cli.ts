#!/usr/bin/env node

import { Command } from "commander";
import { version } from "../package.json";
import { runCommand } from "./commands/run-command/index.js";
import { tryInitializeDatabase } from "./db/index.js";
import { dataPaths } from "./utils/paths.js";
import { logger } from "./utils/logger.js";

dataPaths.ensure();

const program = new Command();

program
  .name("run")
  .alias("运行命令")
  .description("运行当前工作区可用的快捷命令")
  .version(version, "-v, --version", "显示版本号")
  .helpOption("-h, --help", "显示帮助信息")
  .argument("[name]", "快捷命令名称")
  .action(async (name) => {
    await runCommand({ name });
  });

async function main() {
  try {
    await tryInitializeDatabase();
    await program.parseAsync(process.argv);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("运行命令失败");
    logger.highlight(`  原因: ${message}`);
    process.exit(1);
  }
}

main();
