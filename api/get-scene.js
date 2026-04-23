// api/get-scene.js — Vercel Serverless Function
// 验证 token 后返回场景文件的真实路径，不暴露在前端 HTML/JS 中
export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  // 从 Authorization 头或 query 参数读取 token
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : req.query?.token;

  const validToken = process.env.ACCESS_TOKEN || 'he_furniture_v3d_access';

  if (!token || token !== validToken) {
    return res.status(401).json({ success: false, message: '无效的访问凭证' });
  }

  // 验证通过，返回伪装路径（Vercel rewrite 将 .xz 映射到实际 .dat 文件）
  return res.status(200).json({
    success: true,
    sceneURL: 'media/12345.gltf.xz',
  });
}
