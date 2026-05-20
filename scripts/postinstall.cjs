#!/usr/bin/env node

const { spawnSync } = require("node:child_process");

const userAgent = process.env.npm_config_user_agent || "";
const isPnpm = userAgent.includes("pnpm/");
const isGlobalInstall =
  process.env.npm_config_global === "true" ||
  process.env.npm_config_location === "global";

if (!isPnpm || !isGlobalInstall) {
  process.exit(0);
}

const result = spawnSync("pnpm", ["rebuild", "-g", "better-sqlite3"], {
  stdio: "inherit",
});

if (result.error) {
  console.warn(
    `[yakky] 自动执行 pnpm rebuild -g better-sqlite3 失败: ${result.error.message}`,
  );
  console.warn("[yakky] 请手动执行: pnpm rebuild -g better-sqlite3");
  process.exit(0);
}

if (result.status !== 0) {
  console.warn("[yakky] 自动执行 pnpm rebuild -g better-sqlite3 未成功。");
  console.warn(
    "[yakky] 如果 pnpm 提示 ignored build scripts，请重新安装: pnpm add -g --allow-build=better-sqlite3 yakky",
  );
}
