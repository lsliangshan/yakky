import { Command } from "commander";
import { template } from "../commands/template/index.js";
import { logger } from "../utils/logger";
import { templateList } from "../commands/template/list";
import { templateInfo } from "../commands/template/info";
import { templateDelete } from "../commands/template/delete";

export function mount(program: Command) {
  const templateCmd = program
    .command("template")
    .alias("tpl")
    .description("管理模板")
    .action(async () => {
      try {
        await template();
      } catch (error) {
        logger.error(`模板操作失败: ${error}`);
        process.exit(1);
      }
    });

  templateCmd
    .command("list")
    .alias("ls")
    .description("列出所有模板")
    .action(async () => {
      try {
        await templateList();
      } catch (error) {
        logger.error(`模板列表失败: ${error}`);
        process.exit(1);
      }
    });

  templateCmd
    .command("info")
    .description("查看模板详情")
    .option("-n, --name [模板名称]", "模板名称")
    .action(async (args) => {
      try {
        await templateInfo(args);
      } catch (error) {
        logger.error(`模板详情失败: ${error}`);
        process.exit(1);
      }
    });

  templateCmd
    .command("delete")
    .alias("rm")
    .alias("remove")
    .description("删除模板")
    .option("-n, --name [模板名称]", "模板名称")
    .action(async (args) => {
      try {
        await templateDelete(args);
      } catch (error) {
        logger.error(`模板删除失败: ${error}`);
        process.exit(1);
      }
    });
}
