import { db } from "../db/index.js";
import { templates, repositories } from "../db/schema.js";
import { eq, and, like, desc } from "drizzle-orm";
import { logger } from "../utils/logger.js";

export async function template(args?: any) {
  const { list, add, delete: deleteTemplate, update, rename, move, copy, test, edit } = args || {};

  try {
    if (list) {
      // 列出所有模板
      const allTemplates = await db
        .select({
          id: templates.id,
          name: templates.name,
          description: templates.description,
          repository: repositories.name,
          path: templates.path,
          tags: templates.tags,
          createdAt: templates.createdAt,
        })
        .from(templates)
        .leftJoin(repositories, eq(templates.repositoryId, repositories.id))
        .orderBy(desc(templates.createdAt));

      if (allTemplates.length === 0) {
        logger.info("暂无模板");
        return;
      }

      logger.info("模板列表:");
      allTemplates.forEach((tpl) => {
        logger.highlight(`  ${tpl.name} (ID: ${tpl.id})`);
        if (tpl.description) logger.highlight(`    描述: ${tpl.description}`);
        if (tpl.repository) logger.highlight(`    仓库: ${tpl.repository}`);
        if (tpl.path) logger.highlight(`    路径: ${tpl.path}`);
        if (tpl.tags && tpl.tags.length > 0) logger.highlight(`    标签: ${tpl.tags.join(", ")}`);
        logger.highlight(`    创建时间: ${new Date(tpl.createdAt).toLocaleString()}`);
        console.log();
      });
      return allTemplates;
    }

    if (add) {
      // 添加模板 - 这里需要更多参数，暂时简单实现
      logger.warn("添加模板功能需要更多参数，请使用完整命令格式");
      logger.info("示例: yakky template add --name <模板名> --repository-id <仓库ID> --path <路径>");
      return;
    }

    if (deleteTemplate) {
      // 删除模板
      const templateId = parseInt(deleteTemplate, 10);
      if (isNaN(templateId)) {
        logger.error("请提供有效的模板ID");
        return;
      }

      const deleted = await db.delete(templates).where(eq(templates.id, templateId)).returning();
      if (deleted.length > 0) {
        logger.success(`模板已删除: ${deleted[0].name}`);
      } else {
        logger.warn("未找到指定模板");
      }
      return deleted;
    }

    // 其他操作暂未实现
    if (update || rename || move || copy || test || edit) {
      logger.warn("该功能暂未实现");
      return;
    }

    // 如果没有指定任何操作，显示帮助信息
    logger.info("模板管理命令");
    logger.info("可用选项:");
    logger.info("  --list, -l     列出所有模板");
    logger.info("  --add, -a      添加模板");
    logger.info("  --delete, -d   删除模板");
    logger.info("  --update, -u   更新模板");
    logger.info("  --rename, -r   重命名模板");
    logger.info("  --move, -m     移动模板");
    logger.info("  --copy, -c     复制模板");
    logger.info("  --test, -t     测试模板");
    logger.info("  --edit, -e     编辑模板");
  } catch (error) {
    logger.error(`模板操作失败: ${error}`);
    throw error;
  }
}
