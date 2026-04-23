import { db } from "../../db/index.js";
import { repositories } from "../../db/schema.js";
import { desc } from "drizzle-orm";
import { logger } from "../../utils/logger.js";

export async function repositryList() {
  try {
    const allRepos = await db
      .select()
      .from(repositories)
      .orderBy(desc(repositories.createdAt));

    if (allRepos.length === 0) {
      logger.info("暂无仓库");
      return;
    }

    const maxNameLen = Math.max(...allRepos.map((r) => r.name.length));
    const targetWidth = Math.max(13, maxNameLen + 4);

    allRepos.forEach((repo, index) => {
      if (index === 0) {
        console.log("\n");
      }
      const prefix = index === 0 ? "  " : "  ";
      // const prefix = index === 0 ? "* " : "  ";
      const dashes = "-".repeat(targetWidth - repo.name.length);
      logger.log(`${prefix}${repo.name} ${dashes} ${repo.url}`);
      if (index === allRepos.length - 1) {
        console.log("\n");
      }
    });
    return allRepos;
  } catch (error) {
    logger.error(`获取仓库列表失败: ${error}`);
    throw error;
  }
}
