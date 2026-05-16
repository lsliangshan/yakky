import { describe, expect, it } from 'vitest';
import { isEditCommandScopeConflict } from '../../src/commands/edit-command/index.js';

describe('edit command duplicate rule', () => {
  it('修改当前记录时不与自己冲突', () => {
    expect(
      isEditCommandScopeConflict(
        { id: 1, workspacePath: '/work/app' },
        1,
        '/work/app',
      ),
    ).toBe(false);
  });

  it('修改为其他记录的同名同范围时冲突', () => {
    expect(
      isEditCommandScopeConflict(
        { id: 2, workspacePath: '/work/app' },
        1,
        '/work/app',
      ),
    ).toBe(true);
  });

  it('沿用添加命令的全系统冲突规则', () => {
    expect(
      isEditCommandScopeConflict(
        { id: 2, workspacePath: null },
        1,
        '/work/app',
      ),
    ).toBe(true);
  });
});
