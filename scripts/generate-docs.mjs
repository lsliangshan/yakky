#!/usr/bin/env node

/**
 * yakky CLI 文档生成器
 *
 * 工作方式：
 * 1. 扫描 src/libs/*.ts 解析 commander 命令结构（名称、别名、选项、描述）
 * 2. 按命令路径索引详细文档内容（见 COMMAND_DETAILS）
 * 3. 输出 docs/yakky-documents.md
 *
 * 新增命令时只需更新 COMMAND_DETAILS 中的对应文档即可。
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// ============================================================
// 1. 命令结构定义
// ============================================================

/**
 * @typedef {Object} CommandOption
 * @property {string} flags
 * @property {string} description
 *
 * @typedef {Object} CommandNode
 * @property {string} name
 * @property {string[]} aliases
 * @property {string} description
 * @property {string} usage
 * @property {CommandOption[]} options
 * @property {CommandNode[]} subcommands
 * @property {"group"|"leaf"} type
 */

/**
 * 解析 lib 文件中的 commander 命令链
 * @param {string} content
 * @returns {CommandNode[]}
 */
function parseCommands(content) {
  const commands = [];

  // 定位所有 program.command() 调用（仅顶层命令）
  const commandPattern = /program\s*\.\s*command\(['"]([^'"]+)['"]\)/g;
  const matches = [];
  let m;
  while ((m = commandPattern.exec(content)) !== null) {
    matches.push({ name: m[1], index: m.index });
  }

  for (let i = 0; i < matches.length; i++) {
    const cmd = { name: matches[i].name, aliases: [], description: "", usage: "", options: [], subcommands: [] };

    // 从 .command() 后面开始，截取到下一个 .command() 或文件末尾
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : content.length;

    // 找到离 .command() 最近的 action 作为结束边界
    const blockEnd = Math.min(
      end,
      (() => {
        const actionIdx = content.indexOf(".action(", start);
        return actionIdx !== -1 && actionIdx < end ? actionIdx + 200 : end;
      })(),
    );

    const block = content.slice(start, blockEnd);

    // 提取 alias
    const aliasRegex = /\.alias\(['"]([^'"]+)['"]\)/g;
    while ((m = aliasRegex.exec(block)) !== null) {
      cmd.aliases.push(m[1]);
    }

    // 提取 description
    const descMatch = block.match(/\.description\(['"]([^'"]+)['"]\)/);
    if (descMatch) cmd.description = descMatch[1];

    // 提取 usage
    const usageMatch = block.match(/\.usage\(['"]([^'"]+)['"]\)/);
    if (usageMatch) cmd.usage = usageMatch[1];

    // 提取 option
    // 模式 1: .option("-f, --flag <val>", "desc")
    const optionRegex = /\.option\(['"]([^'"]+)['"],\s*['"]([^'"]+)['"]\)/g;
    while ((m = optionRegex.exec(block)) !== null) {
      cmd.options.push({ flags: m[1], description: m[2] });
    }
    // 模式 2: .option("-f, --flag <val>", `desc`)（简单模板字符串，不含 ${}）
    const optionBacktickRegex = /\.option\(['"]([^'"]+)['"],\s*`([^`$]+)`\)/g;
    while ((m = optionBacktickRegex.exec(block)) !== null) {
      cmd.options.push({ flags: m[1], description: m[2] });
    }

    // 判断是否是 group 命令（注册了子命令）还是 leaf 命令
    // group 命令通常在变量上注册子命令，或者有 .action() 但主要是展示帮助
    cmd.type = i > 0 ? "leaf" : "group"; // heuristic, refined later

    commands.push(cmd);
  }

  // 如果只有一个子命令，推断出父子关系：根命令视为 group，其余视为 leaf
  // 更精确的判断：如果命令名是复数且是所有列表类，则检查是否有子命令详情
  // 我们直接从代码结构推断：.command()链如果后面还有.addCommand等，或另一个.command()

  // 更简单的推断：相邻的 .command() 链如果有各自完整的 .action()，则都是独立的 root 级命令
  // 在 yakky 的结构中，lib 文件中的每个 .command()/subcommand 都后缀 .action()
  // 所以我们把每个独立注册的命令当作 root 级命令

  return commands;
}

/**
 * 读取 src/libs/*.ts 并返回所有 CommandNode
 */
function discoverCommands() {
  const libsDir = path.join(root, "src", "libs");
  const files = fs.readdirSync(libsDir).filter((f) => f.endsWith(".ts") || f.endsWith(".js"));

  /** @type {CommandNode[]} */
  const topLevelCommands = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(libsDir, file), "utf-8");
    const cmds = parseCommands(content);
    topLevelCommands.push(...cmds);
  }

  // 读取子命令注册（从 lib 文件中识别子命令结构）
  // 在 yakky 中，子命令是以 repositryCmd.command("add") 的形式注册的
  for (const file of files) {
    const content = fs.readFileSync(path.join(libsDir, file), "utf-8");
    const contentStr = content;

    // 找到变量声明：const xxxCmd = program.command(...)...
    // 及其后面的子命令注册
    const varDeclRegex = /const\s+(\w+Cmd)\s*=\s*program/g;
    let vdMatch;
    while ((vdMatch = varDeclRegex.exec(contentStr)) !== null) {
      const varName = vdMatch[1];
      const varStart = vdMatch.index;

      // 找这个变量的子命令注册：varName.command("name")
      const subCmdPattern = new RegExp(
        varName.replace(/([.*+?^${}()|[\]\\])/g, "\\$1") + `\\s*\\.command\\(['"]([^'"]+)['"]\\)`,
        "g",
      );
      const subMatches = [];
      let sm;
      while ((sm = subCmdPattern.exec(contentStr)) !== null) {
        subMatches.push({ name: sm[1], index: sm.index });
      }

      if (subMatches.length === 0) continue;

      // 找到对应的父命令
      const parentNameMatch = contentStr.slice(varStart, varStart + 200).match(/\.command\(['"]([^'"]+)['"]\)/);
      if (!parentNameMatch) continue;
      const parentName = parentNameMatch[1];

      const parent = topLevelCommands.find(
        (c) => c.name === parentName || c.aliases.includes(parentName),
      );
      if (!parent) continue;

      parent.type = "group";

      for (let i = 0; i < subMatches.length; i++) {
        /** @type {CommandNode} */
        const sub = { name: subMatches[i].name, aliases: [], description: "", usage: "", options: [], subcommands: [], type: "leaf" };

        const start = subMatches[i].index;
        const end = i + 1 < subMatches.length ? subMatches[i + 1].index : contentStr.length;
        const blockEnd = Math.min(
          end,
          (() => {
            const actionIdx = contentStr.indexOf(".action(", start);
            return actionIdx !== -1 && actionIdx < end ? actionIdx + 200 : end;
          })(),
        );
        const block = contentStr.slice(start, blockEnd);

        const aliasRegex = /\.alias\(['"]([^'"]+)['"]\)/g;
        let am;
        while ((am = aliasRegex.exec(block)) !== null) sub.aliases.push(am[1]);

        const descMatch = block.match(/\.description\(['"]([^'"]+)['"]\)/);
        if (descMatch) sub.description = descMatch[1];

        const usageMatch = block.match(/\.usage\(['"]([^'"]+)['"]\)/);
        if (usageMatch) sub.usage = usageMatch[1];

        const subOptionRegex = /\.option\(['"]([^'"]+)['"],\s*['"]([^'"]+)['"]\)/g;
        let om1;
        while ((om1 = subOptionRegex.exec(block)) !== null) {
          sub.options.push({ flags: om1[1], description: om1[2] });
        }
        const subOptionBtRegex = /\.option\(['"]([^'"]+)['"],\s*`([^`$]+)`\)/g;
        let om2;
        while ((om2 = subOptionBtRegex.exec(block)) !== null) {
          sub.options.push({ flags: om2[1], description: om2[2] });
        }

        parent.subcommands.push(sub);
      }
    }
  }

  // 后处理：所有没有子命令的标记为 leaf
  for (const cmd of topLevelCommands) {
    if (cmd.subcommands.length === 0) cmd.type = "leaf";
  }

  // 读取官方仓库信息
  const officialRepos = readOfficialRepos();

  return { commands: topLevelCommands, officialRepos };
}

