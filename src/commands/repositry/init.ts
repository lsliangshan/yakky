import { logger } from "../../utils/logger.js";
import { createSpinner } from "../../utils/spinner.js";
import { ensureOfficialRepos } from "../../utils/ensure-official.js";
import Enquirer from "enquirer";
import fs from "node:fs";
import path from "node:path";

export interface IRepoInitArgs {
  name?: string;
  dir?: string;
}

const DEFAULT_TEMPLATE_NAME = "my-template";
const DEFAULT_VARIABLES = [
  {
    value: "name",
    template: "$NAME$",
    message: "项目名称",
    default: "my-project",
  },
  {
    value: "version",
    template: "$VERSION$",
    message: "版本号",
    default: "1.0.0",
  },
];

function createTemplateRepo(dir: string, templateName: string) {
  const templatesDir = path.join(dir, "templates");
  const templateDir = path.join(templatesDir, templateName);
  const srcDir = path.join(templateDir, "template");

  // 创建目录结构
  fs.mkdirSync(srcDir, { recursive: true });

  // 创建 roadmap.json
  const roadmap = {
    name: templateName,
    description: "模板描述",
    tags: ["demo"],
    configs: [],
    variables: DEFAULT_VARIABLES,
  };
  fs.writeFileSync(
    path.join(templateDir, "roadmap.json"),
    JSON.stringify(roadmap, null, 2),
    "utf-8",
  );

  // 创建 README.md 提示用户如何使用 template 目录
  const readme = `# ${templateName} 模板

## 目录说明

\`\`\`
${templateName}/
├── template/          # 在此目录下添加您的业务模板文件
│   └── README.md      # 本文件
└── roadmap.json       # 模板配置文件
\`\`\`

## 使用方式

1. 在 \`template/\` 目录下添加您的业务模板文件，文件名和文件内容中均可使用占位符（如 \`\$NAME\$\`）
2. 编辑 \`roadmap.json\` 定义模板的配置项（configs）和变量（variables）
3. 将本仓库推送到 Git 远程仓库
4. 使用 \`yakky repo add\` 命令添加仓库到本地
5. 使用 \`yakky create\` 命令通过模板创建项目

## configs 字段说明

\`roadmap.json\` 中的 \`configs\` 字段用于定义模板的配置项，让用户在使用模板时做出选择。

**与模板目录结构的关系：**

configs 中每个配置项的选择值会**按顺序拼接成子目录路径**，用于定位 \`template/\` 目录。

例如，定义以下 configs：

\`\`\`json
{
  "configs": [
    { "name": "language", "type": "select", "choices": [{ "value": "js" }, { "value": "ts" }] },
    { "name": "method", "type": "select", "choices": [{ "value": "sfc" }, { "value": "class" }] }
  ]
}
\`\`\`

当用户选择 \`language=js\` 和 \`method=sfc\` 时，模板源目录为：

\`\`\`
templates/模板名称/js/sfc/template/
\`\`\`

因此，如需根据不同的配置项值提供不同的模板文件，需在 \`template/\` 所在目录下创建对应的子目录结构：

\`\`\`
${templateName}/
├── js/
│   ├── sfc/
│   │   └── template/     # language=js, method=sfc 时使用
│   └── class/
│       └── template/     # language=js, method=class 时使用
├── ts/
│   ├── sfc/
│   │   └── template/     # language=ts, method=sfc 时使用
│   └── class/
│       └── template/     # language=ts, method=class 时使用
├── template/             # 无 configs 或 configs 为空时使用
└── roadmap.json
\`\`\`

**注意：**

- \`configs\` 可以为空（\`[]\`），此时直接从 \`template/\` 目录读取模板文件
- 不定义 \`configs\` 时，模板源目录固定为 \`template/\`
- 每个配置项的 \`name\` 值就是子目录的名称
- \`configs\` 数组的顺序决定子目录的嵌套层级

## 变量说明

\`roadmap.json\` 中的 \`variables\` 字段定义模板变量，用于文件内容中的占位符替换：

\`\`\`json
{
  "variables": [
    { "value": "name", "template": "\$NAME\$", "message": "项目名称" }
  ]
}
\`\`\$

- \`value\`：变量标识符，用于映射用户输入
- \`template\`：文件中的占位符文本，如 \`\$NAME\$\` 会被替换为用户输入的值
- \`message\`：向用户提问时的提示信息

## 注意事项

- \`template/\` 目录结构会被原样复制到输出目录，请在该目录下放置所有模板文件
- 请勿删除或重命名 \`template/\` 目录，否则模板将无法正常使用
- 如果使用了 \`configs\`，请确保对应的子目录结构存在
- \`roadmap.json\` 是模板的配置文件，请根据实际需求修改
`;
  fs.writeFileSync(path.join(srcDir, "README.md"), readme, "utf-8");
}

