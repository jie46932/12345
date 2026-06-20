/**
 * v3d-loader.ts  v2
 *
 * 让 R3F 正确读取 Verge3D 导出的 GLTF 私有扩展（S8S_v3d_*）
 * 包含节点图纹理解析 —— 补全 v1 缺失的 baseColor / roughness / metalness / normal 贴图
 *
 * 迁移说明（来自 S8SMaterialLoader.js）
 * ─────────────────────────────────────────────────────────────────────────────
 * 旧方式：自建子类 + 手动遍历 JSON 节点图
 * 新方式：GLTFLoader.register() 插件系统 + parser.assignTexture()
 *   · parser.assignTexture() 内置纹理缓存、KHR_TEXTURE_TRANSFORM、colorSpace
 *     正是旧版手写 textureResolver(index) 所缺失的部分
 *   · inputs[5] 金属度/粗糙度共用纹理 → _resolveORM() 统一处理，不再出现回退 bug
 *
 * 快速检验节点图字段名
 * ─────────────────────────────────────────────────────────────────────────────
 * 用 inspectV3DExtensions(gltf) 把节点图打印出来，
 * 对照 BSDF_SOCKET_MAP 里的 socket 编号与 V3DNode.image/textureIndex 字段名。
 *
 * ⚠️ 与旧的 S8SMaterialLoader.js 差异：
 *   + 支持 NORMAL_MAP 等中间节点穿透（边缘追踪到 TEX_IMAGE 为止）
 *   + ORM 贴图自动检测（metalness + roughness 指向同一贴图）
 *   + parser.assignTexture() 正确处理 KHR_TEXTURE_TRANSFORM
 *   + 缺失 inputs[5] 标量金属度/粗糙度兜底（已补：_resolveScalars）
 *   + 缺失 roughness=1 workaround（已补：roughnessMap + roughness===0 → 1）
 */

import * as THREE from 'three'
import { SRGBColorSpace, LinearSRGBColorSpace } from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { useLoader } from '@react-three/fiber'

// ─────────────────────────────────────────────────────────────────────────────
// 扩展名常量
// ─────────────────────────────────────────────────────────────────────────────

const EXT = {
  MATERIALS: 'S8S_v3d_materials',
  OBJECT:    'S8S_v3d_object',
  SCENE:     'S8S_v3d_scene',
  MESH_DATA: 'S8S_v3d_mesh_data',
  CAMERA:    'S8S_v3d_camera',
  LIGHT:     'S8S_v3d_light',
  CURVES:    'S8S_v3d_curves',
} as const

// ─────────────────────────────────────────────────────────────────────────────
// 节点图类型
// ─────────────────────────────────────────────────────────────────────────────

/**
 * TEX_IMAGE 节点里存贴图引用的字段名因导出版本不同可能有差异：
 *   · 新版 Verge3D：textureIndex（指向 gltf.textures[N]）
 *   · 旧版 Verge3D：image（指向 gltf.images[N]，需要通过 textures 数组反查）
 * _getTextureIndex() 同时处理两种情况。
 */
interface V3DNode {
  id:            number
  type:          string
  textureIndex?: number   // 直接是 gltf.textures 下标（优先使用）
  image?:        number   // gltf.images 下标（兼容旧格式）
  texture?:      number   // S8SExtension 旧版字段名
  inputs?:       Array<{ type?: string; value?: number | number[] }>
  inputFactors?: number[]
}

interface V3DEdge {
  /** 源节点下标（在 nodes 数组里的位置，或者节点 .id） */
  fromNode:   number
  fromSocket: number
  toNode:     number
  toSocket:   number
}

interface V3DNodeGraph {
  nodes: V3DNode[]
  edges: V3DEdge[]
}

// ─────────────────────────────────────────────────────────────────────────────
// 材质外层类型
// ─────────────────────────────────────────────────────────────────────────────

export interface V3DMaterialExt {
  useShadeless?:     boolean
  blendMode?:        'OPAQUE' | 'ALPHA_BLEND' | 'ADD' | 'MULTIPLY' | 'CUSTOM'
  renderSide?:       'FRONT' | 'BACK' | 'DOUBLE'
  depthWrite?:       boolean
  depthTest?:        boolean
  renderOrder?:      number
  lineWidth?:        number
  emissiveIntensity?: number
  /** 节点图（含纹理连接）*/
  nodeGraph?:        V3DNodeGraph
  /** 旧版字段名兼容 */
  nodeMaterial?:     V3DNodeGraph
}