/**
 * 从 src/common/config.ts 读取官方仓库列表
 */
function readOfficialRepos() {
  const configPath = path.join(root, "src", "common", "config.ts");
  if (!fs.existsSync(configPath)) return [{ name: "yakky", url: "https://gitlab.dev.zhaopin.com/camx/yakky-template" }];

  const content = fs.readFileSync(configPath, "utf-8");
  const defaultRepos = [{ name: "yakky", url: "https://gitlab.dev.zhaopin.com/camx/yakky-template" }];

  try {
    // 匹配 officialRepositories 数组中的 { name, url } 条目
    const repos = [];
    const repoRegex = /\{\s*name\s*:\s*['"]([^'"]+)['"]\s*,\s*url\s*:\s*['"]([^'"]+)['"]\s*\}/g;
    let m;
    while ((m = repoRegex.exec(content)) !== null) {
      repos.push({ name: m[1], url: m[2] });
    }
    return repos.length > 0 ? repos : defaultRepos;
  } catch {
    return defaultRepos;
  }
}

// ============================================================
// 2. 详细文档内容索引
// ============================================================

/**
 * 按命令路径索引的详细文档。
 * 结构：{ "命令路径": "markdown 内容" }
 * 命令路径如 "create"、"repo/remove"、"sample-file"
 * 核心文档逻辑在此维护，命令结构（名称/别名/选项）由解析器动态生成。
 */
