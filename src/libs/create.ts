import { Command } from "commander";
import { create } from "../commands/create/index.js";
import { logger } from "../utils/logger";

export function mount(program: Command) {
  program
    .command("create")
    .description("通过模板创建项目")
    .option("-r, --repositry <name>", "选择仓库")
    .option("-t, --template <name>", "选择模板")
    .option("-f, --file <path>", "JSON 配置文件路径（支持 object/array）")
    .action(async (args) => {
      try {
        // 只有当提供了 -r 或 -t 时才做交互式选择
        // 没提供任何选项时也进入交互模式
        await create(args);
      } catch (error) {
        logger.error(`创建失败: ${error}`);
        process.exit(1);
      }
    });
}
