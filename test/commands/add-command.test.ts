import { describe, expect, it } from 'vitest';
import {
  buildEditorCommand,
  getLastEmptyLineNumber,
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

describe('add command editor cursor', () => {
  it('定位到初始化脚本的最后一个空行', () => {
    expect(getLastEmptyLineNumber('#!/usr/bin/env bash\n\n')).toBe(2);
  });

  it('为 vi 编辑器添加行号参数', () => {
    expect(buildEditorCommand('vi', '/tmp/script.sh', 2)).toBe("vi +2 '/tmp/script.sh'");
  });

  it('保留编辑器已有参数并添加跳转位置', () => {
    expect(buildEditorCommand('code --wait', '/tmp/script.sh', 2)).toBe(
      "code --wait --goto '/tmp/script.sh:2:1'",
    );
  });

  it('无法识别编辑器时保持原打开方式', () => {
    expect(buildEditorCommand('custom-editor', '/tmp/script.sh', 2)).toBe(
      "custom-editor '/tmp/script.sh'",
    );
  });
});
