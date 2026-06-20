/**
 * S8S_v3d_materials 扩展加载器  v5 — MeshPhysicalMaterial 完整映射
 *
 * 将 Verge3D 节点材质（PHYSICAL_MX）转换为 Three.js MeshPhysicalMaterial。
 * v5 新增：
 *  - MeshPhysicalMaterial 替代 MeshStandardMaterial
 *  - specular → specularIntensity，specularTint → specularColor
 *  - IOR 映射
 *  - clearcoat/clearcoatRoughness 映射
 */
import * as THREE from 'three';
import { NodeGraphResolver } from './v3d-loader';
import { applyMTMaxIBL } from './PhysicalMXShaderPatcher';

// PHYSICAL_MX 输入插槽索引映射（来源：v3d.js PHYSICAL_MX 节点定义）
// slot 0 = "base"（标量因子），slot 1 = "baseColor"（实际颜色/纹理连接）
// Verge3D 内部公式：diffuse = base × baseColor（× texture if connected）
const SLOT = {
  BASE_FACTOR:        0,  // "base" — 标量乘数因子
  BASE_COLOR:         1,  // "baseColor" — 实际颜色/纹理
  SPECULAR:           2,
  SPECULAR_TINT:      3,
  ROUGHNESS:          4,
  METALLIC:           5,
  DIFF_ROUGHNESS:     6,
  ANISOTROPY:         7,
  ANISO_ANGLE:        8,
  TRANSPARENCY:       9,
  TRANS_COLOR:        10,
  TRANS_ROUGHNESS:    11,
  IOR:                12,
  SCATTERING:         13,
  SSS_COLOR:          14,
  SSS_SCALE:          15,
  EMISSION:           16,
  EMIT_COLOR:         17,
  CLEARCOAT:          18,
  CLEARCOAT_COLOR:    19,
  CLEARCOAT_ROUGHNESS:20,
  NORMAL:             21,
  CLEARCOAT_NORMAL:   22,
  DISPLACEMENT:       23,
  OPACITY:            24,
};

/**
 * 在节点图中查找连接到指定 PHYSICAL_MX 插槽的 BITMAP_MX 节点
 * 使用 edges 追踪，比启发式 inputFactors 更可靠
 *
 * @param {Object} ng - 节点图
 * @param {number} physIdx - PHYSICAL_MX 节点索引
 * @param {number|number[]} slots - 目标插槽（支持多个备选）
 * @returns {{ node, slot } | null}
 */
function findBitmapEdge(ng, physIdx, slots) {
  const slotSet = new Set(Array.isArray(slots) ? slots : [slots]);
  const edges = ng.edges || [];
  const nodes = ng.nodes || [];

  for (const e of edges) {
    const toSlot = e.toInput ?? e.toSocket;
    if (e.toNode === physIdx && slotSet.has(toSlot)) {
      const srcNode = nodes[e.fromNode];
      if (srcNode && srcNode.type === 'BITMAP_MX') {
        return { node: srcNode, slot: toSlot };
      }
    }
  }
  return null;
}

/**
 * 从 PHYSICAL_MX 节点的 inputs[] 读取标量值
 */
function readScalar(inputs, slot) {
  if (!inputs || !Array.isArray(inputs)) return undefined;
  const v = inputs[slot];
  if (v == null) return undefined;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && 'value' in v) return Number(v.value);
  return undefined;
}

/**
 * 从 PHYSICAL_MX 节点的 inputs[] 读取颜色值 [r,g,b,a]
 */
function readColorRgba(inputs, slot) {
  if (!inputs || !Array.isArray(inputs)) return null;
  const v = inputs[slot];
  if (v == null) return null;
  if (Array.isArray(v)) return v;
  if (typeof v === 'object' && 'value' in v && Array.isArray(v.value)) return v.value;
  return null;
}

/**
 * 线性空间 → sRGB 转换
 *
 * PHYSICAL_MX 的 inputs[] 颜色值存储在 LINEAR 空间（Verge3D 着色器内部
 * 直接使用，不做 sRGB→linear 转换）。但 THREE.Color 的 hex 构造函数
 * 会对 hex 做 sRGB→linear 转换，导致 DOUBLE LINEARIZATION（颜色过暗）。
 *
 * 解决方案：先 linear→sRGB，THREE.Color 再 sRGB→linear 回到正确的值。
 */
