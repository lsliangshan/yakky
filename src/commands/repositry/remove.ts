import { db } from "../../db/index.js";
import { repositories, templates } from "../../db/schema.js";
import { eq, sql } from "drizzle-orm";
import { logger } from "../../utils/logger.js";
import { IRepositryArgs } from "./types.js";
import Enquirer from "enquirer";

export async function repositryRemove(args?: IRepositryArgs) {
  try {
    let name = args?.name;

    // If name is missing, ask interactively
    if (!name) {
      const allRepos = await db
        .select({ name: repositories.name })
        .from(repositories)
        .orderBy(repositories.name);

      if (allRepos.length === 0) {
        logger.info("暂无仓库可删除");
        return;
      }

      const response = await Enquirer.prompt<{ name: string }>({
        type: "select",
        name: "name",
        message: "请选择要删除的仓库",
        choices: allRepos.map((r) => r.name),
      });
      name = response.name;
    }

    if (!name) {
      logger.error("仓库名称不能为空");
      return;
    }

    // 检查仓库是否存在
    const existing = await db
      .select()
      .from(repositories)
      .where(eq(repositories.name, name))
      .limit(1);

    if (existing.length === 0) {
      logger.error(`仓库 "${name}" 不存在`);
      return;
    }

    // 确认删除
    const { confirm } = await Enquirer.prompt<{ confirm: boolean }>({
      type: "confirm",
      name: "confirm",
      message: `确定要删除仓库 "${name}" 吗？`,
      initial: false,
    });

    if (!confirm) {
      logger.info("已取消删除");
      return;
    }

    const repo = existing[0];

    // 检查是否有模板关联
    const linkedTemplates = await db
      .select({ count: sql<number>`count(*)` })
      .from(templates)
      .where(eq(templates.repositoryId, repo.id));

    if (linkedTemplates[0].count > 0) {
      logger.error(
        `仓库 "${name}" 下有 ${linkedTemplates[0].count} 个模板，请先删除模板`
      );
      return;
    }

    // 删除仓库
    await db.delete(repositories).where(eq(repositories.name, name));

    logger.success(`仓库已删除: ${name}`);
    logger.highlight(`  URL: ${repo.url}`);
  } catch (error) {
    logger.error(`删除仓库失败: ${error}`);
    throw error;
  }
}
