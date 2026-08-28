# 12345 智能升降桌 Viewer

本项目只负责产品 Viewer、R3F 配置器、Verge3D 导出资产加载和 `postMessage` 配置接收。

母后台 / 子后台业务已迁移到独立项目：

`F:\houtai`

## 启动

```powershell
cd "F:\verge3d app manager\12345"
npm install
npm run dev:viewer
```

默认访问：

- 产品配置器：`http://127.0.0.1:5173/index.dev.html`
- 本地开发免登录调试：`http://127.0.0.1:5173/index.html?bypass=1`
- 后台 iframe Viewer：`http://127.0.0.1:5173/index.html?viewer=1`

`?bypass=1` 只在 Vite 本地开发环境生效，生产构建不会绕过登录。

访问 `?portal=admin` 或 `?portal=client` 时，本项目只显示迁移提示，不再加载后台代码。

## 技术边界

- `engine: r3f`
- `exportPipeline: verge3d`
- 3ds Max + Verge3D 负责导出 `glTF/bin/贴图`。
- React + R3F + Three.js 负责运行时展示。
- `S8SExtension`、`S8SMaterialLoader`、`v3d-loader` 是 Verge3D S8S 私有扩展兼容层，不能删除。
- 本项目不直接运行 Verge3D 页面或 `window.v3d` runtime。

## 验证命令

```powershell
npm run check:gltf
npm run lint
npm run build
```

核心验收：

- 当前生产模型入口为 `media/12345-verge3d-20260622.gltf`，外部资源缺失数为 0。
- Viewer 加载后 `window.v3d === undefined`。
- 3D canvas、`window.__threeScene`、mesh、环境贴图、升降动画都能通过浏览器 JS 检测。
- 后台联动只来自允许的后台 origin，默认 `http://127.0.0.1:5174`。
- 本地调参写入源码接口已移除；交付 Viewer 不再提供“确认写入代码”式调试面板。
- 登录态使用 cookie 持久化；刷新网页不需要重新登录，清理站点数据或 cookie 后需要重新短信验证或输入账号密码。

## 用户操作与异常上报

本项目可将 Viewer 用户操作、自动异常、资源加载失败和模型加载状态写入 Supabase。

启用步骤：

1. 在 Supabase SQL Editor 执行 `scripts/viewer-events.sql`。
2. 复制 `.env.example` 中的变量到本地或服务器构建环境。
3. 设置：

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_TELEMETRY_ENABLED=1
```

隐私边界：

- 只记录设备、浏览器、屏幕、WebGL 渲染器、页面路径、操作名和必要业务参数。
- 不记录账号、密码、token、电话、姓名、微信号、定位或输入框原文。
- Supabase RLS 只允许匿名写入 `viewer_events`，不能匿名读取事件。

## 静态部署清单

部署服务器时只上传 `npm run build` 生成的 `dist/` 目录内容。

必须包含：

- `dist/index.html`
- `dist/index.dev.html`
- `dist/assets/`
- `dist/media/`
- `dist/basis_transcoder/`

禁止上传：

- `.git/`
- `.env`
- `node_modules/`
- `_archive/`
- `backups/`
- `*.max`
- `*.zip` / `*.7z` / `*.rar`
- `*.pem` / `*.key` / `*.crt`
- 源码调参接口或本地开发服务

部署前建议用静态服务器预览 `dist/`，确认 `/media/12345-verge3d-20260622.gltf`、`/media/12345-verge3d-20260622.bin`、贴图、HDR、音频和二维码资源均返回 200。

### 生产部署安全清单

发布前必须执行：

```powershell
npm run check:gltf
npm run lint
npm run build
npm run check:security
```

配置好服务器 SSH 环境变量后，可以用一个命令完成检查、构建、安全扫描和同步：

```powershell
$env:DEPLOY_HOST="your-server-ip-or-domain"
$env:DEPLOY_USER="your-ssh-user"
$env:DEPLOY_PORT="22"
$env:DEPLOY_PATH="/srv/www/projects/12345/current"
$env:DEPLOY_IDENTITY="C:\Users\16905\.ssh\your_key"
npm run deploy:server
```

`deploy:server` 会把本地 `dist/` 打包上传到 `DEPLOY_PATH`，并清空该目录中的旧文件后解压新的静态站点。脚本会拒绝部署到 `/`、`.`、`~` 或过短路径。

发布允许清单：

- `dist/index.html`
- `dist/assets/`
- `dist/media/`
- `dist/basis_transcoder/`
- `dist/favicon.svg`

安全要求：

- 不上传项目源码目录、`.git/`、`.env`、`node_modules/`、`_archive/`、`backups/`、3ds Max 源文件和临时压缩包。
- 不把微信 `AppSecret`、Supabase 服务端高权限密钥、服务器 `ACCESS_TOKEN`、`ADMIN_PASS` 写入前端、README、Git 或 `dist/`。
- 如果 `.env` 中的密钥曾经被公开、提交或发送给第三方，必须在对应平台重置密钥；从文件中删除不等于密钥安全。
- `api/` 目录是 Vercel Serverless 兼容层。阿里云静态部署只上传 `dist/` 时不会自动执行这些接口。
- 阿里云生产接口必须由独立 Node/systemd 服务承接，并通过 Nginx 反向代理 `/api/login`、`/api/sms-login/*` 等真实接口。
- 交付项目不再包含 `/api/write-*` 写源码接口。生产 Nginx 不应暴露任何写源码调参接口。

## OSS / CDN 媒体资源部署

为避免 ECS 公网小带宽导致模型加载慢，推荐把 `dist/media/` 上传到阿里云 OSS，并通过 CDN 域名访问。

构建时设置媒体基址：

```env
VITE_MEDIA_BASE_URL=https://cdn.example.com/12345/media
```

配置后，模型、贴图、HDR、画廊、音乐、二维码和加载背景都会从该 CDN 基址读取。未配置时仍使用站点本地 `/media/`。

上传步骤：

```powershell
npm run build
$env:OSS_BUCKET="your-bucket"
$env:OSS_PREFIX="12345"
npm run upload:oss
```

前提：

- 已在执行机器上完成 `aliyun configure`，并只在本地/服务器保存 AccessKey。
- OSS Bucket 已允许 CDN 回源读取。
- CDN 域名已绑定到 OSS Bucket，并配置 CORS 允许 `https://hefurniture.gsdmsj.cn`。
- 不要把 `AccessKeyId`、`AccessKeySecret` 写入 `.env.example`、README、源码或 Git。

上线后验证：

```powershell
curl -I https://cdn.example.com/12345/media/12345-verge3d-20260622.bin
curl -I https://cdn.example.com/12345/media/12345-verge3d-20260622.gltf
```

必须返回 `200`，并且 `.bin` 建议命中 CDN 缓存。

## 与后台联动

后台项目运行在 `F:\houtai`，默认端口 `5174`。

Viewer 允许的后台来源可通过环境变量配置：

```env
VITE_ADMIN_ORIGINS=http://127.0.0.1:5174,http://localhost:5174
VITE_PARENT_TARGET_ORIGIN=http://127.0.0.1:5174
```
