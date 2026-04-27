import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// 模板仓库表
export const repositories = sqliteTable("repositories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  url: text("url").notNull(),
  type: text("type", { enum: ["git", "local", "remote"] }).default("git"),
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .notNull(),
});

// 模板表
export const templates = sqliteTable("templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  repositoryId: integer("repository_id")
    .references(() => repositories.id)
    .notNull(),
  repositryName: text("repositry_name").notNull(),
  path: text("path").notNull(), // 模板在仓库中的相对路径
  description: text("description"),
  tags: text("tags", { mode: "json" }).$type<string[]>(),
  metadata: text("metadata", { mode: "json" }).$type<Record<string, any>>(),
  configs: text("configs", { mode: "json" }).$type<Record<string, any>[]>(),
  variables: text("variables", { mode: "json" }).$type<Record<string, any>[]>(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .notNull(),
});

// 项目生成记录表
export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  templateId: integer("template_id")
    .references(() => templates.id)
    .notNull(),
  outputPath: text("output_path").notNull(),
  variables: text("variables", { mode: "json" }).$type<Record<string, any>>(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .notNull(),
});

// 用户配置表
export const configs = sqliteTable("configs", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).$type<any>(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .notNull(),
});

// 审计日志表（可选）
export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  action: text("action").notNull(), // create, update, delete, etc.
  tableName: text("table_name").notNull(),
  recordId: integer("record_id"),
  oldData: text("old_data", { mode: "json" }).$type<any>(),
  newData: text("new_data", { mode: "json" }).$type<any>(),
  userId: text("user_id"), // 如果有用户系统
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .notNull(),
});
