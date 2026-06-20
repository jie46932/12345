/**
 * useModel — R3F 模型加载 hook（手动加载，不使用 useLoader/Suspense）
 *
 * 封装 GLTFLoader，支持 KTX2 + S8SExtension（处理所有 Verge3D
 * S8S 私有扩展：材质、纹理、节点、动画、相机、灯光、场景）。
 *
 * Three.js r184+ no longer exposes result.textures — textures are only
 * accessible via the parser.getDependency API, which is why a GLTFLoader
 * extension (afterRoot phase) is used instead of post-load collection.
 */
import { useEffect, useState } from 'react';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { S8SExtension } from '../utils/S8SExtension';
import { trackModelError, trackPerformance } from '../utils/telemetry';

/**
 * Create a preconfigured KTX2Loader
 */
function createKTX2Loader(renderer) {
  // 使用相对路径，Vite 在 dev 和 build 中都会正确解析
  // public/basis_transcoder/ → dev: /basis_transcoder/, build: ./basis_transcoder/
  const transcoderPath = new URL('./basis_transcoder/', window.location.href).href;
  return new KTX2Loader()
    .setTranscoderPath(transcoderPath)
    .detectSupport(renderer);
}

/**
 * Load a glTF model with KTX2 and S8S support
 * @param {string} url - Path to the .gltf/.glb file
 * @param {object} options
 * @param {THREE.WebGLRenderer} [options.renderer] - For KTX2 detection
 * @returns {object|null} glTF scene graph or null
 */
export function useModel(url, options = {}) {
  const [gltf, setGltf] = useState(null);
  const renderer = options.renderer;

  useEffect(() => {
    if (!url) return;

    let cancelled = false;
    const loader = new GLTFLoader();

    // Register comprehensive S8S extension (handles materials, textures,
    // nodes, animations, camera, lights, scene data)
    loader.register((parser) => new S8SExtension(parser));

    // KTX2 support
    if (renderer) {
      const ktx2 = createKTX2Loader(renderer);
      loader.setKTX2Loader(ktx2);
    }

    console.log('[useModel] Loading:', url);

    let timeoutId = null;
    const startedAt = Date.now();

    loader.load(
      url,
      (result) => {
        if (cancelled) return;
        if (timeoutId) clearTimeout(timeoutId);
        console.log('[useModel] Loaded, scene:', !!result?.scene,
          'animations:', result?.animations?.length,
          's8s:', !!result?.userData?.s8s);
        trackPerformance('model_loaded', {
          url,
          elapsedMs: Date.now() - startedAt,
          scene: !!result?.scene,
          animations: result?.animations?.length || 0,
          s8s: !!result?.userData?.s8s,
        });
        setGltf(result);
      },
      options.onProgress,
      (error) => {
        if (timeoutId) clearTimeout(timeoutId);
        console.error('[useModel] Error:', error?.message || error);
        trackModelError('model_load_failed', error, { url });
        if (cancelled) return;
      }
    );

    // Timeout warning (120s — generous for large models)
    timeoutId = setTimeout(() => {
      if (!cancelled) {
        console.warn('[useModel] Still loading after 120s');
        trackPerformance('model_loading_timeout', { url, elapsedMs: 120000 });
      }
    }, 120000);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [url, renderer, options.onProgress]);

  return gltf;
}
