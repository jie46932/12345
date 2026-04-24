import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from 'tailwindcss'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import obfuscatorPlugin from 'vite-plugin-javascript-obfuscator'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 自定义插件：dev 模式下把根目录的 .gltf/.bin/v3d.js/12345.js 直接 serve
// 同时提供 /api/login 和 /api/get-scene mock（本地开发用，读取 .env.local 环境变量）
function serveRootFiles() {
  const rootFiles = ['12345.gltf', '12345.bin', 'v3d.js', '12345.js']
  return {
    name: 'serve-root-files',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url.split('?')[0]

        // 访问根路径或 /index.html 时，重写为 /index.dev.html 让 Vite 处理
        if (url === '/' || url === '/index.html') {
          req.url = '/index.dev.html'
          return next()
        }

        // 本地 /api/login mock（Vercel Functions 在本地不执行）
        if (url === '/api/login' && req.method === 'POST') {
          let body = ''
          req.on('data', chunk => { body += chunk })
          req.on('end', () => {
            try {
              const { username, password } = JSON.parse(body)
              const adminUser = process.env.ADMIN_USER || 'admin'
              const adminPass = process.env.ADMIN_PASS || 'admin123'
              res.setHeader('Content-Type', 'application/json')
              if (username === adminUser && password === adminPass) {
                res.statusCode = 200
                res.end(JSON.stringify({ success: true, token: 'he_furniture_dev_token' }))
              } else {
                res.statusCode = 401
                res.end(JSON.stringify({ success: false, message: '账号或密码错误' }))
              }
            } catch {
              res.statusCode = 400
              res.end(JSON.stringify({ success: false, message: '请求格式错误' }))
            }
          })
          return
        }

        // 本地 /api/get-scene mock：验证 token，返回场景路径
        if (url === '/api/get-scene' && req.method === 'GET') {
          const authHeader = req.headers['authorization'] || ''
          const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
          const validToken = process.env.ACCESS_TOKEN || 'he_furniture_v3d_access'
          const devToken = 'he_furniture_dev_token'
          res.setHeader('Content-Type', 'application/json')
          if (token === validToken || token === devToken) {
            res.statusCode = 200
            res.end(JSON.stringify({ success: true, sceneURL: 'media/12345.gltf.xz' }))
          } else {
            res.statusCode = 401
            res.end(JSON.stringify({ success: false, message: '无效的访问凭证' }))
          }
          return
        }

        // 本地模拟 Vercel rewrite：把 .xz 请求映射到实际的 .dat 文件
        if (url === '/media/12345.gltf.xz') {
          const filePath = path.resolve(__dirname, 'media/a3f8c2.dat')
          if (fs.existsSync(filePath)) {
            res.setHeader('Content-Type', 'application/octet-stream')
            res.setHeader('Cache-Control', 'public, max-age=31536000')
            fs.createReadStream(filePath).pipe(res)
            return
          }
        }
        if (url === '/media/12345.bin.xz') {
          const filePath = path.resolve(__dirname, 'media/b7d1e9.dat')
          if (fs.existsSync(filePath)) {
            res.setHeader('Content-Type', 'application/octet-stream')
            res.setHeader('Cache-Control', 'public, max-age=31536000')
            fs.createReadStream(filePath).pipe(res)
            return
          }
        }

        const filename = url.replace(/^\//, '')
        if (rootFiles.includes(filename)) {
          const filePath = path.resolve(__dirname, filename)
          if (fs.existsSync(filePath)) {
            const ext = path.extname(filename)
            const mime = ext === '.js' ? 'application/javascript'
              : ext === '.gltf' ? 'model/gltf+json'
              : 'application/octet-stream'
            res.setHeader('Content-Type', mime)
            fs.createReadStream(filePath).pipe(res)
            return
          }
        }
        next()
      })
    },
  }
}

// 构建后修正路径，写入 index.html（本地）和 dist/index.html（Vercel）
function fixAssetsPath() {
  return {
    name: 'fix-assets-path',
    closeBundle() {
      const distHtmlPath = path.resolve(__dirname, 'dist/index.dev.html')
      const outHtmlPath = path.resolve(__dirname, 'index.html')
      const distIndexPath = path.resolve(__dirname, 'dist/index.html')

      // Vite 用 index.dev.html 为入口时，输出也叫 index.dev.html
      const srcHtmlPath = fs.existsSync(distHtmlPath)
        ? distHtmlPath
        : path.resolve(__dirname, 'dist/index.html')

      if (fs.existsSync(srcHtmlPath)) {
        let html = fs.readFileSync(srcHtmlPath, 'utf-8')
        // Vercel 版本：保留绝对路径 /assets/，只修正外部脚本引用
        let htmlVercel = html
        htmlVercel = htmlVercel.replace(/src="\/12345\.js"/g, 'src="/12345.js"')
        htmlVercel = htmlVercel.replace(/title>.*?<\/title>/s, 'title>12345 Configurator</title>')
        // 写入 dist/index.html 供 Vercel 使用
        fs.writeFileSync(distIndexPath, htmlVercel)

        // 本地版本：改为相对路径（供 Verge3D App Manager 使用）
        let htmlLocal = html
        htmlLocal = htmlLocal.replace(/src="\/assets\//g, 'src="./assets/')
        htmlLocal = htmlLocal.replace(/href="\/assets\//g, 'href="./assets/')
        htmlLocal = htmlLocal.replace(/src="\/12345\.js"/g, 'src="12345.js"')
        htmlLocal = htmlLocal.replace(/title>.*?<\/title>/s, 'title>12345 Configurator</title>')
        fs.writeFileSync(outHtmlPath, htmlLocal)

        // 如果 srcHtmlPath 不是 dist/index.html 本身则删除（避免 App Manager 误扫描）
        if (srcHtmlPath !== distIndexPath) {
          fs.unlinkSync(srcHtmlPath)
        }
      }
    }
  }
}

export default defineConfig({
  base: './',
  plugins: [
    react(),
    serveRootFiles(),
    fixAssetsPath(),
    // JS 混淆：仅在 build 时生效，dev 模式跳过（避免影响 HMR 速度）
    obfuscatorPlugin({
      apply: 'build',
      options: {
        // 中等强度：变量/函数名混淆 + 字符串加密，不开控制流（体积翻倍）
        compact: true,
        identifierNamesGenerator: 'hexadecimal',
        renameGlobals: false,          // 保留全局名（防止破坏 Verge3D API）
        stringArray: true,
        stringArrayEncoding: ['rc4'],
        stringArrayThreshold: 0.8,
        rotateStringArray: true,
        selfDefending: false,          // 关闭自卫（会破坏 minify）
        debugProtection: false,        // 关闭 debugger 陷阱（影响合法用户）
        disableConsoleOutput: true,    // 清除所有 console.log
      },
    }),
  ],
  css: {
    postcss: {
      plugins: [tailwindcss],
    },
  },
  optimizeDeps: {
    exclude: ['v3d'],
  },
  server: {
    fs: {
      allow: ['.'],
    },
    open: '/',
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: path.resolve(__dirname, 'index.dev.html'),
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
})
