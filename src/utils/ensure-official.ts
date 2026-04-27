import { db } from "../db/index.js";
import { repositories } from "../db/schema.js";
import { config } from "../common/config.js";
import { logger } from "./logger.js";
import { templatesPath } from "./paths.js";
import { syncTemplatesTable } from "../commands/repositry/template-utils.js";
import { createSpinner } from "./spinner.js";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export async function ensureOfficialRepos() {
  const existingNames: string[] = (
    await db.select({ name: repositories.name }).from(repositories)
  ).map((r) => r.name);

  for (const official of config.officialRepositories) {
    if (existingNames.includes(official.name)) continue;

    logger.info(`检测到官方仓库 "${official.name}" 不存在，正在自动添加...`);

    const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "yakky-"));
    try {
      const spinner = createSpinner(`正在下载官方仓库 "${official.name}"...`);
      spinner.start();

      execSync(`git clone --depth 1 ${official.url} ${repoDir}`, {
        stdio: "pipe",
      });

      const templatesSrc = path.join(repoDir, "templates");
      const templatesDest = templatesPath(official.name, "templates");
      fs.mkdirSync(templatesDest, { recursive: true });
      if (fs.existsSync(templatesSrc)) {
        fs.cpSync(templatesSrc, templatesDest, { recursive: true });
      }

      const newRepo = await db
        .insert(repositories)
        .values({
          name: official.name,
          url: official.url,
          type: "git",
          description: "",
        })
        .returning();

      await syncTemplatesTable(newRepo[0].id, official.name);

      spinner.succeed(`官方仓库 "${official.name}" 已自动添加并同步`);
    } catch (error) {
      // 清理失败的产物
      const dest = templatesPath(official.name);
      if (fs.existsSync(dest)) {
        fs.rmSync(dest, { recursive: true, force: true });
      }
      logger.error(`添加官方仓库 "${official.name}" 失败: ${error}`);
    } finally {
      fs.rmSync(repoDir, { recursive: true, force: true });
    }
  }
}
