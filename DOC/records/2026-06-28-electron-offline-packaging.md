# 2026-06-28 Electron 离线打包与轻量化记录

## 已验证结论

- Windows 离线交付使用 Electron 便携版 `.exe`。
- 手机、iPad、微信和浏览器不能直接运行 `.exe`；移动端需要 Web/PWA、Android APK、iOS App 或局域网访问方案。
- 当前 Electron 离线包验证通过：
  - `window.__electronOffline === true`
  - 不显示登录页
  - `window.v3d === undefined`
  - `window.__threeScene` 存在
  - `viewerMeshCount === "134"`

## 轻量化结果

- `release-electron` 目录曾经偏大，是因为同时包含：
  - 便携版 exe
  - `win-unpacked` 解压调试目录
  - `builder-debug.yml`
- 交付只需要便携版 exe。
- 验收后删除 `win-unpacked` 和 `builder-debug.yml`，`release-electron` 只保留：
  - `12345 智能升降桌 0.0.0.exe`
- 当前 exe 约 `83.47MB`。

## 固化改动

- `electron/main.cjs`：加载本地 `dist/index.html`，关闭 Node 注入，启用隔离。
- `electron/preload.cjs`：只暴露 `window.__electronOffline = true`。
- `scripts/prune-electron-dist.cjs`：Electron 打包前裁剪离线包不需要的资源。
- `package.json`：
  - `electron:dev`
  - `electron:pack`
  - `electronLanguages: ["zh-CN", "en-US"]`

## 踩坑

- `dist/media` 中曾同时包含多套模型：
  - `12345-verge3d-*.bin`
  - `12345.bin`
  - `12345-draco.bin`
  - `.gz/.xz` 网络压缩副本
- Electron 运行只需要当前入口引用的 `12345-draco.gltf/bin`。
- `.gz/.xz` 主要服务 Web/Nginx，不需要放进 Electron 离线包。
- `dist/media/optimized/` 是压缩实验产物，不能跟随 Electron 打包。

## 后续规则

- 打包命令固定使用：
  - `npm run electron:pack`
- 验收 Electron 后，只交付：
  - `release-electron\12345 智能升降桌 0.0.0.exe`
- 不交付：
  - `win-unpacked`
  - `.env`
  - `.git`
  - `node_modules`
  - `*.max`
  - `_archive`
  - `_recycle`
- 如果必须显著小于 80MB，Electron 不是合适路线，应评估 Tauri/WebView2。