export interface V3DObjectExt {
  hidden?:         boolean
  renderOrder?:    number
  frustumCulled?:  boolean
  hiddenInCamera?: boolean
  useFog?:         boolean
}

export interface V3DSceneExt {
  aaMethod?:                string
  useShadows?:              boolean
  shadowMapType?:           'BasicShadowMap' | 'PCFShadowMap' | 'PCFSoftShadowMap' | 'VSMShadowMap'
  physicallyCorrectLights?: boolean
  backgroundColor?:         [number, number, number]
  backgroundAlpha?:         number
  toneMapping?:             string
  toneMappingExposure?:     number
  ambientLightColor?:       [number, number, number]
  ambientLightIntensity?:   number
}

// ─────────────────────────────────────────────────────────────────────────────
// 映射表
// ─────────────────────────────────────────────────────────────────────────────

const BLEND_MAP: Record<string, Partial<THREE.MeshStandardMaterial>> = {
  OPAQUE:      { transparent: false, blending: THREE.NormalBlending,   depthWrite: true  },
  ALPHA_BLEND: { transparent: true,  blending: THREE.NormalBlending,   depthWrite: false },
  ADD:         { transparent: true,  blending: THREE.AdditiveBlending,  depthWrite: false },
  MULTIPLY:    { transparent: true,  blending: THREE.MultiplyBlending,  depthWrite: false },
}

const SIDE_MAP: Record<string, THREE.Side> = {
  FRONT:  THREE.FrontSide,
  BACK:   THREE.BackSide,
  DOUBLE: THREE.DoubleSide,
}

const SHADOW_MAP: Record<string, THREE.ShadowMapType> = {
  BasicShadowMap:   THREE.BasicShadowMap,
  PCFShadowMap:     THREE.PCFShadowMap,
  PCFSoftShadowMap: THREE.PCFSoftShadowMap,
  VSMShadowMap:     THREE.VSMShadowMap,
}

const TONE_MAP: Record<string, THREE.ToneMapping> = {
  NoToneMapping:         THREE.NoToneMapping,
  LinearToneMapping:     THREE.LinearToneMapping,
  ReinhardToneMapping:   THREE.ReinhardToneMapping,
  CineonToneMapping:     THREE.CineonToneMapping,
  ACESFilmicToneMapping: THREE.ACESFilmicToneMapping,
}

// ── PHYSICAL_MX 输入插槽索引（对应 3ds Max 导出） ────────────────────
const SLOT = {
  BASE_COLOR:        0,
  SUBSURFACE:        1,
  ROUGHNESS:         4,
  METALLIC:          5,
  EMISSION:          16,
  EMIT_COLOR:        17,
  NORMAL:            21,
} as const

/**
 * BSDF_PRINCIPLED socket → { Three.js params key, colorSpace }
 *
 * Socket 编号来自 Blender Principled BSDF（Verge3D 遵循相同约定）：
 *   0  Base Color       → map            (SRGB)
 *   4  Metallic         → metalnessMap   (Linear)
 *   5  Roughness        → roughnessMap   (Linear)
 *       ↑ 当 4 和 5 指向同一张贴图时 → ORM 贴图，见 _resolveORM()
 *   7  Specular Tint    → (跳过)
 *   17 Emission         → emissiveMap    (SRGB)
 *   19 Alpha            → alphaMap       (Linear)
 *   20 Normal           → normalMap      (Linear，经 NORMAL_MAP 中间节点)
 *   21 Ambient Occlusion→ aoMap          (Linear)
 *
 * ⚠️  如果你的文件 socket 编号不同（3ds Max 导出有时会偏移），
 *     用 inspectV3DExtensions(gltf) 打印节点图后修改此表。
 */
const BSDF_SOCKET_MAP: Array<{
  socket:     number
  paramKey:   string
  colorSpace: string
}> = [
  { socket: 0,  paramKey: 'map',          colorSpace: SRGBColorSpace       },
  { socket: 4,  paramKey: 'metalnessMap', colorSpace: LinearSRGBColorSpace  },
  { socket: 5,  paramKey: 'roughnessMap', colorSpace: LinearSRGBColorSpace  },
  { socket: 17, paramKey: 'emissiveMap',  colorSpace: SRGBColorSpace        },
  { socket: 19, paramKey: 'alphaMap',     colorSpace: LinearSRGBColorSpace  },
  { socket: 20, paramKey: 'normalMap',    colorSpace: LinearSRGBColorSpace  },
  { socket: 21, paramKey: 'aoMap',        colorSpace: LinearSRGBColorSpace  },
]

