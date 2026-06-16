一、 添加一个新命令 “添加命令”，跟 yakky 命令不走同一套入口 。“添加命令” 的功能是创建快捷命令，

1. 用户输入快捷命令的名称，名称必填。
2. 用户输入快捷命令的工作区，系统路径，非必填。路径录入方式，期望是用户能选择，如果不能选择，则让用户输入。如未填写工作区路径，表示快捷命令是全系统路径生效；填写了，则表示只在工作区路径内生效。
3. 快捷命令的执行脚本，bash 脚本。命令行打开 edit 供用户输入；或者 使用 -f/--file 选项指定 bash 脚本的系统路径
4. 快捷命令的相关配置数据要写入本地数据库。

二、 同一个工作区内，快捷命令名称不能相同

1. 已经存在 全系统生效的快捷命令 “测试”，再在 /path1/path2 中添加快捷命令 “测试”，需要提示错误 快捷命令已经存在
2. 已经存在 /path1/path2 路径的快捷命令 “测试”，再在 /path1/path2 中添加快捷命令 “测试”，需要提示错误 快捷命令已经存在
3. 已经存在 /path1/path2 路径的快捷命令 “测试”，再在 全系统生效的快捷命令 “测试”，需要提示错误 快捷命令已经存在
4. 已经存在 /path1 路径的快捷命令 “测试”，再在 /path1/path2 中添加快捷命令 “测试”，能正常添加
5. 已经存在 /path1/path2 路径的快捷命令 “测试”，再在 /path1 中添加快捷命令 “测试”，能正常添加
   提示错误后，不要往数据库中写入数据

三、添加一个新命令 “查询命令”，与 “添加命令”类似，跟 yakky 命令不走同一套入口 。“查询命令” 的功能是查询所有符合条件的快捷命令，

1. 用户输入快捷命令的工作区，系统路径，非必填。路径录入方式，期望是用户能选择，如果不能选择，则让用户输入。如未填写工作区路径，表示快捷命令是查询所有快捷命令；填写了，则表示只查询所填写工作区路径内生效的快捷命令。
2. 注意输出的内容的样式，可读性要高。

四、 “添加命令”，新增一个字段，命令描述，可选，用户输入，用于描述该快捷命令的功能。数据表中也添加相应字段。“查询命令”也显示描述，超长可以换行显示

五、添加一个新命令 “运行命令”，与 “添加命令”类似，跟 yakky 命令不走同一套入口 。“运行命令” 的功能是查询所有符合条件的快捷命令并运行快捷命令的 bash 脚本，

1. 输出当前工作区可用 的快捷命令，提示快捷命令名称、快捷命令描述，供用户选择。如果无可用快捷命令，就提示用户当前工作区无可用快捷命令。如果有可用快捷命令，就让用户选择执行哪个快捷命令

六、添加一个新命令 “分享命令”，与 “添加命令”类似，跟 yakky 命令不走同一套入口 。“分享命令” 的功能是将某个快捷命令的 json 配置，使用 crypto-js 加密，返回加密后的密文

1. 输出所有可用 的快捷命令，提示快捷命令名称、快捷命令描述，供用户选择。如果无可用快捷命令，就提示还没有快捷命令。如果有可用快捷命令，就让用户选择执行哪个快捷命令
2. 提供加密、解密的公共方法。密钥是“yakkyencryptkey”。

七、“添加命令”，新增一个 -t/--token 选项，接收 “分享命令” 生成的密文。

