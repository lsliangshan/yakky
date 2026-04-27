import { Command } from "commander";
import { repositry } from "../commands/repositry";
import { logger } from "../utils/logger";
import { repositryList } from "../commands/repositry/list";
import { repositryAdd } from "../commands/repositry/add";
import { repositryRemove } from "../commands/repositry/remove";
import { repositrySync } from "../commands/repositry/sync";
import { repositrySyncAll } from "../commands/repositry/sync-all";
import { repositryInit } from "../commands/repositry/init";

export function mount(program: Command) {
  const repositryCmd = program
    .command("repo")
    .alias("repositry")
    .description("管理模板仓库")
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
    .action(async (args) => {
      try {
        await repositryAdd(args);
      } catch (error) {
        logger.error(`仓库添加失败: ${error}`);
        process.exit(1);
      }
    });

  repositryCmd
    .command("remove")
    .alias("rm")
    .alias("delete")
    .description("删除仓库")
    .option("-n, --name [模板仓库名称]", "模板仓库名称")
    .action(async (args) => {
      try {
        await repositryRemove(args);
      } catch (error) {
        logger.error(`仓库删除失败: ${error}`);
        process.exit(1);
      }
    });

  repositryCmd
    .command("sync")
    .description("从远端同步模板仓库")
    .option("-n, --name [模板仓库名称]", "模板仓库名称")
    .action(async (args) => {
      try {
        await repositrySync(args);
      } catch (error) {
        logger.error(`仓库同步失败: ${error}`);
        process.exit(1);
      }
    });

  repositryCmd
    .command("sync-all")
    .description("同步所有模板仓库")
    .action(async () => {
      try {
        await repositrySyncAll();
      } catch (error) {
        logger.error(`仓库同步失败: ${error}`);
        process.exit(1);
      }
    });

  repositryCmd
    .command("init")
    .description("初始化模板仓库项目结构")
    .option("-n, --name <模板名称>", "模板名称（templates 下的第一个模板名）")
    .option("-d, --dir <目录>", "项目输出目录")
    .action(async (args) => {
      try {
        await repositryInit(args);
      } catch (error) {
        logger.error(`初始化失败: ${error}`);
        process.exit(1);
      }
    });
}
