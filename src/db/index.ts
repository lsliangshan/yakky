import { drizzle } from "drizzle-orm/better-sqlite3";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dataPath } from "../utils/paths.js";
import * as schema from "./schema.js";

const dbPath = dataPath("yakky.db");
const sqlite = new Database(dbPath);

// 创建数据库客户端
export const db = drizzle(sqlite, { schema });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "migrations");

const nameSymbol = Symbol.for("drizzle:Name");
const isTableSymbol = Symbol.for("drizzle:IsDrizzleTable");
const fkSymbol = Symbol.for("drizzle:SQLiteInlineForeignKeys");

const typeMap: Record<string, string> = {
  SQLiteInteger: "INTEGER",
  SQLiteTimestamp: "INTEGER",
  SQLiteText: "TEXT",
  SQLiteTextJson: "TEXT",
  SQLiteReal: "REAL",
};

function formatDefault(col: any): string {
  // SQL expression default (e.g. sql`(unixepoch())`)
  if (col.default?.queryChunks) {
    return col.default.queryChunks
      .map((chunk: any) => (chunk.value ? chunk.value.join("") : String(chunk)))
      .join("");
  }
  // Literal string
  if (typeof col.default === "string") {
    return `'${col.default.replace(/'/g, "''")}'`;
  }
  // Literal number or boolean
  if (typeof col.default === "number" || typeof col.default === "boolean") {
    return String(col.default);
  }
  // Object / array (JSON)
  return `'${JSON.stringify(col.default).replace(/'/g, "''")}'`;
}

// 从 schema.ts 动态生成 CREATE TABLE，按依赖拓扑排序
function ensureTables(): void {
  const tables = Object.values(schema).filter(
    (v) => (v as any)?.[isTableSymbol] === true,
  );

  // 构建依赖图
  const depMap = new Map<string, Set<string>>();
  const tableMap = new Map<string, any>();

  for (const table of tables) {
    const t = table as any;
    const name: string = t[nameSymbol];
    tableMap.set(name, table);
    depMap.set(name, new Set());

    for (const fk of t[fkSymbol] || []) {
      const refName: string = fk.reference().foreignTable[nameSymbol];
      if (refName && refName !== name) {
        depMap.get(name)!.add(refName);
      }
    }
  }

  // 拓扑排序
  const sorted: string[] = [];
  const visited = new Set<string>();
  const visit = (n: string) => {
    if (visited.has(n)) return;
    visited.add(n);
    for (const dep of depMap.get(n) || []) visit(dep);
    sorted.push(n);
  };
  for (const n of depMap.keys()) visit(n);

  // 按序建表
  for (const tableName of sorted) {
    const table = tableMap.get(tableName)!;
    const config = getTableConfig(table);
    const columnDefs: string[] = [];

    for (const col of config.columns) {
      const c = col as any;
      let def = `"${c.name}" ${typeMap[c.columnType] || "TEXT"}`;

      if (c.primary && c.autoIncrement) {
        def += " PRIMARY KEY AUTOINCREMENT";
      } else if (c.primary) {
        def += " PRIMARY KEY";
      }

      if (c.notNull) def += " NOT NULL";
      if (c.isUnique) def += " UNIQUE";

      if (c.hasDefault && c.default !== undefined) {
        def += " DEFAULT " + formatDefault(c);
      }

      columnDefs.push(def);
    }

    // 外键约束
    const t = table as any;
    for (const fk of t[fkSymbol] || []) {
      const ref = fk.reference();
      if (ref.columns.length > 0) {
        const local: string = ref.columns[0].name;
        const refTbl: string = ref.foreignTable[nameSymbol];
        const refCol: string = ref.foreignColumns[0].name;
        columnDefs.push(
          `FOREIGN KEY ("${local}") REFERENCES "${refTbl}"("${refCol}")`,
        );
      }
    }

    sqlite.exec(
      `CREATE TABLE IF NOT EXISTS "${tableName}" (\n  ${columnDefs.join(",\n  ")}\n);`,
    );
  }
}

// 数据库初始化函数
export async function initializeDatabase(): Promise<typeof db> {
  ensureTables();
  applyMigrations();
  return db;
}

function applyMigrations(): void {
  // 创建迁移记录表（用于追踪已执行的迁移）
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      migration TEXT NOT NULL UNIQUE,
      applied_at INTEGER DEFAULT (unixepoch())
    )
  `);

  const journalPath = path.join(migrationsDir, "meta", "_journal.json");
  if (!fs.existsSync(journalPath)) {
    return;
  }

  const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));

  // 查询已执行的迁移
  const applied = new Set(
    sqlite
      .prepare("SELECT migration FROM __drizzle_migrations")
      .all()
      .map((row: any) => row.migration),
  );

  for (const entry of journal.entries) {
    const tag = entry.tag;
    if (applied.has(tag)) continue;

    const migrationFile = path.join(migrationsDir, `${tag}.sql`);
    if (!fs.existsSync(migrationFile)) {
      continue;
    }

    const sql = fs.readFileSync(migrationFile, "utf-8");
    const statements = sql.split("--> statement-breakpoint");

    // 在一个事务中执行所有语句
    const apply = sqlite.transaction(() => {
      for (const stmt of statements) {
        const trimmed = stmt.trim();
        if (trimmed) {
          sqlite.exec(trimmed);
        }
      }
      sqlite
        .prepare("INSERT INTO __drizzle_migrations (migration) VALUES (?)")
        .run(tag);
    });

    apply();
  }
}

// 导出类型
export type Database = typeof db;
export type NewRepository = typeof schema.repositories.$inferInsert;
export type Repository = typeof schema.repositories.$inferSelect;
export type NewTemplate = typeof schema.templates.$inferInsert;
export type Template = typeof schema.templates.$inferSelect;
export type NewProject = typeof schema.projects.$inferInsert;
export type Project = typeof schema.projects.$inferSelect;
export type NewConfig = typeof schema.configs.$inferInsert;
export type Config = typeof schema.configs.$inferSelect;
export type NewAuditLog = typeof schema.auditLogs.$inferInsert;
export type AuditLog = typeof schema.auditLogs.$inferSelect;
