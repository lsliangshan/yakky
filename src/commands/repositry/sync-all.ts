import { db } from "../../db/index.js";
import { repositories } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { logger } from "../../utils/logger.js";
import { templatesPath } from "../../utils/paths.js";
import { syncTemplatesTable } from "./template-utils.js";
import { createSpinner } from "../../utils/spinner.js";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

function downloadRepo(url: string, dest: string) {
  if (url.startsWith("http") || url.startsWith("git@")) {
    execSync(`git clone --depth 1 ${url} ${dest}`, { stdio: "pipe" });
  } else {
    fs.cpSync(url, dest, { recursive: true });
  }
}

export async function repositrySyncAll() {
  try {
    const allRepos = await db
      .select()
      .from(repositories)
      .orderBy(repositories.name);

    if (allRepos.length === 0) {
      logger.info("暂无仓库，请先添加仓库");
      return;
    }

    logger.info(`共 ${allRepos.length} 个仓库需要同步`);

    let successCount = 0;
    let failCount = 0;

    for (const repo of allRepos) {
      const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "yakky-"));
      const spinner = createSpinner(`[${repo.name}] 正在同步...`);
      spinner.start();
      try {
        downloadRepo(repo.url, repoDir);

        const templatesSrc = path.join(repoDir, "templates");
        const templatesDest = templatesPath(repo.name, "templates");

        if (fs.existsSync(templatesDest)) {
          spinner.update(`[${repo.name}] 正在删除旧模板目录...`);
          fs.rmSync(templatesDest, { recursive: true, force: true });
        }

        fs.mkdirSync(templatesDest, { recursive: true });

        spinner.update(`[${repo.name}] 正在复制模板文件...`);
        if (fs.existsSync(templatesSrc)) {
          fs.cpSync(templatesSrc, templatesDest, { recursive: true });
          spinner.succeed(`[${repo.name}] 同步成功`);
        } else {
          spinner.info(`[${repo.name}] 未找到 templates 目录`);
        }

        await db
          .update(repositories)
          .set({ updatedAt: new Date() })
          .where(eq(repositories.name, repo.name));

        // 同步模板数据到数据库
        await syncTemplatesTable(repo.id, repo.name);

        successCount++;
      } catch (error) {
        spinner.fail(`[${repo.name}] 同步失败: ${error}`);
        failCount++;
      } finally {
        fs.rmSync(repoDir, { recursive: true, force: true });
      }
    }

    console.log("");
    logger.success(`同步完成: ${successCount} 个成功, ${failCount} 个失败`);
  } catch (error) {
    logger.error(`同步全部仓库失败: ${error}`);
    throw error;
  }
}