1. 如果使用了 -t/--token 选项，则后面必需接收一个字符串密文，
   1.1 如果密文为空，则提示用户输入
   1.2 获取到密文后，再使用解密的公共方法进行解密，
   1.2.1 解密失败，则提示命令不存在；
   1.2.2 解密后的内容如果不是 JSON 格式，则提示命令不存在；
   1.2.3 将解密后的字符串转换成 json，如果 json 缺少 name/description/workspace*path/script 中的任何一个字段，则提示命令不存在。
   1.2.4 密文正确，则
   1.2.4.1 提示用户命令名称，默认为[JSON 中的 name 字段值]，用户可以修改，如果修改了，则需要满足 “命令名称只能包括 中文、字母、数字*、-,且只能以中文、字母开头。”
   1.2.4.2 提示工作区路径，默认为[JSON 中的 workspace_path 字段值]，用户也可以修改，修改后要验证路径是否存在，不存在要提示用户
   1.2.4.3 显示脚本内容，值为[JSON 中的 script 字段值]，不可修改。字体颜色浅一点。
   1.2.4.4 将 [JSON 中 script 字段值] 写入 dataPath("data") 目录，生成一个随机 uid 文件名，组装一个完整的路径 dataPath("data", '文件名')
   1.2.4.5 将解析出来的 JSON 数据，写入数据库。script_path 值为 dataPath("data", '文件名')

八、“添加命令”，-t/--token 选项，输出的 脚本内容，样式改成跟 “运行命令” 输出的日志 样式一样。
“添加命令”，-t/--token 选项，添加快捷命令时，也要根据命令名称、工作区路径查重，如果命令名称且工作区路径重复时要提示错误。所有重复判断的逻辑与直接“添加命令”一样

九、“添加命令”，新增一个 -t/--token 选项，接收 “分享命令” 生成的密文。正确解析密文后，提示完 命令名称、工作区路径后，再提示一下命令描述，默认[JSON 中的 description 字段值]，用户可以修改

十、添加一个新命令 “删除命令”，与 “添加命令”类似，跟 yakky 命令不走同一套入口 。“删除命令” 的功能是删除某个快捷命令

1. 给用户提供所有快捷命令，显示命令名称、描述、生效工作区路径，用户选择某个命令后，删除这个快捷命令，数据库中也要删除这条记录

十一、添加一个新命令 “修改命令”，与 “添加命令”类似，跟 yakky 命令不走同一套入口 。“修改命令” 的功能是删除某个快捷命令

1. 依次提示用户，可以修改命令名称、工作区路径、描述、脚本内容。使用和 “添加命令” 相对应的交互组件

十二、更新 yakky -h 输出的文档，添加所有快捷命令相关的命令文档，如“添加命令”,"add","查询命令","query"等。这些快捷命令不依赖 yakky 命令，是与 yakky 同级的命令,文档与其他子命令要有区别

十三、修改 run 命令，如果输入 "run 测试"，表示 “测试”是快捷命令名称，先在当前工作区内查找 名为“测试”的快捷命令。

1. 如果未找到，则提示当前工作区不存在快捷命令“测试”；如果存在，则执行这个快捷命令
2. 删除 -w/--workspace 选项，因为当前工作区的快捷命令可能不唯一

十四、修改 run, delete, edit 命令，如果输入 "run 测试"，表示 “测试”是快捷命令名称，查找名为“测试”的快捷命令。

1. 如果未找到，则提示不存在快捷命令“测试”；如果存在，提示快捷命令名称、工作区路径，再操作这个快捷命令

```
添加  yak upload-ftp 命令, 功能是上传文件或文件夹到远程 FTP 服务器。文件目录实现与 yak repositry 一致。支持 以下选项
1. -t/--type 上传类型，可选值： dir 和 file 。 type 为 'dir' 时，调用 src/utils/ftp.ts 文件中的 uploadDirToFtp 方法； type 为 'file' 时，调用 src/utils/ftp.ts 文件中的 uploadFileToFtp 方法。
2. -h/--host ftp服务器地址，必填
3. -u/--user ftp用户名，必填
4. -p/--password ftp密码，必填
5. -lp/--local-path 本地文件或文件夹的路径，type == 'dir' 表示待上传文件夹的路径；type == 'file' 表示待上传文件的路径。
6. -rp/--remote-path 远程FTP服务器端文件或文件夹的路径，type == 'dir' 表示远程FTP服务器端文件夹的路径；type == 'file' 表示远程FTP服务器端文件的路径。
7. -s/--secure 表示连接远程FTP服务器时，是否开启 'secure' 选项，默认为 false，表示不开启。
8. -o/--overwrite 当type == 'dir' 时生效，表示是否替换远程 FTP 服务器端的文件夹，为 true 时，会先删除远程 FTP 服务器端的目标文件夹。默认为 true 。
9. type == 'dir' 时，调用 src/utils/ftp.ts 中的 uploadDirToFtp 方法；type == 'file' 时，调用 src/utils/ftp.ts 中的 uploadFileToFtp 方法.
10. 以上必填选项，如果没有值，就直接结束命令并返回错误。
```

