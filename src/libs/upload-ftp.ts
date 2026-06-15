import { Command } from "commander";
import { uploadFtp } from "../commands/upload-ftp/index.js";
import { logger } from "../utils/logger.js";

export function mount(program: Command) {
  program
    .command("upload-ftp")
    .alias("ftp")
    .description("上传文件或文件夹到远程 FTP 服务器")
    .option("-t, --type <type>", "上传类型，可选值: dir, file")
    .option("-h, --host <host>", "FTP 服务器地址")
    .option("-u, --user <user>", "FTP 用户名")
    .option("-p, --password <password>", "FTP 密码")
    .option("-l, --local-path <localPath>", "本地文件或文件夹路径")
    .option("-r, --remote-path <remotePath>", "远程 FTP 服务器端路径")
    .option("-s, --secure", "是否开启 secure 连接", false)
    .option("-o, --overwrite", "是否替换远程文件夹（仅 type=dir 时生效）", true)
    .action(async (options) => {
      try {
        await uploadFtp(options);
      } catch (error) {
        logger.error(`FTP 上传失败: ${error}`);
        process.exit(1);
      }
    });
}
