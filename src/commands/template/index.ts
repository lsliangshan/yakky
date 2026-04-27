import { logger } from "../../utils/logger.js";

export async function template() {
  logger.info("模板管理");
  logger.info("可用子命令:");
  logger.info("  list, ls       列出所有模板");
  logger.info("  info           查看模板详情");
  logger.info("  delete, rm     删除模板");
}
