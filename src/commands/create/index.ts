import { db } from "../../db/index.js";
import { templates, repositories } from "../../db/schema.js";
import { eq, and } from "drizzle-orm";
import { logger } from "../../utils/logger.js";
import { ICreateArgs } from "./types.js";
import Enquirer from "enquirer";
import fs from "node:fs";
import path from "node:path";

export async function create(args?: ICreateArgs) {
  try {
    // 1. 选择仓库
    let repoName = args?.repositry;
    if (!repoName) {
      const allRepos = await db
        .select({ name: repositories.name })
        .from(repositories)
        .orderBy(repositories.name);

      if (allRepos.length === 0) {
        logger.info("暂无仓库，请先添加仓库");
        return;
      }

      const response = await Enquirer.prompt<{ name: string }>({
        type: "select",
        name: "name",
        message: "请选择仓库",
        choices: allRepos.map((r) => r.name),
      });
      repoName = response.name;
    }

    if (!repoName) {
      logger.error("仓库名称不能为空");
      return;
    }

    // 2. 选择模板
    let templateName = args?.template;
    if (!templateName) {
      const repo = await db
        .select()
        .from(repositories)
        .where(eq(repositories.name, repoName))
        .limit(1);

      if (repo.length === 0) {
        logger.error(`仓库 "${repoName}" 不存在`);
        return;
      }

      const repoId = repo[0].id;
      const repoDir = path.dirname(
        (await db
          .select({ path: templates.path })
          .from(templates)
          .where(eq(templates.repositoryId, repoId))
          .limit(1)
        )[0]?.path ?? ""
      );

      const tplList = await db
        .select({ name: templates.name })
        .from(templates)
        .where(eq(templates.repositoryId, repoId))
        .orderBy(templates.name);

      if (tplList.length === 0) {
        logger.info(`仓库 "${repoName}" 下暂无模板`);
        return;
      }

      const response = await Enquirer.prompt<{ name: string }>({
        type: "select",
        name: "name",
        message: "请选择模板",
        choices: tplList.map((t) => t.name),
      });
      templateName = response.name;
    }

    if (!templateName) {
      logger.error("模板名称不能为空");
      return;
    }

    // 3. 查询模板完整信息
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
      })
      .from(templates)
      .where(
        and(
          eq(templates.name, templateName),
          eq(templates.repositryName, repoName),
        ),
      )
      .limit(1);

    if (result.length === 0) {
      logger.error(`模板 "${templateName}" 不存在`);
      return;
    }

    const tpl = result[0];
    logger.info(`使用模板: ${tpl.name} (${tpl.repositryName})`);

    // 4. 收集配置项
    const configAnswers: Record<string, any> = {};
    if (tpl.configs?.length) {
      for (const c of tpl.configs) {
        if (c.type === "select" && c.choices?.length) {
          const answer = await Enquirer.prompt<any>({
            type: "select",
            name: c.name,
            message: c.message || `请选择 ${c.name}`,
            choices: c.choices.map((ch: any) => ({
              name: ch.name || ch.value || ch,
              message: ch.message || ch.name || ch.value || ch,
              value: ch.value ?? ch.name ?? ch,
            })),
          });
          configAnswers[c.name] = answer[c.name];
        } else {
          const answer = await Enquirer.prompt<any>({
            type: "input",
            name: c.name,
            message: c.message || `请输入 ${c.name}`,
            initial: c.default ?? "",
          });
          configAnswers[c.name] = answer[c.name];
        }
      }
    }

    // 5. 收集变量值
    const varAnswers: Record<string, string> = {};
    if (tpl.variables?.length) {
      logger.info("请填写以下变量:");
      for (const v of tpl.variables) {
        const answer = await Enquirer.prompt<any>({
          type: "input",
          name: v.value,
          message: v.message || `请输入 ${v.value}`,
          initial: v.default ?? "",
        });
        varAnswers[v.value] = answer[v.value];
      }
    }

    // 6. 确认信息
    console.log("");
    logger.highlight(`  模板: ${tpl.name}`);
    logger.highlight(`  仓库: ${tpl.repositryName}`);
    if (Object.keys(configAnswers).length) {
      logger.log(`  配置: ${JSON.stringify(configAnswers)}`);
    }
    if (Object.keys(varAnswers).length) {
      logger.log(`  变量: ${JSON.stringify(varAnswers)}`);
    }

    const { confirm } = await Enquirer.prompt<{ confirm: boolean }>({
      type: "confirm",
      name: "confirm",
      message: "确认以上信息并创建?",
      initial: true,
    });

    if (!confirm) {
      logger.info("已取消创建");
      return;
    }

    // 7. 复制模板文件到目标目录
    const srcDir = tpl.path;
    const destDir = path.join(process.cwd(), templateName);

    if (!fs.existsSync(srcDir)) {
      logger.error(`模板目录不存在: ${srcDir}`);
      return;
    }

    // 替换变量并复制
    function copyAndReplace(src: string, dest: string, vars: Record<string, string>, config: Record<string, any>) {
      fs.mkdirSync(dest, { recursive: true });
      const entries = fs.readdirSync(src, { withFileTypes: true });

      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
          copyAndReplace(srcPath, destPath, vars, config);
        } else {
          let content = fs.readFileSync(srcPath, "utf-8");
          // 替换变量占位符
          for (const [key, val] of Object.entries(vars)) {
            content = content.replace(new RegExp(`\\$\\$${key}\\$\\$`, "g"), val);
          }
          // 替换配置占位符
          for (const [key, val] of Object.entries(config)) {
            content = content.replace(new RegExp(`\\$\\$${key}\\$\\$`, "g"), String(val));
          }
          fs.writeFileSync(destPath, content, "utf-8");
        }
      }
    }

    copyAndReplace(srcDir, destDir, varAnswers, configAnswers);
    logger.success(`模板已生成到: ${destDir}`);

  } catch (error) {
    logger.error(`创建失败: ${error}`);
    throw error;
  }
}
