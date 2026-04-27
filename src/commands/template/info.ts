import { db } from "../../db/index.js";
import { templates, repositories } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { logger } from "../../utils/logger.js";
import { ITemplateArgs } from "./types.js";
import Enquirer from "enquirer";

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
    logger.highlight(`  模板: ${tpl.name}`);
    logger.log(`  ${"=".repeat(40)}`);
    logger.highlight(`  ID: ${tpl.id}`);
    logger.log(`  仓库: ${tpl.repositryName}`);
    logger.log(`  路径: ${tpl.path}`);
    if (tpl.description) logger.log(`  描述: ${tpl.description}`);
    if (tpl.tags?.length) logger.log(`  标签: ${tpl.tags.join(", ")}`);
    if (tpl.metadata) logger.log(`  元数据: ${JSON.stringify(tpl.metadata)}`);
    logger.log(`  创建时间: ${new Date(tpl.createdAt).toLocaleString()}`);
    logger.log(`  更新时间: ${new Date(tpl.updatedAt).toLocaleString()}`);
    console.log("");

    return tpl;
  } catch (error) {
    logger.error(`获取模板详情失败: ${error}`);
    throw error;
  }
}
