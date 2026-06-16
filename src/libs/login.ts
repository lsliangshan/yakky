import { Command } from "commander";
import { login } from "../commands/login/index.js";
import { logout } from "../commands/login/logout.js";
import { whoami } from "../commands/login/whoami.js";
import { logger } from "../utils/logger.js";

export function mount(program: Command) {
  program
    .command("login")
    .description("通过 GitHub 账号登录 yakky")
    .action(async () => {
      try {
        await login();
      } catch (error) {
        logger.error(`登录失败: ${error}`);
        process.exit(1);
      }
    });

  program
    .command("logout")
    .description("退出当前登录账号")
    .action(async () => {
      try {
        await logout();
      } catch (error) {
        logger.error(`退出登录失败: ${error}`);
        process.exit(1);
      }
    });

  program
    .command("whoami")
    .description("查看当前登录账号信息")
    .action(async () => {
      try {
        await whoami();
      } catch (error) {
        logger.error(`查询失败: ${error}`);
        process.exit(1);
      }
    });
}
