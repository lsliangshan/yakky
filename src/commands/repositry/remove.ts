import { db } from "../../db/index.js";
import { repositories, templates } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { logger } from "../../utils/logger.js";
import { templatesPath } from "../../utils/paths.js";
import { IRepositryArgs } from "./types.js";
import { config } from "../../common/config.js";
import { ensureOfficialRepos } from "../../utils/ensure-official.js";
import Enquirer from "enquirer";
import fs from "node:fs";

export async function repositryRemove(args?: IRepositryArgs) {
  try {
    await ensureOfficialRepos();
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

    const repo = existing[0];

    // 检查是否为官方仓库（禁止删除）
    const officialNames = config.officialRepositories.map((r) => r.name);
    if (officialNames.includes(name)) {
      logger.error(`"${name}" 是官方仓库，不允许删除`);
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

    // 先删除数据库中的模板记录
    await db.delete(templates).where(eq(templates.repositoryId, repo.id));

    // 再删除 templates 目录
    const repoPath = templatesPath(name);
    fs.rmSync(repoPath, { recursive: true, force: true });
    logger.highlight(`  已删除模板文件`);

    // 最后删除仓库记录
    await db.delete(repositories).where(eq(repositories.name, name));

    logger.success(`仓库已删除: ${name}`);
    logger.highlight(`  URL: ${repo.url}`);
  } catch (error) {
    logger.error(`删除仓库失败: ${error}`);
    throw error;
  }
}
