import { db } from "../../db/index.js";
import { accounts } from "../../db/schema.js";
import { logger } from "../../utils/logger.js";
import { syncUserLogout } from "../../utils/api.js";

export async function logout(): Promise<void> {
  const existing = await db.select().from(accounts).limit(1);

  if (existing.length === 0) {
    logger.warn("当前未登录");
    return;
  }

  const acc = existing[0];

  // 同步退出登录到后端
  try {
    await syncUserLogout({
      userId: String(acc.githubId),
    });
  } catch (e) {
    logger.warn(`退出登录同步失败: ${e}`);
  }

  await db.delete(accounts);

  logger.success(`已退出登录: ${acc.login}`);
}
