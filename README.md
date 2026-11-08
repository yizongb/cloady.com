<div align="center">
  <h2>
    <img src="https://cdn.nodeimage.com/i/NXz3ah3zTwikq3AdQOU0dYw3uyaBiGVj.webp" width="40" height="40" style="vertical-align: middle;"/> 
    nodejs-argo隧道代理
  </h2>
  nodejs-argo是一个强大的Argo隧道部署工具，专为PaaS平台和游戏玩具平台设计。它支持多种代理协议（VLESS、VMess、Trojan等），并集成了哪吒探针功能。

---

Telegram交流反馈群组：https://t.me/eooceu
</div>

## 郑重声明
* 本项目自2025年10月29日15时45分起,已更改开源协议,并包含以下特定要求
* 此项目仅限个人使用，禁止用于商业行为(包括但不限于：youtube,bilibili,tiktok,facebook..等等)
* 禁止新建项目将代码复制到自己仓库中用做商业行为
* 请遵守当地法律法规,禁止滥用做公共代理行为
* 如有违反以上条款者将追究法律责任

## 说明 （部署前请仔细阅读）

* 本项目是针对node环境的paas平台和游戏玩具而生，采用Argo隧道部署节点，可选哪吒探针v0/v1或Lite探针。
* node玩具平台只需上传index.js和package.json即可，paas平台需要docker部署的才上传Dockerfile。
* 不填写ARGO_DOMAIN和ARGO_AUTH两个变量即启用临时隧道，反之则使用固定隧道。
* 哪吒v0/v1可选,当哪吒端口为{443,8443,2096,2087,2083,2053}其中之一时，自动开启tls。

## 📋 环境变量

| 变量名 | 是否必须 | 默认值 | 说明 |
|--------|----------|--------|------|
| UPLOAD_URL | 否 | - | 订阅上传地址 |
| PROJECT_URL | 否 | https://www.google.com | 项目分配的域名 |
| AUTO_ACCESS | 否 | false | 是否开启自动访问保活 |
| PORT | 否 | 3000 | HTTP服务监听端口 |
| ARGO_PORT | 否 | 8001 | Argo隧道端口 |
| UUID | 否 | 9afd1229-b893-40c1-84dd-51e7ce204913 | 节点UUID |
| NEZHA_SERVER | 否 | - | 哪吒面板域名 |
| NEZHA_PORT | 否 | - | 哪吒端口 |
| NEZHA_KEY | 否 | - | 哪吒密钥 |
| PROBE_TYPE | 否 | nezha | 探针类型：nezha、lite、none；默认保持原有哪吒行为 |
| LITE_SERVER | 选择lite时必填 | - | Lite面板完整HTTP(S)地址，例如 https://lite.example.com |
| LITE_TOKEN | 选择lite时必填 | - | Lite后台对应节点的Token，不是管理员密码 |
| LITE_AGENT_VERSION | 否 | latest | 启动时下载的Lite-agent发布标签；不关闭运行期间自动更新 |
| ARGO_DOMAIN | 否 | - | Argo固定隧道域名,留空使用临时隧道 |
| ARGO_AUTH | 否 | - | Argo固定隧道密钥 |
| CFIP | 否 | www.visa.com.tw | 节点优选域名或IP |
| CFPORT | 否 | 443 | 节点端口 |
| NAME | 否 |   | 节点名称前缀 |
| FILE_PATH | 否 | ./tmp | 运行目录 |
| SUB_PATH | 否 | sub | 订阅路径 |
| CHAT_ID | 否 |   | 推送节点的chat id,需要和bot token同时填写生效 |
| BOT_TOKEN | 否 |  | 推送节点的bot token |
| SHOW_LOG | 否 | true | 是否显示日志,no/false/disable屏蔽,true/yes显示|

## Lite探针与Cloady部署

在Lite后台添加节点，从该节点的“节点配置 → 部署指令”取得面板地址和Token。在Cloady的环境变量中填写：

```env
PROBE_TYPE=lite
LITE_SERVER=https://lite.example.com
LITE_TOKEN=替换为该节点的Token
LITE_AGENT_VERSION=latest
```

默认`latest`会在每次容器启动时下载当时的正式版，运行期间也始终开启Agent自动更新。若指定版本标签，只决定启动时下载的版本，不锁定运行版本。自动更新完成后，脚本会重新启动更新后的Agent并保留两个常开参数。每个独立实例应使用自己的节点Token。

