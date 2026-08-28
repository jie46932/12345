# 2026-07-02 登录、部署、媒体与交付记录

## 项目事实

- 当前线上域名：`https://hefurniture.gsdmsj.cn/`
- 发布目录：`/srv/www/projects/12345/current`
- 本地项目路径：`F:\verge3d app manager\12345`
- 只发布 `dist/*`，不发布源码、DOC、`.env`、`.max`、`node_modules`。

## 已确认经验

- 账号密码登录：生产与本地 mock 均使用 `当前新口令`。
- 登录态：刷新页面不重新登录；清除 Cookie / 站点数据后重新登录。
- 微信扫码登录：当前项目不再作为默认登录方式，默认保留短信验证码和账号密码登录。
- 登录后加载：加载组件应复用登录页背景，只替换中间内容。
- 语言切换：左上角 `智能升降桌` 不翻译。
- 升降音效：短音频循环需要 Web Audio 预排程，避免 `<audio loop>` 缝隙。
- 模型贴图：重新导出 glTF 后贴图丢失时，优先恢复 S8S 贴图元数据。

## 稳定部署命令

```powershell
$env:DEPLOY_HOST="39.108.48.171"
$env:DEPLOY_USER="root"
$env:DEPLOY_PORT="22"
$env:DEPLOY_PATH="/srv/www/projects/12345/current"
$env:DEPLOY_IDENTITY="C:\Users\16905\.ssh\id_ed25519"
npm run deploy:server
```

## 必做验证

```powershell
npm run lint
npm run build
npm run check:security
```

线上发布后检查：

- 首页 200。
- 当前 HTML 引用的 `assets/index-*.js` 是本次构建产物。
- `/api/login` 返回 JSON，不返回 HTML。
- `当前新口令` 返回 200。
- 旧口令返回 401。
- 页面中没有旧英文副标题 `SMART DESK`。

## 注意事项

- 不把密钥、AccessKey、AppSecret、token 写入 DOC、README、Git 或长期记忆。
- 服务器环境变量变更后必须重启 `12345-auth-api`。
- 不用截图作为验收依据，必须用接口、DOM、资源和 bundle 检查确认。