const COMMAND_DETAILS = {
  // ── repo ────────────────────────────────────────────────
  "repo": {
    prose: `
管理模板仓库的添加、删除、查看和同步。
`,
  },
  "repo/list": {
    prose: `
以列表形式展示所有仓库的名称和 URL，按创建时间倒序排列。自动检查并确保官方仓库存在。
`,
    extra: `
**输出示例：**

\`\`\`
yakky --------------- https://gitlab.dev.zhaopin.com/camx/yakky-template
\`\`\`
`,
  },
  "repo/add": {
    prose: `
添加一个新的模板仓库。

**操作流程：**

1. 如果未提供 \`-n\` 或 \`-u\`，交互式提示输入仓库名称和 URL（名称重复将被拒绝）
2. 克隆远程 Git 仓库或复制本地目录到临时目录
3. 将仓库中的 \`templates\` 目录复制到本地模板存储目录
4. 将仓库信息写入数据库
5. 同步模板数据到数据库（解析每个模板的 \`roadmap.json\`）

**地址格式支持：**

| 类型 | 说明 |
|------|------|
| Git 远程仓库 | \`https://...\` 或 \`git@...\`（使用 \`git clone --depth 1\` 拉取） |
| 本地路径 | 直接复制目录（如 \`/Users/xxx/my-templates\`） |

**注意事项：**

- 仓库 URL 以 \`http\` 或 \`git@\` 开头时视为 Git 仓库，否则视为本地路径
- 如果远端仓库没有 \`templates\` 目录，会创建空目录并给出警告
- 添加失败时会自动清理已创建的目录
`,
  },
  "repo/remove": {
    prose: `
删除一个模板仓库。

**操作流程：**

1. 如果未提供 \`-n\`，交互式从列表中选择要删除的仓库
2. 检查仓库是否存在
3. 检查是否为官方仓库（官方仓库禁止删除）
4. 确认删除操作
5. 删除数据库中该仓库下的所有模板记录
6. 删除本地模板文件目录
7. 删除数据库中的仓库记录

> ⚠️ **官方仓库不可删除**，尝试删除会提示错误。删除操作不可撤销。
`,
  },
  "repo/sync": {
    prose: `
从远端同步指定模板仓库的最新模板。

**操作流程：**

1. 如果未提供 \`-n\`，交互式从列表中选择要同步的仓库
2. 拉取远端仓库最新代码到临时目录
3. 删除旧的本地模板目录
4. 复制最新的 \`templates\` 文件
5. 同步模板数据到数据库（重新解析 \`roadmap.json\`）
6. 更新仓库的 \`updatedAt\` 时间戳

> 如果远端仓库没有 \`templates\` 目录，会创建空目录。
`,
  },
  "repo/sync-all": {
    prose: `
同步所有模板仓库。

**操作流程：**

1. 自动确保官方仓库存在
2. 遍历数据库中的所有仓库，依次执行同步操作
3. 输出同步结果统计（成功数 / 失败数）

> 某个仓库同步失败不影响其他仓库的同步。
`,
  },
  "repo/init": {
    prose: `
初始化一个模板仓库项目结构，用于创建和管理自定义模板。

该命令会在指定目录下创建完整的模板仓库脚手架，包含目录结构、示例模板文件和 \`roadmap.json\` 配置文件。创建完成后可使用 \`yakky repo add\` 将其添加到本地。
`,
    extra: `
**操作流程：**

1. 如果未提供 \`-d\` 或 \`-n\`，交互式输入目录名称和模板名称
2. 检查输出目录是否存在（已存在时询问是否覆盖）
3. 创建模板仓库目录结构
4. 生成示例模板文件（含占位符）和 \`roadmap.json\`

**生成的目录结构：**

\`\`\`
<dir>/
  templates/
    <template-name>/
      template/
        \$NAME\$.ts            # 变量占位符演示
        \$NAME\$.config.ts     # 配置项占位符演示（\$\$language\$\$）
        README.md             # 综合占位符演示
      roadmap.json
\`\`\`

**生成的 roadmap.json 示例：**

\`\`\`json
{
  "name": "my-template",
  "description": "模板描述",
  "tags": ["demo"],
  "configs": [
    {
      "name": "language",
      "type": "select",
      "message": "请选择语言",
      "choices": [
        { "name": "JavaScript", "value": "js" },
        { "name": "TypeScript", "value": "ts" }
      ],
      "default": "js"
    }
  ],
  "variables": [
    { "value": "name", "template": "\$NAME\$", "message": "项目名称" }
  ]
}
\`\`\`

**生成的示例模板文件说明：**

| 文件 | 演示内容 |
|------|----------|
| \`\$NAME\$.ts\` | 变量占位符 \`\$NAME\$\`、\`\$VERSION\$\` 替换 |
| \`\$NAME\$.config.ts\` | 配置项占位符 \`\$\$language\$\$\`、\`\$\$method\$\$\` 替换 |
| \`README.md\` | 变量和配置项占位符综合替换 |

**后续步骤：**

1. 编辑 \`roadmap.json\` 定义模板的配置项和变量
2. 在 \`template/\` 目录下添加或修改模板文件
3. 将仓库推送到 Git 远程仓库
4. 使用 \`yakky repo add -n <名称> -u <地址>\` 添加仓库到本地
`,
  },

  // ── template ──────────────────────────────────────────
  "template": {
    prose: `
查看和管理已同步的模板。
`,
  },
  "template/list": {
    prose: `
以表格形式展示所有模板的 ID、名称、所属仓库、描述和标签，默认按创建时间倒序排列。中文字符按双字符宽度对齐。
`,
    extra: `
**输出示例：**

| ID | 名称 | 仓库 | 描述 | 标签 |
|----|------|------|------|------|
| 1 | my-template | yakky | 这是一个模板 | tag1, tag2 |
`,
  },
  "template/info": {
    prose: `
查看模板的详细信息，包括：

- 基本信息：ID、名称、所属仓库、描述、标签
- **配置项（configs）：** 配置名称、类型（select / input / multiselect 等）、提示信息、可选值列表
- **变量（variables）：** 变量名、占位符、说明
- **元数据（metadata）：** 自定义键值对
- **时间信息：** 创建时间和更新时间
`,
  },

  // ── create ────────────────────────────────────────────
  "create": {
    prose: `
从模板创建新的项目文件。支持交互式和配置文件两种模式。

> 提示：可用 \`yakky sample-file\` 生成模板示例配置文件用于 \`-f\` 模式。
`,
    extra: `
---

### 交互模式

不提供 \`-f\` 选项时进入交互模式。

**Step 1 — 选择仓库**

列出所有已添加的仓库供用户选择。如果没有仓库，提示用户先添加仓库。如果提供了 \`-r\` 选项则跳过此步。

\`\`\`bash
yakky create -r my-repo -t my-template
\`\`\`

**Step 2 — 选择模板**

根据所选仓库列出该仓库下的所有模板供用户选择。如果提供了 \`-t\` 选项则跳过此步。

**Step 3 — 配置配置项（configs）**

根据模板 \`roadmap.json\` 中定义的 \`configs\` 数组，依次提示用户输入。每个配置项支持以下 Enquirer 类型：

| 类型 | 说明 | 适用场景 |
|------|------|----------|
| \`input\` | 文本输入 | 自定义文本 |
| \`select\` | 单选 | 从列表中选择一项 |
| \`multiselect\` | 多选 | 从列表中选择多项 |
| \`autocomplete\` | 自动补全 | 从列表中搜索选择 |
| \`confirm\` | 确认（是/否） | 布尔值 |
| \`toggle\` | 开关 | 开/关切换 |
| \`form\` | 表单 | 多个字段组合输入 |
| \`password\` | 密码输入 | 隐藏输入内容 |
| \`numeral\` | 数字输入 | 数值 |
| \`sort\` | 排序 | 对选项排序 |

当配置项包含 \`choices\` 时，每个选项可以包含以下字段：

\`\`\`json
{ "name": "显示名称", "value": "实际存储值", "message": "显示信息" }
\`\`\`

- \`name\` / \`value\` / 选项本身用作显示标签
- \`value\` 会作为实际存储值（fallback 到 \`name\`，再 fallback 到选项本身）
- 多选模式下，返回所有选中项的 \`value\` 数组

配置项的选择值会按顺序拼接成子路径，用于定位模板源目录：

\`\`\`
模板路径 / config[0]值 / config[1]值 / template
\`\`\`

例如配置项 \`language\` 选择了 \`js\`，\`method\` 选择了 \`sfc\`，则源目录为 \`/path/to/templates/my-template/js/sfc/template/\`。

**Step 4 — 填写变量（variables）**

根据模板 \`roadmap.json\` 中定义的 \`variables\` 数组，依次提示用户输入每个变量的值。

- 变量名（\`value\` 字段）用于标识变量
- 占位符（\`template\` 字段）用于文件内容替换
- 支持 \`default\` 默认值

**Step 5 — 确认信息**

展示所有配置和变量值，让用户确认：

\`\`\`
模板: my-template
仓库: my-repo
输出: my-output-dir
配置: {"language": "js", "method": "sfc"}
变量: {"name": "my-app"}
确认以上信息并创建? (Y/n)
\`\`\`

**Step 6 — 处理冲突**

如果输出目录已存在，提供 忽略 / 覆盖 / 重命名 选项（详见[冲突处理](#冲突处理)章节）。

**Step 7 — 生成文件**

复制模板文件到输出目录，并进行占位符替换：

- 文件名中的 \`$NAME$\` → \`my-app\`（如 \`$NAME$.ts\` → \`my-app.ts\`）
- 文件内容中的变量占位符使用 \`$变量名$\` 格式
- 文件内容中的配置项占位符使用 \`$$配置项名称$$\` 格式

---

### 文件模式（\`-f\`）

通过 JSON 文件配置批量创建，适用于自动化场景。

\`\`\`bash
yakky create -f ./config.json
\`\`\`

**文件验证规则：**

- 仅支持 \`.json\` 文件格式，其他扩展名将报错
- 文件内容必须是合法的 JSON 语法
- 可以是 object（单个创建）或 array（批量创建）
- 每个配置项必须包含 \`repositry\`、\`template\` 字段

**字段说明：**

| 字段 | 是否必填 | 说明 |
|------|----------|------|
| \`repositry\` | 是 | 仓库名称，用于查找模板 |
| \`template\` | 是 | 模板名称，与仓库组合唯一确定一个模板 |
| \`configs\` | 否 | 配置项字典，key 对应模板定义中 configs 的 \`name\` 字段 |
| \`variables\` | 否 | 变量字典，key 对应模板定义中 variables 的 \`value\` 字段 |

**configs 匹配规则：** key 必须与 \`roadmap.json\` 中 \`configs[].name\` 完全匹配。

**variables 匹配规则：** key 必须与 \`roadmap.json\` 中 \`variables[].value\` 完全匹配。

**批量创建（array 格式）：**

每个项目独立处理，一个失败不影响其他项目。多个输出目录冲突时会依次弹出提示。

\`\`\`json
[
  {
    "repositry": "my-repo",
    "template": "my-template",
    "configs": { "language": "js" },
    "variables": { "name": "project-a" }
  },
  {
    "repositry": "my-repo",
    "template": "my-template",
    "configs": { "language": "ts" },
    "variables": { "name": "project-b" }
  }
]
\`\`\`
`,
  },

  // ── sample-file ───────────────────────────────────────
  "sample-file": {
    prose: `
生成用于 \`yakky create -f\` 的示例 JSON 配置文件，方便用户了解 JSON 文件格式。
`,
    extra: `
### 操作流程

**Step 1 — 选择仓库：** 从所有已添加的仓库中选择（未提供 \`-r\` 时交互选择）。

**Step 2 — 选择模板：** 从选定仓库下的模板列表中选择（未提供 \`-t\` 时交互选择）。

**Step 3 — 选择输出格式：**

| 格式 | 说明 |
|------|------|
| object | 生成单个创建的 JSON 对象 |
| array | 生成批量创建的 JSON 数组 |

**Step 4 — 设置数量（仅批量模式）：** 输入要生成的示例数量，默认 2 个。

**Step 5 — 输出文件：** 输入文件名保存生成的 JSON 文件。

### 示例内容生成规则

**配置项（configs）的示例值：**

| config 类型 | 生成的示例值 |
|------------|-------------|
| \`select\` / \`autocomplete\` | 用 " 或 " 连接所有可选值，如 \`"js 或 ts"\` |
| \`multiselect\` | 数组包裹所有可选值，如 \`["js", "ts"]\` |
| 其他类型 | 使用 \`default\` 值或空字符串 |

**变量（variables）的示例值：**

| 条件 | 生成的示例值 |
|------|-------------|
| 有 \`default\` 值 | 使用默认值 |
| \`value\` 为 \`"name"\` | 批量模式下生成 \`my-模板名-1\`、\`my-模板名-2\` |
| 其他情况 | 使用 \`[message]\` 作为占位符提示 |

### 输出示例

\`\`\`json
{
  "repositry": "yakky",
  "template": "my-template",
  "configs": {
    "language": "js 或 ts",
    "method": "sfc 或 class"
  },
  "variables": {
    "name": "my-template",
    "version": "[请输入版本号]"
  }
}
\`\`\`
`,
  },
};