选择`lite`时忽略所有`NEZHA_*`变量。选择`nezha`（或不设置`PROBE_TYPE`）时沿用原来的哪吒v0/v1配置；选择`none`关闭所有探针。Lite配置缺失或下载失败会输出错误，但不会阻塞隧道启动。

将改动合并到GitHub的`main`后，现有Actions构建并发布`ghcr.io/yizongb/nodejs:latest`（amd64/arm64）。Cloady使用该镜像，设置上述环境变量及原有隧道变量，然后重新拉取镜像并部署。私有镜像需配置拉取凭据，或将GitHub Packages中的镜像设为公开。节点Token只填在Cloady环境变量中，不要提交到仓库。

Lite-agent在容器启动时从GitHub Releases下载，需要容器能够访问GitHub及Lite面板。它直接作为子进程运行，不需要systemd；状态保存在`FILE_PATH/lite`，不受90秒清理任务影响。默认校验证书，并固定传入`--disable-auto-update=false`和`--enable-remote-control=true`，始终开启Agent自动更新与远程控制。要使用远程终端、文件管理和远程执行，还需要在Lite面板的“系统设置 → 通用 → 允许远程管理”中开启面板端开关。日志中的`process started`仅表示进程已启动，是否成功上报以Lite面板在线状态为准。容器环境统计以容器可见资源为准。

## 🌐 订阅地址

- 标准端口：`https://your-domain.com/sub`
- 非标端口：`http://your-domain.com:port/sub`

---

## 🚀 进阶使用

### 安装

```bash
# 全局安装（推荐）
npm install -g nodejs-argo

# 或者使用yarn
yarn global add nodejs-argo

# 或者使用pnpm
pnpm add -g nodejs-argo
```

### 基本使用

```bash
# 直接运行（使用默认配置）
nodejs-argo

# 使用npx运行
npx nodejs-argo

# 设置环境变量运行
 PORT=3000 npx nodejs-argo
```

### 环境变量配置

可使用 `.env` 文件来配置环境变量运行


或者直接在命令行中设置：

```bash
export UPLOAD_URL="https://your-merge-sub-domain.com"
export PROJECT_URL="https://your-project-domain.com"
export PORT=3000
export UUID="your-uuid-here"
export NEZHA_SERVER="nz.your-domain.com:8008"
export NEZHA_KEY="your-nezha-key"
```

## 📦 作为npm模块使用

```javascript
// CommonJS
const nodejsArgo = require('nodejs-argo');

// ES6 Modules
import nodejsArgo from 'nodejs-argo';

// 启动服务
nodejsArgo.start();
```

## 🔧 后台运行

### 使用screen（推荐）
```bash
# 创建screen会话
screen -S argo

# 运行应用
nodejs-argo

# 按 Ctrl+A 然后按 D 分离会话
# 重新连接：screen -r argo
```

### 使用tmux
```bash
# 创建tmux会话
tmux new-session -d -s argo

# 运行应用
tmux send-keys -t argo "nodejs-argo" Enter

# 分离会话：tmux detach -s argo
# 重新连接：tmux attach -t argo
```

### 使用PM2
```bash
# 安装PM2
npm install -g pm2

# 启动应用
pm2 start nodejs-argo --name "argo-service"

# 管理应用
pm2 status
pm2 logs argo-service
pm2 restart argo-service
```

### 使用systemd（Linux系统服务）
```bash
# 创建服务文件
sudo nano /etc/systemd/system/nodejs-argo.service

```
[Unit]
Description=Node.js Argo Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/test
Environment=ARGO_PORT=8080
Environment=PORT=3000
ExecStart=/usr/bin/npx nodejs-argo
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

# 启动服务
sudo systemctl start nodejs-argo
sudo systemctl enable nodejs-argo
```

## 🔄 更新

```bash
# 更新全局安装的包
npm update -g nodejs-argo

# 或者重新安装
npm uninstall -g nodejs-argo
npm install -g nodejs-argo
```

## 📚 更多信息

- [GitHub仓库](https://github.com/eooce/nodejs-argo)
- [npm包页面](https://www.npmjs.com/package/nodejs-argo)
- [问题反馈](https://github.com/eooce/nodejs-argo/issues)

---

## 赞助
* 感谢[VPS.Town](https://vps.town)提供赞助 <a href="https://vps.town" target="_blank"><img src="https://vps.town/static/images/sponsor.png" width="30%" alt="https://vps.town"></a>

* 感谢[ZMTO](https://zmto.com/?affid=1548)提供赞助优质双isp vps。
