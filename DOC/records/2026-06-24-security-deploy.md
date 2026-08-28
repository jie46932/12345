# 2026-06-24 登录安全与服务器同步记录

## 涉及节点

- `11_backend_database_api`
- `14_deployment_nginx_ecs`
- `18_ops_data_maintenance`

## 已完成

- 生产环境 `?bypass=1` 不再绕过登录。
- 未登录时不挂载 3D 场景、动态背景、标注、Header、ControlBar。
- 登录态改为会话级存储：只写 `sessionStorage`，不写长期 `localStorage` 或长期 cookie。
- 页面启动时清理旧版本遗留的 `v3d_token` 长期存储。
- 微信登录用户信息从 `localStorage` 改为 `sessionStorage`。
- Vercel 兼容层 `api/login.js`、`api/get-scene.js` 移除 fallback token。
- 新增 `npm run check:security` 作为发布前泄露检查。
- 新增 `scripts/deploy-server.ps1`，用于 tar.gz 同步 `dist/` 到服务器。

## 验证

- `npm run check:gltf` 通过。
- `npm run lint` 通过，保留 4 个既有 warning。
- `npm run build` 通过。
- `npm run check:security` 通过。
- 线上最终 bundle 与本地一致：`index-BPMPP8s4.js`。

## 部署经验

旧公司脚本 `F:\company-knowledge-base\scripts\deploy-12345.ps1` 曾显示 `Deploy complete`，但线上没有切换到新 bundle。原因与 Windows zip 反斜杠路径有关：服务器提示 zip 使用 backslashes as path separators。

后续 12345 优先使用项目内 tar.gz 同步脚本：

```powershell
$env:DEPLOY_HOST="39.108.48.171"
$env:DEPLOY_USER="root"
$env:DEPLOY_PORT="22"
$env:DEPLOY_PATH="/srv/www/projects/12345/current"
$env:DEPLOY_IDENTITY="C:\Users\16905\.ssh\id_ed25519"
npm run deploy:server
```

## 必须复验

部署成功必须比对本地、线上、服务器当前目录中的 bundle 文件名。

```powershell
Select-String -Path dist\index.html -Pattern 'index-[A-Za-z0-9_-]+\.js|index-[A-Za-z0-9_-]+\.css' -AllMatches

$tmp=Join-Path $env:TEMP '12345-online-index.html'
curl.exe -s -L "https://hefurniture.gsdmsj.cn/?cacheBust=$([DateTimeOffset]::Now.ToUnixTimeMilliseconds())" -o $tmp
Select-String -Path $tmp -Pattern 'index-[A-Za-z0-9_-]+\.js|index-[A-Za-z0-9_-]+\.css' -AllMatches

ssh root@39.108.48.171 "grep -Eo 'index-[A-Za-z0-9_-]+\.(js|css)' /srv/www/projects/12345/current/index.html"
```

三处一致才算上线成功。

## 后续风险

- 如果微信 AppSecret 或 Supabase 高权限密钥曾在聊天、截图、文档或 Git 历史中暴露，需要轮换。
- 如果未来要求跨会话免登录，应使用服务端会话或 refresh token，不要恢复长期本地明文 token。
