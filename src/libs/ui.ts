import { Command } from "commander";
import { startUi } from "../commands/ui/index.js";
import { logger } from "../utils/logger.js";

export function mount(program: Command) {
  program
    .command("ui")
    .description("启动本地 UI 管理界面")
    .action(async () => {
      try {
        await startUi();
      } catch (error) {
        logger.error(`启动 UI 失败: ${error}`);
        process.exit(1);
      }
    });
}
