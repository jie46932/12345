/**
 * S8SExtension — 综合性 GLTFLoader 扩展
 *
 * 处理所有 Verge3D S8S 私有扩展，使 R3F/Three.js 能正确读取
 * Verge3D 导出的 glTF 文件。
 *
 * 处理的扩展（共 11 个）：
 *   S8S_v3d_materials    — PHYSICAL_MX → MeshStandardMaterial 转换（已有）
 *   S8S_v3d_texture      — 纹理参数（anisotropy, colorSpace）
 *   S8S_v3d_node         — 节点属性（renderOrder, shadows, frustumCulling）
 *   S8S_v3d_animation    — 动画循环模式（ONCE/PING_PONG/REPEAT）
 *   S8S_v3d_camera       — 相机控制参数（orbit target, limits）
 *   S8S_v3d_lights       — 灯光定义（ambient/directional/point/spot）
 *   S8S_v3d_scene        — 场景级属性（shadow map, physical lights）
 *   S8S_v3d_curves       — 动画曲线（占位，当前 glTF 未使用）
 *   S8S_v3d_light_probes — 光照探针（占位，当前 glTF 未使用）
 *   S8S_v3d_clipping_planes — 裁剪平面（占位，当前 glTF 未使用）
 *   KHR_texture_basisu   — KTX2/Basis 纹理（由 KTX2Loader 处理）
 *
 * 注册为 'S8S_v3d_materials' 名称以挂钩 afterRoot 阶段。
 * 非材质的扩展数据存储在 result.userData 中供 SceneContent 使用。
 */
import * as THREE from 'three';
import { createMaterialsFromS8S } from './S8SMaterialLoader';

// ── PHYSICAL_MX 输入插槽索引（来源：v3d.js PHYSICAL_MX）────────────────
const SLOT_PHYSICAL = {
  BASE_COLOR: 0,
  SUBSURFACE: 1,
  ROUGHNESS: 4,
  METALLIC: 5,
  EMISSION: 16,
  EMIT_COLOR: 17,
  NORMAL: 21,
};

// ── BITMAP_ENV_MX 输入插槽索引（来源：v3d.js BITMAP_ENV_MX）───────────
const SLOT_ENV = {
  U_OFFSET: 0,
  V_OFFSET: 1,
  U_TILING: 2,
  V_TILING: 3,
  W_ANGLE: 4,
  NORMAL: 5,
};

/**
 * 收集所有 S8S 纹理索引
 */
function collectAllS8STextureIndices(json) {
  const needed = new Set();
  const images = json.images || [];

  // 1. 从 S8S_v3d_materials node graphs
  (json.materials || []).forEach((mat) => {
    const ext = mat.extensions?.S8S_v3d_materials;
    if (!ext?.nodeGraph) return;
    (ext.nodeGraph.nodes || []).forEach((node) => {
      if (node.texture != null) needed.add(node.texture);
    });
  });

  // 2. 从 S8S_v3d_texture 扩展
  (json.textures || []).forEach((tex, idx) => {
    const ext = tex.extensions?.S8S_v3d_texture;
    if (ext?.source == null) return;
    needed.add(idx);
  });

  // 3. 过滤掉源图片是 HDR 文件的纹理
  //    （HDR 环境贴图由 SceneContent.jsx 独立加载，GLTFLoader 无法加载 .hdr/.hdr.xz）
  const filtered = [...needed].filter((texIdx) => {
    const tex = json.textures?.[texIdx];
    if (!tex) return true;
    const src = tex.source ?? tex.extensions?.S8S_v3d_texture?.source ?? tex.extensions?.KHR_texture_basisu?.source;
    if (src == null) return true;
    const img = images[src];
    if (!img?.uri) return true;
    const lower = img.uri.toLowerCase();
    if (lower.endsWith('.hdr') || lower.endsWith('.hdr.xz')) return false;
    return true;
  });

  return filtered;
}

/**
 * 应用 S8S_v3d_texture 纹理参数
 */
function applyTextureParams(texture, texDef, idx, ext) {
  if (!texture || !ext) return;
  const changed = [];

  if (typeof ext.anisotropy === 'number') {
    texture.anisotropy = ext.anisotropy;
    changed.push('anisotropy');
  }
  if (typeof ext.colorSpace === 'string') {
    // Verge3D "srgb" / "linear" → Three.js colorSpace
    const cs = ext.colorSpace === 'srgb' ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
    texture.colorSpace = cs;
    changed.push('colorSpace');
  }

  if (changed.length) {
    texture.needsUpdate = true;
  }
}

