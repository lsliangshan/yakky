import { describe, expect, it } from 'vitest';
import { formatBetterSqliteInstallError } from '../../src/db/index.js';

describe('better-sqlite3 install error formatting', () => {
  it('把原生 binding 缺失错误转换成可执行的安装提示', () => {
    const formatted = formatBetterSqliteInstallError(
      new Error('Could not locate the bindings file. Tried: better_sqlite3.node'),
    );

    expect(formatted.message).toContain('better-sqlite3 原生模块未构建成功');
    expect(formatted.message).toContain('pnpm rebuild -g better-sqlite3');
    expect(formatted.message).toContain('pnpm add -g --allow-build=better-sqlite3 yakky');
  });

  it('保留非 binding 缺失错误', () => {
    const error = new Error('database is locked');

    expect(formatBetterSqliteInstallError(error)).toBe(error);
  });
});
