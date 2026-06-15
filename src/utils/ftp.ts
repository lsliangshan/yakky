import { Client } from "basic-ftp";

export interface UploadDirToFtpOptions {
  host: string;
  user: string;
  password: string;
  localPath: string;
  remotePath: string;
  secure?: boolean;
  overwrite?: boolean;
}

export interface UploadFileToFtpOptions {
  host: string;
  user: string;
  password: string;
  localPath: string;
  remotePath: string;
  secure?: boolean;
}

export function uploadDirToFtp(
  options: UploadDirToFtpOptions
): Promise<boolean> {
  return new Promise(async (resolve) => {
    const {
      host,
      user,
      password,
      secure = false,
      localPath,
      remotePath,
      overwrite = true,
    } = options;

    const client = new Client();

    try {
      await client.access({
        host,
        user,
        password,
        secure,
      });

      if (overwrite) {
        try {
          await client.removeDir(remotePath);
        } catch (e) {
          // 目录不存在，忽略
        }
      }

      await client.ensureDir(remotePath);
      await client.uploadFromDir(localPath);
      resolve(true);
    } catch (err) {
      resolve(false);
    } finally {
      client.close();
    }
  });
}

export function uploadFileToFtp(
  options: UploadFileToFtpOptions
): Promise<boolean> {
  return new Promise(async (resolve) => {
    const {
      host,
      user,
      password,
      secure = false,
      localPath,
      remotePath,
    } = options;

    const client = new Client();

    try {
      await client.access({
        host,
        user,
        password,
        secure,
      });

      await client.uploadFrom(localPath, remotePath);
      resolve(true);
    } catch (err) {
      resolve(false);
    } finally {
      client.close();
    }
  });
}
