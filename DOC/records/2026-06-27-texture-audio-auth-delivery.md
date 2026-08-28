# 2026-06-27 贴图、升降音效、登录持久化与部署记录

## 范围

本记录只覆盖 `12345` Viewer 项目本日已验证的交付修复。

项目路径：

`F:\verge3d app manager\12345`

线上入口：

`https://hefurniture.gsdmsj.cn`

## 1. 重新导出 glTF 后贴图丢失

### 现象

重新导出 `media/12345.gltf` 后，以下对象贴图丢失：

- `Rectangle004`
- `对象012`
- `对象013`
- `对象014`
- `对象015`

### 原因

这些对象的材质在新 glTF 中丢失了 Verge3D/S8S bitmap 节点，表现为 `BITMAP_MX` 变成 `BITMAP_NONE_MX`。

旧版 `media/12345-verge3d-20260622.gltf` 中仍有正确引用。

### 修复

新增脚本：

`scripts/restore-deleted-object-textures.cjs`

脚本从参考 glTF 恢复目标材质、纹理和图片引用，并同步处理：

- `media/12345.gltf`
- `media/12345-draco.gltf`

同时修复：

`src/utils/S8SExtension.js`

纹理 source 读取顺序现在兼容：

- `texture.source`
- `S8S_v3d_texture.source`
- `KHR_texture_basisu.source`

### 验证

- `npm run check:gltf` 通过。
- 外部资源缺失为 `0`。
- mesh 数为 `134`。
- 运行时 `window.v3d === undefined`。
- 运行时 `window.__threeScene` 存在。
- 浏览器资源包含：
  - `/media/shang.ktx2`
  - `/media/1.ktx2`
  - `/media/2.ktx2`
  - `/media/3.ktx2`
- 五个对象运行时 `material.map === true`。

## 2. 升降音效循环

### 文件

`media/BW61769-loop.wav`

### 处理

- 多轮提升音量，每次处理前备份到 `_recycle/audio/`。
- 当前文件为 48kHz stereo 16-bit PCM WAV。
- 当前时长约 `0.92s`。
- 当前峰值约 `0.0127`，未削波。

### 代码策略

普通音频循环仍可能在短音效之间产生缝隙，因此 `src/App.jsx` 改为 Web Audio 预调度：

- 预先 decode 音频 buffer。
- 在升降动画期间提前调度多个 one-shot source。
- 使用 `AudioContext.currentTime` 控制每段开始时间。
- 动画停止时清理后续 source。

### 验证

- 触发 `window.__sceneAPI.playToFrame(120)` 后，音频资源被请求。
- 控制台无 lift sound 错误。
- 线上 `BW61769-loop.wav` 返回 `200 audio/wav`。

## 3. 登录持久化

### 目标

- 刷新网页不重新登录。
- 清除缓存、Cookie 或站点数据后重新登录。

### 原因

之前 token 主要存在内存 `Map`，页面刷新后丢失。

### 修复

`src/utils/authStorage.js` 改为 cookie-backed token：

- memory 作为快速缓存。
- cookie 作为刷新后的恢复来源。
- HTTPS 下 cookie 带 `Secure`。
- 保留 `SameSite=Lax`。
- 清除登录态时同步清 memory、localStorage、sessionStorage、cookie。

### 验证

- 无 cookie 刷新：显示登录页。
- 写入 `v3d_token` 后刷新：不显示登录页。
- 清除 cookie 后刷新：回到登录页。

## 4. 部署

使用：

```powershell
npm run deploy:server
```

部署脚本已执行：

- `npm run check:gltf`
- `npm run lint`
- `npm run build`
- `npm run check:security`

当前状态：

- `check:gltf` 通过。
- `lint` 无 error，保留 4 个既有 warning。
- `build` 通过。
- `check:security` 通过。
- 线上 bundle 更新为 `assets/index-BT8O22-B.js`。

## 5. 后续复用提醒

- 重新导出 glTF 后，不要只看资源缺失数量；还要查目标对象运行时材质。
- 短音效无缝循环优先用 Web Audio 预调度。
- 登录持久化必须同时验收刷新、清 cookie、清站点数据三个场景。
- 部署后必须检查线上 bundle，不要只看服务器上传成功。
