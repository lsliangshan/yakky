import { Command } from "commander";
import { sampleFile } from "../commands/sample-file/index.js";
import { logger } from "../utils/logger";

export function mount(program: Command) {
  program
    .command("sample-file")
    .description("生成模板示例配置文件（用于 yak create -f）")
    .option("-r, --repositry <name>", "选择仓库")
    .option("-t, --template <name>", "选择模板")
    .action(async (args) => {
      try {
        await sampleFile(args);
      } catch (error) {
        logger.error(`生成示例文件失败: ${error}`);
        process.exit(1);
      }
    });
}
