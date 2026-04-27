# yakky CLI 命令参考

yakky 是一个交互式脚手架工具，通过模板快速创建项目。

---

## 目录

- [`create`](#create)
- [`repo`](#repo)
  - [`repo list`](#repo-list)
  - [`repo add`](#repo-add)
  - [`repo remove`](#repo-remove)
  - [`repo sync`](#repo-sync)
  - [`repo sync-all`](#repo-sync-all)
- [`sample-file`](#sample-file)
- [`template`](#template)
  - [`template list`](#template-list)
  - [`template info`](#template-info)
- [模板工作机制](#模板工作机制)
- [冲突处理](#冲突处理)
- [官方仓库](#官方仓库)

---

## 全局选项

| 选项 | 说明 |
|------|------|
| `-v, --version` | 显示版本号 |
| `-h, --help` | 显示帮助信息 |


## `create`

通过模板创建项目


从模板创建新的项目文件。支持交互式和配置文件两种模式。

> 提示：可用 `yakky sample-file` 生成模板示例配置文件用于 `-f` 模式。


---

### 交互模式

不提供 `-f` 选项时进入交互模式。

**Step 1 — 选择仓库**

列出所有已添加的仓库供用户选择。如果没有仓库，提示用户先添加仓库。如果提供了 `-r` 选项则跳过此步。

```bash
yakky create -r my-repo -t my-template
```

**Step 2 — 选择模板**

根据所选仓库列出该仓库下的所有模板供用户选择。如果提供了 `-t` 选项则跳过此步。

**Step 3 — 配置配置项（configs）**

根据模板 `roadmap.json` 中定义的 `configs` 数组，依次提示用户输入。每个配置项支持以下 Enquirer 类型：

| 类型 | 说明 | 适用场景 |
|------|------|----------|
| `input` | 文本输入 | 自定义文本 |
| `select` | 单选 | 从列表中选择一项 |
| `multiselect` | 多选 | 从列表中选择多项 |
| `autocomplete` | 自动补全 | 从列表中搜索选择 |
| `confirm` | 确认（是/否） | 布尔值 |
| `toggle` | 开关 | 开/关切换 |
| `form` | 表单 | 多个字段组合输入 |
| `password` | 密码输入 | 隐藏输入内容 |
| `numeral` | 数字输入 | 数值 |
| `sort` | 排序 | 对选项排序 |

当配置项包含 `choices` 时，每个选项可以包含以下字段：

```json
{ "name": "显示名称", "value": "实际存储值", "message": "显示信息" }
```

- `name` / `value` / 选项本身用作显示标签
- `value` 会作为实际存储值（fallback 到 `name`，再 fallback 到选项本身）
- 多选模式下，返回所有选中项的 `value` 数组

配置项的选择值会按顺序拼接成子路径，用于定位模板源目录：

```
模板路径 / config[0]值 / config[1]值 / template
```

例如配置项 `language` 选择了 `js`，`method` 选择了 `sfc`，则源目录为 `/path/to/templates/my-template/js/sfc/template/`。

**Step 4 — 填写变量（variables）**

根据模板 `roadmap.json` 中定义的 `variables` 数组，依次提示用户输入每个变量的值。

- 变量名（`value` 字段）用于标识变量
- 占位符（`template` 字段）用于文件内容替换
- 支持 `default` 默认值

**Step 5 — 确认信息**

展示所有配置和变量值，让用户确认：

```
模板: my-template
仓库: my-repo
输出: my-output-dir
配置: {"language": "js", "method": "sfc"}
变量: {"name": "my-app"}
确认以上信息并创建? (Y/n)
```

**Step 6 — 处理冲突**

如果输出目录已存在，提供 忽略 / 覆盖 / 重命名 选项（详见[冲突处理](#冲突处理)章节）。

**Step 7 — 生成文件**

复制模板文件到输出目录，并进行占位符替换：

- 文件名中的 `$NAME$` → `my-app`（如 `$NAME$.ts` → `my-app.ts`）
- 文件内容中的变量占位符使用 `$变量名$` 格式
- 文件内容中的配置项占位符使用 `$$配置项名称$$` 格式

---

### 文件模式（`-f`）

通过 JSON 文件配置批量创建，适用于自动化场景。

```bash
yakky create -f ./config.json
```

**文件验证规则：**

- 仅支持 `.json` 文件格式，其他扩展名将报错
- 文件内容必须是合法的 JSON 语法
- 可以是 object（单个创建）或 array（批量创建）
- 每个配置项必须包含 `repositry`、`template` 字段

**字段说明：**

| 字段 | 是否必填 | 说明 |
|------|----------|------|
| `repositry` | 是 | 仓库名称，用于查找模板 |
| `template` | 是 | 模板名称，与仓库组合唯一确定一个模板 |
| `configs` | 否 | 配置项字典，key 对应模板定义中 configs 的 `name` 字段 |
| `variables` | 否 | 变量字典，key 对应模板定义中 variables 的 `value` 字段 |

**configs 匹配规则：** key 必须与 `roadmap.json` 中 `configs[].name` 完全匹配。

**variables 匹配规则：** key 必须与 `roadmap.json` 中 `variables[].value` 完全匹配。

**批量创建（array 格式）：**

每个项目独立处理，一个失败不影响其他项目。多个输出目录冲突时会依次弹出提示。

```json
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
```

| 选项 | 说明 |
|------|------|
| `-r, --repositry <name>` | 选择仓库 |
| `-t, --template <name>` | 选择模板 |

```bash
yakky create -r <...> -t <...>
```



---

## `repo` / repositry

管理模板仓库


管理模板仓库的添加、删除、查看和同步。



### `repo list` / repo ls

列出本地所有仓库


以列表形式展示所有仓库的名称和 URL，按创建时间倒序排列。自动检查并确保官方仓库存在。


**输出示例：**

```
yakky --------------- https://gitlab.dev.zhaopin.com/camx/yakky-template
```

```bash
yakky repo list
yakky repo ls
```


### `repo add`

添加仓库


添加一个新的模板仓库。

**操作流程：**

1. 如果未提供 `-n` 或 `-u`，交互式提示输入仓库名称和 URL（名称重复将被拒绝）
2. 克隆远程 Git 仓库或复制本地目录到临时目录
3. 将仓库中的 `templates` 目录复制到本地模板存储目录
4. 将仓库信息写入数据库
5. 同步模板数据到数据库（解析每个模板的 `roadmap.json`）

**地址格式支持：**

| 类型 | 说明 |
|------|------|
| Git 远程仓库 | `https://...` 或 `git@...`（使用 `git clone --depth 1` 拉取） |
| 本地路径 | 直接复制目录（如 `/Users/xxx/my-templates`） |

**注意事项：**

- 仓库 URL 以 `http` 或 `git@` 开头时视为 Git 仓库，否则视为本地路径
- 如果远端仓库没有 `templates` 目录，会创建空目录并给出警告
- 添加失败时会自动清理已创建的目录

| 选项 | 说明 |
|------|------|
| `-n, --name [模板仓库名称]` | 模板仓库名称 |
| `-u, --url [模板仓库地址]` | 模板仓库地址 |

```bash
yakky repo add -n <...> -u <...>
```


### `repo remove` / repo rm / repo delete

删除仓库


删除一个模板仓库。

**操作流程：**

1. 如果未提供 `-n`，交互式从列表中选择要删除的仓库
2. 检查仓库是否存在
3. 检查是否为官方仓库（官方仓库禁止删除）
4. 确认删除操作
5. 删除数据库中该仓库下的所有模板记录
6. 删除本地模板文件目录
7. 删除数据库中的仓库记录

> ⚠️ **官方仓库不可删除**，尝试删除会提示错误。删除操作不可撤销。

| 选项 | 说明 |
|------|------|
| `-n, --name [模板仓库名称]` | 模板仓库名称 |

```bash
yakky repo remove -n <...>
yakky repo rm -n <...>
yakky repo delete -n <...>
```


### `repo sync`

从远端同步模板仓库


从远端同步指定模板仓库的最新模板。

**操作流程：**

1. 如果未提供 `-n`，交互式从列表中选择要同步的仓库
2. 拉取远端仓库最新代码到临时目录
3. 删除旧的本地模板目录
4. 复制最新的 `templates` 文件
5. 同步模板数据到数据库（重新解析 `roadmap.json`）
6. 更新仓库的 `updatedAt` 时间戳

> 如果远端仓库没有 `templates` 目录，会创建空目录。

| 选项 | 说明 |
|------|------|
| `-n, --name [模板仓库名称]` | 模板仓库名称 |

```bash
yakky repo sync -n <...>
```


### `repo sync-all`

同步所有模板仓库


同步所有模板仓库。

**操作流程：**

1. 自动确保官方仓库存在
2. 遍历数据库中的所有仓库，依次执行同步操作
3. 输出同步结果统计（成功数 / 失败数）

> 某个仓库同步失败不影响其他仓库的同步。

```bash
yakky repo sync-all
```



---

## `sample-file`

生成模板示例配置文件（用于 yak create -f）


生成用于 `yakky create -f` 的示例 JSON 配置文件，方便用户了解 JSON 文件格式。


### 操作流程

**Step 1 — 选择仓库：** 从所有已添加的仓库中选择（未提供 `-r` 时交互选择）。

**Step 2 — 选择模板：** 从选定仓库下的模板列表中选择（未提供 `-t` 时交互选择）。

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
| `select` / `autocomplete` | 用 " 或 " 连接所有可选值，如 `"js 或 ts"` |
| `multiselect` | 数组包裹所有可选值，如 `["js", "ts"]` |
| 其他类型 | 使用 `default` 值或空字符串 |

**变量（variables）的示例值：**

| 条件 | 生成的示例值 |
|------|-------------|
| 有 `default` 值 | 使用默认值 |
| `value` 为 `"name"` | 批量模式下生成 `my-模板名-1`、`my-模板名-2` |
| 其他情况 | 使用 `[message]` 作为占位符提示 |

### 输出示例

```json
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
```

| 选项 | 说明 |
|------|------|
| `-r, --repositry <name>` | 选择仓库 |
| `-t, --template <name>` | 选择模板 |

```bash
yakky sample-file -r <...> -t <...>
```



---

## `template` / tpl

管理模板


查看和管理已同步的模板。



### `template list` / template ls

列出所有模板


以表格形式展示所有模板的 ID、名称、所属仓库、描述和标签，默认按创建时间倒序排列。中文字符按双字符宽度对齐。


**输出示例：**

| ID | 名称 | 仓库 | 描述 | 标签 |
|----|------|------|------|------|
| 1 | my-template | yakky | 这是一个模板 | tag1, tag2 |

```bash
yakky template list
yakky template ls
```


### `template info`

查看模板详情


查看模板的详细信息，包括：

- 基本信息：ID、名称、所属仓库、描述、标签
- **配置项（configs）：** 配置名称、类型（select / input / multiselect 等）、提示信息、可选值列表
- **变量（variables）：** 变量名、占位符、说明
- **元数据（metadata）：** 自定义键值对
- **时间信息：** 创建时间和更新时间

| 选项 | 说明 |
|------|------|
| `-n, --name [模板名称]` | 模板名称 |

```bash
yakky template info -n <...>
```



---

## 模板工作机制

### 目录结构

一个模板仓库的典型目录结构：

```
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
```

### roadmap.json

每个模板目录下有一个 `roadmap.json` 文件，定义模板的元数据和用户交互配置：

```json
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
```

**字段说明：**

| 字段 | 说明 |
|------|------|
| `name` | 模板名称，用于显示和选择 |
| `description` | 模板描述 |
| `tags` | 标签数组，用于分类 |
| `configs` | 配置项数组，用于用户选择/输入，值会影响模板子路径的拼接 |
| `configs[].name` | 配置项名称，也是子路径的目录名 |
| `configs[].type` | Enquirer 提示类型（input、select、multiselect 等） |
| `configs[].message` | 提示信息 |
| `configs[].choices` | 可选值列表（用于 select、multiselect 等类型） |
| `configs[].default` | 默认值 |
| `variables` | 变量数组，用于文件内容的占位符替换 |
| `variables[].value` | 变量标识符，用于映射用户输入 |
| `variables[].template` | 文件中的占位符文本，如 `$NAME$` |
| `variables[].message` | 提示信息 |
| `variables[].default` | 默认值 |
| `metadata` | 自定义元数据 |

### 占位符替换机制

- **变量替换：** 源文件中的 `$NAME$` 会被替换为用户输入的对应值，替换基于字符串逐字匹配（非正则）
- **配置项替换：** 源文件中的 `$$language$$` 会被替换为选择的值
- **文件名替换：** 文件名中的占位符同样会被替换，如 `$NAME$.ts` → `my-project.ts`

---

## 冲突处理

当输出文件或目录已存在时，提供以下选项：

| 选项 | 说明 | 行为 |
|------|------|------|
| **忽略（skip）** | 跳过当前项目，不执行任何操作 | 不删除已有文件，继续处理下一个 |
| **覆盖（overwrite）** | 删除已存在的目录，重新生成 | ⚠️ 不可恢复，原有内容将被彻底删除 |
| **重命名（rename）** | 使用新的名称创建 | 默认推荐 `原名-副本`，递增为 `原名-副本-2`、`原名-副本-3` |

**应用场景：** `yakky create`（输出目录冲突）、`yakky sample-file`（输出文件冲突）

---

## 官方仓库

系统内置官方仓库，在首次运行任何命令时自动检查并添加。

**当前官方仓库：**

| 名称 | URL |
|------|-----|
| `yakky` | `https://gitlab.dev.zhaopin.com/camx/yakky-template` |

**自动触发场景：**

以下命令首次执行时会自动确保官方仓库存在：

- `yakky create`
- `yakky repo`
  - `yakky repo list`
  - `yakky repo add`
  - `yakky repo remove`
  - `yakky repo sync`
  - `yakky repo sync-all`
- `yakky sample-file`
- `yakky template`
  - `yakky template list`
  - `yakky template info`

**保护规则：**

- 官方仓库不可删除
- 尝试删除官方仓库时会提示：`"xxx" 是官方仓库，不允许删除`

---

> 使用 `yakky -h` 查看所有命令的简要帮助，使用 `yakky <命令> -h` 查看子命令帮助。
