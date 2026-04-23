import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { dataPath } from "../utils/paths.js";
import * as schema from "./schema.js";

const dbPath = dataPath("yakky.db");
const sqlite = new Database(dbPath);

// 创建数据库客户端
export const db = drizzle(sqlite, { schema });

// 数据库初始化函数
export async function initializeDatabase(): Promise<typeof db> {
  // 确保数据库文件存在并应用迁移
  // 实际迁移逻辑由drizzle-kit管理，这里可以添加迁移检查逻辑
  // console.log(`Database initialized at: ${dbPath}`);
  return db;
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
