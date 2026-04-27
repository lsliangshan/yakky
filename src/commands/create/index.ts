import { db } from "../../db/index.js";
import { templates, repositories } from "../../db/schema.js";
import { eq, and } from "drizzle-orm";
import { logger } from "../../utils/logger.js";
import { ICreateArgs } from "./types.js";
import { createSpinner } from "../../utils/spinner.js";
import { ensureOfficialRepos } from "../../utils/ensure-official.js";
import chalk from "chalk";
import Enquirer from "enquirer";
import fs from "node:fs";
import path from "node:path";

// ===== Template copy helpers =====

function resolveName(name: string, vars: Record<string, string>, config: Record<string, any>) {
  let resolved = name;
  for (const [key, val] of Object.entries(vars)) {
    resolved = resolved.split(key).join(val);
  }
  for (const [key, val] of Object.entries(config)) {
    resolved = resolved.split(`$$${key}$$`).join(String(val));
  }
  return resolved;
}

function copyAndReplace(
  src: string,
  dest: string,
  vars: Record<string, string>,
  config: Record<string, any>,
) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const resolvedName = resolveName(entry.name, vars, config);
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, resolvedName);

    if (entry.isDirectory()) {
      copyAndReplace(srcPath, destPath, vars, config);
    } else {
      let content = fs.readFileSync(srcPath, "utf-8");
      for (const [key, val] of Object.entries(vars)) {
        content = content.split(key).join(val);
      }
      for (const [key, val] of Object.entries(config)) {
        content = content.split(`$$${key}$$`).join(String(val));
      }
      fs.writeFileSync(destPath, content, "utf-8");
    }
  }
}

// ===== Conflict resolution =====

async function handleExistingDir(
  destDir: string,
  outputName: string,
): Promise<{ action: "skip" | "proceed"; destDir: string; outputName: string }> {
  if (!fs.existsSync(destDir)) {
    return { action: "proceed", destDir, outputName };
  }

  logger.warn(`"${outputName}" 目录已存在`);
  const { choice } = await Enquirer.prompt<{ choice: string }>({
    type: "select",
    name: "choice",
    message: `请选择操作:`,
    choices: [
      { name: "skip", message: "忽略" },
      { name: "overwrite", message: "覆盖" },
      { name: "rename", message: "重命名" },
    ],
  });

  if (choice === "skip") {
    return { action: "skip", destDir, outputName };
  }

  if (choice === "overwrite") {
    fs.rmSync(destDir, { recursive: true, force: true });
    return { action: "proceed", destDir, outputName };
  }

  // rename
  const { newName } = await Enquirer.prompt<{ newName: string }>({
    type: "input",
    name: "newName",
    message: "请输入新的文件夹名称:",
    initial: `${outputName}-副本`,
  });

  const newDestDir = path.join(process.cwd(), newName);
  return handleExistingDir(newDestDir, newName);
}

