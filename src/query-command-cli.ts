#!/usr/bin/env node

import { Command } from "commander";
import { version } from "../package.json";
import { queryCommand } from "./commands/query-command/index.js";
import { tryInitializeDatabase } from "./db/index.js";
import { dataPaths } from "./utils/paths.js";
import { logger } from "./utils/logger.js";

dataPaths.ensure();

const program = new Command();

program
  .name("查询命令")
  .description("查询快捷命令")
  .version(version, "-v, --version", "显示版本号")
  .helpOption("-h, --help", "显示帮助信息")
  .option("-w, --workspace <path>", "查询指定工作区内生效的快捷命令；留空表示查询全部")
  .action(async (args) => {
    await queryCommand(args);
  });

async function main() {
  try {
    await tryInitializeDatabase();
    await program.parseAsync(process.argv);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("查询命令失败");
    logger.highlight(`  原因: ${message}`);
    process.exit(1);
  }
}

main();
