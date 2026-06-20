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
- 后台 iframe Viewer：`http://127.0.0.1:5173/index.html?bypass=1&viewer=1`

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

- `media/12345.gltf` 外部资源缺失数为 0。
- Viewer 加载后 `window.v3d === undefined`。
- 3D canvas、`window.__threeScene`、mesh、环境贴图、升降动画都能通过浏览器 JS 检测。
- 后台联动只来自允许的后台 origin，默认 `http://127.0.0.1:5174`。
- 本地调参写入接口默认禁用；只有设置 `VITE_ENABLE_WRITE_APIS=1` 后，`/api/write-*` 才能写入源码默认值。

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
- 源码调参接口或本地开发服务

部署前建议用静态服务器预览 `dist/`，确认 `/media/12345.gltf`、`/media/12345.bin`、贴图、HDR、音频和二维码资源均返回 200。

## 与后台联动

后台项目运行在 `F:\houtai`，默认端口 `5174`。

Viewer 允许的后台来源可通过环境变量配置：

```env
VITE_ADMIN_ORIGINS=http://127.0.0.1:5174,http://localhost:5174
VITE_PARENT_TARGET_ORIGIN=http://127.0.0.1:5174
```
