/**
 * PhysicalMXShaderPatcher — Verge3D PHYSICAL_MX MT_MAX IBL 着色器补丁
 *
 * 使用 material.onBeforeCompile 注入 Verge3D PHYSICAL_MX 的 MT_MAX IBL 公式，
 * 替代 Three.js 默认的 DFG LUT 多重散射方法。
 *
 * 核心差异：
 *   Three.js DFG:  FssEss = specularColor * dfgLUT.x + specularF90 * dfgLUT.y
 *                  多散射能量补偿 + dielectric/metallic 分离
 *   Verge3D MT_MAX: specEnv = specularColor / (1 - roughness^4 + π * roughness^4)
 *                  闭式单次散射能量归一化
 *
 * 原理：材质在 3ds Max 中基于 MT_MAX 着色器调校，直接使用 DFG 方法
 * 会产生不同的高光响应，尤其是金属材质。此补丁恢复 MT_MAX 的 IBL 行为。
 */

/**
 * 在 GLSL 源码中查找并替换指定函数
 *
 * @param {string} source - GLSL 源码
 * @param {string} funcName - 函数名
 * @param {string} replacement - 替换文本
 * @returns {string} 替换后的源码
 */
function replaceGLSLFunction(source, funcName, replacement) {
  const pattern = new RegExp(`void\\s+${funcName}\\s*\\(`);
  const match = source.match(pattern);
  if (!match) return source;

  const startIdx = match.index;
  let braceCount = 0;
  let inFunction = false;
  let endIdx = startIdx;

  for (let i = startIdx; i < source.length; i++) {
    if (source[i] === '{') {
      braceCount++;
      inFunction = true;
    } else if (source[i] === '}') {
      braceCount--;
      if (inFunction && braceCount === 0) {
        endIdx = i + 1;
        break;
      }
    }
  }

  return source.slice(0, startIdx) + replacement + source.slice(endIdx);
}

/**
 * MT_MAX IBL 替换函数
 *
 * 替换 RE_IndirectSpecular_Physical：
 *   - Three.js 默认：DFG LUT 查询 + computeMultiscattering
 *   - MT_MAX：闭式 alphaEnv = roughness^4, specEnv = specColor / (1 - alphaEnv + PI * alphaEnv)
 *
 * 保留 clearcoat/sheen 处理（使用原有的 EnvironmentBRDF / IBLSheenBRDF）。
 */
const MT_MAX_IBL_FUNC = /* glsl */`
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {

\t#ifdef USE_CLEARCOAT
\t\tclearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
\t#endif

\t#ifdef USE_SHEEN
\t\tsheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
\t#endif

\t// ── Verge3D PHYSICAL_MX MT_MAX 闭式能量归一化 ──────────────────
\t// Three.js 的 specularColorBlended 直接就是 F0 空间的反射率颜色
\t// （不作 F0 预乘），无需像 Verge3D 内部那样反转 F0 缩放。
\t// 金属时 specularColorBlended 即为 diffuseColor（Three.js 内部已处理）。
\tvec3 specTint = material.specularColorBlended;

\t// MT_MAX 闭式能量归一化: specEnv = tint / (1 - roughness^4 + PI * roughness^4)
\tfloat alphaEnv = pow4( material.roughness );
\tvec3 specEnv = specTint / ( vec3( 1.0 ) - alphaEnv + PI * alphaEnv );

\tvec3 indirectSpecular = radiance * specEnv;
\tvec3 indirectDiffuse = irradiance * RECIPROCAL_PI * material.diffuseContribution * ( vec3( 1.0 ) - specEnv );

\t#ifdef USE_SHEEN
\t\tfloat sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
\t\tfloat sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
\t\tindirectSpecular *= sheenEnergyComp;
\t\tindirectDiffuse *= sheenEnergyComp;
\t#endif

\treflectedLight.indirectSpecular += indirectSpecular;
\treflectedLight.indirectDiffuse += indirectDiffuse;
}
`;

/**
 * 为 MeshPhysicalMaterial 应用 MT_MAX IBL 补丁
 *
 * @param {THREE.MeshPhysicalMaterial} material - 要补丁的材质
 * @returns {THREE.MeshPhysicalMaterial} 传入的材质（链式调用）
 */
export function applyMTMaxIBL(material) {
  const originalOnBeforeCompile = material.onBeforeCompile;

  material.onBeforeCompile = (shader, renderer) => {
    // 先调用原有的 onBeforeCompile（如果有）
    if (originalOnBeforeCompile) {
      originalOnBeforeCompile(shader, renderer);
    }

    // 替换 RE_IndirectSpecular_Physical 为 MT_MAX 版本
    shader.fragmentShader = replaceGLSLFunction(
      shader.fragmentShader,
      'RE_IndirectSpecular_Physical',
      MT_MAX_IBL_FUNC,
    );
  };

  // 共享同一着色器缓存的 patched 材质
  material.customProgramCacheKey = () => 'PHYSICAL_MX_MT_MAX';

  return material;
}
