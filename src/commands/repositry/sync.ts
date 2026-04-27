import { db } from "../../db/index.js";
import { repositories } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { logger } from "../../utils/logger.js";
import { templatesPath } from "../../utils/paths.js";
import { IRepositryArgs } from "./types.js";
import { syncTemplatesTable } from "./template-utils.js";
import { createSpinner } from "../../utils/spinner.js";
import { ensureOfficialRepos } from "../../utils/ensure-official.js";
import Enquirer from "enquirer";
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

export async function repositrySync(args?: IRepositryArgs) {
  try {
    await ensureOfficialRepos();
    let name = args?.name;

    // If name is missing, list all repos for the user to choose
    if (!name) {
      const allRepos = await db
        .select()
        .from(repositories)
        .orderBy(repositories.name);

      if (allRepos.length === 0) {
        logger.info("暂无仓库，请先添加仓库");
        return;
      }

      const response = await Enquirer.prompt<{ name: string }>({
        type: "select",
        name: "name",
        message: "请选择要同步的仓库",
        choices: allRepos.map((r) => ({ name: r.name, message: `${r.name} (${r.url})` })),
      });
      name = response.name;
    }

    if (!name) {
      logger.error("仓库名称不能为空");
      return;
    }

    // 查找仓库
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

    // 下载仓库
    const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "yakky-"));
    try {
      const downloadSpinner = createSpinner("正在同步模板...");
      downloadSpinner.start();
      downloadRepo(repo.url, repoDir);

      const templatesSrc = path.join(repoDir, "templates");
      const templatesDest = templatesPath(name, "templates");

      // 先删除旧的模板目录和文件
      if (fs.existsSync(templatesDest)) {
        downloadSpinner.update("正在删除旧模板目录...");
        fs.rmSync(templatesDest, { recursive: true, force: true });
      }

      // 重新创建空目录
      fs.mkdirSync(templatesDest, { recursive: true });

      // 复制新模板文件
      if (fs.existsSync(templatesSrc)) {
        downloadSpinner.update("正在复制模板文件...");
        fs.cpSync(templatesSrc, templatesDest, { recursive: true });
        downloadSpinner.succeed("模板同步完成");
      } else {
        downloadSpinner.info("远端仓库中未找到 templates 目录，已创建空目录");
      }

      // 同步模板数据到数据库
      const syncSpinner = createSpinner("正在同步模板数据到数据库...");
      syncSpinner.start();
      await syncTemplatesTable(repo.id, name);
      syncSpinner.succeed("数据库同步完成");

      // 更新仓库 updatedAt
      await db
        .update(repositories)
        .set({ updatedAt: new Date() })
        .where(eq(repositories.name, name));

      logger.highlight(`  URL: ${repo.url}`);
    } catch (error) {
      logger.error(`同步仓库失败: ${error}`);
      return;
    } finally {
      fs.rmSync(repoDir, { recursive: true, force: true });
    }
  } catch (error) {
    logger.error(`同步仓库失败: ${error}`);
    throw error;
  }
}