/** BSDF 节点的可能类型名（不同版本 Verge3D / 3ds Max 导出可能不同） */
const BSDF_NODE_TYPES = new Set([
  'BSDF_PRINCIPLED',
  'BSDF_DIFFUSE',
  'MIX_SHADER',
  'EEVEE_SPECULAR',
  'PHYSICAL_MX',     // 3ds Max 导出
  'NORMAL_BUMP_MX',  // 法线 bump 复合节点
])

// ─────────────────────────────────────────────────────────────────────────────
// 节点图解析工具类
// ─────────────────────────────────────────────────────────────────────────────

export class NodeGraphResolver {
  private nodes:    V3DNode[]
  /** reverseEdge key = "nodeIndex:socket" → {fromIndex, fromSocket}
   *  S8S edges 使用 nodes 数组下标（而非 node.id）作为 fromNode / toNode */
  private incoming: Map<string, { fromIndex: number; fromSocket: number }>

  constructor(graph: V3DNodeGraph) {
    this.nodes    = graph.nodes
    this.incoming = new Map()

    for (const e of graph.edges) {
      // S8S 导出的 edges 可能用 toInput 而非 toSocket
      const toSocket = e.toSocket ?? (e as any).toInput ?? 0
      this.incoming.set(
        `${e.toNode}:${toSocket}`,
        { fromIndex: e.fromNode, fromSocket: e.fromSocket },
      )
    }
  }

  findBSDFIndex(): number {
    return this.nodes.findIndex(n => BSDF_NODE_TYPES.has(n.type))
  }

  findBSDF(): V3DNode | undefined {
    return this.nodes.find(n => BSDF_NODE_TYPES.has(n.type))
  }

  /**
   * 从 BSDF 节点的某个输入 socket 出发，沿 edges 追溯到 TEX_IMAGE 节点，
   * 返回 gltf.textures 下标；找不到返回 undefined。
   *
   * @param nodeIndex 节点在 nodes 数组中的下标（S8S edges 使用数组下标）
   * @param socket    目标输入 socket 编号
   */
  resolveTextureIndex(nodeIndex: number, socket: number): number | undefined {
    const result = this._traceNode(nodeIndex, socket, 0)
    return result?.textureIndex
  }

  /**
   * 从 BSDF 节点的某个输入 socket 出发，沿 edges 追溯到源纹理节点，
   * 返回源节点对象（含 output 属性等），用于读取 BITMAP_MX 的输出变换参数。
   *
   * @param nodeIndex 节点在 nodes 数组中的下标
   * @param socket    目标输入 socket 编号
   * @returns 源节点（BITMAP_MX / BITMAP_ENV_MX / TEX_IMAGE）或 null
   */
  resolveSourceNode(nodeIndex: number, socket: number): V3DNode | null {
    const result = this._traceNode(nodeIndex, socket, 0)
    return result?.node ?? null
  }

  private _traceNode(
    nodeIndex: number,
    socket: number,
    depth: number,
  ): { textureIndex: number; node: V3DNode } | undefined {
    if (depth > 8) return undefined
    const link = this.incoming.get(`${nodeIndex}:${socket}`)
    if (!link) return undefined

    const src = this.nodes[link.fromIndex]
    if (!src) return undefined

    // 终端纹理节点：TEX_IMAGE（Blender）或 BITMAP_MX / BITMAP_ENV_MX（3ds Max）
    if (src.type === 'TEX_IMAGE' || src.type === 'BITMAP_MX' || src.type === 'BITMAP_ENV_MX') {
      return {
        textureIndex: this._getTextureIndex(src),
        node: src,
      }
    }

    // 透传节点：
    // NORMAL_MAP: socket 0=strength, socket 1=color/normal map → passthrough 1
    // NORMAL_BUMP_MX: socket 0=normal map, socket 1=bump map → passthrough 0
    const passthroughSocket =
      src.type === 'NORMAL_MAP' ? 1 : 0
    return this._traceNode(link.fromIndex, passthroughSocket, depth + 1)
  }

  private _trace(nodeIndex: number, socket: number, depth: number): number | undefined {
    return this._traceNode(nodeIndex, socket, depth)?.textureIndex
  }

