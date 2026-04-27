import { db } from "../../db/index.js";
import { templates } from "../../db/schema.js";
import { desc } from "drizzle-orm";
import { logger } from "../../utils/logger.js";
import { ensureOfficialRepos } from "../../utils/ensure-official.js";

function visualLen(s: string): number {
  let len = 0;
  for (const ch of s) {
    len += /[\u4e00-\u9fff\u3000-\u30ff\uff00-\uffef]/.test(ch) ? 2 : 1;
  }
  return len;
}

function padVisual(s: string, len: number): string {
  return s + " ".repeat(Math.max(0, len - visualLen(s)));
}

export async function templateList() {
  try {
    await ensureOfficialRepos();
    const allTemplates = await db
      .select({
        id: templates.id,
        name: templates.name,
        repositryName: templates.repositryName,
        path: templates.path,
        description: templates.description,
        tags: templates.tags,
        createdAt: templates.createdAt,
      })
      .from(templates)
      .orderBy(desc(templates.createdAt));

    if (allTemplates.length === 0) {
      logger.info("暂无模板");
      return;
    }

    const cols = { name: "名称", repo: "仓库", desc: "描述" };
    const minColW = 8;
    const nameW = Math.max(minColW, visualLen(cols.name), ...allTemplates.map((t) => t.name.length));
    const repoW = Math.max(minColW, visualLen(cols.repo), ...allTemplates.map((t) => t.repositryName.length));
    const descW = Math.max(minColW, visualLen(cols.desc), ...allTemplates.map((t) => (t.description ?? "").length));
    const gap = 3;

    const idW = 4;

    function fmt(...items: string[]) {
      return "  " + items.join(" ".repeat(gap));
    }

    const head = fmt(
      padVisual("ID", idW),
      padVisual(cols.name, nameW),
      padVisual(cols.repo, repoW),
      padVisual(cols.desc, descW),
      "标签",
    );

    const sepLen = 2 + idW + gap + nameW + gap + repoW + gap + descW + gap + 6;
    const sep = "  " + "─".repeat(sepLen - 2);

    console.log("");
    logger.log(head);
    logger.muted(sep);

    for (const tpl of allTemplates) {
      const tags = tpl.tags?.length ? tpl.tags.join(", ") : "";
      logger.log(
        fmt(
          String(tpl.id).padEnd(idW),
          padVisual(tpl.name, nameW),
          padVisual(tpl.repositryName, repoW),
          padVisual(tpl.description ?? "", descW),
          tags,
        ),
      );
    }
    console.log("");

    return allTemplates;
  } catch (error) {
    logger.error(`获取模板列表失败: ${error}`);
    throw error;
  }
}
