import { describe, expect, it } from 'vitest';
import {
  isShortcutCommandScopeConflict,
  validateShortcutCommandName,
} from '../../src/commands/add-command/index.js';

describe('add command scope conflict', () => {
  it('全系统快捷命令会阻止同名工作区快捷命令', () => {
    expect(isShortcutCommandScopeConflict(null, '/path1/path2')).toBe(true);
  });

  it('同一路径内同名快捷命令会冲突', () => {
    expect(isShortcutCommandScopeConflict('/path1/path2', '/path1/path2')).toBe(true);
  });

  it('已有工作区快捷命令会阻止同名全系统快捷命令', () => {
    expect(isShortcutCommandScopeConflict('/path1/path2', null)).toBe(true);
  });

  it('父路径已有同名快捷命令时子路径可以继续添加', () => {
    expect(isShortcutCommandScopeConflict('/path1', '/path1/path2')).toBe(false);
  });

  it('子路径已有同名快捷命令时父路径可以继续添加', () => {
    expect(isShortcutCommandScopeConflict('/path1/path2', '/path1')).toBe(false);
  });
});

describe('add command name validation', () => {
  it.each(['测试', '测试-1', 'test_1', 'Test-命令_2'])(
    '允许合法快捷命令名称 %s',
    (name) => {
      expect(validateShortcutCommandName(name)).toBe(true);
    },
  );

  it.each(['', ' test', 'test ', 'test cmd', 'test\ncmd', '1test', '-test', '_test', 'test.cmd'])(
    '拒绝非法快捷命令名称 %s',
    (name) => {
      expect(validateShortcutCommandName(name)).not.toBe(true);
    },
  );
});
