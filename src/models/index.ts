// 从数据库schema导出类型
export type {
  NewRepository,
  Repository,
  NewTemplate,
  Template,
  NewProject,
  Project,
  NewConfig,
  Config,
  NewAuditLog,
  AuditLog,
} from '../db/index.js';

// 常用查询和工具函数可以在这里定义
// 例如：模板搜索、仓库管理等