// ============================================================
// 3. Markdown 生成器
// ============================================================

/**
 * 将选项列表渲染为表格
 * @param {CommandOption[]} options
 * @returns {string}
 */
function renderOptionsTable(options) {
  if (options.length === 0) return "";
  const rows = options.map((o) => `| \`${escapeMd(o.flags)}\` | ${escapeMd(o.description)} |`);
  return `| 选项 | 说明 |\n|------|------|\n${rows.join("\n")}`;
}

/**
 * 转义 markdown 特殊字符（粗略处理）
 */
function escapeMd(text) {
  return text.replace(/\|/g, "\\|");
}

/**
 * 生成单个命令的文档
 * @param {CommandNode} cmd
 * @param {string} parentPath 父命令路径（如 "repo"）
 * @param {number} level 标题等级
 * @returns {string}
 */
function generateCommandDoc(cmd, parentPath = "", level = 3) {
  const heading = "#".repeat(level);
  const fullName = parentPath ? `${parentPath} ${cmd.name}` : cmd.name;
  const aliasStr = cmd.aliases.length > 0 ? ` / ${cmd.aliases.map((a) => `${parentPath ? parentPath + " " : ""}${a}`).join(" / ")}` : "";

  let md = `\n${heading} \`${fullName}\`${aliasStr}\n\n`;
  md += `${cmd.description}\n\n`;

  // 从 COMMAND_DETAILS 查找路径 key
  const pathKey = parentPath ? `${parentPath}/${cmd.name}` : cmd.name;
  const detail = COMMAND_DETAILS[pathKey];

  if (detail) {
    md += `${detail.prose}\n`;
    if (detail.extra) {
      md += `${detail.extra}\n`;
    }
  }

  // 选项表格
  if (cmd.options.length > 0) {
    md += `${renderOptionsTable(cmd.options)}\n\n`;
  }

  // Bash 用法示例
  const allNames = [cmd.name, ...cmd.aliases];
  const allOpts = cmd.options.map((o) => {
    const terms = o.flags.split(",").map((s) => s.trim());
    return `[${terms[terms.length - 1]}]`;
  });
  const usageLines = allNames.slice(0, 2).map((n) => {
    const full = parentPath ? `${parentPath} ${n}` : n;
    if (allOpts.length > 0) {
      return `yakky ${full} ${allOpts.join(" ")}`;
    }
    return `yakky ${full}`;
  });

  if (cmd.type === "leaf") {
    md += `\`\`\`bash\n${usageLines.join("\n")}\n\`\`\`\n\n`;
  }

  // 子命令
  if (cmd.subcommands.length > 0) {
    md += `\n`;
    for (const sub of cmd.subcommands) {
      md += generateCommandDoc(sub, fullName, level + 1);
    }
  }

  return md;
}