```
提供一个 bash 脚本 ，主要功能是
1. cd 到当前目录下的 docs 目录中，后续所有操作都在当前目录
2. 获取当前目录下的 package.json 的json，
2.1 如果 version 字段的值不是 v1.v2.v3-docs.v4 这种形式（v1, v2, v3, v4 均为数字），则将 version的值改为 v1.v2.v3-docs.1，如：2.1.3-rc.2 改为 2.1.3-docs.1
2.2 如果 version 字段的值是 v1.v2.v3-docs.v4 这种形式（v1, v2, v3, v4 均为数字），则将 version的值改为 v1.v2.v3-docs.[v4+1]，如：2.1.3-docs.1 改为 2.1.3-docs.2
3. 执行命令：`npm run docs:build`。
4. 检查当前目录下 是否存在 .vitepress/dist 目录，
4.1 如果不存在，则提示错误
4.2 如果存在，则将 .vitepress/dist 目录 上传到远程 FTP 服务器，可以使用命令 `yakky upload-ftp -t dir -h 192.168.11.108 -u team.mobile -p QuuVoov6ooChie -l [.vitepress/dist 的绝对路径] -r /docs/use-services/v2`
```

```
添加 yak tunnel 命令，功能是将本地服务，通过内网穿透到远端服务器。文件目录实现与 yak repositry 一致。支持以下选项
1. -u/--url 本地服务的地址，带端口号。如: http://127.0.0.1:3000
2. -s/--server 服务器端
```

```
提供一个 bash 脚本 ，主要功能是
1. 判断当前目录下，是否包含 dist 目录，如果包含，则删除 dist 目录，执行完后，进入下一步
2. 先执行 `npm run build` 命令，执行完后，进入下一步
3. 检查当前目录下是否包含 dist
3.1 如果不包含 dist 目录，表示项目打包失败，提示用户失败，中止bash继续执行。
3.2 如果包含 dist 目录，则将 dist 目录压缩成 ZIP 包，执行完后，进入下一步
4. 执行命令 `yak set-sshkey -h 82.157.53.203 -u root -p *#Liangshan123*#`，如果命令提示 "该服务器已配置过免密登录" 也继续往下执行 bash.
5. 上传 ZIP 包至远程服务器，执行命令 `scp dist.zip root@82.157.53.203:/mnt/api.smlrt.com`，执行完后，进入下一步
6. 执行命令 `ssh root@82.157.53.203 "cd /mnt/api.smlrt.com && rm -rf dist && unzip dist.zip && pm2 restart smlrtapi"`
```

```
添加 yak set-sshkey 命令，功能是本地生成一个密钥，并将公钥上传至服务器，主要目的是能免密连接 远程服务器。文件目录实现与 yak repositry 一致。支持以下选项
1. -h/--host 远程服务器地址，必填
2. -u/--user 远程服务器的登录用户名，必填
3. -p/--password 远程服务器的登录密码，必填
4. --port 远程服务器的连接端口，选填，默认 `22`
5. 本命令 --help 不再使用 `-h` 短选项。
6. 如果用户没有默认提供选项址，需要使用 enquirer 提供交互式提问，来搜集选项的值
7. 所有选项搜集完成后，调用 src/utils/setup-ssh-key.ts 中的 setupSshKeyLogin 方法。
```

```
需要为 yak set-sshkey 命令添加一个数据表，用于存储已经添加过的 sshkey，需要绑定 远程服务器地址、本地密钥文件地址、远程登录的用户名、添加时间等信息，额外的信息，你可以酌情添加。
1. 使用 yak set-sshkey 设置 sshkey 时，如果存在（根据数据表中 远程服务器地址 判断），则提示用户已经设置过
2. yak set-sshkey 设置成功后，需要更新数据表
```

```
添加 yak whoami 命令，输出当前系统登录的用户名。文件目录实现与 yak repositry 一致。
添加 yak profile 命令，输出当前系统登录的用户名。文件目录实现与 yak repositry 一致。
```

```
src 目录下创建一个 ui 目录，在 src/ui 目录下初始化一个 vue3 + typescript + tailwind.css + vite.js 项目。这个项目能与 yak 命令通信。
1. ui 项目头部显示 yak login 的用户信息，包括头像、昵称、id等。
2. ui 项目左侧有一个菜单，现在菜单有 "快捷命令管理"，
添加 yak ui 命令，功能是在本地启动一个 ui 界面
```

```
yak login 登录成功后，post 方式 调用 接口 http://127.0.0.1:3000/yakky-user/login 保存用户信息，传递参数示例如下:
{
  "userId": "user_001",
  "email": "user@example.com",
  "username": "张三",
  "access_token": "eyJhbGciOiJIUzI1NiJ9..."
}
yak logout 退出登录后，post 方式 调用 接口 http://127.0.0.1:3000/yakky-user/logout 更新用户信息，传递参数示例如下:
{
  "userId": "user_001"
}

