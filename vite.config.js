import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from 'tailwindcss'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const wechatLoginSessions = new Map()
const useLocalWechatMock = process.env.VITE_USE_LOCAL_WECHAT_MOCK === '1'
const remoteWechatApiOrigin = process.env.VITE_REMOTE_WECHAT_API_ORIGIN || 'https://gsdmsj.cn'

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

async function proxyRemoteApi(req, res, targetOrigin) {
  try {
    const body = req.method === 'GET' || req.method === 'HEAD'
      ? undefined
      : await readRequestBody(req)
    const headers = { ...req.headers }
    delete headers.host
    delete headers.connection
    delete headers['content-length']

    const upstream = await fetch(new URL(req.url, targetOrigin), {
      method: req.method,
      headers,
      body,
      redirect: 'manual',
    })

    res.statusCode = upstream.status
    upstream.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'content-encoding') res.setHeader(key, value)
    })
    res.end(Buffer.from(await upstream.arrayBuffer()))
  } catch (error) {
    res.setHeader('Content-Type', 'application/json')
    res.statusCode = 502
    res.end(JSON.stringify({
      success: false,
      message: `远程微信登录服务连接失败：${error.message}`,
    }))
  }
}

function createMockWechatUser() {
  return {
    openid: `mock_openid_${Date.now().toString(36)}`,
    unionid: `mock_unionid_${Date.now().toString(36)}`,
    nickname: '微信访客',
    avatarUrl: '',
    city: '',
    province: '',
    country: 'CN',
    source: 'wechat_mock',
    projectId: '12345',
    loginAt: new Date().toISOString(),
  }
}