function askDir(args?: IRepoInitArgs): Promise<string> {
  return new Promise((resolve, reject) => {
    if (args?.dir) return resolve(args.dir);
    Enquirer.prompt<{ dir: string }>({
      type: "input",
      name: "dir",
      message: "请输入模板仓库项目目录名称",
      initial: "my-template-repo",
      validate: (value: string) => {
        if (!value || value.trim() === "") return "目录名称不能为空";
        return true;
      },
    })
      .then((r) => resolve(r.dir))
      .catch(reject);
  });
}

function askTemplateName(args?: IRepoInitArgs): Promise<string> {
  return new Promise((resolve, reject) => {
    if (args?.name) return resolve(args.name);
    Enquirer.prompt<{ name: string }>({
      type: "input",
      name: "name",
      message: "请输入模板名称（第一个模板）",
      initial: DEFAULT_TEMPLATE_NAME,
      validate: (value: string) => {
        if (!value || value.trim() === "") return "模板名称不能为空";
        return true;
      },
    })
      .then((r) => resolve(r.name))
      .catch(reject);
  });
}

async function resolveDir(dir: string): Promise<string | null> {
  const targetDir = path.resolve(process.cwd(), dir);
  if (!fs.existsSync(targetDir)) return targetDir;

  logger.warn(`目录 "${dir}" 已存在`);
  const { choice } = await Enquirer.prompt<{ choice: string }>({
    type: "select",
    name: "choice",
    message: `请选择操作:`,
    choices: [
      { name: "rename", message: "重命名" },
      { name: "skip", message: "忽略" },
      { name: "overwrite", message: "覆盖" },
    ],
    initial: 0,
  });

  if (choice === "skip") {
    logger.info(`已跳过 "${dir}"`);
    return null;
  }

  if (choice === "overwrite") {
    fs.rmSync(targetDir, { recursive: true, force: true });
    return targetDir;
  }

  // rename
  const ext = path.extname(dir);
  const base = path.basename(dir, ext);
  let suggestion = `${base}-副本`;
  for (let i = 2; fs.existsSync(path.resolve(process.cwd(), suggestion)); i++) {
    suggestion = `${base}-副本-${i}`;
  }
  const { newName } = await Enquirer.prompt<{ newName: string }>({
    type: "input",
    name: "newName",
    message: "请输入新的目录名称:",
    initial: suggestion,
  });
  return resolveDir(newName);
}

export async function repositryInit(args?: IRepoInitArgs) {
  try {
    await ensureOfficialRepos();

    // 1. 先询问目录名，立即处理冲突
    const dir = await askDir(args);
    if (!dir) return;
    const targetDir = await resolveDir(dir);
    if (!targetDir) return;

    // 2. 再询问模板名
    const templateName = await askTemplateName(args);

    // 3. 创建
    const spinner = createSpinner("正在生成模板仓库...");
    spinner.start();
    createTemplateRepo(targetDir, templateName || DEFAULT_TEMPLATE_NAME);
    spinner.succeed("模板仓库已创建");

    logger.success(`模板仓库已生成到: ${targetDir}`);
    console.log("");
    logger.highlight("  目录结构:");
    logger.log(`  ${dir}/`);
    logger.log(`  └── templates/`);
    logger.log(`      └── ${templateName || DEFAULT_TEMPLATE_NAME}/`);
    logger.log(`          ├── template/`);
	    logger.log(`          │   └── README.md`);
    console.log("");
    logger.highlight("  提示:");
    logger.info("  1. 编辑 roadmap.json 定义模板的配置项和变量");
    logger.info("  2. 在 template/ 目录下添加模板文件");
    logger.info("  3. 将仓库推送到 Git 远程仓库");
    logger.info("  4. 使用 yakky repo add 添加仓库到本地");

    return targetDir;
  } catch (error) {
    logger.error(`初始化模板仓库失败: ${error}`);
    throw error;
  }
}
