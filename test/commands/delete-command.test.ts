import { describe, expect, it } from 'vitest';
import {
  findCommandsByName,
  formatCommandManageChoice,
  formatSelectedCommand,
} from '../../src/commands/delete-command/index.js';
import { shortcutCommands } from '../../src/db/schema.js';

type ShortcutCommandRow = typeof shortcutCommands.$inferSelect;

function command(overrides: Partial<ShortcutCommandRow>): ShortcutCommandRow {
  return {
    id: 1,
    name: 'deploy',
    description: null,
    workspacePath: null,
    script: 'echo deploy',
    scriptPath: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('delete command choice formatting', () => {
  it('显示命令名称、描述和生效工作区路径', () => {
    expect(
      formatCommandManageChoice(
        command({
          name: 'deploy',
          description: '发布当前服务',
          workspacePath: '/work/app',
        }),
      ),
    ).toBe('deploy - 发布当前服务 - 工作区: /work/app');
  });

  it('没有描述和工作区时显示占位内容', () => {
    expect(formatCommandManageChoice(command({ name: 'deploy' }))).toBe(
      'deploy - 无描述 - 全系统生效',
    );
  });
});

describe('delete command name lookup', () => {
  it('按快捷命令名称查找全部同名项', () => {
    const commands = [
      command({ id: 1, name: 'deploy', workspacePath: null }),
      command({ id: 2, name: 'deploy', workspacePath: '/work/app' }),
      command({ id: 3, name: 'test', workspacePath: null }),
    ];

    expect(findCommandsByName(commands, 'deploy').map(item => item.id)).toEqual([
      1,
      2,
    ]);
  });

  it('格式化选中命令的名称和工作区路径提示', () => {
    expect(
      formatSelectedCommand(command({ name: 'deploy', workspacePath: null })),
    ).toEqual(['  快捷命令: deploy', '  工作区路径: 全系统生效']);
  });
});
