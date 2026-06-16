import os from "node:os";
import path from "node:path";
import Enquirer from "enquirer";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { sshKeys } from "../../db/schema.js";
import { setupSshKeyLogin } from "../../utils/setup-ssh-key.js";
import { logger } from "../../utils/logger.js";
import { createSpinner } from "../../utils/spinner.js";

export interface SetSshKeyOptions {
  host?: string;
  user?: string;
  password?: string;
  port?: string;
}

async function askHost(host?: string): Promise<string> {
  if (host) return host;

  const { answer } = (await Enquirer.prompt({
    type: "input",
    name: "answer",
    message: "请输入远程服务器地址",
    validate: (value: string) =>
      !value || value.trim() === "" ? "远程服务器地址不能为空" : true,
  })) as { answer: string };

  return answer;
}

async function askRemaining(options: SetSshKeyOptions) {
  const questions: any[] = [];

  if (!options.user) {
    questions.push({
      type: "input",
      name: "user",
      message: "请输入远程服务器的登录用户名",
      validate: (value: string) =>
        !value || value.trim() === "" ? "登录用户名不能为空" : true,
    });
  }
  if (!options.password) {
    questions.push({
      type: "password",
      name: "password",
      message: "请输入远程服务器的登录密码",
      validate: (value: string) =>
        !value || value.trim() === "" ? "登录密码不能为空" : true,
    });
  }
  if (!options.port) {
    questions.push({
      type: "input",
      name: "port",
      message: "请输入远程服务器的连接端口",
      default: "22",
      validate: (value: string) => {
        if (!value || value.trim() === "") return true;
        const num = Number(value);
        if (!Number.isInteger(num) || num < 1 || num > 65535) {
          return "端口号必须为 1-65535 之间的整数";
        }
        return true;
      },
    });
  }

  if (questions.length > 0) {
    return Enquirer.prompt(questions) as Promise<Partial<SetSshKeyOptions>>;
  }
  return {};
}

export async function setSshKey(initialOptions: SetSshKeyOptions): Promise<void> {
  // 第一步：收集 host
  const host = await askHost(initialOptions.host);
  if (!host) {
    logger.error("缺少必填选项: -h/--host <远程服务器地址>");
    process.exit(1);
  }

  // 检查是否已配置过该服务器的免密登录
  const existing = await db
    .select()
    .from(sshKeys)
    .where(eq(sshKeys.host, host))
    .limit(1);

  if (existing.length > 0) {
    const record = existing[0];
    logger.warn(`该服务器已配置过免密登录`);
    logger.muted(
      `  主机: ${record.host}  用户名: ${record.username}  端口: ${record.port}  密钥: ${record.localKeyPath}`
    );
    logger.muted(`  配置时间: ${record.createdAt.toLocaleString()}`);
    process.exit(0);
  }

  // 第二步：收集剩余选项
  const prompted = await askRemaining(initialOptions);
  const options = { ...initialOptions, ...prompted, host };

  const { user, password, port: portStr = "22" } = options;

  if (!user) {
    logger.error("缺少必填选项: -u/--user <登录用户名>");
    process.exit(1);
  }
  if (!password) {
    logger.error("缺少必填选项: -p/--password <登录密码>");
    process.exit(1);
  }

  const port = Number(portStr) || 22;

  const localKeyPath = path.join(os.homedir(), ".ssh", "id_ed25519");

  const spinner = createSpinner("正在生成 SSH 密钥并配置免密登录...");
  spinner.start();

  try {
    await setupSshKeyLogin({
      host,
      username: user,
      password,
      port,
    });

    await db.insert(sshKeys).values({
      host,
      username: user,
      localKeyPath,
      port,
    });

    spinner.succeed("SSH 免密登录配置成功");
  } catch (err: any) {
    spinner.fail(`SSH 免密登录配置失败: ${err.message}`);
    process.exit(1);
  }
}
