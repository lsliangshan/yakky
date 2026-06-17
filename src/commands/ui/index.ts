import http from "node:http";
import { spawn, execSync, exec } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../../db/index.js";
import { accounts, shortcutCommands } from "../../db/schema.js";
import { asc } from "drizzle-orm";
import { config } from "../../common/config.js";
import { logger } from "../../utils/logger.js";
import { createSpinner } from "../../utils/spinner.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function listenWithRetry(server: http.Server, startPort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    server.listen(startPort, () => resolve(startPort));
    server.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        resolve(listenWithRetry(server, startPort + 1));
      } else {
        reject(err);
      }
    });
  });
}

function findUiDir(): string {
  const candidates = [
    path.resolve(__dirname, "../../ui"),        // dev: src/commands/ui/ → src/ui/
    path.resolve(__dirname, "../src/ui"),        // built: dist/ → src/ui/
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "package.json"))) return dir;
  }
  return candidates[1]; // fallback to built path
}

const UI_DIR = findUiDir();

function getLocalUser() {
  const rows = db.select().from(accounts).all();
  if (rows.length === 0) return null;
  const acc = rows[0];
  return {
    id: acc.id,
    githubId: acc.githubId,
    login: acc.login,
    name: acc.name,
    email: acc.email,
    avatarUrl: acc.avatarUrl,
  };
}

function proxyToBackend(req: http.IncomingMessage, res: http.ServerResponse, backendPath: string) {
  const bodyChunks: Buffer[] = [];
  req.on("data", (chunk: Buffer) => bodyChunks.push(chunk));
  req.on("end", () => {
    const body = Buffer.concat(bodyChunks).toString();
    const backendUrl = new URL(backendPath, config.baseUrl);

    const options: http.RequestOptions = {
      hostname: backendUrl.hostname,
      port: backendUrl.port,
      path: backendUrl.pathname + backendUrl.search,
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on("error", () => {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ code: -1, message: "后端服务不可用" }));
    });

    if (body) proxyReq.write(body);
    proxyReq.end();
  });
}

function createApiServer() {
  return http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || "/", "http://127.0.0.1");

    if (url.pathname === "/api/me") {
      const user = getLocalUser();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(user));
      return;
    }

    if (url.pathname.startsWith("/api/backend/")) {
      const backendPath = url.pathname.replace("/api/backend", "") + url.search;
      proxyToBackend(req, res, backendPath);
      return;
    }

    if (url.pathname === "/api/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    if (url.pathname === "/api/local-commands") {
      try {
        const rows = db
          .select()
          .from(shortcutCommands)
          .orderBy(asc(shortcutCommands.name))
          .all();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(rows));
      } catch {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "查询本地命令失败" }));
      }
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });
}

function ensureDependencies(): void {
  const nodeModules = path.join(UI_DIR, "node_modules");
  if (fs.existsSync(nodeModules)) return;

  const spinner = createSpinner("首次启动，正在安装 UI 依赖...");
  spinner.start();
  try {
    execSync("npm install", { cwd: UI_DIR, stdio: "pipe" });
    spinner.succeed("UI 依赖安装完成");
  } catch {
    spinner.fail("UI 依赖安装失败");
    logger.error("请手动执行: cd src/ui && npm install");
    process.exit(1);
  }
}

function startVite(apiPort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const spinner = createSpinner("正在启动前端开发服务器...");
    spinner.start();

    const viteBin = path.join(UI_DIR, "node_modules", ".bin", "vite");
    const viteProcess = spawn(viteBin, [], {
      cwd: UI_DIR,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, VITE_API_PORT: String(apiPort) },
    });

    let viteStarted = false;
    let stderrBuf = "";

    viteProcess.stdout?.on("data", (data: Buffer) => {
      const text = data.toString();
      const match = text.match(/Local:\s+http:\/\/localhost:(\d+)/);
      if (match && !viteStarted) {
        viteStarted = true;
        const port = parseInt(match[1], 10);
        spinner.succeed("前端开发服务器已启动");
        logger.success(`UI 界面: http://localhost:${port}`);
        logger.muted("按 Ctrl+C 退出");
        resolve(port);
      }
    });

    viteProcess.stderr?.on("data", (data: Buffer) => {
      const text = data.toString();
      stderrBuf += text;
      if (!viteStarted && !text.includes("ExperimentalWarning")) {
        spinner.update(text.trim());
      }
    });

    viteProcess.on("error", () => {
      spinner.fail("启动前端开发服务器失败");
      reject(new Error("请确保已安装依赖：cd src/ui && npm install"));
    });

    viteProcess.on("exit", (code) => {
      if (!viteStarted) {
        spinner.fail(`前端服务器异常退出 (code: ${code})`);
        if (stderrBuf.trim()) {
          logger.error(stderrBuf.trim());
        }
        reject(new Error(`Vite exited with code ${code}`));
      }
    });

    const cleanup = () => {
      viteProcess.kill();
      process.exit(0);
    };

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
  });
}

function openBrowser(url: string): void {
  const platform = process.platform;
  let cmd: string;
  if (platform === "darwin") {
    cmd = `open "${url}"`;
  } else if (platform === "win32") {
    cmd = `start "" "${url}"`;
  } else {
    cmd = `xdg-open "${url}"`;
  }
  exec(cmd, (err) => {
    if (err) logger.muted(`无法自动打开浏览器，请手动访问: ${url}`);
  });
}

export async function startUi(): Promise<void> {
  const user = getLocalUser();

  if (!user) {
    logger.warn("当前未登录，部分功能可能受限");
    logger.muted("请执行 yak login 进行登录");
    logger.log("");
  } else {
    logger.success(`当前登录: ${user.login}${user.name ? ` (${user.name})` : ""}`);
  }

  ensureDependencies();

  const apiServer = createApiServer();
  const apiPort = await listenWithRetry(apiServer, 3456);
  logger.info(`API 服务已启动: http://127.0.0.1:${apiPort}`);

  process.on("SIGINT", () => apiServer.close());
  process.on("SIGTERM", () => apiServer.close());

  const vitePort = await startVite(apiPort);

  openBrowser(`http://localhost:${vitePort}`);
}
