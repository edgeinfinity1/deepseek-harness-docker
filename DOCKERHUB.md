# deepseek-harness（Docker 镜像）

镜像地址（默认）：**`smanx/deepseek-harness:latest`**（Docker Hub）
镜像地址（备用）：**`ghcr.io/smanx/deepseek-harness:latest`**（GitHub Container Registry，GHCR，所有 tag 同步推送）
Docker Hub 项目主页：https://hub.docker.com/r/smanx/deepseek-harness
Github 项目主页：https://github.com/smanx/deepseek-harness-docker


一个开箱即用的 **DeepSeek Harness（DSH）** Docker 镜像，内置了 Node 反向代理，解决 DSH 官方不允许 `--host 0.0.0.0`、只能监听回环地址的问题，让 DSH 可以安全地通过局域网访问。

## 在线体验地址（Demo）

- 体验地址：https://deepseek-harness-test-latest.onrender.com
- 登录账号 / 密码：`admin` / `admin`

> ⚠️ **注意：** 该地址为**公开地址**。如需填入你自己的 API Key（如 DeepSeek 等），请**谨慎填写**，以免 Key 泄露。

## 项目介绍

- **DSH**：容器内安装官方 npm 包 `@deepseek-ai/dsh`（[deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)），默认监听容器内 `127.0.0.1:3079`（源端口）；
- **Node 代理**：`0.0.0.0:3080`（代理端口）→ `127.0.0.1:3079`，对外提供 HTTP + WebSocket 转发；
- **为什么需要代理**：
  - DSH 官方禁止 `--host 0.0.0.0`（安全限制），只能监听回环地址；
  - 局域网 IP 页面属于浏览器**非安全上下文**，DSH 前端依赖的 `crypto.randomUUID` 不可用，代理在转发 HTML 时自动注入基于 `getRandomValues` 的 polyfill，否则实时通道（WS）会一直 pending；
  - 代理同时提供可选的 **HTTP Basic Auth**，给局域网访问加认证。

## 快速开始（拉取运行）

```bash
# 1. 拉取镜像（默认从 Docker Hub 拉取）
docker pull smanx/deepseek-harness:latest

# 2. 启动（默认：代理对外端口 3080，数据持久化到命名卷 dsh-data）
docker run -d \
  --name dsh-harness \
  -p 3080:3080 \
  -v dsh-data:/root/.dsh \
  --restart unless-stopped \
  smanx/deepseek-harness:latest

# 3. 访问
#    本机：  http://127.0.0.1:3080/
#    局域网：http://<服务器局域网IP>:3080/
```

WebSocket 实时通道（`/api/events.mux`、`/api/events.host`）由代理自动转发，无需额外配置。

### 不同 tag 的区别

| tag | 定位 | 包含工具 |
|---|---|---|
| `latest` | 精简运行镜像 | 无（仅 Node 运行时 + DSH + 反向代理） |
| `devtools-min-latest` | 精简工具版，常用调试工具 | git、curl、wget、nano、jq、procps、ca-certificates、unzip；npm 全局包：pnpm；uv |
| `devtools-latest` | 完整工具版，可在容器内开发/编译 | 精简版全部 + vim、openssh-client、zip、htop、tmux、tree、openssl、python3、build-essential(make+g++)、bash-completion；npm 全局包：pnpm；uv |
| `admin-latest` | 管理版：**预装最新 DSH**，开箱即用，页面自选版本安装/切换 | 同完整工具版（含 pnpm、uv）+ 管理服务；保留 python3/build-essential 供运行时编译 node-pty |

> 每个 tag 都有对应的**版本号 tag**：`latest` ↔ `<版本>`、`devtools-latest` ↔ `devtools-<版本>`、`devtools-min-latest` ↔ `devtools-min-<版本>`、`admin-latest` ↔ `admin-<版本>`（admin 预装最新 DSH，版本号 tag 即为 DSH 版本）。

**简单示例：**

```bash
# 场景一：只想在浏览器里跑 DSH，不做任何调试 → 用精简的 latest
docker run -d \
  --name dsh-harness \
  -p 3080:3080 \
  -v dsh-data:/root/.dsh \
  --restart unless-stopped \
  smanx/deepseek-harness:latest

# 场景二：需要进容器排查问题（看日志、jq 处理 JSON、wget 抓包）→ 用 devtools-min-latest
docker run -d \
  --name dsh-harness \
  -p 3080:3080 \
  -v dsh-data:/root/.dsh \
  --restart unless-stopped \
  smanx/deepseek-harness:devtools-min-latest

# 场景三：要在容器里开发/编译扩展或做较重的运维（vim、python3、make 等）→ 用 devtools-latest
docker run -d \
  --name dsh-harness \
  -p 3080:3080 \
  -v dsh-data:/root/.dsh \
  --restart unless-stopped \
  smanx/deepseek-harness:devtools-latest
```

三个 tag 的启动命令完全一样，只是把镜像名替换成对应的 tag 即可；`latest` 之外的工具版镜像会比精简版略大，按需选择。

