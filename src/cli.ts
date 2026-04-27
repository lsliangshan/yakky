#!/usr/bin/env node

import { Command } from "commander";
import { logger } from "./utils/logger.js";
import { version } from "../package.json";
import { getRandomSentence } from "./utils/random.js";
import chalk from "chalk";
import { create } from "./commands/create.js";
import { dataPaths } from "./utils/paths.js";
import { initializeDatabase } from "./db/index.js";
import { mount as mountRepositry } from "./libs/repositry.js";
import { mount as mountTemplate } from "./libs/template.js";

dataPaths.ensure();

const program = new Command();

program
  .name("yakky")
  .description(chalk.hex("#FFA500")(getRandomSentence()))
  .version(version, "-v, --version", "显示版本号");

program.name("yakky").helpOption("-h, --help", "显示帮助信息");

mountRepositry(program);
mountTemplate(program);

// program
//   .command("hello [name]")
//   .description("Say hello to someone")
//   .option("-g, --greeting <text>", "Custom greeting message", "Hello")
//   .action((name, options) => {
//     hello(name, options);
//   });

// program
//   .command("init")
//   .description("Initialize a new project interactively")
//   .action(async () => {
//     try {
//       await init();
//     } catch (error) {
//       logger.error(`Initialization failed: ${error}`);
//       process.exit(1);
//     }
//   });

program
  .command("create")
  .description("通过模板创建内容")
  .option("-p, --provider <provider>", "选择提供者", "")

  .action(async (args) => {
    try {
      await create(args as any);
    } catch (error) {
      logger.error(`创建失败: ${error}`);
      process.exit(1);
    }
  });

// 主异步函数
async function main() {
  try {
    // 初始化数据库
    await initializeDatabase();

    // 解析命令行参数
    await program.parseAsync(process.argv);
  } catch (error) {
    logger.error(`程序执行失败: ${error}`);
    process.exit(1);
  }
}

main();
