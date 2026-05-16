import Enquirer from "enquirer";
import { asc } from "drizzle-orm";
import { createRequire } from "node:module";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { db } from "../../db/index.js";
import { shortcutCommands } from "../../db/schema.js";
import { logger } from "../../utils/logger.js";
import type { ShareCommandArgs, ShortcutCommandShareConfig } from "./types.js";
import chalk from "chalk";

type ShortcutCommandRow = typeof shortcutCommands.$inferSelect;
type LegacyShortcutCommandShareConfig = Omit<
  ShortcutCommandShareConfig,
  "workspace_path"
> & {
  workspacePath?: string | null;
  workspace_path?: string | null;
};
type CryptoWordArray = {
  sigBytes: number;
  words: number[];
  toString: (encoder?: unknown) => string;
};
type CryptoJs = {
  AES: {
    encrypt: (
      message: string | CryptoWordArray,
      secretKey: string,
    ) => { toString: () => string };
    decrypt: (
      ciphertext: string,
      secretKey: string,
    ) => CryptoWordArray;
  };
  enc: {
    Utf8: unknown;
  };
  lib: {
    WordArray: {
      create: (words: number[], sigBytes: number) => CryptoWordArray;
    };
  };
};

const require = createRequire(import.meta.url);
const CryptoJS = require("crypto-js") as CryptoJs;

export const shortcutCommandEncryptKey = "yakkyencryptkey";

function bufferToWordArray(buffer: Buffer): CryptoWordArray {
  const words: number[] = [];

  for (let index = 0; index < buffer.length; index += 1) {
    words[index >>> 2] |= buffer[index] << (24 - (index % 4) * 8);
  }

  return CryptoJS.lib.WordArray.create(words, buffer.length);
}

function wordArrayToBuffer(wordArray: CryptoWordArray): Buffer {
  const bytes = Buffer.alloc(wordArray.sigBytes);

  for (let index = 0; index < wordArray.sigBytes; index += 1) {
    bytes[index] =
      (wordArray.words[index >>> 2] >>> (24 - (index % 4) * 8)) & 0xff;
  }

  return bytes;
}

export function encryptShortcutCommandConfig(
  config: ShortcutCommandShareConfig,
): string {
  const compressed = deflateRawSync(
    Buffer.from(JSON.stringify(config), "utf-8"),
  );

  return CryptoJS.AES.encrypt(
    bufferToWordArray(compressed),
    shortcutCommandEncryptKey,
  ).toString();
}

export function decryptShortcutCommandConfig(
  ciphertext: string,
): ShortcutCommandShareConfig {
  const decrypted = CryptoJS.AES.decrypt(
    ciphertext,
    shortcutCommandEncryptKey,
  );
  let plaintext = "";

  try {
    plaintext = inflateRawSync(wordArrayToBuffer(decrypted)).toString("utf-8");
  } catch {
    plaintext = decrypted.toString(CryptoJS.enc.Utf8);
  }

  if (!plaintext) {
    throw new Error("快捷命令密文无法解密");
  }

  const parsed = JSON.parse(plaintext) as LegacyShortcutCommandShareConfig;

  return {
    name: parsed.name,
    description: parsed.description,
    workspace_path: parsed.workspace_path ?? parsed.workspacePath ?? null,
    script: parsed.script,
  };
}

export function toShortcutCommandShareConfig(
  command: ShortcutCommandRow,
): ShortcutCommandShareConfig {
  return {
    name: command.name,
    description: command.description,
    workspace_path: command.workspacePath,
    script: command.script,
  };
}

export function formatShareCommandChoice(command: ShortcutCommandRow): string {
  const description = command.description?.trim() || "无描述";
  return `${command.name} - ${description}`;
}

async function getCommands(): Promise<ShortcutCommandRow[]> {
  return db
    .select()
    .from(shortcutCommands)
    .orderBy(asc(shortcutCommands.name), asc(shortcutCommands.workspacePath));
}

async function askCommandToShare(
  commands: ShortcutCommandRow[],
): Promise<ShortcutCommandRow> {
  const answer = await Enquirer.prompt<{ commandId: string }>({
    type: "select",
    name: "commandId",
    message: "请选择要分享的快捷命令",
    choices: commands.map((command) => ({
      name: String(command.id),
      message: formatShareCommandChoice(command),
    })),
  });

  const selected = commands.find(
    (command) => String(command.id) === answer.commandId,
  );
  if (!selected) {
    throw new Error("未找到选择的快捷命令");
  }

  return selected;
}

export async function shareCommand(_args?: ShareCommandArgs) {
  const commands = await getCommands();

  // logger.highlight("可分享快捷命令");
  logger.muted(`\n  快捷命令数量: ${chalk.green(commands.length)} 个`);

  if (commands.length === 0) {
    logger.info("还没有快捷命令");
    return null;
  }

  logger.log("\n");
  // for (const command of commands) {
  //   logger.log(`  ${formatShareCommandChoice(command)}`);
  // }

  const selected = await askCommandToShare(commands);
  const ciphertext = encryptShortcutCommandConfig(
    toShortcutCommandShareConfig(selected),
  );

  logger.log("");
  logger.highlight("加密后的快捷命令密文");
  logger.log(ciphertext);

  return ciphertext;
}
