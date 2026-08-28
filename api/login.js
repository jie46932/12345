// api/login.js — Vercel Serverless Function
// 账号密码从环境变量读取，永远不暴露在前端代码中
export default function handler(req, res) {
  // 只允许 POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { username, password } = req.body || {};
  const adminUser = process.env.ADMIN_USER;
  const adminPass = process.env.ADMIN_PASS;
  const accessToken = process.env.ACCESS_TOKEN;

  if (!adminUser || !adminPass || !accessToken) {
    return res.status(500).json({ success: false, message: 'Auth service is not configured' });
  }

  if (
    username === adminUser &&
    password === adminPass
  ) {
    // 验证通过：返回一个访问令牌（生产环境建议换成 JWT）
    return res.status(200).json({
      success: true,
      token: accessToken,
    });
  }

  // 统一返回 401，不区分"用户名错"还是"密码错"（防枚举）
  return res.status(401).json({ success: false, message: '账号或密码错误' });
}