> 工具版（devtools / devtools-min / test）内置 **pnpm**（npm 全局安装）。DSH 的 `dsh plugin` 命令依赖 pnpm 管理插件，
> 社区插件市场 [dsh-market](https://github.com/dsh-market/dsh-market)（`dsh plugin --profile web add dshmarket`）也需要它；
> 精简版 `latest` 不内置，首次使用插件时 dsh-market 会检测缺失并提供一键自动安装。
>
> 工具版还内置 **uv**（Python 包管理器，静态二进制，不依赖系统 Python）。不少社区 MCP server 以
> `uvx` / `uv run` 方式启动（DSH 的 MCP 客户端配置中常见 `"command": "uvx"`），缺少 uv 时这类 MCP 无法运行。

#### admin 变体（管理版，预装最新 DSH）

`admin` 变体**随镜像预装最新 DSH（@next）**。容器启动后管理服务自动识别并拉起 DSH，直接访问 `/` 即可进入 DSH 界面；访问 `/__admin/` 进入管理台：

- 查看 `@deepseek-ai/dsh` 可用版本（`latest`/`next` 等 dist-tag + 全部版本），选择并**安装 / 切换**版本，安装进度实时显示；
- 手动配置 **npm 源（NPM_CONFIG_REGISTRY）**：输入框**自动回显默认值**（环境变量 `NPM_CONFIG_REGISTRY` 或官方源）与**上次配置的值**，并显示当前生效值，可一键「使用默认值」或清空恢复默认；优先级：**页面配置 > 环境变量 `NPM_CONFIG_REGISTRY` > 默认值**；
- 一键**重启** DSH；安装完成后自动启动，页面右下角悬浮「⚙ 管理」按钮可随时回到管理台调整版本。

```bash
# admin 变体：需要两个命名卷（dsh-data 存 DSH 配置/会话、dsh-install 存 DSH 安装文件与配置状态，
# 这样容器重建后升级/源配置依然有效）
docker run -d \
  --name dsh-harness \
  -p 3080:3080 \
  -v dsh-data:/root/.dsh \
  -v dsh-install:/opt/dsh \
  --restart unless-stopped \
  smanx/deepseek-harness:admin-latest
```

> admin 变体保留了 `python3` + `build-essential`（node-pty 在 Linux 上无预编译产物，管理台安装其他版本 DSH 时需容器内从源码编译原生模块），镜像比精简版略大。

### 备用镜像（GHCR）

如果从 Docker Hub 拉取受限（如网络问题），可以使用备用镜像（GitHub Container Registry，tag 与 Docker Hub 完全一致）：

```bash
# 拉取 GHCR 上的镜像
docker pull ghcr.io/smanx/deepseek-harness:latest

# 启动命令与默认镜像完全一样，只需替换镜像名
docker run -d \
  --name dsh-harness \
  -p 3080:3080 \
  -v dsh-data:/root/.dsh \
  --restart unless-stopped \
  ghcr.io/smanx/deepseek-harness:latest
```

> 除镜像地址不同外，两个镜像的配置与使用方式完全一致，可互相替换。

## 配置（环境变量）

| 环境变量 | 含义 | 默认值 |
|---|---|---|
| `DSH_PORT` | 源端口：DSH 在容器内监听（`127.0.0.1`） | `3079` |
| `PROXY_PORT` | 代理端口：代理对外监听（局域网入口） | `3080` |
| `PROXY_USERNAME` | Basic Auth 用户名（可选） | 未设置 |
| `PROXY_PASSWORD` | Basic Auth 密码（可选） | 未设置 |
| `NPM_CONFIG_REGISTRY` | admin 变体管理页「npm 源」的默认值（优先级低于页面配置） | `https://registry.npmjs.org/` |
| `DSH_INSTALL_DIR` | admin 变体 DSH 安装目录（页面安装的 DSH 及状态文件都在这里，建议挂载命名卷） | `/opt/dsh` |

> `DSH_PORT` 与 `PROXY_PORT` 必须不同（同一端口只能被一个进程监听）。
> 修改 `PROXY_PORT` 时，`-p` 端口映射要对应改成 `-p <宿主机端口>:<新代理端口>`。

### 启用 Basic Auth

```bash
docker run -d \
  --name dsh-harness \
  -p 3080:3080 \
  -v dsh-data:/root/.dsh \
  -e PROXY_USERNAME=yourname \
  -e PROXY_PASSWORD=yourpass \
  --restart unless-stopped \
  smanx/deepseek-harness:latest
```

- 用户名和密码**两个都设置**才启用认证；只设置一个（或都不设置）则完全放行；
- 认证对 HTTP 和 WebSocket 都生效，未通过认证返回 `401` + `WWW-Authenticate`，浏览器会弹出认证框；
- 公开静态资源 `/manifest.webmanifest`、`/favicon.svg`、`/favicon.ico` 不参与认证（只含应用名/图标等非敏感数据）。浏览器抓取 `<link rel="manifest">` 时不会携带 Basic Auth 凭据，若强制认证，控制台会持续报 `/manifest.webmanifest` 401。

### 修改代理端口

```bash
# 例如代理对外用 3088
docker run -d \
  --name dsh-harness \
  -p 3088:3088 \
  -v dsh-data:/root/.dsh \
  -e PROXY_PORT=3088 \
  --restart unless-stopped \
  smanx/deepseek-harness:latest
```

## 数据持久化

DSH 的会话/配置数据保存在容器内 `/root/.dsh`，上面的命令用命名卷 `dsh-data` 持久化：

- `docker stop/start` 和容器删除后卷仍在，数据不丢；
- 彻底清除数据：`docker volume rm dsh-data`（先停容器）。

## 停止 / 重启 / 删除

```bash
docker stop dsh-harness     # 停止
docker start dsh-harness    # 再次启动
docker logs -f dsh-harness  # 查看日志
docker rm -f dsh-harness    # 删除容器（卷中的数据保留）
```

## 联系作者 / 反馈

- 交流与 Bug 反馈：https://github.com/deepseek-ai/deepseek-harness/discussions/1762
