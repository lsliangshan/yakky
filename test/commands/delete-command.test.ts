import { describe, expect, it } from 'vitest';
import { formatCommandManageChoice } from '../../src/commands/delete-command/index.js';
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
