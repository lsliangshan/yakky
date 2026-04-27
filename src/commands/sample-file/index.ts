import { db } from "../../db/index.js";
import { templates, repositories } from "../../db/schema.js";
import { eq, and } from "drizzle-orm";
import { logger } from "../../utils/logger.js";
import { ISampleFileArgs } from "./types.js";
import { ensureOfficialRepos } from "../../utils/ensure-official.js";
import Enquirer from "enquirer";
import fs from "node:fs";
import path from "node:path";

export async function sampleFile(args?: ISampleFileArgs) {
  await ensureOfficialRepos();

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

  // 3. 查询模板完整信息
  const result = await db
    .select({
      name: templates.name,
      repositryName: templates.repositryName,
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

  // 4. 选择输出格式
  const { format } = await Enquirer.prompt<{ format: string }>({
    type: "select",
    name: "format",
    message: "请选择输出格式",
    choices: [
      { name: "object", message: "单个创建 (object)" },
      { name: "array", message: "批量创建 (array)" },
    ],
  });

  // 生成配置项示例值
  function genConfigSample(c: any): any {
    if ((c.type === "select" || c.type === "autocomplete") && c.choices?.length) {
      const values = c.choices.map((ch: any) => ch.value ?? ch.name ?? ch);
      return values.join(" 或 ");
    }
    if (c.type === "multiselect" && c.choices?.length) {
      const values = c.choices.map((ch: any) => ch.value ?? ch.name ?? ch);
      return `[${values.join(", ")}]`;
    }
    return c.default ?? "";
  }

  // 生成变量示例值
  function genVariableSample(v: any, index?: number): string {
    if (v.default) return String(v.default);
    if (v.value === "name") {
      return index ? `my-${templateName}-${index}` : `my-${templateName}`;
    }
    // 用 message 或 value 作为占位符提示
    return `[${v.message || v.value}]`;
  }

  function generateItem(index?: number) {
    const configs: Record<string, any> = {};
    for (const c of tpl.configs || []) {
      configs[c.name] = genConfigSample(c);
    }

    const variables: Record<string, string> = {};
    for (const v of tpl.variables || []) {
      variables[v.value] = genVariableSample(v, index);
    }

    return {
      repositry: repoName!,
      template: templateName!,
      configs,
      variables,
    };
  }

  let outputData: any;
  const defaultFilename =
    format === "array"
      ? `${templateName}-batch-sample.json`
      : `${templateName}-sample.json`;

  if (format === "object") {
    outputData = generateItem();
  } else {
    const { count } = await Enquirer.prompt<{ count: number }>({
      type: "numeral",
      name: "count",
      message: "请输入批量生成的数量",
      initial: 2,
    });
    outputData = Array.from({ length: count }, (_, i) => generateItem(i + 1));
  }

  // 5. 输出文件
  let filename = "";
  let outputPath = "";
  let isFirstPrompt = true;

  while (true) {
    const answer = await Enquirer.prompt<{ filename: string }>({
      type: "input",
      name: "filename",
      message: "请输入输出文件名",
      initial: isFirstPrompt ? defaultFilename : filename,
    });
    isFirstPrompt = false;
    filename = answer.filename;
    outputPath = path.join(process.cwd(), filename);

    if (!fs.existsSync(outputPath)) break;

    logger.warn(`"${filename}" 已存在`);
    const { choice } = await Enquirer.prompt<{ choice: string }>({
      type: "select",
      name: "choice",
      message: "请选择操作:",
      choices: [
        { name: "overwrite", message: "覆盖" },
        { name: "skip", message: "忽略" },
        { name: "rename", message: "重命名" },
      ],
      initial: 0,
    });

    if (choice === "skip") {
      logger.info(`已跳过 "${filename}"`);
      return;
    }

    if (choice === "overwrite") break;

    if (choice === "rename") {
      // 自动推荐一个不存在的文件名
      const ext = path.extname(filename);
      const base = path.basename(filename, ext);
      let suggestion = `${base}-副本${ext}`;
      for (let i = 2; fs.existsSync(path.join(process.cwd(), suggestion)); i++) {
        suggestion = `${base}-副本-${i}${ext}`;
      }
      filename = suggestion;
      continue;
    }
  }

  fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2), "utf-8");
  logger.success(`示例文件已生成到: ${outputPath}`);
}
