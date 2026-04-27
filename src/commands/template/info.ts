import { db } from "../../db/index.js";
import { templates } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { logger } from "../../utils/logger.js";
import { ITemplateArgs } from "./types.js";
import Enquirer from "enquirer";

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

function printSection(title: string) {
  const len = 50;
  if (title) {
    logger.muted(`  ── ${title} ${"─".repeat(Math.max(2, len - visualLen(title) - 4))}`);
  } else {
    logger.muted(`  ${"─".repeat(len)}`);
  }
}

function printKV(key: string, value: string) {
  logger.log(`  ${padVisual(key, 10)} ${value}`);
}

function printArray(label: string, arr: string[] | null | undefined, emptyText: string) {
  if (!arr?.length) {
    printKV(label, emptyText);
    return;
  }
  printKV(label, arr.join(", "));
}

export async function templateInfo(args?: ITemplateArgs) {
  try {
    let name = args?.name;

    if (!name) {
      const allTemplates = await db
        .select({ name: templates.name })
        .from(templates)
        .orderBy(templates.name);

      if (allTemplates.length === 0) {
        logger.info("暂无模板");
        return;
      }

      const response = await Enquirer.prompt<{ name: string }>({
        type: "select",
        name: "name",
        message: "请选择模板",
        choices: allTemplates.map((t) => t.name),
      });
      name = response.name;
    }

    if (!name) {
      logger.error("模板名称不能为空");
      return;
    }

    const result = await db
      .select({
        id: templates.id,
        name: templates.name,
        repositryName: templates.repositryName,
        path: templates.path,
        description: templates.description,
        tags: templates.tags,
        configs: templates.configs,
        variables: templates.variables,
        metadata: templates.metadata,
        createdAt: templates.createdAt,
        updatedAt: templates.updatedAt,
      })
      .from(templates)
      .where(eq(templates.name, name))
      .limit(1);

    if (result.length === 0) {
      logger.error(`模板 "${name}" 不存在`);
      return;
    }

    const tpl = result[0];

    console.log("");
    logger.highlight(`  模板 » ${tpl.name}`);
    printSection("");
    printKV("ID", String(tpl.id));
    printKV("仓库", tpl.repositryName);
    printKV("描述", tpl.description || "(无)");
    printArray("标签", tpl.tags, "(无)");

    // configs
    console.log("");
    printSection("配置");
    if (tpl.configs?.length) {
      for (const c of tpl.configs) {
        logger.log("");
        logger.highlight(`  ${c.name}`);
        printKV("  类型", c.type || "");
        printKV("  说明", c.message || "");
        if (c.choices?.length) {
          printKV("  选项", c.choices.map((ch: any) => ch.name || ch.value || ch).join(", "));
        }
      }
    } else {
      printKV("", "(无)");
    }

    // variables
    console.log("");
    printSection("变量");
    if (tpl.variables?.length) {
      const vNameW = Math.max(6, ...tpl.variables.map((v: any) => visualLen(String(v.value ?? ""))));
      logger.muted(`  ${padVisual("变量名", vNameW)}  占位符             说明`);
      for (const v of tpl.variables) {
        logger.log(
          `  ${padVisual(String(v.value ?? ""), vNameW)}  ${String(v.template ?? "").padEnd(18)} ${v.message ?? ""}`,
        );
      }
    } else {
      printKV("", "(无)");
    }

    // metadata
    if (tpl.metadata && Object.keys(tpl.metadata).length > 0) {
      console.log("");
      printSection("元数据");
      for (const [k, v] of Object.entries(tpl.metadata)) {
        printKV(k, typeof v === "object" ? JSON.stringify(v) : String(v));
      }
    }

    // time
    console.log("");
    printSection("时间");
    printKV("创建时间", new Date(tpl.createdAt).toLocaleString());
    printKV("更新时间", new Date(tpl.updatedAt).toLocaleString());

    console.log("");
    return tpl;
  } catch (error) {
    logger.error(`获取模板详情失败: ${error}`);
    throw error;
  }
}
