import fs from "fs";
import os from "os";
import path from "path";
import ssh2 from "ssh2";
const { Client, utils } = ssh2;

export interface SetupSshKeyOptions {
  host: string;
  username: string;
  password: string;
  port?: number;
  keyName?: string;
}

export async function setupSshKeyLogin(
  options: SetupSshKeyOptions
): Promise<void> {
  const {
    host,
    username,
    password,
    port = 22,
    keyName = "id_ed25519",
  } = options;

  const sshDir = path.join(os.homedir(), ".ssh");
  const privateKeyPath = path.join(sshDir, keyName);
  const publicKeyPath = path.join(sshDir, `${keyName}.pub`);

  ensureSshDir(sshDir);
  await generateKeyIfNeeded(privateKeyPath, publicKeyPath);

  const publicKey = fs.readFileSync(publicKeyPath, "utf8").trim();
  const escapedPublicKey = shellEscapeSingleQuote(publicKey);

  const remoteCommand = `
mkdir -p ~/.ssh &&
chmod 700 ~/.ssh &&
touch ~/.ssh/authorized_keys &&
chmod 600 ~/.ssh/authorized_keys &&
grep -qxF '${escapedPublicKey}' ~/.ssh/authorized_keys || echo '${escapedPublicKey}' >> ~/.ssh/authorized_keys
`;

  await execRemoteCommandByPassword({
    host,
    port,
    username,
    password,
    command: remoteCommand,
  });

  await testPrivateKeyLogin({
    host,
    port,
    username,
    privateKeyPath,
  });
}

function ensureSshDir(sshDir: string): void {
  if (!fs.existsSync(sshDir)) {
    fs.mkdirSync(sshDir, {
      recursive: true,
      mode: 0o700,
    });
  }
}

function generateKeyIfNeeded(
  privateKeyPath: string,
  publicKeyPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(privateKeyPath) && fs.existsSync(publicKeyPath)) {
      return resolve();
    }

    utils.generateKeyPair(
      "ed25519",
      {
        comment: `${os.userInfo().username}@${os.hostname()}`,
      },
      (err, keys) => {
        if (err) return reject(err);

        fs.writeFileSync(privateKeyPath, keys.private, {
          mode: 0o600,
        });

        fs.writeFileSync(publicKeyPath, keys.public, {
          mode: 0o644,
        });

        resolve();
      }
    );
  });
}

interface ExecRemoteCommandOptions {
  host: string;
  port: number;
  username: string;
  password: string;
  command: string;
}

function execRemoteCommandByPassword(
  options: ExecRemoteCommandOptions
): Promise<string> {
  const { host, port, username, password, command } = options;

  return new Promise((resolve, reject) => {
    const conn = new Client();

    conn
      .on("ready", () => {
        conn.exec(command, (err, stream) => {
          if (err) {
            conn.end();
            return reject(err);
          }

          let stdout = "";
          let stderr = "";

          stream
            .on("close", (code: number) => {
              conn.end();

              if (code !== 0) {
                return reject(
                  new Error(
                    stderr || stdout || `Remote command failed: ${code}`
                  )
                );
              }

              resolve(stdout);
            })
            .on("data", (data: Buffer) => {
              stdout += data.toString();
            });

          stream.stderr.on("data", (data: Buffer) => {
            stderr += data.toString();
          });
        });
      })
      .on("error", reject)
      .connect({
        host,
        port,
        username,
        password,
        readyTimeout: 20_000,
      });
  });
}

interface TestPrivateKeyLoginOptions {
  host: string;
  port: number;
  username: string;
  privateKeyPath: string;
}

function testPrivateKeyLogin(
  options: TestPrivateKeyLoginOptions
): Promise<void> {
  const { host, port, username, privateKeyPath } = options;

  return new Promise((resolve, reject) => {
    const conn = new Client();

    conn
      .on("ready", () => {
        conn.exec("echo SSH_KEY_LOGIN_SUCCESS", (err, stream) => {
          if (err) {
            conn.end();
            return reject(err);
          }

          let output = "";

          stream
            .on("close", () => {
              conn.end();

              if (output.includes("SSH_KEY_LOGIN_SUCCESS")) {
                resolve();
              } else {
                reject(new Error("SSH key login test failed"));
              }
            })
            .on("data", (data: Buffer) => {
              output += data.toString();
            });
        });
      })
      .on("error", reject)
      .connect({
        host,
        port,
        username,
        privateKey: fs.readFileSync(privateKeyPath),
        readyTimeout: 20_000,
      });
  });
}

function shellEscapeSingleQuote(value: string): string {
  return value.replace(/'/g, `'\\''`);
}
