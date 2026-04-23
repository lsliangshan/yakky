import { db } from "../../db/index.js";
import { templates } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { templatesPath } from "../../utils/paths.js";
import fs from "node:fs";
import path from "node:path";

/**
 * 扫描本地模板目录，将模板记录同步到数据库 templates 表。
 * 先删除该仓库的所有旧模板记录，再插入当前文件系统中的模板。
 */
export async function syncTemplatesTable(repositoryId: number, repoName: string) {
  // 删除旧记录
  await db.delete(templates).where(eq(templates.repositoryId, repositoryId));

  // 扫描 templates 目录下的文件夹
  const templatesDir = templatesPath(repoName, "templates");
  if (!fs.existsSync(templatesDir)) {
    return;
  }

  const entries = fs.readdirSync(templatesDir, { withFileTypes: true });
  const templateFolders = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  if (templateFolders.length === 0) {
    return;
  }

  await db.insert(templates).values(
    templateFolders.map((name) => ({
      name,
      repositoryId,
      repositryName: repoName,
      path: name,
    }))
  );
}