/**
 * 应用 S8S_v3d_node 节点属性
 */
// eslint-disable-next-line no-unused-vars
function applyNodeProps(_scene) {
  // 我们无法从 scene 访问原始 glTF JSON 的节点扩展，
  // 所以这个方法需要在 afterRoot 中通过遍历原始 JSON 节点来工作。
  // 实际调用时传入已收集的 nodeProps 映射：nodeIndex → S8S_v3d_node
}

/**
 * 在场景中按名称应用节点属性
 */
function applyNodePropsToScene(scene, nodePropsByName) {
  if (!scene || !nodePropsByName) return;
  scene.traverse((child) => {
    const props = nodePropsByName.get(child.name);
    if (!props) return;

    // renderOrder
    if (typeof props.renderOrder === 'number') {
      child.renderOrder = props.renderOrder;
    }

    // shadows
    if (typeof props.useCastShadows === 'boolean') {
      child.castShadow = props.useCastShadows;
    }
    if (typeof props.useShadows === 'boolean') {
      child.receiveShadow = props.useShadows;
    }

    // frustumCulling
    if (typeof props.frustumCulling === 'boolean') {
      child.frustumCulling = props.frustumCulling;
    }
  });
}

/**
 * 应用 S8S_v3d_animation 循环模式
 *
 * Three.js r184+ 中 AnimationClip 没有 setLoop 方法，
 * 循环模式在 AnimationAction 上设置（播放时）。
 * 此处将循环信息存储到 clip.userData.s8s 供消费者使用。
 */
function applyAnimationSettings(animations, json) {
  if (!animations) return;
  (json.animations || []).forEach((aDef, idx) => {
    const ext = aDef.extensions?.S8S_v3d_animation;
    if (!ext) return;
    const clip = animations[idx];
    if (!clip) return;

    let loopMode = THREE.LoopRepeat;
    if (ext.loop === 'ONCE') {
      loopMode = THREE.LoopOnce;
    } else if (ext.loop === 'PING_PONG') {
      loopMode = THREE.LoopPingPong;
    }
    const repeatCount = ext.repeatInfinite ? Infinity : (ext.repeatCount || 1);

    // 存储到 userData，消费者可在创建 AnimationAction 后调用
    // action.setLoop(loopMode, repeatCount)
    clip.userData.s8s = {
      loopMode,
      repeatCount,
      auto: !!ext.auto,
      offset: ext.offset || 0,
    };
  });
}

/**
 * 从 glTF JSON 收集 S8S_v3d_node 属性，按名称索引
 */
function collectNodeProps(json) {
  const byName = new Map();
  (json.nodes || []).forEach((nDef, idx) => {
    const ext = nDef.extensions?.S8S_v3d_node;
    if (!ext) return;
    byName.set(nDef.name || `__node_${idx}`, ext);
  });
  return byName;
}


/**
 * 收集 S8S_v3d_camera 数据
 */
function collectCameraData(json) {
  const cameras = json.cameras || [];
  const nodes = json.nodes || [];
  for (const cDef of cameras) {
    const ext = cDef.extensions?.S8S_v3d_camera;
    if (!ext) continue;

    const data = {
      controls: ext.controls || 'ORBIT',
      enablePan: ext.enablePan !== false,
      minDistance: ext.orbitMinDistance ?? 0.1,
      maxDistance: ext.orbitMaxDistance ?? 1000,
      minPolarAngle: ext.orbitMinPolarAngle ?? 0,
      maxPolarAngle: ext.orbitMaxPolarAngle ?? Math.PI,
      rotateSpeed: ext.rotateSpeed ?? 1,
      moveSpeed: ext.moveSpeed ?? 1,
    };

    // orbitTarget 是节点索引 → 读取其位置
    if (typeof ext.orbitTarget === 'number') {
      const targetNode = nodes[ext.orbitTarget];
      if (targetNode?.translation) {
        data.orbitTarget = new THREE.Vector3(
          targetNode.translation[0],
          targetNode.translation[1],
          targetNode.translation[2]
        );
      }
    }

    return data;
  }
  return null;
}

/**
 * 收集 S8S_v3d_lights 数据
 */