/**
 * 生成完整文档
 */
function generateDocs() {
  const { commands, officialRepos } = discoverCommands();

  // 目录
  let tocItems = [];
  for (const cmd of commands) {
    tocItems.push(`- [\`${cmd.name}\`](#${cmd.name})`);
    if (cmd.subcommands.length > 0) {
      for (const sub of cmd.subcommands) {
        tocItems.push(`  - [\`${cmd.name} ${sub.name}\`](#${cmd.name}-${sub.name})`);
      }
    }
  }

  // 附录
  tocItems.push("- [模板工作机制](#模板工作机制)");
  tocItems.push("- [冲突处理](#冲突处理)");
  tocItems.push("- [官方仓库](#官方仓库)");

  const doc = `# yakky CLI 命令参考

yakky 是一个交互式脚手架工具，通过模板快速创建项目。

---

## 目录

${tocItems.join("\n")}

---

## 全局选项

| 选项 | 说明 |
|------|------|
| \`-v, --version\` | 显示版本号 |
| \`-h, --help\` | 显示帮助信息 |

${commands.map((cmd) => generateCommandDoc(cmd, "", 2)).join("\n\n---\n")}

---

## 模板工作机制

### 目录结构

一个模板仓库的典型目录结构：

\`\`\`
my-template-repo/
  templates/
    template-a/
      js/
        template/
          文件1.ts
          文件2.ts
      ts/
        template/
          文件1.ts
          文件2.ts
      roadmap.json
    template-b/
      template/
        ...
      roadmap.json
\`\`\`

### roadmap.json

每个模板目录下有一个 \`roadmap.json\` 文件，定义模板的元数据和用户交互配置：

\`\`\`json
{
  "name": "模板名称",
  "description": "模板描述",
  "tags": ["tag1", "tag2"],
  "configs": [
    {
      "name": "language",
      "type": "select",
      "message": "选择语言",
      "choices": [
        { "name": "JavaScript", "value": "js" },
        { "name": "TypeScript", "value": "ts" }
      ]
    }
  ],
  "variables": [
    {
      "value": "name",
      "template": "$NAME$",
      "message": "项目名称",
      "default": "my-project"
    }
  ],
  "metadata": {
    "author": "xxx",
    "version": "1.0.0"
  }
}
\`\`\`

**字段说明：**

| 字段 | 说明 |
|------|------|
| \`name\` | 模板名称，用于显示和选择 |
| \`description\` | 模板描述 |
| \`tags\` | 标签数组，用于分类 |
| \`configs\` | 配置项数组，用于用户选择/输入，值会影响模板子路径的拼接 |
| \`configs[].name\` | 配置项名称，也是子路径的目录名 |
| \`configs[].type\` | Enquirer 提示类型（input、select、multiselect 等） |
| \`configs[].message\` | 提示信息 |
| \`configs[].choices\` | 可选值列表（用于 select、multiselect 等类型） |
| \`configs[].default\` | 默认值 |
| \`variables\` | 变量数组，用于文件内容的占位符替换 |
| \`variables[].value\` | 变量标识符，用于映射用户输入 |
| \`variables[].template\` | 文件中的占位符文本，如 \`$NAME$\` |
| \`variables[].message\` | 提示信息 |
| \`variables[].default\` | 默认值 |
| \`metadata\` | 自定义元数据 |

### 占位符替换机制

- **变量替换：** 源文件中的 \`$NAME$\` 会被替换为用户输入的对应值，替换基于字符串逐字匹配（非正则）
- **配置项替换：** 源文件中的 \`$$language$$\` 会被替换为选择的值
- **文件名替换：** 文件名中的占位符同样会被替换，如 \`$NAME$.ts\` → \`my-project.ts\`

---

## 冲突处理

当输出文件或目录已存在时，提供以下选项：

| 选项 | 说明 | 行为 |
|------|------|------|
| **忽略（skip）** | 跳过当前项目，不执行任何操作 | 不删除已有文件，继续处理下一个 |
| **覆盖（overwrite）** | 删除已存在的目录，重新生成 | ⚠️ 不可恢复，原有内容将被彻底删除 |
| **重命名（rename）** | 使用新的名称创建 | 默认推荐 \`原名-副本\`，递增为 \`原名-副本-2\`、\`原名-副本-3\` |

**应用场景：** \`yakky create\`（输出目录冲突）、\`yakky sample-file\`（输出文件冲突）

---

## 官方仓库

系统内置官方仓库，在首次运行任何命令时自动检查并添加。

**当前官方仓库：**

| 名称 | URL |
|------|-----|
${officialRepos.map((r) => `| \`${r.name}\` | \`${r.url}\` |`).join("\n")}

**自动触发场景：**

以下命令首次执行时会自动确保官方仓库存在：

${commands.map((cmd) => {
  const lines = [];
  lines.push(`- \`yakky ${cmd.name}\``);
  if (cmd.subcommands.length > 0) {
    for (const sub of cmd.subcommands) {
      lines.push(`  - \`yakky ${cmd.name} ${sub.name}\``);
    }
  }
  return lines.join("\n");
}).join("\n")}

**保护规则：**

- 官方仓库不可删除
- 尝试删除官方仓库时会提示：\`"xxx" 是官方仓库，不允许删除\`

---

> 使用 \`yakky -h\` 查看所有命令的简要帮助，使用 \`yakky <命令> -h\` 查看子命令帮助。
`;

  const outputPath = path.join(root, "docs", "yakky-documents.md");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, doc, "utf-8");

  return outputPath;
}

// ============================================================
// 4. 执行
// ============================================================

const outputPath = generateDocs();
console.log(`✅ 文档已生成到: ${outputPath}`);