function linearToSRGB(c) {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

function rgbaToHex(rgba) {
  if (!rgba || !Array.isArray(rgba)) return 0xffffff;
  // linear→sRGB 转换后再乘 255 取整，THREE.Color(hex) 会逆向转换
  const r = Math.round(linearToSRGB(rgba[0]) * 255);
  const g = Math.round(linearToSRGB(rgba[1]) * 255);
  const b = Math.round(linearToSRGB(rgba[2]) * 255);
  return (r << 16) | (g << 8) | b;
}

// ── BITMAP_MX output 变换 ────────────────────────────────────────────────

/**
 * 对纹理应用 BITMAP_MX output 变换（Canvas2D 预处理）。
 *
 * Verge3D BITMAP_MX shader 中纹理输出公式：
 *   output = ((texture_sample * rgbLevel + rgbOffset) → clamp → invert) * outputAmount
 *
 * 适用于 roughness / baseColor / emissive / alpha 等所有纹理类型。
 * 对灰度纹理仅处理 R 通道；对颜色纹理处理 RGB 三通道。
 *
 * @param {THREE.Texture} texture - 原始纹理
 * @param {object} outputProps - BITMAP_MX output 属性
 * @param {string} colorSpace - 输出色彩空间（默认 LinearSRGBColorSpace）
 * @returns {THREE.CanvasTexture} 变换后的新纹理
 */
function applyBitmapOutputTransform(texture, outputProps, colorSpace) {
  const img = texture.image;
  if (!img || !img.width) return texture;

  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const { rgbLevel = 1, rgbOffset = 0, outputAmount = 1, clamp = false, invert = false } = outputProps;

  for (let i = 0; i < data.length; i += 4) {
    for (let ch = 0; ch < 3; ch++) {
      let v = (data[i + ch] / 255) * rgbLevel + rgbOffset;
      if (clamp) v = Math.max(0, Math.min(1, v));
      if (invert) v = 1 - v;
      v = v * outputAmount;
      data[i + ch] = Math.round(Math.max(0, Math.min(1, v)) * 255);
    }
  }

  ctx.putImageData(imageData, 0, 0);

  const newTex = new THREE.CanvasTexture(canvas);
  newTex.colorSpace = colorSpace || THREE.LinearSRGBColorSpace;
  newTex.wrapS = texture.wrapS;
  newTex.wrapT = texture.wrapT;
  newTex.magFilter = texture.magFilter;
  newTex.minFilter = texture.minFilter;
  newTex.flipY = texture.flipY;
  newTex.needsUpdate = true;

  return newTex;
}

/**
 * 检查 BITMAP_MX output 是否有非默认变换
 */
function hasBitmapOutputTransform(outputProps) {
  if (!outputProps) return false;
  return (
    (outputProps.outputAmount ?? 1) !== 1 ||
    (outputProps.rgbLevel ?? 1) !== 1 ||
    (outputProps.rgbOffset ?? 0) !== 0 ||
    (outputProps.clamp ?? false) ||
    (outputProps.invert ?? false)
  );
}

// ── 主转换函数 ───────────────────────────────────────────────────────────

/**
 * 从 glTF JSON 构建 S8S 材质（v4：完整节点图求值）
 *
 * @param {Object} gltfJson - 解析后的 glTF JSON
 * @param {Function} textureResolver - (textureIndex) => THREE.Texture | null
 * @returns {Map<number, THREE.Material>} materialIndex → THREE.Material
 */
export function createMaterialsFromS8S(gltfJson, textureResolver) {
  // 非 S8S 空材质回退表（materialIndex → 默认属性）
  // 当 glTF pbrMetallicRoughness 为空时，使用此表的 baseColor/roughness/metalness
  const FALLBACK_MATS = {
    2:  { color: '#888888', roughness: 0.5, metalness: 0.05 },  // #73 (20 meshes)
    7:  { color: '#7a7a7a', roughness: 0.55, metalness: 0.05 }, // #71
    8:  { color: '#808080', roughness: 0.5, metalness: 0.05 },  // #68
    9:  { color: '#757575', roughness: 0.55, metalness: 0.05 }, // #67
    10: { color: '#808080', roughness: 0.5, metalness: 0.05 },  // #68 (dup)
    11: { color: '#707070', roughness: 0.6, metalness: 0.1 },   // fsdfsd31233213705
  };

  const matMap = new Map();
  const materials = gltfJson.materials || [];

  materials.forEach((matDef, idx) => {
    const ext = matDef.extensions?.S8S_v3d_materials;
    if (!ext) {
      // 标准材质（无 S8S 扩展）
      const pbr = matDef.pbrMetallicRoughness || {};
      const hasPbrData = pbr.baseColorFactor != null || pbr.baseColorTexture != null;

      let color, roughness, metalness;

      if (hasPbrData) {
        color = pbr.baseColorFactor ? rgbaToHex(pbr.baseColorFactor) : 0xffffff;
        roughness = pbr.roughnessFactor ?? 1;
        metalness = pbr.metallicFactor ?? 0;
      } else {
        // 空 PBR → 使用回退表
        const fallback = FALLBACK_MATS[idx];
        if (fallback) {
          color = new THREE.Color(fallback.color).getHex();
          roughness = fallback.roughness;
          metalness = fallback.metalness;
        } else {
          color = 0x888888;
          roughness = 0.5;
          metalness = 0.05;
        }
        console.log(`[S8SMaterialLoader] ${matDef.name || `#${idx}`}: empty PBR → fallback color=${color.toString(16)}`);
      }

      const mat = new THREE.MeshPhysicalMaterial({
        color,
        roughness,
        metalness,
      });
      if (matDef.alphaMode === 'BLEND') {
        mat.transparent = true;
        mat.opacity = pbr.baseColorFactor?.[3] ?? 1;
      }
      if (matDef.doubleSided) mat.side = THREE.DoubleSide;
      mat.name = matDef.name || `Material #${idx}`;

      // 注入 MT_MAX IBL 着色器补丁（保持与 S8S 材质一致的 IBL 行为）
      applyMTMaxIBL(mat);

      matMap.set(idx, mat);
      return;
    }

    const ng = ext.nodeGraph;
    const physNode = ng.nodes.find((n) => n.type === 'PHYSICAL_MX');
    if (!physNode) {
      const mat = new THREE.MeshPhysicalMaterial({ name: matDef.name || `Material #${idx}` });
      matMap.set(idx, mat);
      return;
    }

    const inputs = physNode.inputs || [];
    const inputFactors = physNode.inputFactors || [];
    const physIdx = ng.nodes.indexOf(physNode);

    // ── NodeGraphResolver ──────────────────────────────────────────────
    const resolver = new NodeGraphResolver(ng);

    /** 解析纹理 + 源节点信息 */
    const resolveTexWithMeta = (socket) => {
      const sourceNode = resolver.resolveSourceNode(physIdx, socket);
      if (!sourceNode) return { texture: null, bitmapNode: null, texIdx: null };
      const texIdx = sourceNode.texture ?? sourceNode.textureIndex ?? sourceNode.image;
      if (texIdx == null) return { texture: null, bitmapNode: sourceNode, texIdx: null };
      const texture = textureResolver(texIdx);
      return { texture, bitmapNode: sourceNode, texIdx };
    };

    /** 仅解析纹理 */
    const resolveTex = (socket) => resolveTexWithMeta(socket).texture;

    // ── 边缘追踪：确定 base color 纹理连接 ───────────────────────
    // Verge3D PHYSICAL_MX: slot 0="base"(因子), slot 1="baseColor"(颜色)
    // 纹理可连接到任意一个 slot，通过 edges 追踪
    const colorEdge = findBitmapEdge(ng, physIdx, [SLOT.BASE_FACTOR, SLOT.BASE_COLOR]);
    // 无纹理时颜色来自 slot 1 (baseColor)，有纹理时做乘法
    const colorSourceSlot = colorEdge ? colorEdge.slot : SLOT.BASE_COLOR;

    // ── 解析纹理 + BITMAP_MX 元数据 ──────────────────────────────────
    const baseColorMeta   = resolveTexWithMeta(colorSourceSlot);
    const roughnessMeta   = resolveTexWithMeta(SLOT.ROUGHNESS);
    const metalnessMeta   = resolveTexWithMeta(SLOT.METALLIC);
    const normalMeta      = resolveTexWithMeta(SLOT.NORMAL);
    const emissiveMeta    = resolveTexWithMeta(SLOT.EMIT_COLOR);

    let baseColorTex   = baseColorMeta.texture;
    let roughnessTex   = roughnessMeta.texture;
    let metalnessTex   = metalnessMeta.texture;
    let normalTex      = normalMeta.texture;
    let emissiveTex    = emissiveMeta.texture || resolveTex(SLOT.EMISSION);

    // 透明度/不透明度纹理
    const transparencyMeta = resolveTexWithMeta(SLOT.TRANSPARENCY);
    const opacityMeta     = resolveTexWithMeta(SLOT.OPACITY);
    let transparencyTex   = transparencyMeta.texture || opacityMeta.texture;

    // ── 收集 BITMAP_MX output 属性 ───────────────────────────────────
    const bitmapOutputs = {};

    // 粗糙度纹理 output 变换
    if (roughnessTex && roughnessMeta.bitmapNode?.output) {
      bitmapOutputs.roughness = { ...roughnessMeta.bitmapNode.output };
      if (hasBitmapOutputTransform(bitmapOutputs.roughness)) {
        roughnessTex = applyBitmapOutputTransform(roughnessTex, bitmapOutputs.roughness, THREE.LinearSRGBColorSpace);
        console.log(
          `[S8SMaterialLoader] ${matDef.name}: roughness transform ` +
          `outputAmount=${bitmapOutputs.roughness.outputAmount} ` +
          `rgbOffset=${bitmapOutputs.roughness.rgbOffset}`,
        );
      }
    }

    // 其他纹理也记录 output 并应用变换
    for (const [key, meta] of [
      ['baseColor', baseColorMeta],
      ['metalness', metalnessMeta],
      ['normal', normalMeta],
      ['emissive', emissiveMeta],
      ['transparency', transparencyMeta],
      ['opacity', opacityMeta],
    ]) {
      if (meta.texture && meta.bitmapNode?.output) {
        bitmapOutputs[key] = { ...meta.bitmapNode.output };
      }
    }

    // baseColor 纹理 output 变换
    if (baseColorTex && bitmapOutputs.baseColor && hasBitmapOutputTransform(bitmapOutputs.baseColor)) {
      baseColorTex = applyBitmapOutputTransform(baseColorTex, bitmapOutputs.baseColor, THREE.SRGBColorSpace);
    }

    // emissive 纹理 output 变换
    if (emissiveTex && bitmapOutputs.emissive && hasBitmapOutputTransform(bitmapOutputs.emissive)) {
      emissiveTex = applyBitmapOutputTransform(emissiveTex, bitmapOutputs.emissive, THREE.SRGBColorSpace);
    }

    // 透明度纹理 output 变换
    if (transparencyTex && bitmapOutputs.transparency && hasBitmapOutputTransform(bitmapOutputs.transparency)) {
      transparencyTex = applyBitmapOutputTransform(transparencyTex, bitmapOutputs.transparency, THREE.LinearSRGBColorSpace);
    }

    // ── PHYSICAL_MX 属性 ────────────────────────────────────────────
    const brdfLow  = physNode.brdfLow  ?? 0;
    const brdfHigh = physNode.brdfHigh ?? 1;
    const emitLuminance = physNode.emitLuminance ?? 1500;
    const roughnessInv  = physNode.roughnessInv ?? false;

    // ── 修正色彩空间 ──────────────────────────────────────────────────
    if (baseColorTex) baseColorTex.colorSpace = THREE.SRGBColorSpace;
    if (roughnessTex) roughnessTex.colorSpace = THREE.LinearSRGBColorSpace;
    if (metalnessTex) metalnessTex.colorSpace = THREE.LinearSRGBColorSpace;
    if (normalTex) normalTex.colorSpace = THREE.LinearSRGBColorSpace;
    if (emissiveTex) emissiveTex.colorSpace = THREE.SRGBColorSpace;
    if (transparencyTex) transparencyTex.colorSpace = THREE.LinearSRGBColorSpace;

    // ── 标量值 ────────────────────────────────────────────────────────
    // baseColor 总是从 slot 1 读取（PHYSICAL_MX 的颜色定义在 "baseColor" 插槽）
    let baseColorRgba = readColorRgba(inputs, SLOT.BASE_COLOR);

    // 有纹理时：读取另一插槽的值作为乘数，模拟 Verge3D 的 base × baseColor 公式
    if (baseColorTex) {
      if (colorEdge?.slot === SLOT.BASE_FACTOR) {
        // 纹理连接在 slot 0（base 因子），slot 1 的值是颜色乘数
        // 例: GalvanizedSteel — 纹理×[0.227,0.227,0.227]
        const multiplier = readColorRgba(inputs, SLOT.BASE_COLOR);
        // 安全钳：乘数接近纯黑（默认值）时不应用，避免纹理变黑
        if (multiplier && multiplier[0] + multiplier[1] + multiplier[2] > 0.01) {
          baseColorRgba = multiplier;
        } else {
          baseColorRgba = null;
        }
      } else {
        // 纹理连接在 slot 1（baseColor），slot 0 是标量因子
        // 例: Wood06 — 1×纹理
        baseColorRgba = null; // 白色，不改变纹理颜色
      }
    }

    let roughness = readScalar(inputs, SLOT.ROUGHNESS) ?? 0.5;
    let metalness = readScalar(inputs, SLOT.METALLIC) ?? 0;

    // Verge3D PHYSICAL_MX: roughness=0 时 roughnessMap 影响力为 0（0 × map = 0）
    // 材质保持 brdfLow 光泽度，与 3ds Max 一致。丢弃 roughnessTex。
    if (roughnessTex && roughness === 0) {
      roughnessTex = null;
    }

    // roughnessInv：Verge3D 支持粗糙度反转（光泽度模式），glossiness → roughness
    if (roughnessInv) {
      roughness = 1 - roughness;
    }

    // brdfLow 钳制：Verge3D PHYSICAL_MX 内部 clamp(roughness, brdfLow, brdfHigh)
    roughness = Math.max(brdfLow, Math.min(brdfHigh, roughness));

    // ── PHYSICAL_MX 高级属性 ──────────────────────────────────────
    const specular        = readScalar(inputs, SLOT.SPECULAR)        ?? 1;
    const specularTintRgba = readColorRgba(inputs, SLOT.SPECULAR_TINT);
    const ior             = readScalar(inputs, SLOT.IOR)             ?? 1.5;
    const clearcoat       = readScalar(inputs, SLOT.CLEARCOAT)       ?? 0;
    const clearcoatRough  = readScalar(inputs, SLOT.CLEARCOAT_ROUGHNESS) ?? 0;

    // specularColor 从 specularTint 取（默认 [1,1,1,1] = 无染色）
    const specularColor = specularTintRgba
      ? new THREE.Color(specularTintRgba[0], specularTintRgba[1], specularTintRgba[2])
      : new THREE.Color(0xffffff);

    // 自发光 —— 仅当有实际发光数据时才启用
    let emissiveRgba = readColorRgba(inputs, SLOT.EMIT_COLOR);
    let emissiveIntensity = readScalar(inputs, SLOT.EMISSION);
    const hasEmissionData = emissiveRgba != null || emissiveTex || emissiveIntensity != null;
    const normalizedEmissiveIntensity = hasEmissionData
      ? (emissiveIntensity ?? 1) * (emitLuminance / 1500)
      : 0;

    // 透明度 / 不透明度
    // Verge3D: transparency (slot 9, 0=opaque 1=clear) + opacity (slot 24, 1=opaque 0=clear)
    // combined: finalAlpha = (1 - transparency) * opacity * alphaMap
    const transparencyScalar = readScalar(inputs, SLOT.TRANSPARENCY) ?? 0;
    const opacityScalar = readScalar(inputs, SLOT.OPACITY) ?? 1;
    const alphaMode = matDef.alphaMode;
    const hasTransparencyTex = !!transparencyTex;
    const needsTransparency = alphaMode === 'BLEND' || alphaMode === 'MASK'
      || transparencyScalar > 0.001 || hasTransparencyTex || opacityScalar < 0.999;

    // 计算最终不透明度
    let finalOpacity = opacityScalar; // 默认 1
    if (hasTransparencyTex) {
      // 透明度纹理控制 per-pixel 透明度，保留 scalar 作为乘数
      finalOpacity = (1 - transparencyScalar) * opacityScalar;
    } else if (needsTransparency) {
      finalOpacity = (1 - transparencyScalar) * opacityScalar;
    }

    // ── 创建材质（MeshPhysicalMaterial 支持 specular/IOR/clearcoat）───
    const mat = new THREE.MeshPhysicalMaterial({
      name: matDef.name || `Material #${idx}`,
      color: baseColorRgba ? rgbaToHex(baseColorRgba) : 0xffffff,
      roughness,
      metalness,
      // PHYSICAL_MX specular 控制
      specularIntensity: specular,
      specularColor,
      // IOR
      ior,
      // clearcoat
      clearcoat,
      clearcoatRoughness: clearcoatRough,
      // 自发光
      emissive: emissiveRgba ? rgbaToHex(emissiveRgba) : 0x000000,
      emissiveIntensity: normalizedEmissiveIntensity,
      transparent: needsTransparency,
      opacity: finalOpacity,
      ...(alphaMode === 'MASK' ? { alphaTest: matDef.alphaCutoff ?? 0.5 } : {}),
      depthWrite: !(alphaMode === 'BLEND'),
      side: matDef.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
    });

    // ── 赋纹理 ──────────────────────────────────────────────────────
    if (baseColorTex) mat.map = baseColorTex;
    if (roughnessTex) mat.roughnessMap = roughnessTex;
    if (metalnessTex) mat.metalnessMap = metalnessTex;
    if (normalTex) {
      mat.normalMap = normalTex;
      // PHYSICAL_MX normal 强度来自 inputFactors[21]（默认 1.0）
      const normalStrength = (physNode.inputFactors || [])[SLOT.NORMAL];
      if (normalStrength != null) {
        mat.normalScale = new THREE.Vector2(normalStrength, normalStrength);
      }
    }
    if (emissiveTex) mat.emissiveMap = emissiveTex;
    if (transparencyTex) mat.alphaMap = transparencyTex;

    // 有 emission 纹理时：emit_color 为 null 或默认黑色 → 设为白色
    // （Three.js 中 emissive × emissiveMap，黑色会使纹理完全不发光）
    if (emissiveTex) {
      const isBlackEmission = !emissiveRgba || (
        emissiveRgba[0] < 0.01 && emissiveRgba[1] < 0.01 && emissiveRgba[2] < 0.01
      );
      if (isBlackEmission) {
        mat.emissive = new THREE.Color(0xffffff);
      }
    }

    // ── 保存完整 S8S 数据供业务层使用 ─────────────────────────────────
    mat.userData.s8s = {
      inputs,
      inputFactors,
      physNodeIdx: physIdx,
      nodeGraph: ng,
      bitmapOutputs,
      brdfLow,
      brdfHigh,
      emitLuminance,
      roughnessInv,
      specular,
      specularTint: specularTintRgba,
      ior,
      clearcoat,
      clearcoatRoughness: clearcoatRough,
      transparencyScalar,
      opacityScalar,
      hasTransparencyTex,
      alphaMode,
    };

    // ── 注入 MT_MAX IBL 着色器补丁 ───────────────────────────────────
    applyMTMaxIBL(mat);

    matMap.set(idx, mat);
  });

  return matMap;
}

// ── 公共 API ─────────────────────────────────────────────────────────────

/**
 * 从 S8S 材质中读取 float 输入值
 */
export function getS8SInput(mat, inputIndex) {
  const s8s = mat?.userData?.s8s;
  if (!s8s) return undefined;
  return s8s.inputs[inputIndex];
}

/**
 * 设置 S8S 材质的 float 输入值
 *
 * 特殊处理：
 *  - SLOT.EMISSION (16)：更新 mat.emissiveIntensity，自动乘 emitLuminance/1500
 *  - SLOT.EMIT_COLOR (17)：更新 mat.emissive 颜色
 */
export function setS8SInput(mat, inputIndex, value) {
  const s8s = mat?.userData?.s8s;
  if (!s8s) return;
  s8s.inputs[inputIndex] = value;

  if (inputIndex === SLOT.EMISSION) {
    const emitLum = s8s.emitLuminance ?? 1500;
    mat.emissiveIntensity = value * (emitLum / 1500);
  }
  if (inputIndex === SLOT.EMIT_COLOR) {
    if (Array.isArray(value)) {
      mat.emissive.setRGB(value[0], value[1], value[2]);
    }
  }
}
