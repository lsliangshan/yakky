import { describe, expect, it } from 'vitest';
import {
  formatCommandOutputLine,
  formatRunCommandChoice,
  getAvailableCommandsForWorkspace,
} from '../../src/commands/run-command/index.js';
import { shortcutCommands } from '../../src/db/schema.js';

type ShortcutCommandRow = typeof shortcutCommands.$inferSelect;

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

describe('run command workspace matching', () => {
  it('列出全系统和当前工作区可用快捷命令', () => {
    const commands = [
      command({ id: 1, name: 'global', workspacePath: null }),
      command({ id: 2, name: 'current', workspacePath: '/work/current' }),
      command({ id: 3, name: 'other', workspacePath: '/work/other' }),
    ];

    expect(
      getAvailableCommandsForWorkspace(commands, '/work/current').map(
        item => item.name,
      ),
    ).toEqual(['global', 'current']);
  });

  it('父级工作区快捷命令不在当前子工作区中显示', () => {
    const commands = [
      command({ id: 1, name: 'parent', workspacePath: '/work' }),
      command({ id: 2, name: 'child', workspacePath: '/work/current' }),
    ];

    expect(
      getAvailableCommandsForWorkspace(commands, '/work/current').map(
        item => item.name,
      ),
    ).toEqual(['child']);
  });
});

describe('run command choice formatting', () => {
  it('显示快捷命令名称和描述', () => {
    expect(
      formatRunCommandChoice(
        command({ name: 'deploy', description: '发布当前服务' }),
      ),
    ).toBe('deploy - 发布当前服务');
  });

  it('没有描述时显示占位文案', () => {
    expect(formatRunCommandChoice(command({ name: 'deploy' }))).toBe(
      'deploy - 无描述',
    );
  });
});

describe('run command output formatting', () => {
  it('脚本标准输出带独立样式前缀', () => {
    const output = formatCommandOutputLine('hello', 'stdout');

    expect(output).toContain('│');
    expect(output).toContain('hello');
  });

  it('脚本错误输出带独立样式前缀', () => {
    const output = formatCommandOutputLine('failed', 'stderr');

    expect(output).toContain('│');
    expect(output).toContain('failed');
  });
});
