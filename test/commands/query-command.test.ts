import { describe, expect, it } from 'vitest';
import {
  formatCommandWorkspaceScope,
  isWorkspaceCommandEffective,
  truncateText,
  wrapText,
} from '../../src/commands/query-command/index.js';

describe('query command workspace matching', () => {
  it('全系统快捷命令在任意工作区内生效', () => {
    expect(isWorkspaceCommandEffective(null, '/path1/path2')).toBe(true);
  });

  it('当前工作区快捷命令在当前路径内生效', () => {
    expect(isWorkspaceCommandEffective('/path1/path2', '/path1/path2')).toBe(true);
  });

  it('父级工作区快捷命令不在子路径查询结果中显示', () => {
    expect(isWorkspaceCommandEffective('/path1', '/path1/path2')).toBe(false);
  });

  it('子级工作区快捷命令不在父路径内生效', () => {
    expect(isWorkspaceCommandEffective('/path1/path2', '/path1')).toBe(false);
  });

  it('相邻工作区快捷命令不互相生效', () => {
    expect(isWorkspaceCommandEffective('/path1/path2', '/path1/path3')).toBe(false);
  });

  it('查询 yakky 工作区时不显示 crm 工作区快捷命令', () => {
    expect(
      isWorkspaceCommandEffective(
        '/Users/liangshan/workspace/zp/crm',
        '/Users/liangshan/workspace/zp/crm/yakky',
      ),
    ).toBe(false);
  });
});

describe('query command workspace scope label', () => {
  it('workspace_path 为空时才显示为全系统生效', () => {
    expect(formatCommandWorkspaceScope(null)).toBe('全系统生效');
  });

  it('具体路径只显示为工作区生效，不属于全系统生效', () => {
    expect(formatCommandWorkspaceScope('/Users/liangshan/workspace/zp/crm')).toBe(
      '工作区: /Users/liangshan/workspace/zp/crm',
    );
  });
});

describe('query command table formatting', () => {
  it('路径不省略，超长后按列宽换行显示', () => {
    expect(wrapText('/Users/liangshan/workspace/zp/crm/yakky/data/script.sh', 20)).toEqual([
      '/Users/liangshan/wor',
      'kspace/zp/crm/yakky/',
      'data/script.sh',
    ]);
  });

  it('非路径长文本使用尾部省略', () => {
    expect(truncateText('abcdefghijklmnopqrstuvwxyz', 8)).toBe('abcde...');
  });

  it('长描述按列宽换行显示', () => {
    expect(wrapText('这是一个用于验证快捷命令描述换行展示的长文本', 12).length).toBeGreaterThan(1);
  });
});
