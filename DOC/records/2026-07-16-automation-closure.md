# 八类自动化闭环实施记录

- 已接入：6 个 Node 测试、GitHub Actions、glTF 检查、性能预算、浏览器验收脚本、安全 release/回滚和统一命令。
- 已验证：test、lint、glTF、build、security、doc、budget 通过。
- 静态预算：dist 164.85MB，最大 JS 1.82MB，glTF/bin 122.82MB。
- 阻断项：尚未在 3ds Max 执行第一次 `reports/scan-max-scene.ms`，`check:max` 保持失败。
- 浏览器：线上 bundle 与本地一致，但隔离浏览器没有验收登录凭据，未进入 canvas；不记为通过。凭据只允许通过 `VERIFY_LOGIN_USERNAME` / `VERIFY_LOGIN_PASSWORD` 注入。
- 安全边界：只发布 dist，不保存生产密钥，不在 CI 连接 ECS。