export default defineConfig({
  base: './',
  plugins: [
    react(),
    // Dev 模式下提供 API mock 和静态文件服务
    {
      name: 'dev-server',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url.split('?')[0]

          if (!useLocalWechatMock && (
            url === '/api/wechat-login/session' ||
            url === '/api/wechat-login/status' ||
            url === '/api/wechat-login/callback' ||
            url === '/api/wechat-sms/send' ||
            url === '/api/wechat-sms/verify' ||
            url === '/api/sms-login/send' ||
            url === '/api/sms-login/verify'
          )) {
            proxyRemoteApi(req, res, remoteWechatApiOrigin)
            return
          }

          // 本地 /api/login mock
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

          if (url === '/api/wechat-login/session' && req.method === 'POST') {
            const token = `wx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
            const qrImageUrl = process.env.WECHAT_LOGIN_QR_IMAGE_URL || ''
            const loginUrl = process.env.WECHAT_LOGIN_URL || ''
            const configured = Boolean(qrImageUrl || loginUrl)
            wechatLoginSessions.set(token, {
              token,
              user: null,
              createdAt: Date.now(),
              configured,
            })
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              success: configured || process.env.WECHAT_LOGIN_ALLOW_MOCK !== '0',
              message: configured ? '' : '微信登录服务未配置',
              session: {
                token,
                qrImageUrl,
                loginUrl,
                mock: !configured,
              },
            }))
            return
          }

          if (url === '/api/wechat-login/status' && req.method === 'GET') {
            const token = new URL(req.url, 'http://localhost').searchParams.get('token')
            const session = token ? wechatLoginSessions.get(token) : null
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              success: !!session?.user,
              user: session?.user || null,
            }))
            return
          }

          if (url === '/api/wechat-login/mock-confirm' && req.method === 'POST') {
            let body = ''
            req.on('data', chunk => { body += chunk })
            req.on('end', () => {
              try {
                const { token } = JSON.parse(body || '{}')
                if (token) {
                  const session = wechatLoginSessions.get(token) || { token }
                  session.user = createMockWechatUser()
                  wechatLoginSessions.set(token, session)
                }
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({
                  success: true,
                  user: token ? wechatLoginSessions.get(token)?.user : null,
                }))
              } catch {
                res.statusCode = 400
                res.end(JSON.stringify({ success: false }))
              }
            })
            return
          }

          // 本地 /api/get-scene mock
          if (url === '/api/get-scene' && req.method === 'GET') {
            const authHeader = req.headers['authorization'] || ''
            const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
            const validToken = process.env.ACCESS_TOKEN || 'he_furniture_v3d_access'
            const devToken = 'he_furniture_dev_token'
            res.setHeader('Content-Type', 'application/json')
            if (token === validToken || token === devToken) {
              res.statusCode = 200
              res.end(JSON.stringify({ success: true, sceneURL: 'media/12345.gltf' }))
            } else {
              res.statusCode = 401
              res.end(JSON.stringify({ success: false, message: '无效的访问凭证' }))
            }
            return
          }

          // /api/write-feature-pos：写入 FeatureAnnotationPin.jsx 的 localPos 和 Gizmo 的 DEFAULT_STYLES
          if (url === '/api/write-feature-pos' && req.method === 'POST') {
            let body = ''
            req.on('data', chunk => { body += chunk })
            req.on('end', () => {
              try {
                const payload = JSON.parse(body)
                const poses = payload.poses || payload
                const styles = payload.styles || []
                const pinFilePath = path.resolve(__dirname, 'src/components/FeatureAnnotationPin.jsx')
                let pinSrc = fs.readFileSync(pinFilePath, 'utf-8')
                let posCount = 0
                pinSrc = pinSrc.replace(/localPos:\s*\[([^\]]+)\]/g, () => {
                  if (posCount >= poses.length) return arguments[0]
                  const [x, y, z] = poses[posCount++]
                  return `localPos: [${x.toFixed(6)}, ${y.toFixed(6)}, ${z.toFixed(6)}]`
                })
                fs.writeFileSync(pinFilePath, pinSrc, 'utf-8')

                // 同时写入 styles 到 FeatureAnnotationGizmo.jsx 的 DEFAULT_STYLES
                if (styles.length > 0) {
                  const gizmoFilePath = path.resolve(__dirname, 'src/components/FeatureAnnotationGizmo.jsx')
                  let gizmoSrc = fs.readFileSync(gizmoFilePath, 'utf-8')
                  const newDefaults = 'const DEFAULT_STYLES = [\n' + styles.map(s =>
                    `  { line0: '${(s.line0 || '').replace(/'/g, "\\'")}', line1: '${(s.line1 || '').replace(/'/g, "\\'")}', color0: '${s.color0 || '#ffffff'}', color1: '${s.color1 || '#c0c0c0'}', size0: ${s.size0 || 13}, size1: ${s.size1 || 12}, bold0: ${!!s.bold0}, bold1: ${!!s.bold1}, bgColor: '${s.bgColor || '#000000'}', bgAlpha: ${s.bgAlpha ?? 0.62}, bgW: ${s.bgW ?? 260}, bgH: ${s.bgH ?? 80} }`
                  ).join(',\n') + '\n];'
                  gizmoSrc = gizmoSrc.replace(/const DEFAULT_STYLES = \[[\s\S]*?\];/, newDefaults)
                  fs.writeFileSync(gizmoFilePath, gizmoSrc, 'utf-8')
                }

                res.setHeader('Content-Type', 'application/json')
                res.statusCode = 200
                res.end(JSON.stringify({ success: true, updatedPos: posCount, updatedStyles: styles.length }))
              } catch (e) {
                res.setHeader('Content-Type', 'application/json')
                res.statusCode = 500
                res.end(JSON.stringify({ success: false, message: e.message }))
              }
            })
            return
          }

          // /api/write-outline-defaults：写入 useStore.js 的 DEFAULT_OUTLINE
          if (url === '/api/write-outline-defaults' && req.method === 'POST') {
            let body = ''
            req.on('data', chunk => { body += chunk })
            req.on('end', () => {
              try {
                const params = JSON.parse(body)
                const filePath = path.resolve(__dirname, 'src/store/useStore.js')
                let src = fs.readFileSync(filePath, 'utf-8')
                const f = n => typeof n === 'number' ? (Number.isInteger(n) ? n : parseFloat(n.toFixed(3))) : n
                const newDefaults = `const DEFAULT_OUTLINE = {
  enabled: ${!!params.enabled},
  edgeThickness: ${f(params.edgeThickness ?? 8)},
  edgeGlow: ${f(params.edgeGlow ?? 0.5)},
  pulsePeriod: ${f(params.pulsePeriod ?? 0)},
  visibleEdgeColor: '${params.visibleEdgeColor ?? '#00ffff'}',
};`
                src = src.replace(/const DEFAULT_OUTLINE = \{[\s\S]*?\};/, newDefaults)
                fs.writeFileSync(filePath, src, 'utf-8')
                res.setHeader('Content-Type', 'application/json')
                res.statusCode = 200
                res.end(JSON.stringify({ success: true }))
              } catch (e) {
                res.setHeader('Content-Type', 'application/json')
                res.statusCode = 500
                res.end(JSON.stringify({ success: false, message: e.message }))
              }
            })
            return
          }

          // /api/write-led-defaults：写入 useStore.js 的 DEFAULT_LED
          if (url === '/api/write-led-defaults' && req.method === 'POST') {
            let body = ''
            req.on('data', chunk => { body += chunk })
            req.on('end', () => {
              try {
                const params = JSON.parse(body)
                const filePath = path.resolve(__dirname, 'src/store/useStore.js')
                let src = fs.readFileSync(filePath, 'utf-8')
                const f = n => typeof n === 'number' ? (Number.isInteger(n) ? n : parseFloat(n.toFixed(4))) : n
                const newDefaults = `const DEFAULT_LED = {
  textColor: '${params.textColor ?? '#ffffff'}',
  unitColor: '${params.unitColor ?? '#ffffff'}',
  bgColor: '${params.bgColor ?? '#050505'}',
  glowBlur: ${f(params.glowBlur ?? 5)},
  textSize: ${f(params.textSize ?? 0.8)},
  textX: ${f(params.textX ?? 0.45)},
  textY: ${f(params.textY ?? 0.76)},
  emissiveIntensity: ${f(params.emissiveIntensity ?? 0.5)},
  unit: '${params.unit ?? 'cm'}',
  unitSize: ${f(params.unitSize ?? 0.5)},
  unitGap: ${f(params.unitGap ?? 10)},
  unitOffsetY: ${f(params.unitOffsetY ?? 0)},
};`
                src = src.replace(/const DEFAULT_LED = \{[\s\S]*?\};/, newDefaults)
                fs.writeFileSync(filePath, src, 'utf-8')
                res.setHeader('Content-Type', 'application/json')
                res.statusCode = 200
                res.end(JSON.stringify({ success: true }))
              } catch (e) {
                res.setHeader('Content-Type', 'application/json')
                res.statusCode = 500
                res.end(JSON.stringify({ success: false, message: e.message }))
              }
            })
            return
          }

          // /api/write-dim-defaults：写入 useStore.js 的 DEFAULT_DIM
          if (url === '/api/write-dim-defaults' && req.method === 'POST') {
            let body = ''
            req.on('data', chunk => { body += chunk })
            req.on('end', () => {
              try {
                const params = JSON.parse(body)
                const filePath = path.resolve(__dirname, 'src/store/useStore.js')
                let src = fs.readFileSync(filePath, 'utf-8')
                const f = n => typeof n === 'number' ? (Number.isInteger(n) ? n : parseFloat(n.toFixed(4))) : n
                const newDefaults = `const DEFAULT_DIM = {
  textColor: '${params.textColor ?? '#ffffff'}',
  bgColor: '${params.bgColor ?? '#000000'}',
  bgAlpha: ${f(params.bgAlpha ?? 0.55)},
  fontSize: ${f(params.fontSize ?? 14)},
  lineColor: '${params.lineColor ?? '#e8e8e8'}',
};`
                src = src.replace(/const DEFAULT_DIM = \{[\s\S]*?\};/, newDefaults)
                fs.writeFileSync(filePath, src, 'utf-8')
                res.setHeader('Content-Type', 'application/json')
                res.statusCode = 200
                res.end(JSON.stringify({ success: true }))
              } catch (e) {
                res.setHeader('Content-Type', 'application/json')
                res.statusCode = 500
                res.end(JSON.stringify({ success: false, message: e.message }))
              }
            })
            return
          }

          // /api/write-bg-defaults：写入 BgPanel.jsx 的 DEFAULTS
          if (url === '/api/write-bg-defaults' && req.method === 'POST') {
            let body = ''
            req.on('data', chunk => { body += chunk })
            req.on('end', () => {
              try {
                const params = JSON.parse(body)
                const filePath = path.resolve(__dirname, 'src/components/BgPanel.jsx')
                let src = fs.readFileSync(filePath, 'utf-8')
                const f = n => typeof n === 'number' ? (Number.isInteger(n) ? n : parseFloat(n.toFixed(3))) : n
                const newDefaults = `const DEFAULTS = {
  x: ${f(params.x ?? 0)},
  y: ${f(params.y ?? 0)},
  scale: ${f(params.scale ?? 1.0)},
  opacity: ${f(params.opacity ?? 1.0)},
};`
                src = src.replace(/const DEFAULTS = \{[\s\S]*?\};/, newDefaults)
                fs.writeFileSync(filePath, src, 'utf-8')
                res.setHeader('Content-Type', 'application/json')
                res.statusCode = 200
                res.end(JSON.stringify({ success: true }))
              } catch (e) {
                res.setHeader('Content-Type', 'application/json')
                res.statusCode = 500
                res.end(JSON.stringify({ success: false, message: e.message }))
              }
            })
            return
          }

          // /api/write-studio-bg-defaults：写入 useStore.js 的 DEFAULT_STUDIO_BG
          if (url === '/api/write-studio-bg-defaults' && req.method === 'POST') {
            let body = ''
            req.on('data', chunk => { body += chunk })
            req.on('end', () => {
              try {
                const params = JSON.parse(body)
                const filePath = path.resolve(__dirname, 'src/store/useStore.js')
                let src = fs.readFileSync(filePath, 'utf-8')
                const f = n => typeof n === 'number' ? (Number.isInteger(n) ? n : parseFloat(n.toFixed(3))) : n
                const newDefaults = `const DEFAULT_STUDIO_BG = {
  baseColor: '${params.baseColor ?? '#8f0909'}',
  highlightOpacity: ${f(params.highlightOpacity ?? 0.62)},
  highlightSize: ${f(params.highlightSize ?? 1)},
  vignetteStrength: ${f(params.vignetteStrength ?? 0.82)},
};`
                src = src.replace(/const DEFAULT_STUDIO_BG = \{[\s\S]*?\};/, newDefaults)
                fs.writeFileSync(filePath, src, 'utf-8')
                res.setHeader('Content-Type', 'application/json')
                res.statusCode = 200
                res.end(JSON.stringify({ success: true }))
              } catch (e) {
                res.setHeader('Content-Type', 'application/json')
                res.statusCode = 500
                res.end(JSON.stringify({ success: false, message: e.message }))
              }
            })
            return
          }

          // /api/write-material-defaults：写入 materialDefaults.js 的 MATERIAL_DEFAULTS
	          if (url === '/api/write-material-defaults' && req.method === 'POST') {
	            let body = ''
            req.on('data', chunk => { body += chunk })
            req.on('end', () => {
              try {
                const { overrides } = JSON.parse(body)
                const filePath = path.resolve(__dirname, 'src/data/materialDefaults.js')
                let src = fs.readFileSync(filePath, 'utf-8')
                const newDefaults = `const MATERIAL_DEFAULTS = ${JSON.stringify(overrides, null, 2)};`
                src = src.replace(/const MATERIAL_DEFAULTS = \{[\s\S]*?\};/, newDefaults)
                fs.writeFileSync(filePath, src, 'utf-8')
                res.setHeader('Content-Type', 'application/json')
                res.statusCode = 200
                res.end(JSON.stringify({ success: true }))
              } catch (e) {
                res.setHeader('Content-Type', 'application/json')
                res.statusCode = 500
                res.end(JSON.stringify({ success: false, message: e.message }))
              }
            })
	            return
	          }

	          if (url === '/__ar-state' && req.method === 'POST') {
	            let body = ''
	            req.on('data', chunk => { body += chunk })
	            req.on('end', () => {
	              try {
	                const payload = JSON.parse(body || '{}')
	                const data = payload.dataset || {}
	                const summary = {
	                  href: payload.href || '',
	                  mode: data.viewerARMode,
	                  provider: data.viewerARProvider,
	                  launch: data.viewerARLaunchState,
	                  overlay: data.viewerAROverlayActive,
	                  plane: data.viewerARPlaneReady,
	                  reticle: data.viewerARReticleReady,
	                  placed: data.viewerARPlaced,
	                  flow: data.viewerARFlowState,
	                  control: data.viewerARControlMode,
	                  dragging: data.viewerARDragging,
	                  floorGrid: data.viewerARFloorGridVisible,
	                  tapToPlace: data.viewerARTapToPlaceVisible,
	                  placementHitReady: data.viewerARPlacementHitReady,
	                  placementHitType: data.viewerARPlacementHitType,
	                  selection: data.viewerARSelectionVisible,
	                  rotationRing: data.viewerARRotationRingVisible,
	                  controlsBoundToModel: data.viewerARControlsBoundToModel,
	                  controlVisualsType: data.viewerARControlVisualsType,
	                  controlWorldX: data.viewerARControlWorldX,
	                  controlWorldY: data.viewerARControlWorldY,
	                  controlWorldZ: data.viewerARControlWorldZ,
	                  scaleLocked: data.viewerARScaleLocked,
	                  modelScaleX: data.viewerARModelScaleX,
	                  moveX: data.viewerARLastMoveX,
	                  moveZ: data.viewerARLastMoveZ,
	                  rotate: data.viewerARLastRotateRadians,
	                  resetCount: data.viewerARResetCount,
	                  cameraFeed: data.viewerARCameraFeedReady,
	                  frameCount: data.viewerARCameraFrameCount,
	                  cameraTexture: data.viewerARCameraTextureReady,
	                  nativeVideo: data.viewerARNativeCameraVideoReady,
	                  nativeVideoVisible: data.viewerARNativeCameraVideoVisible,
	                  nativeVideoW: data.viewerARNativeCameraVideoWidth,
	                  nativeVideoH: data.viewerARNativeCameraVideoHeight,
	                  nativeVideoLuma: data.viewerARNativeCameraVideoLumaMean,
	                  nativeVideoError: data.viewerARNativeCameraVideoError,
	                  cameraDirection: data.viewerARCameraDirectionRequested,
	                  pixelArray: data.viewerARCameraPixelArrayReady,
	                  pixelArrayModule: data.viewerARCameraPixelArrayModuleAdded,
	                  pixelLength: data.viewerARCameraPixelArrayLength,
	                  pixelMin: data.viewerARCameraPixelMin,
	                  pixelMax: data.viewerARCameraPixelMax,
	                  blackFrame: data.viewerARCameraBlackFrameSuspected,
	                  lumaMean: data.viewerARCameraLumaMean,
	                  lumaVariance: data.viewerARCameraLumaVariance,
	                  nonBlackFrames: data.viewerARCameraNonBlackFrameCount,
	                  anyHitSeen: data.viewerARAnyHitSeen,
	                  surfaceHitSeen: data.viewerARSurfaceHitSeen,
	                  surfaceQualified: data.viewerARSurfaceQualified,
	                  hitCount: data.viewerARHitCount,
	                  hitType: data.viewerARHitType,
	                  trackingStatus: data.viewerARTrackingStatus,
	                  trackingReason: data.viewerARTrackingReason,
	                  modelReady: data.viewerARModelReady,
	                  modelSource: data.viewerARModelSource,
	                  modelVisible: data.viewerARModelVisible,
	                  modelError: data.viewerARModelError,
	                  modelMeshes: data.viewerARModelMeshCount,
	                  modelScreenX: data.viewerARModelScreenX,
	                  modelScreenY: data.viewerARModelScreenY,
	                  reticleScreenX: data.viewerARReticleScreenX,
	                  reticleScreenY: data.viewerARReticleScreenY,
	                  canvasW: data.viewerARCanvasWidth,
	                  canvasH: data.viewerARCanvasHeight,
	                  rendererTransparent: data.viewerARThreeRendererTransparent,
	                  projectionSynced: data.viewerARProjectionSynced,
	                  pipeline: data.viewerARPipelineVersion,
	                }
	                console.log(`[ar-state] ${JSON.stringify(summary)}`)
	                try {
	                  fs.writeFileSync('/tmp/12345-ar-latest.json', `${JSON.stringify(summary, null, 2)}\n`)
	                } catch {
	                  // Keep telemetry best-effort so AR runtime logging never breaks the dev server.
	                }
	              } catch (e) {
	                console.warn('[ar-state] invalid payload', e?.message || e)
	              }
	              res.statusCode = 204
	              res.end()
	            })
	            return
	          }

	          // 开发模式提供 /media/ 下的资源
	          if (url.startsWith('/media/')) {
            const filePath = path.resolve(__dirname, url.slice(1))
            if (fs.existsSync(filePath)) {
              const ext = path.extname(filePath)
              const stat = fs.statSync(filePath)
              const mimeMap = {
                '.gltf': 'model/gltf+json',
                '.usdz': 'model/vnd.usdz+zip',
                '.bin': 'application/octet-stream',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
              }
              res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream')
              res.setHeader('Content-Length', String(stat.size))
              res.setHeader('Accept-Ranges', 'bytes')
              res.setHeader('Cache-Control', 'no-store')
              if (req.method === 'HEAD') {
                res.statusCode = 200
                res.end()
                return
              }
              fs.createReadStream(filePath).pipe(res)
              return
            }
          }

          next()
        })
      },
    },
  ],
  css: {
    postcss: {
      plugins: [tailwindcss],
    },
  },
	  server: {
	    fs: {
	      allow: ['.'],
	    },
	    allowedHosts: ['.serveousercontent.com', '.lhr.life', '.trycloudflare.com'],
	    open: '/',
	  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'index.html'),
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
})
