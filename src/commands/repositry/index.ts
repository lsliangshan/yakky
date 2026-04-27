import { logger } from "../../utils/logger.js";

export async function repositry() {
  logger.info("模板仓库管理");
  logger.info("可用子命令:");
  logger.info("  list, ls        列出所有仓库");
  logger.info("  add             添加仓库");
  logger.info("  remove, rm, delete  删除仓库");
  logger.info("  sync            同步仓库");
  logger.info("  sync-all        同步所有仓库");
  logger.info("  init            初始化模板仓库项目结构");
}
