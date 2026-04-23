#!/usr/bin/env node

import { Command } from "commander";
import { logger } from "./utils/logger.js";
import { version } from "../package.json";
import { getRandomSentence } from "./utils/random.js";
import chalk from "chalk";
import { create } from "./commands/create.js";
import { dataPaths } from "./utils/paths.js";
import { template } from "./commands/template.js";
import { repositry } from "./commands/repositry/index.js";
import { repositryList } from "./commands/repositry/list.js";
import { repositryAdd } from "./commands/repositry/add.js";
import { initializeDatabase } from "./db/index.js";

dataPaths.ensure();

const program = new Command();

program
  .name("yakky")
  .description(chalk.hex("#FFA500")(getRandomSentence()))
  .version(version, "-v, --version", "显示版本号");

program.name("yakky").helpOption("-h, --help", "显示帮助信息");

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

const templateCmd = program
  .command("template")
  .description("管理模板")
  .option("-l, --list", "列出所有模板")
  .option("-a, --add <template>", "添加模板")
  .option("-d, --delete <template>", "删除模板")
  .option("-u, --update <template>", "更新模板")
  .option("-r, --rename <template>", "重命名模板")
  .option("-m, --move <template>", "移动模板")
  .option("-c, --copy <template>", "复制模板")
  .option("-t, --test <template>", "测试模板")
  .option("-e, --edit <template>", "编辑模板")
  .action(async (args) => {
    try {
      await template(args as any);
    } catch (error) {
      logger.error(`模板管理失败: ${error}`);
      process.exit(1);
    }
  });

const repositryCmd = program
  .command("repo")
  .alias("repositry")
  .description("管理模板仓库")
  .addHelpText("after", "\nUsage: yakky repositry <command>")
  .action(async () => {
    try {
      await repositry();
    } catch (error) {
      logger.error(`仓库操作失败: ${error}`);
      process.exit(1);
    }
  });

repositryCmd
  .command("list")
  .alias("ls")
  .description("列出本地所有仓库")
  .action(async () => {
    try {
      await repositryList();
    } catch (error) {
      logger.error(`仓库列表失败: ${error}`);
      process.exit(1);
    }
  });

repositryCmd
  .command("add")
  .description("添加仓库")
  .option("-n, --name [模板仓库名称]", "模板仓库名称")
  .option("-u, --url [模板仓库地址]", "模板仓库地址")
  .usage("-n [模板仓库名称] -u [模板仓库地址]")
  // .addHelpText(
  //   "before",
  //   "使用方式: yak repo add -n <模板仓库名称> -u <模板仓库地址>"
  // )
  .action(async (args) => {
    try {
      await repositryAdd(args);
    } catch (error) {
      logger.error(`仓库列表失败: ${error}`);
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
