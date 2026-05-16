import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import {
  decryptShortcutCommandConfig,
  encryptShortcutCommandConfig,
  formatShareCommandChoice,
  shortcutCommandEncryptKey,
  toShortcutCommandShareConfig,
} from '../../src/commands/share-command/index.js';
import { shortcutCommands } from '../../src/db/schema.js';

type ShortcutCommandRow = typeof shortcutCommands.$inferSelect;
const require = createRequire(import.meta.url);
const CryptoJS = require('crypto-js') as {
  AES: {
    encrypt: (message: string, secretKey: string) => { toString: () => string };
  };
};

function command(overrides: Partial<ShortcutCommandRow>): ShortcutCommandRow {
  return {
    id: 1,
    name: 'test',
    description: null,
    workspacePath: null,
    script: 'echo test',
    scriptPath: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('share command crypto', () => {
  it('使用固定密钥名称', () => {
    expect(shortcutCommandEncryptKey).toBe('yakkyencryptkey');
  });

  it('能加密并解密快捷命令 JSON 配置', () => {
    const config = {
      name: 'deploy',
      description: '发布当前服务',
      workspace_path: '/work/app',
      script: 'echo deploy',
    };

    const ciphertext = encryptShortcutCommandConfig(config);

    expect(ciphertext).not.toBe(JSON.stringify(config));
    expect(decryptShortcutCommandConfig(ciphertext)).toEqual(config);
  });

  it('长脚本会先压缩再加密，减少密文长度', () => {
    const config = {
      name: 'deploy',
      description: '发布当前服务',
      workspace_path: '/work/app',
      script: Array.from({ length: 80 }, () => 'echo deploy service').join('\n'),
    };

    const ciphertext = encryptShortcutCommandConfig(config);

    expect(ciphertext.length).toBeLessThan(JSON.stringify(config).length);
    expect(decryptShortcutCommandConfig(ciphertext)).toEqual(config);
  });

  it('仍能解密旧版未压缩 JSON 密文', () => {
    const config = {
      name: 'legacy',
      description: null,
      workspacePath: null,
      script: 'echo legacy',
    };
    const ciphertext = CryptoJS.AES.encrypt(
      JSON.stringify(config),
      shortcutCommandEncryptKey,
    ).toString();

    expect(decryptShortcutCommandConfig(ciphertext)).toEqual({
      name: 'legacy',
      description: null,
      workspace_path: null,
      script: 'echo legacy',
    });
  });
});

describe('share command config formatting', () => {
  it('分享配置不包含本机数据库字段', () => {
    expect(
      toShortcutCommandShareConfig(
        command({
          name: 'deploy',
          description: '发布当前服务',
          workspacePath: '/work/app',
          script: 'echo deploy',
          scriptPath: '/tmp/script.sh',
        }),
      ),
    ).toEqual({
      name: 'deploy',
      description: '发布当前服务',
      workspace_path: '/work/app',
      script: 'echo deploy',
    });
  });

  it('选择项显示快捷命令名称和描述', () => {
    expect(
      formatShareCommandChoice(
        command({ name: 'deploy', description: '发布当前服务' }),
      ),
    ).toBe('deploy - 发布当前服务');
  });

  it('没有描述时显示占位文案', () => {
    expect(formatShareCommandChoice(command({ name: 'deploy' }))).toBe(
      'deploy - 无描述',
    );
  });
});