  /**
   * 从 TEX_IMAGE 节点拿 gltf.textures 下标。
   * 优先 textureIndex；退而求其次用 image（旧版），
   * 再退而求其次用 texture（S8SExtension 旧版字段）。
   */
  private _getTextureIndex(node: V3DNode): number | undefined {
    if (node.textureIndex !== undefined) return node.textureIndex
    if (node.texture      !== undefined) return node.texture      // S8SExtension 旧版
    if (node.image        !== undefined) return node.image        // 旧版：image ≈ textures 下标
    return undefined
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Plugin: S8S_v3d_materials
// ─────────────────────────────────────────────────────────────────────────────

class V3DMaterialsPlugin {
  name   = EXT.MATERIALS
  parser: any

  constructor(parser: any) { this.parser = parser }

  getMaterialType(materialIndex: number): typeof THREE.Material | null {
    const ext = this._ext(materialIndex)
    if (!ext) return null
    return ext.useShadeless ? THREE.MeshBasicMaterial : null
  }

  async extendMaterialParams(
    materialIndex: number,
    params: Record<string, any>,
  ): Promise<void> {
    const ext = this._ext(materialIndex)
    if (!ext) return

    const pending: Promise<any>[] = []

    // ── 混合模式 ─────────────────────────────────────────────────────────────
    if (ext.blendMode && BLEND_MAP[ext.blendMode]) {
      Object.assign(params, BLEND_MAP[ext.blendMode])
    }
    // ── 渲染面 ───────────────────────────────────────────────────────────────
    if (ext.renderSide) {
      params.side = SIDE_MAP[ext.renderSide] ?? THREE.FrontSide
    }
    // ── 深度 ─────────────────────────────────────────────────────────────────
    if (ext.depthWrite  !== undefined) params.depthWrite = ext.depthWrite
    if (ext.depthTest   !== undefined) params.depthTest  = ext.depthTest
    // ── 自发光强度 ───────────────────────────────────────────────────────────
    if (ext.emissiveIntensity !== undefined) {
      params.emissiveIntensity = ext.emissiveIntensity
    }

    // ── 节点图纹理 ───────────────────────────────────────────────────────────
    const rawGraph = ext.nodeGraph ?? ext.nodeMaterial
    if (rawGraph?.nodes?.length) {
      const resolver = new NodeGraphResolver(rawGraph)
      const bsdf = resolver.findBSDF()

      if (bsdf) {
        // 先收集所有 socket → textureIndex
        const resolved: Record<string, number> = {}
        for (const { socket, paramKey } of BSDF_SOCKET_MAP) {
          const texIdx = resolver.resolveTextureIndex(bsdf, socket)
          if (texIdx !== undefined) resolved[paramKey] = texIdx
        }

        // ORM 检测：metalness 和 roughness 指向同一张贴图
        // Three.js 从同一张纹理的 B(metalness) / G(roughness) 通道读取，直接共用即可
        const isSameORM =
          resolved['metalnessMap'] !== undefined &&
          resolved['roughnessMap'] !== undefined &&
          resolved['metalnessMap'] === resolved['roughnessMap']

        // assignTexture：内置缓存 + KHR_TEXTURE_TRANSFORM + colorSpace
        for (const { socket: _s, paramKey, colorSpace } of BSDF_SOCKET_MAP) {
          const texIdx = resolved[paramKey]
          if (texIdx === undefined) continue

          // ORM 情况：metalnessMap 和 roughnessMap 用同一个 Promise，避免重复加载
          if (isSameORM && paramKey === 'metalnessMap') {
            // roughnessMap 会处理这张贴图，metalness 也指向它
            pending.push(
              this.parser
                .assignTexture(params, 'roughnessMap', { index: texIdx }, colorSpace)
                .then(() => { params.metalnessMap = params.roughnessMap }),
            )
            continue
          }
          if (isSameORM && paramKey === 'roughnessMap') continue  // 已在上面处理

          pending.push(
            this.parser.assignTexture(params, paramKey, { index: texIdx }, colorSpace),
          )
        }

        // ═════════════════════════════════════════════════════════════════════
        // 标量金属度/粗糙度兜底（从 PHYSICAL_MX inputs[] 读取 scalar values）
        // S8SMaterialLoader.js 中已确认 inputs[5] 是正确金属度（非 inputFactors[21]）
        // ═════════════════════════════════════════════════════════════════════
        const physNode = rawGraph.nodes.find(n => n.type === 'PHYSICAL_MX')
        if (physNode?.inputs) {
          // 金属度兜底：没有 metalnessMap 时读 inputs[5]
          if (resolved['metalnessMap'] === undefined) {
            const metalVal = physNode.inputs[SLOT.METALLIC]
            if (metalVal != null && typeof metalVal === 'object' && 'value' in metalVal) {
              params.metalness = metalVal.value
            } else if (typeof metalVal === 'number') {
              params.metalness = metalVal
            }
          }

          // 粗糙度兜底：没有 roughnessMap 时读 inputs[4]
          if (resolved['roughnessMap'] === undefined) {
            const roughVal = physNode.inputs[SLOT.ROUGHNESS]
            if (roughVal != null && typeof roughVal === 'object' && 'value' in roughVal) {
              params.roughness = roughVal.value
            } else if (typeof roughVal === 'number') {
              params.roughness = roughVal
            }
          }
        }

        // ═════════════════════════════════════════════════════════════════════
        // roughness=1 workaround：Three.js 中 roughness=0 × map = 不可见
        // 但 Verge3D 中 roughness=0 表示「完全由地图定义」
        // ═════════════════════════════════════════════════════════════════════
        if (resolved['roughnessMap'] !== undefined) {
          // roughnessMap 存在时，检查 roughness scalar 是否为 0
          const physNode2 = rawGraph.nodes.find(n => n.type === 'PHYSICAL_MX')
          let rawRoughness: number | undefined
          if (physNode2?.inputs) {
            const rv = physNode2.inputs[SLOT.ROUGHNESS]
            if (rv != null && typeof rv === 'object' && 'value' in rv) {
              rawRoughness = rv.value
            } else if (typeof rv === 'number') {
              rawRoughness = rv
            }
          }
          if (rawRoughness === 0) {
            params.roughness = 1
          }
        }

        // 当 emissiveMap 存在时，自动设置 emissive 白色（否则贴图不显示）
        if (resolved['emissiveMap'] !== undefined) {
          params.emissive ??= new THREE.Color(1, 1, 1)
        }
      }
    }

    // 原始数据保留供业务层使用
    params.userData = { ...params.userData, v3dMaterial: ext }

    await Promise.all(pending)
  }

  private _ext(index: number): V3DMaterialExt | undefined {
    return this.parser.json.materials?.[index]?.extensions?.[EXT.MATERIALS]
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Plugin: S8S_v3d_object
// ─────────────────────────────────────────────────────────────────────────────

class V3DObjectPlugin {
  name   = EXT.OBJECT
  parser: any

  constructor(parser: any) { this.parser = parser }

  afterRoot(_gltf: GLTF): void {
    const nodes: any[] = this.parser.json.nodes ?? []

    this.parser.associations.forEach(
      (assoc: { nodes?: number }, object: THREE.Object3D) => {
        const nodeIndex = assoc?.nodes
        if (nodeIndex === undefined) return

        const ext: V3DObjectExt | undefined =
          nodes[nodeIndex]?.extensions?.[EXT.OBJECT]
        if (!ext) return

        if (ext.hidden         !== undefined) object.visible       = !ext.hidden
        if (ext.renderOrder    !== undefined) object.renderOrder   = ext.renderOrder
        if (ext.frustumCulled  !== undefined) object.frustumCulled = ext.frustumCulled

        if (ext.useFog !== undefined && object instanceof THREE.Mesh) {
          const mats = Array.isArray(object.material)
            ? object.material
            : [object.material]
          mats.forEach(m => { m.fog = ext.useFog! })
        }

        object.userData.v3d = ext
      },
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Plugin: S8S_v3d_scene
// ─────────────────────────────────────────────────────────────────────────────

class V3DScenePlugin {
  name   = EXT.SCENE
  parser: any

  constructor(parser: any) { this.parser = parser }

  afterRoot(gltf: GLTF): void {
    const scenes: any[] = this.parser.json.scenes ?? []
    for (const sceneDef of scenes) {
      const ext: V3DSceneExt | undefined = sceneDef?.extensions?.[EXT.SCENE]
      if (ext) {
        gltf.userData ??= {}
        gltf.userData.v3dScene = ext
        return
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stub plugins（防止 Unknown extension 警告）
// ─────────────────────────────────────────────────────────────────────────────

class V3DStubPlugin {
  name: string
  constructor(_parser: any, name: string) { this.name = name }
}

// ─────────────────────────────────────────────────────────────────────────────
// Loader
// ─────────────────────────────────────────────────────────────────────────────

export class Verge3DGLTFLoader extends GLTFLoader {
  constructor() {
    super()
    this.register(p => new V3DMaterialsPlugin(p))
    this.register(p => new V3DObjectPlugin(p))
    this.register(p => new V3DScenePlugin(p))
    ;([EXT.MESH_DATA, EXT.CAMERA, EXT.LIGHT, EXT.CURVES] as const).forEach(
      name => this.register(p => new V3DStubPlugin(p, name)),
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export type UseVerge3DGLTFResult = GLTF & {
  v3dScene: V3DSceneExt | undefined
}

export function useVerge3DGLTF(url: string): UseVerge3DGLTFResult {
  const gltf = useLoader(Verge3DGLTFLoader, url) as GLTF
  return { ...gltf, v3dScene: gltf.userData?.v3dScene as V3DSceneExt | undefined }
}

useVerge3DGLTF.preload = (url: string): void => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  useLoader.preload(Verge3DGLTFLoader, url)
}

useVerge3DGLTF.preloadAll = (urls: string[]): void =>
  urls.forEach(useVerge3DGLTF.preload)

// ─────────────────────────────────────────────────────────────────────────────
// 工具：同步场景设置到 WebGLRenderer
// ─────────────────────────────────────────────────────────────────────────────

export function applyV3DSceneSettings(
  gl:       THREE.WebGLRenderer,
  scene:    THREE.Scene,
  settings: V3DSceneExt,
): void {
  if (settings.toneMapping && TONE_MAP[settings.toneMapping] !== undefined) {
    gl.toneMapping = TONE_MAP[settings.toneMapping]
  }
  if (settings.toneMappingExposure !== undefined) {
    gl.toneMappingExposure = settings.toneMappingExposure
  }
  if (settings.useShadows        !== undefined) gl.shadowMap.enabled = settings.useShadows
  if (settings.shadowMapType && SHADOW_MAP[settings.shadowMapType] !== undefined) {
    gl.shadowMap.type = SHADOW_MAP[settings.shadowMapType]
  }
  if (settings.backgroundColor) {
    const [r, g, b] = settings.backgroundColor
    scene.background = new THREE.Color(r, g, b)
  }
  if (settings.backgroundAlpha !== undefined) gl.setClearAlpha(settings.backgroundAlpha)
  if (settings.ambientLightColor && settings.ambientLightIntensity !== undefined) {
    if (!scene.getObjectByProperty('type', 'AmbientLight')) {
      const [r, g, b] = settings.ambientLightColor
      scene.add(new THREE.AmbientLight(new THREE.Color(r, g, b), settings.ambientLightIntensity))
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 调试工具：打印节点图，用于核验 BSDF_SOCKET_MAP 编号
// ─────────────────────────────────────────────────────────────────────────────

export function inspectV3DExtensions(gltf: GLTF) {
  const objectsWithV3D:   { name: string; ext: V3DObjectExt }[]   = []
  const materialsWithV3D: { name: string; ext: V3DMaterialExt }[] = []

  gltf.scene?.traverse(obj => {
    if (obj.userData.v3d) objectsWithV3D.push({ name: obj.name, ext: obj.userData.v3d })
    if (obj instanceof THREE.Mesh) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      mats.forEach(m => {
        if (m.userData.v3dMaterial) {
          materialsWithV3D.push({ name: m.name, ext: m.userData.v3dMaterial })
          // 打印节点图，便于核验 socket 编号
          const graph = m.userData.v3dMaterial.nodeGraph ?? m.userData.v3dMaterial.nodeMaterial
          if (graph) {
            console.group(`[v3d] nodeGraph — material: ${m.name}`)
            console.log('nodes:', graph.nodes)
            console.log('edges:', graph.edges)
            const resolver = new NodeGraphResolver(graph)
            const bsdfIdx = resolver.findBSDFIndex()
            if (bsdfIdx !== -1) {
              console.log('BSDF index:', bsdfIdx)
              BSDF_SOCKET_MAP.forEach(({ socket, paramKey }) => {
                const idx = resolver.resolveTextureIndex(bsdfIdx, socket)
                console.log(`  socket ${socket} (${paramKey}):`, idx ?? '— no texture')
              })
            }
            console.groupEnd()
          }
        }
      })
    }
  })

  return { objectsWithV3D, materialsWithV3D }
}
