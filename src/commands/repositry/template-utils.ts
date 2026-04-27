import { db } from "../../db/index.js";
import { templates } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { templatesPath } from "../../utils/paths.js";
import fs from "node:fs";
import path from "node:path";

interface RoadmapJson {
  configs?: Record<string, any>[];
  variables?: Record<string, any>[];
  tags?: string[];
  description?: string;
}

function readRoadmap(templateDir: string): RoadmapJson | null {
  const roadmapPath = path.join(templateDir, "roadmap.json");
  if (!fs.existsSync(roadmapPath)) return null;

  try {
    const raw = fs.readFileSync(roadmapPath, "utf-8");
    const data = JSON.parse(raw);
    return {
      configs: Array.isArray(data.configs) ? data.configs : undefined,
      variables: Array.isArray(data.variables) ? data.variables : undefined,
      tags: Array.isArray(data.tags) ? data.tags : undefined,
      description: typeof data.description === "string" ? data.description : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * 扫描本地模板目录，将模板记录同步到数据库 templates 表。
 * 先删除该仓库的所有旧模板记录，再插入当前文件系统中的模板。
 * 每个模板目录下的 roadmap.json 会被读取，将其中的 configs / variables / tags / description
 * 存入对应字段。
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

  const records = templateFolders.map((name) => {
    const templateDir = path.join(templatesDir, name);
    const roadmap = readRoadmap(templateDir);
    return {
      name,
      repositoryId,
      repositryName: repoName,
      path: path.join(templatesDir, name),
      configs: roadmap?.configs ?? null,
      variables: roadmap?.variables ?? null,
      tags: roadmap?.tags ?? null,
      description: roadmap?.description ?? null,
    };
  });

  await db.insert(templates).values(records);
}
