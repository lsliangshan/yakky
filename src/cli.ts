#!/usr/bin/env node

import { Command } from "commander";
import { logger } from "./utils/logger.js";
import { version } from "../package.json";
import { getRandomSentence } from "./utils/random.js";
import chalk from "chalk";
import { dataPaths } from "./utils/paths.js";
import { tryInitializeDatabase } from "./db/index.js";
import { mount as mountRepositry } from "./libs/repositry.js";
import { mount as mountTemplate } from "./libs/template.js";
import { mount as mountCreate } from "./libs/create.js";
import { mount as mountSampleFile } from "./libs/sample-file.js";

dataPaths.ensure();

const program = new Command();

const siblingShortcutCommandHelp = [
  "",
  chalk.cyan("快捷命令（与 yakky 同级，直接运行，不需要 yakky 前缀）："),
  "  添加命令, add        创建快捷命令，支持 -t/--token 从分享密文导入",
  "  查询命令, query      查询快捷命令",
  "  运行命令, run        选择并执行当前工作区可用的快捷命令",
  "  分享命令, share      将快捷命令配置加密成分享密文",
  "  删除命令, delete     删除某个快捷命令",
  "  修改命令, edit       修改快捷命令的名称、工作区、描述和脚本",
  "",
  chalk.gray("提示：这些命令是独立入口，例如 `add`、`查询命令`、`run`，不是 `yakky add`。"),
].join("\n");

program
  .name("yakky")
  .description(chalk.hex("#FFA500")(getRandomSentence()))
  .version(version, "-v, --version", "显示版本号")
  .addHelpText("after", siblingShortcutCommandHelp);

program.name("yakky").helpOption("-h, --help", "显示帮助信息");

mountRepositry(program);
mountTemplate(program);
mountCreate(program);
mountSampleFile(program);

// 主异步函数
async function main() {
  try {
    // 首次运行时尽量完成数据库初始化；失败不影响帮助、版本等轻量命令。
    await tryInitializeDatabase();

    // 解析命令行参数
    await program.parseAsync(process.argv);
  } catch (error) {
    logger.error(`程序执行失败: ${error}`);
    process.exit(1);
  }
}

main();