function collectLightsData(json) {
  const ext = json.extensions?.S8S_v3d_lights;
  if (!ext?.lights?.length) return [];

  const lights = [];
  ext.lights.forEach((lDef) => {
    const light = {
      type: lDef.type || 'ambient',
      color: lDef.color ? [lDef.color[0], lDef.color[1], lDef.color[2]] : [1, 1, 1],
      intensity: lDef.intensity ?? 1,
      profile: lDef.profile || 'max',
      range: lDef.range,
      innerConeAngle: lDef.innerConeAngle,
      outerConeAngle: lDef.outerConeAngle,
    };
    lights.push(light);
  });

  // 找出哪些节点引用哪个灯光
  (json.nodes || []).forEach((nDef, nodeIdx) => {
    const lightRef = nDef.extensions?.S8S_v3d_lights;
    if (lightRef?.light != null && lights[lightRef.light]) {
      if (!lights[lightRef.light].nodeIndexes) lights[lightRef.light].nodeIndexes = [];
      lights[lightRef.light].nodeIndexes.push(nodeIdx);
      if (nDef.translation) {
        lights[lightRef.light].position = nDef.translation;
      }
    }
  });

  return lights;
}

/**
 * 收集 S8S_v3d_scene 数据
 */
function collectSceneData(json) {
  const scenes = json.scenes || [];
  for (const sDef of scenes) {
    const ext = sDef.extensions?.S8S_v3d_scene;
    if (!ext) continue;

    return {
      aaMethod: ext.aaMethod,
      physicallyCorrectLights: !!ext.physicallyCorrectLights,
      shadowMap: ext.shadowMap ? { ...ext.shadowMap } : null,
      unitsScaleFactor: ext.unitsScaleFactor,
      worldMaterial: ext.worldMaterial,
      pmremMaxTileSize: ext.pmremMaxTileSize,
    };
  }
  return null;
}


// ═══════════════════════════════════════════════════════════════
// 主扩展类
// ═══════════════════════════════════════════════════════════════

export class S8SExtension {
  constructor(parser) {
    this.parser = parser;
    this.name = 'S8S_v3d_materials'; // 注册名（只要是 used 扩展名即可）
  }

