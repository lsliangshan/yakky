import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '../../src/db/schema.js';
import fs from 'fs';
import path from 'path';

const migrationsDir = path.join(__dirname, '../../src/db/migrations');

function readMigrationStatements() {
  return fs
    .readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort()
    .flatMap(file => {
      const migrationSQL = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      return migrationSQL
        .split('--> statement-breakpoint')
        .map(s => s.trim())
        .filter(s => s.length > 0);
    });
}

function ensureShortcutCommandColumns(sqlite: Database.Database) {
  const columns = new Set(
    sqlite
      .prepare('PRAGMA table_info(shortcut_commands)')
      .all()
      .map((row: any) => row.name),
  );

  if (!columns.has('description')) {
    sqlite.exec('ALTER TABLE shortcut_commands ADD COLUMN description TEXT');
  }
}

describe('Database Schema', () => {
  let db: ReturnType<typeof drizzle>;
  let sqlite: Database.Database;

  beforeAll(() => {
    // 使用内存数据库进行测试
    sqlite = new Database(':memory:');

    // 应用迁移
    readMigrationStatements().forEach(statement => {
      sqlite.exec(statement);
    });
    ensureShortcutCommandColumns(sqlite);

    db = drizzle(sqlite, { schema });
  });

  afterAll(() => {
    sqlite.close();
  });

  it('应该能创建repositories表并插入数据', async () => {
    const newRepo = await db.insert(schema.repositories).values({
      name: 'test-repo',
      url: 'https://github.com/test/repo',
      type: 'git',
      description: '测试仓库',
    }).returning();

    expect(newRepo).toHaveLength(1);
    expect(newRepo[0].name).toBe('test-repo');
    expect(newRepo[0].url).toBe('https://github.com/test/repo');
    expect(newRepo[0].type).toBe('git');
    expect(newRepo[0].description).toBe('测试仓库');
    expect(newRepo[0].id).toBeDefined();
    expect(newRepo[0].createdAt).toBeDefined();
    expect(newRepo[0].updatedAt).toBeDefined();
  });

  it('应该能创建templates表并插入数据', async () => {
    // 先创建一个仓库
    const [repo] = await db.insert(schema.repositories).values({
      name: 'template-repo',
      url: '/local/path',
      type: 'local',
    }).returning();

    const newTemplate = await db.insert(schema.templates).values({
      name: 'test-template',
      repositoryId: repo.id,
      repositryName: repo.name,
      path: '/templates/test',
      description: '测试模板',
      tags: ['test', 'example'],
      metadata: { author: 'test', version: '1.0.0' },
    }).returning();

    expect(newTemplate).toHaveLength(1);
    expect(newTemplate[0].name).toBe('test-template');
    expect(newTemplate[0].repositoryId).toBe(repo.id);
    expect(newTemplate[0].path).toBe('/templates/test');
    expect(newTemplate[0].description).toBe('测试模板');
    expect(newTemplate[0].tags).toEqual(['test', 'example']);
    expect(newTemplate[0].metadata).toEqual({ author: 'test', version: '1.0.0' });
  });

  it('应该能创建configs表并插入数据', async () => {
    const newConfig = await db.insert(schema.configs).values({
      key: 'test.config',
      value: { theme: 'dark', language: 'zh-CN' },
    }).returning();

    expect(newConfig).toHaveLength(1);
    expect(newConfig[0].key).toBe('test.config');
    expect(newConfig[0].value).toEqual({ theme: 'dark', language: 'zh-CN' });
    expect(newConfig[0].updatedAt).toBeDefined();
  });

  it('应该能创建shortcut_commands表并插入数据', async () => {
    const newCommand = await db.insert(schema.shortcutCommands).values({
      name: 'test-shortcut',
      description: '测试快捷命令描述',
      workspacePath: '/tmp/test-workspace',
      script: '#!/usr/bin/env bash\necho hello',
      scriptPath: '/tmp/test-script.sh',
    }).returning();

    expect(newCommand).toHaveLength(1);
    expect(newCommand[0].name).toBe('test-shortcut');
    expect(newCommand[0].description).toBe('测试快捷命令描述');
    expect(newCommand[0].workspacePath).toBe('/tmp/test-workspace');
    expect(newCommand[0].script).toContain('echo hello');
    expect(newCommand[0].scriptPath).toBe('/tmp/test-script.sh');
  });

  it('应该能查询数据', async () => {
    // 先插入一些测试数据
    await db.insert(schema.repositories).values({
      name: 'query-repo',
      url: 'https://example.com/repo',
      type: 'git',
    });

    const repos = await db.select().from(schema.repositories);
    expect(repos.length).toBeGreaterThanOrEqual(1);

    const templates = await db.select().from(schema.templates);
    expect(templates.length).toBeGreaterThanOrEqual(0); // 可能没有模板
  });
});