export async function create(args?: ICreateArgs) {
  try {
    await ensureOfficialRepos();

    // ===== FILE MODE =====
    if (args?.file) {
      console.log(chalk.yellow("ℹ 提示: 可用 yak sample-file 命令生成模板示例配置文件"));

      if (!args.file.endsWith(".json")) {
        logger.error(`不支持的文件格式 "${path.extname(args.file)}"，仅支持 .json`);
        return;
      }

      let raw: any;
      try {
        raw = JSON.parse(fs.readFileSync(args.file, "utf-8"));
      } catch {
        logger.error(`配置文件 "${args.file}" 格式不正确，请检查 JSON 语法`);
        return;
      }
      const items: any[] = Array.isArray(raw) ? raw : [raw];

      for (const item of items) {
        if (!item.repositry || !item.template) {
          logger.error(`配置项缺少必填字段: repositry, template`);
          continue;
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
          })
          .from(templates)
          .where(
            and(
              eq(templates.name, item.template),
              eq(templates.repositryName, item.repositry),
            ),
          )
          .limit(1);

        if (result.length === 0) {
          logger.error(`模板 "${item.template}" (${item.repositry}) 不存在`);
          continue;
        }

        const tpl = result[0];
        logger.info(`使用模板: ${tpl.name} (${tpl.repositryName})`);

        // Build config answers from file (keyed by config.name)
        const configAnswers: Record<string, any> = {};
        for (const c of tpl.configs || []) {
          if (item.configs?.[c.name] !== undefined) {
            configAnswers[c.name] = item.configs[c.name];
          }
        }

        // Build variable answers from file (keyed by variable.template)
        const varAnswers: Record<string, string> = {};
        for (const v of tpl.variables || []) {
          if (item.variables?.[v.value] !== undefined) {
            varAnswers[v.template] = String(item.variables[v.value]);
          }
        }

        // Step 6: Determine source directory
        const pathSegments = tpl.configs?.map((c: any) => String(configAnswers[c.name] ?? "")) ?? [];
        const path1 = pathSegments.filter(Boolean).join("/");
        const srcDir = path.join(tpl.path, path1, "template");

        if (!fs.existsSync(srcDir)) {
          logger.error(`模板目录不存在: ${srcDir}`);
          continue;
        }

        // Step 7: Output directory name
        const nameVar = tpl.variables?.find((v: any) => v.value === "name");
        const outputName = nameVar ? varAnswers[nameVar.template] : item.template;

        if (!outputName) {
          logger.error("未能确定输出目录名称");
          continue;
        }

        const destDir = path.join(process.cwd(), outputName);

        // Step 8: Show info
        logger.highlight(`  输出: ${outputName}`);
        if (Object.keys(configAnswers).length) {
          logger.log(`  配置: ${JSON.stringify(configAnswers)}`);
        }
        if (Object.keys(varAnswers).length) {
          logger.log(`  变量: ${JSON.stringify(varAnswers)}`);
        }

        // Step 9: Handle existing directory + copy
        const fileResult = await handleExistingDir(destDir, outputName);
        if (fileResult.action === "skip") {
          logger.info(`已跳过 "${outputName}"`);
          continue;
        }
        const copySpinner = createSpinner("正在生成模板文件...");
        copySpinner.start();
        copyAndReplace(srcDir, fileResult.destDir, varAnswers, configAnswers);
        copySpinner.succeed(`模板已生成到: ${fileResult.destDir}`);
      }

      return;
    }

    // ===== INTERACTIVE MODE =====
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
      const choiceTypes = ["select", "multiselect", "autocomplete"];
      for (const c of tpl.configs) {
        const type = c.type || "input";

        if (choiceTypes.includes(type) && c.choices?.length) {
          // choice-based prompt: map displayed name → stored value
          const choiceMap = new Map(
            c.choices.map((ch: any) => {
              const key = ch.name || ch.value || ch;
              const val = ch.value ?? ch.name ?? ch;
              return [key, val];
            }),
          );
          const answer = await Enquirer.prompt<any>({
            type,
            name: c.name,
            message: c.message || `请选择 ${c.name}`,
            choices: c.choices.map((ch: any) => ({
              name: ch.name || ch.value || ch,
              message: ch.message || ch.name || ch.value || ch,
              value: ch.value ?? ch.name ?? ch,
            })),
          });
          if (type === "multiselect") {
            configAnswers[c.name] = answer[c.name].map((v: any) => choiceMap.get(v) ?? v);
          } else {
            configAnswers[c.name] = choiceMap.get(answer[c.name]) ?? answer[c.name];
          }
        } else {
          // standard prompt: pass type directly to Enquirer
          const answer = await Enquirer.prompt<any>({
            type,
            name: c.name,
            message: c.message || `请输入 ${c.name}`,
            initial: c.default ?? (type === "confirm" || type === "toggle" ? true : ""),
            ...(type === "form" && c.choices ? { choices: c.choices } : {}),
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
        varAnswers[v.template] = answer[v.value];
      }
    }

    // 6. 根据 config 反馈值拼接子路径，确定源目录
    const pathSegments = tpl.configs?.map((c: any) => String(configAnswers[c.name] ?? "")) ?? [];
    const path1 = pathSegments.filter(Boolean).join("/");
    const srcDir = path.join(tpl.path, path1, "template");

    if (!fs.existsSync(srcDir)) {
      logger.error(`模板目录不存在: ${srcDir}`);
      logger.info(`期望路径: ${path.join(tpl.path, path1, "template")}`);
      return;
    }

    // 7. 确定输出目录名（取自 variable 中 value="name" 的输入值）
    const nameVar = tpl.variables?.find((v: any) => v.value === "name");
    const outputName = nameVar ? varAnswers[nameVar.template] : templateName;

    if (!outputName) {
      logger.error("未能确定输出目录名称");
      return;
    }

    const destDir = path.join(process.cwd(), outputName);

    // 8. 确认信息
    console.log("");
    logger.highlight(`  模板: ${tpl.name}`);
    logger.highlight(`  仓库: ${tpl.repositryName}`);
    logger.highlight(`  输出: ${outputName}`);
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

    // 9. 复制模板文件并替换变量占位符
    const interactResult = await handleExistingDir(destDir, outputName);
    if (interactResult.action === "skip") {
      logger.info(`已跳过 "${outputName}"`);
      return;
    }
    const copySpinner = createSpinner("正在生成模板文件...");
    copySpinner.start();
    copyAndReplace(srcDir, interactResult.destDir, varAnswers, configAnswers);
    copySpinner.succeed(`模板已生成到: ${interactResult.destDir}`);

  } catch (error) {
    logger.error(`创建失败: ${error}`);
    throw error;
  }
}

