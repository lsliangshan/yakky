import { db } from "../../db/index.js";
import { accounts } from "../../db/schema.js";
import { logger } from "../../utils/logger.js";

export async function whoami(): Promise<void> {
  const existing = await db.select().from(accounts).limit(1);

  if (existing.length === 0) {
    logger.warn("当前未登录");
    logger.muted("请执行 yak login 进行登录");
    process.exit(1);
  }

  const acc = existing[0];
  logger.success(`当前登录账号: ${acc.login}`);
  logger.muted(`  GitHub ID: ${acc.githubId}`);
  if (acc.name) logger.muted(`  名称: ${acc.name}`);
  if (acc.email) logger.muted(`  邮箱: ${acc.email}`);
  if (acc.avatarUrl) logger.muted(`  头像: ${acc.avatarUrl}`);
  logger.muted(`  登录时间: ${acc.createdAt.toLocaleString()}`);
}