需要将接口请求进行统一的封装，http://127.0.0.1:3000 是 baseUrl，统一配置。
```

```
新增接口封装，
1. 新增命令，/yakky-shortcut-command/create ，所有参数必填，参数示例：
{
  "userId": "user_001",
  "name": "deploy",
  "description": "部署到生产环境",
  "script": "#!/bin/bash\necho \"deploying...\""
}
2. 删除命令，/yakky-shortcut-command/delete ，参数示例：
{
  "userId": "user_001",
  "id": "550e8400-e29b-41d4-a716-446655440000"
}
3. 分页查询命令列表，/yakky-shortcut-command/list ，pageIndex(选填,number类型，默认 `1`), pageSize(选填,number类型，默认 `20`), status(选填，boolean类型，默认 `true`)参数示例：
{
  "pageIndex": 1,
  "pageSize": 20,
  "userId": "user_001",
  "status": true
}
4. 修改命令，/yakky-shortcut-command/update ，userId 和 id 必填，参数示例：
{
  "userId": "user_001",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "deploy",
  "description": "部署到生产环境",
  "script": "string"
}
5. 修改命令状态，/yakky-shortcut-command/updateStatus ，userId 和 id 必填，参数示例：
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user_001",
  "status": true
}

以上接口，与之前的 登录、退出 接口，将所有接口 url 统一管理
```

```
`add` 命令，添加完快捷命令，
1. 先使用 post 方式调用 接口 http://127.0.0.1:3000/yakky-shortcut-command/create ，保存快捷命令,如果接口返回失败，则提示用户失败，并中止命令执行；如果接口返回成功，则拿到返回数据，执行第2步，
/yakky-shortcut-command/create 接口的传递参数示例如下：
{
  "userId": "user_001",
  "name": "deploy",
  "description": "部署到生产环境",
  "script": "#!/bin/bash\necho \"deploying...\""
}
2. 向本地数据库中的  shortcut_commands 表添加记录，与目前 `add` 命令的处理逻辑一样，id 为 /yakky-shortcut-command/create 接口返回的 data.id。

`edit` 命令，编辑完快捷命令，大概流程同 add 命令
1. 先使用 post 方式调用 接口 http://127.0.0.1:3000/yakky-shortcut-command/update ，更新快捷命令,如果接口返回失败，则提示用户失败，并中止命令执行；/yakky-shortcut-command/update 接口的传递参数示例如下：
{
  "userId": "user_001",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "deploy",
  "description": "部署到生产环境",
  "script": "string"
}
2. 更新本地数据库 shortcut_commands 表中对应 userId + id 的记录。与目前 `edit` 命令的处理逻辑一样。

`delete` 命令，
```