  async afterRoot(result) {
    const json = this.parser.json;
    console.log('[S8SExtension] Processing extensions…');

    // ── 1. 收集用到的扩展 ──────────────────────────────────────
    const usedExts = (json.extensionsUsed || []);
    const hasMaterials = usedExts.includes('S8S_v3d_materials');
    const hasTextures = usedExts.includes('S8S_v3d_texture');
    const hasNodes = usedExts.includes('S8S_v3d_node');
    const hasAnimations = usedExts.includes('S8S_v3d_animation');
    const hasCamera = usedExts.includes('S8S_v3d_camera');
    const hasLights = usedExts.includes('S8S_v3d_lights');
    const hasScene = usedExts.includes('S8S_v3d_scene');

    console.log('[S8SExtension] Extensions found:', {
      materials: hasMaterials, textures: hasTextures, nodes: hasNodes,
      animations: hasAnimations, camera: hasCamera, lights: hasLights, scene: hasScene,
    });

    // ── 2. 收集所有需要的纹理索引 ───────────────────────────────
    const neededTexIndices = hasMaterials || hasTextures
      ? collectAllS8STextureIndices(json)
      : [];

    // ── 3. 解析纹理（并行，带超时）──────────────────────────────
    const texMap = {};
    if (neededTexIndices.length > 0) {
      const texPromises = neededTexIndices.map(async (idx) => {
        try {
          const tex = await Promise.race([
            this.parser.getDependency('texture', idx),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('timeout')), 8000)
            ),
          ]);
          if (tex instanceof THREE.Texture) {
            texMap[idx] = tex;
          }
        } catch (e) {
          console.warn('[S8SExtension] Texture', idx, 'unavailable:', e?.message);
        }
      });
      await Promise.all(texPromises);
      console.log('[S8SExtension] Textures resolved:', Object.keys(texMap).length, '/', neededTexIndices.length);
    }

    // ── 4. 应用 S8S_v3d_texture 参数 ───────────────────────────
    if (hasTextures) {
      (json.textures || []).forEach((texDef, idx) => {
        const ext = texDef.extensions?.S8S_v3d_texture;
        if (!ext) return;
        const tex = texMap[idx];
        if (tex) {
          applyTextureParams(tex, texDef, idx, ext);
        }
      });
      console.log('[S8SExtension] Texture params applied');
    }

    // ── 5. 转换 S8S_v3d_materials ──────────────────────────────
    if (hasMaterials) {
      const textureResolver = (idx) => texMap[idx] || null;
      const s8sMatMap = createMaterialsFromS8S(json, textureResolver);

      // 5a. 通过 parser.getDependency 获取 GLTFLoader 为每个 glTF 材质
      //     创建的原始 Three.js 材质引用，建立 原始材质 → index 映射。
      const oldMatToIndex = new Map();
      const matCount = (json.materials || []).length;
      for (let idx = 0; idx < matCount; idx++) {
        try {
          const origMat = await this.parser.getDependency('material', idx);
          if (origMat) {
            oldMatToIndex.set(origMat, idx);
          }
        } catch {
          // 材质解析失败（极少情况），跳过
        }
      }

      // 5b. 构建名称 → glTF 材质索引 回退映射
      //     处理 getDependency 返回不同引用的情况（如空 PBR 材质）。
      //     重复名称只保留首个索引（重复材质属性相同，可互换）。
      const nameToIndex = new Map();
      (json.materials || []).forEach((mDef, idx) => {
        const name = mDef.name || `Material #${idx}`;
        if (!nameToIndex.has(name)) {
          nameToIndex.set(name, idx);
        }
      });

      // 5c. 替换 result.materials 数组中的材质（供后续代码引用）
      if (result.materials) {
        for (const [idx, mat] of s8sMatMap) {
          if (result.materials[idx]) {
            result.materials[idx] = mat;
          }
        }
      }

      // 5c. 遍历场景 Mesh，替换材质：优先引用匹配，回退名称匹配
      result.scene?.traverse((child) => {
        if (!child.isMesh || !child.material) return;

        const resolveIdx = (mat) => {
          const refIdx = oldMatToIndex.get(mat);
          if (refIdx != null) return refIdx;
          return nameToIndex.get(mat.name) ?? null;
        };

        if (Array.isArray(child.material)) {
          let changed = false;
          const newMats = child.material.map((m) => {
            const mIdx = resolveIdx(m);
            if (mIdx != null && s8sMatMap.has(mIdx)) {
              changed = true;
              const replacement = s8sMatMap.get(mIdx);
              replacement.needsUpdate = true;
              return replacement;
            }
            return m;
          });
          if (changed) child.material = newMats;
        } else {
          const mIdx = resolveIdx(child.material);
          if (mIdx != null && s8sMatMap.has(mIdx)) {
            child.material = s8sMatMap.get(mIdx);
            child.material.needsUpdate = true;
          }
        }
      });

      console.log('[S8SExtension] Materials converted:', s8sMatMap.size);
    }

    // ── 6. 应用 S8S_v3d_node 属性 ──────────────────────────────
    if (hasNodes) {
      const nodePropsByName = collectNodeProps(json);
      applyNodePropsToScene(result.scene, nodePropsByName);
      console.log('[S8SExtension] Node props applied:', nodePropsByName.size);
    }

    // ── 7. 应用 S8S_v3d_animation 设置 ──────────────────────────
    if (hasAnimations && result.animations) {
      applyAnimationSettings(result.animations, json);
      console.log('[S8SExtension] Animation settings applied');
    }

    // ── 8. 收集并存储相机/灯光/场景数据 ─────────────────────────
    const s8sData = {};

    if (hasCamera) {
      s8sData.camera = collectCameraData(json);
      if (s8sData.camera) {
        console.log('[S8SExtension] Camera:', s8sData.camera.controls,
          'target:', s8sData.camera.orbitTarget?.toArray());
      }
    }

    if (hasLights) {
      s8sData.lights = collectLightsData(json);
      console.log('[S8SExtension] Lights:', s8sData.lights.length);
    }

    if (hasScene) {
      s8sData.scene = collectSceneData(json);
      console.log('[S8SExtension] Scene data:', s8sData.scene ? 'yes' : 'no');
    }

    // 存储到 result.userData 供 SceneContent 使用
    if (!result.userData) result.userData = {};
    result.userData.s8s = s8sData;

    console.log('[S8SExtension] Complete');
  }
}


// ═══════════════════════════════════════════════════════════════
// 辅助 API：从 result.userData 读取 S8S 数据
// ═══════════════════════════════════════════════════════════════

/**
 * 从加载结果中获取 S8S 相机数据
 */
export function getS8SCameraData(gltfResult) {
  return gltfResult?.userData?.s8s?.camera || null;
}

/**
 * 从加载结果中获取 S8S 灯光数据
 */
export function getS8SLightsData(gltfResult) {
  return gltfResult?.userData?.s8s?.lights || null;
}

/**
 * 从加载结果中获取 S8S 场景数据
 */
export function getS8SSceneData(gltfResult) {
  return gltfResult?.userData?.s8s?.scene || null;
}

/**
 * 从加载结果中获取所有 S8S 数据
 */
export function getS8SData(gltfResult) {
  return gltfResult?.userData?.s8s || null;
}
