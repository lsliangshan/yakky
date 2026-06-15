import Enquirer from "enquirer";
import { uploadDirToFtp, uploadFileToFtp } from "../../utils/ftp.js";
import { logger } from "../../utils/logger.js";
import { createSpinner } from "../../utils/spinner.js";

export interface UploadFtpOptions {
  type?: "dir" | "file";
  host?: string;
  user?: string;
  password?: string;
  localPath?: string;
  remotePath?: string;
  secure?: boolean;
  overwrite?: boolean;
}

async function askQuestions(options: UploadFtpOptions) {
  const questions: any[] = [];

  if (!options.type) {
    questions.push({
      type: "select",
      name: "type",
      message: "请选择上传类型",
      choices: ["dir", "file"],
    });
  }
  if (!options.host) {
    questions.push({
      type: "input",
      name: "host",
      message: "请输入 FTP 服务器地址",
      validate: (value: string) =>
        !value || value.trim() === "" ? "FTP 服务器地址不能为空" : true,
    });
  }
  if (!options.user) {
    questions.push({
      type: "input",
      name: "user",
      message: "请输入 FTP 用户名",
      validate: (value: string) =>
        !value || value.trim() === "" ? "FTP 用户名不能为空" : true,
    });
  }
  if (!options.password) {
    questions.push({
      type: "password",
      name: "password",
      message: "请输入 FTP 密码",
      validate: (value: string) =>
        !value || value.trim() === "" ? "FTP 密码不能为空" : true,
    });
  }
  if (!options.localPath) {
    questions.push({
      type: "input",
      name: "localPath",
      message: "请输入本地文件或文件夹路径",
      validate: (value: string) =>
        !value || value.trim() === "" ? "本地路径不能为空" : true,
    });
  }
  if (!options.remotePath) {
    questions.push({
      type: "input",
      name: "remotePath",
      message: "请输入远程 FTP 服务器端路径",
      validate: (value: string) =>
        !value || value.trim() === "" ? "远程路径不能为空" : true,
    });
  }

  if (questions.length > 0) {
    return Enquirer.prompt(questions) as Promise<Partial<UploadFtpOptions>>;
  }
  return {};
}

export async function uploadFtp(initialOptions: UploadFtpOptions): Promise<void> {
  const prompted = await askQuestions(initialOptions);
  const options = { ...initialOptions, ...prompted };

  const {
    type,
    host,
    user,
    password,
    localPath,
    remotePath,
    secure = false,
    overwrite = true,
  } = options;

  if (!host) {
    logger.error("缺少必填选项: -h/--host <FTP服务器地址>");
    process.exit(1);
  }
  if (!user) {
    logger.error("缺少必填选项: -u/--user <FTP用户名>");
    process.exit(1);
  }
  if (!password) {
    logger.error("缺少必填选项: -p/--password <FTP密码>");
    process.exit(1);
  }
  if (!localPath) {
    logger.error("缺少必填选项: -l/--local-path <本地路径>");
    process.exit(1);
  }
  if (!remotePath) {
    logger.error("缺少必填选项: -r/--remote-path <远程路径>");
    process.exit(1);
  }

  if (type === "dir") {
    const spinner = createSpinner("正在上传文件夹到 FTP 服务器...");
    spinner.start();

    const success = await uploadDirToFtp({
      host,
      user,
      password,
      localPath,
      remotePath,
      secure,
      overwrite,
    });

    if (success) {
      spinner.succeed("文件夹上传成功");
    } else {
      spinner.fail("文件夹上传失败");
      process.exit(1);
    }
  } else if (type === "file") {
    const spinner = createSpinner("正在上传文件到 FTP 服务器...");
    spinner.start();

    const success = await uploadFileToFtp({
      host,
      user,
      password,
      localPath,
      remotePath,
      secure,
    });

    if (success) {
      spinner.succeed("文件上传成功");
    } else {
      spinner.fail("文件上传失败");
      process.exit(1);
    }
  } else {
    logger.error(`无效的上传类型: ${type}，可选值为 dir 或 file`);
    process.exit(1);
  }
}
