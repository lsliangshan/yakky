import { db } from "../../db/index.js";
import { accounts } from "../../db/schema.js";
import { config } from "../../common/config.js";
import {
  requestDeviceCode,
  pollForAccessToken,
  fetchGitHubUser,
  fetchGitHubEmail,
} from "../../utils/github-auth.js";
import { logger } from "../../utils/logger.js";
import { createSpinner } from "../../utils/spinner.js";

async function pollWithSpinner(
  clientId: string,
  deviceCode: string,
  interval: number
): Promise<string> {
  const spinner = createSpinner("等待 GitHub 授权...");
  spinner.start();

  const startTime = Date.now();
  const timeout = 900_000; // 15 minutes

  while (Date.now() - startTime < timeout) {
    const token = await pollForAccessToken(clientId, deviceCode);
    if (token) {
      spinner.succeed("GitHub 授权成功");
      return token;
    }
    await new Promise((resolve) => setTimeout(resolve, interval * 1000));
  }

  spinner.fail("GitHub 授权超时");
  throw new Error("等待授权超时，请重新运行 yak login");
}

export async function login(): Promise<void> {
  const clientId = config.githubClientId;
  if (!clientId) {
    logger.error("尚未配置 GitHub OAuth App client_id");
    logger.muted("请在 src/common/config.ts 中填入 client_id");
    logger.muted(
      "前往 https://github.com/settings/developers 注册 OAuth App 即可获取"
    );
    process.exit(1);
  }

  // 检查是否已登录
  const existing = await db.select().from(accounts).limit(1);
  if (existing.length > 0) {
    const acc = existing[0];
    logger.warn("当前已登录");
    logger.muted(
      `  GitHub ID: ${acc.login}${acc.name ? ` (${acc.name})` : ""}`
    );
    logger.muted(`  登录时间: ${acc.createdAt.toLocaleString()}`);
    logger.muted(`  如需重新登录，请先执行 yak logout`);
    return;
  }

  // Step 1: 请求 device code
  const deviceResp = await requestDeviceCode(clientId);

  // Step 2: 提示用户打开浏览器
  logger.info("请在浏览器中打开以下地址并输入验证码：");
  logger.log("");
  logger.highlight(`  ${deviceResp.verification_uri}`);
  logger.log("");
  logger.info(`验证码: ${deviceResp.user_code}`);
  logger.log("");

  // Step 3: 轮询等待授权
  const accessToken = await pollWithSpinner(
    clientId,
    deviceResp.device_code,
    deviceResp.interval
  );

  // Step 4: 获取用户信息和邮箱
  const [user, email] = await Promise.all([
    fetchGitHubUser(accessToken),
    fetchGitHubEmail(accessToken),
  ]);

  // Step 5: 保存到数据库
  await db.insert(accounts).values({
    githubId: user.id,
    login: user.login,
    name: user.name,
    email: user.email || email,
    avatarUrl: user.avatar_url,
    accessToken,
  });

  logger.success(
    `登录成功: ${user.login}${user.name ? ` (${user.name})` : ""}`
  );
}
