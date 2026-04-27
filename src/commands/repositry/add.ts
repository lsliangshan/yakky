import { db } from "../../db/index.js";
import { repositories } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { logger } from "../../utils/logger.js";
import { templatesPath } from "../../utils/paths.js";
import { IRepositryArgs } from "./types.js";
import { syncTemplatesTable } from "./template-utils.js";
import { createSpinner } from "../../utils/spinner.js";
import Enquirer from "enquirer";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

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

function downloadRepo(url: string, dest: string) {
  if (url.startsWith("http") || url.startsWith("git@")) {
    execSync(`git clone --depth 1 ${url} ${dest}`, { stdio: "pipe" });
  } else {
    fs.cpSync(url, dest, { recursive: true });
  }
}

function copyTemplates(repoDir: string, name: string) {
  const templatesSrc = path.join(repoDir, "templates");
  const templatesDest = templatesPath(name, "templates");

  fs.mkdirSync(templatesDest, { recursive: true });

  if (fs.existsSync(templatesSrc)) {
    fs.cpSync(templatesSrc, templatesDest, { recursive: true });
    logger.success(`模板已下载成功`);
  } else {
    logger.warn("仓库中未找到 templates 目录，已创建空目录");
  }
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

    // 下载仓库并拷贝 templates
    const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), "yakky-"));
    try {
      const downloadSpinner = createSpinner("正在下载仓库...");
      downloadSpinner.start();
      downloadRepo(url, repoDir);
      downloadSpinner.succeed("仓库下载完成");
      copyTemplates(repoDir, name);
    } catch (error) {
      logger.error(`下载仓库失败: ${error}`);
      // 清理已创建的 templates 目录
      const dest = templatesPath(name);
      if (fs.existsSync(dest)) {
        fs.rmSync(dest, { recursive: true, force: true });
      }
      return;
    } finally {
      fs.rmSync(repoDir, { recursive: true, force: true });
    }

    // 写入数据库
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

    // 同步模板数据到数据库
    const syncSpinner = createSpinner("正在同步模板数据...");
    syncSpinner.start();
    await syncTemplatesTable(newRepo[0].id, name);
    syncSpinner.succeed("模板数据同步完成");

    return newRepo[0];
  } catch (error) {
    logger.error(`添加仓库失败: ${error}`);
    throw error;
  }
}
