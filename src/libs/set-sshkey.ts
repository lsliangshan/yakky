import { Command } from "commander";
import { setSshKey } from "../commands/set-sshkey/index.js";
import { logger } from "../utils/logger.js";

export function mount(program: Command) {
  program
    .command("set-sshkey")
    .description("生成 SSH 密钥并配置免密登录远程服务器")
    .helpOption("--help", "显示帮助信息")
    .option("-h, --host <host>", "远程服务器地址")
    .option("-u, --user <user>", "远程服务器的登录用户名")
    .option("-p, --password <password>", "远程服务器的登录密码")
    .option("--port <port>", "远程服务器的连接端口", "22")
    .action(async (options) => {
      try {
        await setSshKey(options);
      } catch (error) {
        logger.error(`SSH 密钥配置失败: ${error}`);
        process.exit(1);
      }
    });
}
