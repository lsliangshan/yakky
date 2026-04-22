#!/usr/bin/env node

import { Command } from "commander";
import { hello } from "./commands/hello.js";
import { init } from "./commands/init.js";
import { logger } from "./utils/logger.js";
import { version } from "../package.json";
import { getRandomSentence } from "./utils/random.js";
import chalk from "chalk";
import { create } from "./commands/create.js";

const program = new Command();

program
  .name("yakky")
  .description(chalk.hex("#FFA500")(getRandomSentence()))
  .version(version, "-v, --version", "显示版本号");

program.name("yakky").helpOption("-h, --help", "显示帮助信息");

program
  .command("hello [name]")
  .description("Say hello to someone")
  .option("-g, --greeting <text>", "Custom greeting message", "Hello")
  .action((name, options) => {
    hello(name, options);
  });

program
  .command("init")
  .description("Initialize a new project interactively")
  .action(async () => {
    try {
      await init();
    } catch (error) {
      logger.error(`Initialization failed: ${error}`);
      process.exit(1);
    }
  });

program
  .command("create")
  .description("通过模板创建内容")
  .option("-t, --template <template>", "选择模板", "")

  .action(async (args) => {
    try {
      await create(args as any);
    } catch (error) {
      logger.error(`创建失败: ${error}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
