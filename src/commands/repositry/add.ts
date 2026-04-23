import { db } from "../../db/index.js";
import { repositories } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { logger } from "../../utils/logger.js";
import { IRepositryArgs } from "./types.js";
import Enquirer from "enquirer";

async function askQuestions(args?: IRepositryArgs) {
  const questions = [];
  if (!args?.name) {
    questions.push({
      type: "input",
      name: "name",
      message: "请输入仓库名称",
      validate: async (value: string) => {
        if (!value || value.trim() === "") {
          return "仓库名称不能为空";
        }
        // 检查是否已存在同名仓库
        const existing = await db
          .select()
          .from(repositories)
          .where(eq(repositories.name, value.trim()))
          .limit(1);
        if (existing.length > 0) {
          return `仓库名称 "${value}" 已存在，请使用其他名称`;
        }
        return true;
      },
    });
  }
  if (!args?.url) {
    questions.push({
      type: "input",
      name: "url",
      message: "请输入仓库URL",
      validate: (value: string) => {
        if (!value || value.trim() === "") {
          return "仓库URL不能为空";
        }
        return true;
      },
    });
  }

  let response;
  if (questions.length > 0) {
    response = await Enquirer.prompt(questions);
  }

  return {
    ...(args || {}),
    ...response,
  };
}

export async function repositryAdd(args?: IRepositryArgs) {
  try {
    // Start with provided args
    let repoInfo = args ? { ...args } : {};

    // If name or url is missing, ask interactively
    if (!repoInfo.name || !repoInfo.url) {
      const answers = await askQuestions(repoInfo);
      repoInfo = { ...repoInfo, ...answers };
    }

    const { name, url, description } = repoInfo;
    if (!name || !url) {
      logger.error("仓库名称和URL均为必填项");
      return;
    }

    // 检查是否已存在同名仓库
    const existing = await db
      .select()
      .from(repositories)
      .where(eq(repositories.name, name))
      .limit(1);

    if (existing.length > 0) {
      logger.error(`仓库名称 "${name}" 已存在`);
      return;
    }

    // 添加仓库
    const newRepo = await db
      .insert(repositories)
      .values({
        name,
        url,
        type: url.startsWith("http") ? "git" : "local",
        description: description || "",
      })
      .returning();

    logger.success(`仓库添加成功: ${newRepo[0].name}`);
    logger.highlight(`  ID: ${newRepo[0].id}`);
    logger.highlight(`  URL: ${newRepo[0].url}`);
    // logger.highlight(`  类型: ${newRepo[0].type}`);

    return newRepo[0];
  } catch (error) {
    logger.error(`添加仓库失败: ${error}`);
    throw error;
  }
}
