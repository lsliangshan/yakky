import { db } from "../../db/index.js";
import { templates, projects } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { logger } from "../../utils/logger.js";
import { ITemplateArgs } from "./types.js";
import Enquirer from "enquirer";

export async function templateDelete(args?: ITemplateArgs) {
  try {
    let name = args?.name;

    if (!name) {
      const allTemplates = await db
        .select({ name: templates.name })
        .from(templates)
        .orderBy(templates.name);

      if (allTemplates.length === 0) {
        logger.info("暂无模板可删除");
        return;
      }

      const response = await Enquirer.prompt<{ name: string }>({
        type: "select",
        name: "name",
        message: "请选择要删除的模板",
        choices: allTemplates.map((t) => t.name),
      });
      name = response.name;
    }

    if (!name) {
      logger.error("模板名称不能为空");
      return;
    }

    const existing = await db
      .select()
      .from(templates)
      .where(eq(templates.name, name))
      .limit(1);

    if (existing.length === 0) {
      logger.error(`模板 "${name}" 不存在`);
      return;
    }

    const tpl = existing[0];

    // 检查是否有项目使用了该模板
    const usedByProjects = await db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(eq(projects.templateId, tpl.id))
      .limit(1);

    if (usedByProjects.length > 0) {
      logger.warn(
        `模板 "${name}" 已被项目 "${usedByProjects[0].name}" 使用，删除后相关项目记录将丢失`,
      );
    }

    // 确认删除
    const { confirm } = await Enquirer.prompt<{ confirm: boolean }>({
      type: "confirm",
      name: "confirm",
      message: `确定要删除模板 "${name}" 吗？`,
      initial: false,
    });

    if (!confirm) {
      logger.info("已取消删除");
      return;
    }

    // 删除关联的项目记录
    await db.delete(projects).where(eq(projects.templateId, tpl.id));

    // 删除模板
    await db.delete(templates).where(eq(templates.name, name));

    logger.success(`模板已删除: ${name}`);
    logger.highlight(`  路径: ${tpl.repositryName}/${tpl.path}`);
  } catch (error) {
    logger.error(`删除模板失败: ${error}`);
    throw error;
  }
}
