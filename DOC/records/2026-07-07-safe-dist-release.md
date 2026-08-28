# 2026-07-07 防泄露发布记录

## 范围

- 项目：12345 智能升降桌 Viewer
- 本地路径：`F:\verge3d app manager\12345`
- 线上域名：`https://hefurniture.gsdmsj.cn/`
- 服务器目录：`/srv/www/projects/12345/current`
- 发布原则：只发布当前 `dist/`，不从项目根目录复制文件。

## 执行顺序

1. `npm run build`
2. `npm run rename-assets -- --entry dist/media/12345-draco.gltf --prefix=12345_v1`
3. `npm run check:gltf -- dist/media/12345_v1.gltf`
4. `npm run check:security`
5. 本地浏览器烟测
6. Electron 离线烟测
7. `npm run deploy:server -- -SkipBuild`
8. 线上 HTTP 与浏览器烟测
9. 验收通过后清理本地 `dist_prev/`

## 验证结果

- `check:gltf` 通过。
  - 入口：`dist/media/12345_v1.gltf`
  - mesh：134
  - resources missing：0
- `check:security` 通过。
- 本地浏览器烟测通过。
  - `window.v3d === undefined`
  - `window.__threeScene === true`
  - `viewerMeshCount === "134"`
  - 不再请求 `12345-draco.gltf`
- Electron 烟测通过。
  - `window.__electronOffline === true`
  - 离线入口使用当前 `dist/index.html`
  - mesh：134
- 服务器发布目录禁传项检查为空。
  - 未发现 `.env`、`.git`、`node_modules`、`dist_prev`、`dist_temp`、`_archive`、`_recycle`、`*.max`、`*.zip`、`*.pem`、`*.key`

## 线上 HTTP 验证

- `https://hefurniture.gsdmsj.cn/` 返回 200。
- `https://hefurniture.gsdmsj.cn/media/12345_v1.gltf` 返回 200。
  - `Content-Type: model/gltf+json`
  - `Cache-Control: no-cache, must-revalidate`
- `https://hefurniture.gsdmsj.cn/media/12345_v1.bin` 返回 200。
  - `Content-Type: application/octet-stream`
  - `Cache-Control: no-cache, must-revalidate`
- 不存在的 `.bin/.ktx2/.hdr` 返回 404，且不再返回 `text/html`。

## Nginx 调整

- 已备份：`/etc/nginx/conf.d/hefurniture.gsdmsj.cn.conf.bak-20260707-media-cache`
- 已备份：`/etc/nginx/conf.d/hefurniture.gsdmsj.cn.conf.bak-20260707-media-404`
- `/media/` 改为：
  - `try_files $uri @media_404`
  - `Cache-Control: no-cache, must-revalidate`
- 缺失媒体资源通过 `@media_404` 返回短文本 404，避免返回 SPA 或 HTML 错误页。
- `/assets/` 保持 hash 构建产物长缓存。

## 线上浏览器烟测

- `sceneReady === "true"`
- `envReady === "true"`
- `meshCount === "134"`
- `canvasCount === 2`
- `window.v3d === undefined`
- 资源请求中不包含 `12345-draco`。
- 资源请求中包含 `12345_v1.gltf`、`12345_v1.bin` 与重命名后的贴图。

## 遗留观察

- 已修复线上 `/api/project-config?projectId=project_12345` 的 JSON 404。
  - 原因：服务器已有 `project_hefurniture.json`，但前端请求 `project_12345`。
  - 处理：在 `/srv/data/project-configs/` 增加 `project_12345.json`。
- 已修复画廊资源 404。
  - 原因：服务器项目配置仍引用 `/media/4.png` 到 `/media/9.png`，实际发布资源为 `.jpg`。
  - 处理：将 `project_12345.json` 的 `galleryImages` 改为 `/media/4.jpg` 到 `/media/9.jpg`。
- 最终线上浏览器烟测无 4xx/5xx 响应。

## 收尾

- 本地 `dist_prev/` 已在全部验收后删除。
- 本地 `dist_temp/` 不存在。

## 2026-07-18 历史模型资源清理

- 已调整 `scripts/copy-vercel-assets.cjs`：
  - 构建复制 `media/` 时跳过历史/备用模型：
    - `media/12345.gltf`
    - `media/12345.bin`
    - `media/12345.gltf.xz`
    - `media/12345.bin.xz`
    - `media/12345-verge3d-*`
    - `media/optimized/`
  - 当前发布入口仍由 `12345-draco.gltf` 构建后重命名为 `12345_v1.gltf`。
- 已修复 `scripts/deploy-server.ps1`：
  - 远端部署脚本改为上传 LF 格式临时 shell 脚本后执行，避免 PowerShell 管道带入 CRLF。
  - 发布前会清空服务器目标目录，再解压当前 `dist/`，避免旧模型覆盖残留。
- 本地验证：
  - `npm run build` 通过。
  - `npm run rename-assets -- --entry dist/media/12345-draco.gltf --prefix=12345_v1` 通过。
  - `npm run check:gltf -- dist/media/12345_v1.gltf` 通过，资源缺失为 0。
  - `npm run check:security` 通过。
  - 本地静态预览验证：`sceneReady=true`、`envReady=true`、`meshCount=134`。
- 线上验证：
  - 服务器 `/srv/www/projects/12345/current/media` 只保留 `12345_v1.*` 当前模型发布资源。
  - 旧入口返回 404：
    - `/media/12345-draco.gltf`
    - `/media/12345-verge3d-20260622.gltf`
    - `/media/optimized/12345-draco.gltf`
  - 浏览器运行时验证：
    - `sceneReady === "true"`
    - `envReady === "true"`
    - `meshCount === "134"`
    - `window.v3d === undefined`
    - 实际请求不包含 `12345-draco`、`12345-verge3d` 或 `/optimized/`。
