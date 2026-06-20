/**
 * SceneContent — R3F 场景核心
 *
 * 在此组件中：
 *  - 通过 useModel 加载 glTF（含 S8S 材质扩展）
 *  - 管理所有 3D 业务逻辑（灯、材质、伸缩、配件、独显）
 *  - 注册 sceneAPI 供 App.jsx UI 调用
 *  - 处理鼠标点击选中 + Outline 高亮
 *  - 地面反射 CubeCamera + LED CanvasTexture
 */
import { useEffect, useRef, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import useStore from '../store/useStore';
import { useModel } from '../hooks/useModel';
import materialDefaults from '../data/materialDefaults';

// ── 桌面材质名称映射 ───────────────────────────────────────────
const MAT_NAME_MAP = {
  light: 'Wood03_PBR',
  oak: 'Wood06_PBR',
  dark: 'Wood07_PBR',
};

const WOOD_TEXTURES = {
  light: {
    map: './media/Wood03_512_BaseColor.jpg',
    normalMap: './media/Wood03_512_Normal.jpg',
    roughnessMap: './media/Wood03_512_Roughness.jpg',
    fallbackColor: '#c8a882',
  },
  oak: {
    map: './media/Wood06_512_BaseColor.jpg',
    normalMap: './media/Wood06_512_Normal.jpg',
    roughnessMap: './media/Wood06_512_Roughness.jpg',
    fallbackColor: '#e8d5b0',
  },
  dark: {
    map: './media/Wood07_512_BaseColor.jpg',
    normalMap: './media/Wood07_512_Normal.jpg',
    roughnessMap: './media/Wood07_512_Roughness.jpg',
    fallbackColor: '#3a2a1a',
  },
};

// ── 高度档位映射 ──────────────────────────────────────────────
const HEIGHT_T_MAP = { 68: 0, 94: 0.5, 120: 1 };

// ── 环境贴图亮度（可在 3ds Max 导出后在此调整）───────────────────
// 对应 Verge3D App Manager 中的 Environment Brightness 参数
const ENV_MAP_INTENSITY = 1.0;

const MANUAL_AUTO_ROTATE_SPEED = 0.75;
const IDLE_AUTO_ROTATE_SPEED = 0.3675;
const DESK_LAMP_AREA_LIGHT_INTENSITY = 14;
const DESK_LAMP_AREA_LIGHT_WIDTH = 16;
const DESK_LAMP_AREA_LIGHT_HEIGHT = 0.7;
const PRODUCT_MODEL_URL = './media/12345-verge3d-20260620.gltf';

// ── 伸缩 Dummy 数据 ───────────────────────────────────────────
const DUMMIES = [
  { name: 'Dummy003', y0: -4.1517, y1: -9.592 },
  { name: 'Dummy002', y0: -0.4365, y1: -7.1008 },
];

// ── LED 默认参数（与 useStore 中一致）───────────────────────────
const LED_DEFAULTS = {
  textColor: '#ffffff',
  unitColor: '#ffffff',
  bgColor: '#050505',
  glowBlur: 5,
  textSize: 0.8,
  textX: 0.45,
  textY: 0.76,
  emissiveIntensity: 0.5,
  unit: 'cm',
  unitSize: 0.5,
  unitGap: 10,
  unitOffsetY: 0,
};

// ── Canvas2D: LED 数码管绘制 ───────────────────────────────────
function drawLed(canvas, cm, overrides = {}) {
  const p = { ...LED_DEFAULTS, ...overrides };
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  ctx.fillStyle = p.bgColor;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = 'rgba(0,200,255,0.07)';
  for (let x = 4; x < W; x += 8) {
    for (let y = 4; y < H; y += 8) {
      ctx.fillRect(x, y, 3, 3);
    }
  }

  let displayValue, unitLabel;
  const unit = p.unit || 'mm';
  if (unit === 'cm') {
    displayValue = `${cm}`;
    unitLabel = 'cm';
  } else if (unit === 'inch') {
    displayValue = (cm / 2.54).toFixed(1);
    unitLabel = 'in';
  } else {
    displayValue = `${cm * 10}`;
    unitLabel = 'mm';
  }

  const numFont = `bold ${Math.round(H * p.textSize)}px 'Courier New', monospace`;
  const unitFont = `${Math.round(H * (p.unitSize ?? 0.24))}px 'Courier New', monospace`;

  ctx.font = numFont;
  const numW = ctx.measureText(displayValue).width;
  ctx.font = unitFont;
  const unitW = ctx.measureText(unitLabel).width;

  const GAP = p.unitGap ?? 5;
  const totalW = numW + GAP + unitW;
  const startX = W * p.textX - totalW / 2;
  const baseY = H * p.textY;

  ctx.shadowColor = p.textColor;
  ctx.shadowBlur = p.glowBlur;

  ctx.font = numFont;
  ctx.fillStyle = p.textColor;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(displayValue, startX, baseY);

  ctx.shadowBlur = Math.round(p.glowBlur * 0.4);
  ctx.font = unitFont;
  ctx.fillStyle = p.unitColor;
  ctx.fillText(unitLabel, startX + numW + GAP, baseY + (p.unitOffsetY ?? 0));

  ctx.shadowBlur = 0;
}

// ── 应用 Dummy 位置 ─────────────────────────────────────────────
function applyDummyT(scene, t) {
  if (!scene) return;
  DUMMIES.forEach(({ name, y0, y1 }) => {
    const obj = scene.getObjectByName(name);
    if (obj) obj.position.y = y0 + (y1 - y0) * t;
  });
}

function getLiftClipDuration(animations = []) {
  const liftClips = animations.filter((clip) =>
    DUMMIES.some(({ name }) => clip.name === name)
  );
  const clips = liftClips.length ? liftClips : animations;
  return clips.reduce((max, clip) => Math.max(max, clip.duration || 0), 0);
}

// ── SceneContent ────────────────────────────────────────────────
export default function SceneContent({
  disableWebGLReflections = false,
  disableAreaLights = false,
} = {}) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  // Store
  const setSceneReady = useStore((s) => s.setSceneReady);
  const setSceneAPI = useStore((s) => s.setSceneAPI);
  const setThreeRefs = useStore((s) => s.setThreeRefs);
  const setSelectedObject = useStore((s) => s.setSelectedObject);
  const setCurrentHeight = useStore((s) => s.setCurrentHeight);
  const setArrowT = useStore((s) => s.setArrowT);
  const setLightOn = useStore((s) => s.setLightOn);
  const setSoloActive = useStore((s) => s.setSoloActive);
  const setOrbitActive = useStore((s) => s.setOrbitActive);
  const led = useStore((s) => s.led);
  const ledVersion = useStore((s) => s.ledVersion);
  const currentHeight = useStore((s) => s.currentHeight);
  const soloActive = useStore((s) => s.soloActive);

  // ── 加载模型（手动加载，不使用 Suspense）─────────────────────
  const gltf = useModel(PRODUCT_MODEL_URL, { renderer: gl });

  // Refs for imperative access
  const sceneRef = useRef(null);
  const controlsRef = useRef(null);
  const cubeCameraRef = useRef(null);
  const groundRef = useRef(null);
  const ledCanvasRef = useRef(null);
  const ledTextureRef = useRef(null);
  const ledMaterialRef = useRef(null);
  const arrowMoveRef = useRef(null);
  const playRAFRef = useRef(null);
  const liftDriveIdRef = useRef(0);
  const liftMixerRef = useRef(null);
  const liftClipDurationRef = useRef(0);
  const lastSyncedTRef = useRef(-1);
  const idleTimerRef = useRef(null);
  const soloModeRef = useRef({
    hiddenObjs: [],
    ancestorMeshStates: [],
    origCamLimits: null,
    origCamPos: null,
  });
  const origCamLimitsRef = useRef(null);
  const prevLedVersionRef = useRef(-1);
  const origEmissiveIntensityRef = useRef(null); // 保存 Material #186 导出的原始自发光强度
  const deskLampMaterialsRef = useRef([]);
  const deskLampAreaLightRef = useRef(null);
  // Ref 保存 led 最新值供 useFrame 读取（避免闭包过期）
  const ledRef = useRef(led);
  ledRef.current = led;
  const heightRef = useRef(currentHeight);
  heightRef.current = currentHeight;
  // 视角切换动画 tween
  const viewTweenRef = useRef(null);

  // 缓动函数
  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  const applyLiftT = useCallback((targetScene, t) => {
    const normalizedT = Math.max(0, Math.min(1, t));
    // The exported animation only drives Dummy002/Dummy003 translation.
    // Direct interpolation avoids AnimationMixer keyframe jumps when users
    // interrupt preset playback with manual up/down controls.
    applyDummyT(targetScene, normalizedT);
  }, []);

  // 材质缓存（changeMaterial 避免全场景遍历）
  const matCacheRef = useRef({});

  // ── 模型加载完成：初始化场景 ─────────────────────────────────
  useEffect(() => {
    document.documentElement.dataset.viewerSceneReady = 'loading';
    document.documentElement.dataset.viewerMeshCount = '0';
    document.documentElement.dataset.viewerEnvReady = 'false';

    return () => {
      document.documentElement.dataset.viewerSceneReady = 'false';
      document.documentElement.dataset.viewerEnvReady = 'false';
    };
  }, []);

  const markViewerSceneReady = useCallback((meshCount) => {
    document.documentElement.dataset.viewerSceneReady = 'true';
    document.documentElement.dataset.viewerMeshCount = String(meshCount);
    window.dispatchEvent(new CustomEvent('viewer-scene-ready', {
      detail: { meshCount },
    }));
  }, []);

  useEffect(() => {
    if (!gltf?.scene) return;
    if (!disableAreaLights) {
      RectAreaLightUniformsLib.init();
    }
    const loadedScene = gltf.scene;
    sceneRef.current = loadedScene;

    const liftDuration = getLiftClipDuration(gltf.animations);
    if (liftDuration > 0) {
      const mixer = new THREE.AnimationMixer(loadedScene);
      gltf.animations.forEach((clip) => {
        mixer.clipAction(clip).play();
      });
      liftMixerRef.current = mixer;
      liftClipDurationRef.current = liftDuration;
      window.__liftAnimation = {
        mixer,
        duration: liftDuration,
        clips: gltf.animations.map((clip) => ({
          name: clip.name,
          duration: clip.duration,
          tracks: clip.tracks.length,
        })),
      };
      document.documentElement.dataset.viewerLiftDuration = String(liftDuration);
      console.log('[SceneContent] Lift animation mixer ready:', window.__liftAnimation);
    } else {
      liftMixerRef.current = null;
      liftClipDurationRef.current = 0;
      window.__liftAnimation = null;
      document.documentElement.dataset.viewerLiftDuration = '0';
    }

    // 场景背景色透明（让 Unicorn Studio bg-layer 透出）
    scene.background = null;

    // 存储 Three 引用供标注组件使用
    setThreeRefs(camera, loadedScene, gl);
    window.__threeScene = loadedScene;
    window.__threeRenderer = gl;
    window.__selectObject = setSelectedObject;
    let meshCount = 0;
    loadedScene.traverse((obj) => {
      if (obj.isMesh) meshCount += 1;
    });
    document.documentElement.dataset.viewerMeshCount = String(meshCount);

    // ── 保存导出自发光强度（必须在 DEFAULTS 应用前，避免被覆盖）──
    loadedScene.traverse((obj) => {
      const mats = Array.isArray(obj.material)
        ? obj.material
        : obj.material
          ? [obj.material]
          : [];
      mats.forEach((m) => {
        if (m.name === 'Material #186') {
          if (!deskLampMaterialsRef.current.includes(m)) {
            deskLampMaterialsRef.current.push(m);
          }
          // 保存 3ds Max 导出的原始 emissiveIntensity（含 emitLuminance 归一化）
          origEmissiveIntensityRef.current = m.emissiveIntensity;
          // 灯片需要从上下两个方向都可见；默认 FrontSide 会导致俯视时背面被剔除。
          m.side = THREE.DoubleSide;
          m.toneMapped = false;
          // 初始关闭（用户可点灯开启）
          m.emissiveIntensity = 0;
          m.needsUpdate = true;

          if (!disableAreaLights && !deskLampAreaLightRef.current && obj.isMesh) {
            const lampLight = new THREE.RectAreaLight(
              0xe9cb8a,
              0,
              DESK_LAMP_AREA_LIGHT_WIDTH,
              DESK_LAMP_AREA_LIGHT_HEIGHT
            );
            lampLight.name = '__desk_lamp_area_light';
            // RectAreaLight 默认沿本地 -Z 发光；灯管模型本地 +Z 指向桌面，所以翻转 180°。
            lampLight.rotation.x = Math.PI;
            lampLight.position.set(0, 0, 0);
            obj.add(lampLight);
            deskLampAreaLightRef.current = lampLight;
          }
        }
      });
    });

    // 应用材质覆盖（来自 MaterialPanel DEFAULTS 写入）
    const defaultKeys = Object.keys(materialDefaults).filter(k => k !== '_env' && k !== '_lightOn');
    if (defaultKeys.length > 0) {
      loadedScene.traverse((obj) => {
        if (!obj.material) return;
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((mat) => {
          if (!mat || !mat.isMeshStandardMaterial) return;
          const override = materialDefaults[mat.name];
          if (!override) return;
          if (override.roughness != null) mat.roughness = override.roughness;
          if (override.metalness != null) mat.metalness = override.metalness;
          if (override.color) mat.color.set(override.color);
          if (override.opacity != null) {
            mat.opacity = override.opacity;
            mat.transparent = override.opacity < 1;
          }
          if (override.emissive) mat.emissive.set(override.emissive);
          if (override.emissiveIntensity != null) mat.emissiveIntensity = override.emissiveIntensity;
          mat.needsUpdate = true;
        });
      });
    }

    // 应用 env 默认参数（延迟到 HDR 加载后）
    const envDefaults = materialDefaults._env;
    if (envDefaults && Object.keys(envDefaults).length > 0) {
      const applyEnvDefaults = () => {
        const ctrl = window.__envCtrl;
        if (!ctrl) { setTimeout(applyEnvDefaults, 200); return; }
        if (envDefaults.intensity != null) ctrl.intensity = envDefaults.intensity;
        if (envDefaults.rotationX != null) ctrl.rotationX = envDefaults.rotationX * (Math.PI / 180);
        if (envDefaults.rotationY != null) ctrl.rotationY = envDefaults.rotationY * (Math.PI / 180);
        ctrl.update();
      };
      applyEnvDefaults();
    }

    // 修复 组009 可见性
    const grp009 = loadedScene.getObjectByName('组009');
    if (grp009) grp009.visible = true;

    // 初始升降动画位置（t=0.5 → 94cm 二档）
    applyLiftT(loadedScene, 0.5);

    // ── 修复 fsdfsd31233210118 材质 ────────────────────────────
    // 该对象在 3ds Max 导出时 Material #85 发生错误（贴图丢失/负缩放未重置 Xform），
    // 强制替换为 GalvanizedSteel02_PBR（镀锌钢板材质，47 个对象共享该材质）。
    // 同时修复 3ds Max 镜像负缩放导致的法线翻转问题。
    const wrongObj = loadedScene.getObjectByName('fsdfsd31233210118');
    if (wrongObj) {
      let steelMat = null;
      loadedScene.traverse((o) => {
        if (steelMat) return;
        const mats = Array.isArray(o.material)
          ? o.material
          : o.material
            ? [o.material]
            : [];
        const found = mats.find((m) => m.name === 'GalvanizedSteel02_PBR');
        if (found) steelMat = found;
      });
      if (steelMat) wrongObj.material = steelMat;
    }

    // ── CubeCamera 地面反射 ────────────────────────────────────
    // WebGPU 试验入口先跳过 WebGLCubeRenderTarget，避免 WebGL-only 反射链路影响基础验证。
    const ground = loadedScene.getObjectByName('Plane001');
    if (ground && !disableWebGLReflections) {
      const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(256, {
        generateMipmaps: true,
        minFilter: THREE.LinearMipmapLinearFilter,
      });
      const cubeCamera = new THREE.CubeCamera(0.1, 100, cubeRenderTarget);
      cubeCamera.position.set(ground.position.x, 0.01, ground.position.z);
      cubeCameraRef.current = cubeCamera;
      groundRef.current = ground;

      ground.material = new THREE.MeshStandardMaterial({
        envMap: cubeRenderTarget.texture,
        roughness: 0,
        metalness: 1,
        transparent: true,
        opacity: 0.4,
      });
      ground.visible = true;
    }

    // ── Rectangle007 LED 高度显示 ──────────────────────────────
    const rect007 = loadedScene.getObjectByName('Rectangle007');
    if (rect007) {
      const ledCanvas = document.createElement('canvas');
      ledCanvas.width = 256;
      ledCanvas.height = 128;
      ledCanvasRef.current = ledCanvas;

      drawLed(ledCanvas, 94);

      const ledTex = new THREE.CanvasTexture(ledCanvas);
      ledTex.flipY = false;
      ledTextureRef.current = ledTex;

      // UV 重映射
      const geo = rect007.geometry;
      const uvAttr = geo.attributes.uv;
      if (uvAttr) {
        const arr = uvAttr.array;
        let uMin = Infinity,
          uMax = -Infinity,
          vMin = Infinity,
          vMax = -Infinity;
        for (let i = 0; i < arr.length; i += 2) {
          if (arr[i] < uMin) uMin = arr[i];
          if (arr[i] > uMax) uMax = arr[i];
          if (arr[i + 1] < vMin) vMin = arr[i + 1];
          if (arr[i + 1] > vMax) vMax = arr[i + 1];
        }
        const uRange = uMax - uMin || 1;
        const vRange = vMax - vMin || 1;
        const remapped = new Float32Array(arr.length);
        for (let i = 0; i < arr.length; i += 2) {
          remapped[i] = (arr[i] - uMin) / uRange;
          remapped[i + 1] = (arr[i + 1] - vMin) / vRange;
        }
        geo.setAttribute('uv', new THREE.BufferAttribute(remapped, 2));
      }

      const ledMat = new THREE.MeshStandardMaterial({
        map: ledTex,
        emissiveMap: ledTex,
        emissive: new THREE.Color(LED_DEFAULTS.textColor),
        emissiveIntensity: LED_DEFAULTS.emissiveIntensity,
        roughness: 0.5,
        metalness: 0.1,
      });
      rect007.material = ledMat;
      ledMaterialRef.current = ledMat;
    }

    // Cache desktop materials for changeMaterial. The exported glTF only
    // contains the active desktop material, so alternate wood finishes are
    // built at runtime from the same shader/material base.
    {
      const cache = {};
      const textureLoader = new THREE.TextureLoader();
      const loadTexture = (url, colorSpace = THREE.NoColorSpace) => {
        const texture = textureLoader.load(url, (loaded) => {
          loaded.needsUpdate = true;
        });
        texture.colorSpace = colorSpace;
        texture.flipY = false;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.needsUpdate = true;
        return texture;
      };
      loadedScene.traverse((obj) => {
        const mats = Array.isArray(obj.material)
          ? obj.material
          : obj.material
            ? [obj.material]
            : [];
        mats.forEach((m) => {
          if (m.name === 'Wood03_PBR') cache.light = m;
          else if (m.name === 'Wood06_PBR') cache.oak = m;
          else if (m.name === 'Wood07_PBR') cache.dark = m;
        });
      });
      const baseMat = cache.light
        || loadedScene.getObjectByName('Rectangle005')?.material
        || loadedScene.getObjectByName('Rectangle006')?.material;
      if (baseMat) {
        Object.entries(WOOD_TEXTURES).forEach(([id, cfg]) => {
          if (cache[id]) return;
          const mat = baseMat.clone();
          mat.name = MAT_NAME_MAP[id];
          mat.map = loadTexture(cfg.map, THREE.SRGBColorSpace);
          mat.normalMap = loadTexture(cfg.normalMap);
          mat.roughnessMap = loadTexture(cfg.roughnessMap);
          mat.color?.set('#ffffff');
          mat.roughness = id === 'dark' ? 0.46 : 0.38;
          mat.metalness = 0;
          mat.needsUpdate = true;
          cache[id] = mat;
        });
      }
      matCacheRef.current = cache;
    }

    // ── 应用 S8S_v3d_camera 数据到 OrbitControls ─────────────────
    {
      const s8sData = gltf.userData?.s8s;
      if (s8sData?.camera) {
        const camData = s8sData.camera;
        const ctrl = controlsRef.current;
        if (ctrl) {
          if (camData.orbitTarget) {
            ctrl.target.copy(camData.orbitTarget);
          }
          ctrl.minDistance = camData.minDistance;
          ctrl.maxDistance = camData.maxDistance;
          ctrl.minPolarAngle = camData.minPolarAngle;
          ctrl.maxPolarAngle = camData.maxPolarAngle;
          ctrl.enablePan = camData.enablePan;
          ctrl.update();
          console.log('[SceneContent] Applied S8S camera settings:', camData);
        }
      }
    }

    // ── HDR 环境贴图 ────────────────────────────────────────────
    {
      new HDRLoader().load('/media/22.hdr', (hdrTexture) => {
        hdrTexture.wrapS = THREE.RepeatWrapping;
        hdrTexture.wrapT = THREE.ClampToEdgeWrapping;
        const pmrem = new THREE.PMREMGenerator(gl);
        pmrem.compileEquirectangularShader();

        let currentEnvMap = pmrem.fromEquirectangular(hdrTexture).texture;

        /** 应用 envMap 到场景所有材质 */
        const applyEnvMap = (envMap, intensity) => {
          loadedScene.traverse((child) => {
            if (child.isMesh && child.name !== 'Plane001') {
              const mats = Array.isArray(child.material)
                ? child.material
                : child.material
                  ? [child.material]
                  : [];
              mats.forEach((m) => {
                m.envMap = envMap;
                m.envMapIntensity = intensity;
                m.needsUpdate = true;
              });
            }
          });
          scene.environment = envMap;
          scene.environmentIntensity = intensity;
        };

        applyEnvMap(currentEnvMap, ENV_MAP_INTENSITY);

        // ── 暴露环境贴图控制接口 ──────────────────────────────
        window.__envCtrl = {
          hdrTexture,
          pmrem,
          intensity: ENV_MAP_INTENSITY,
          rotationX: 0,  // 水平旋转 (弧度)
          rotationY: 0,  // 纵向旋转 (弧度)
          _rafId: null,  // rAF 节流：同一帧内多次 update() 只执行最后一次

          /** 更新 envMap（强度或旋转变化时调用），自带 rAF 节流 */
          update() {
            // 已在等待 rAF → 跳过，当前帧结束时执行最后一次
            if (this._rafId !== null) return;
            this._rafId = requestAnimationFrame(() => {
              this._rafId = null;
              // 通过纹理偏移模拟全景旋转
              hdrTexture.offset.x = this.rotationX / (Math.PI * 2);
              hdrTexture.offset.y = this.rotationY / Math.PI;
              // 关键：直接修改 Vector2 不会触发纹理矩阵更新，
              // 必须手动调用 updateMatrix() 否则 PMREM 仍按原始 UV 采样
              hdrTexture.updateMatrix();

              // 重新生成 PMREM cube map
              currentEnvMap = pmrem.fromEquirectangular(hdrTexture).texture;
              applyEnvMap(currentEnvMap, this.intensity);
            });
          },

          /** 单独更新强度（无需重建 PMREM） */
          updateIntensity() {
            loadedScene.traverse((child) => {
              if (child.isMesh && child.name !== 'Plane001') {
                const mats = Array.isArray(child.material)
                  ? child.material
                  : child.material ? [child.material] : [];
                mats.forEach((m) => {
                  m.envMapIntensity = this.intensity;
                  m.needsUpdate = true;
                });
              }
            });
            scene.environmentIntensity = this.intensity;
          },
        };

        console.log('[SceneContent] HDR env map loaded, __envCtrl ready');
        document.documentElement.dataset.viewerEnvReady = 'true';
        window.dispatchEvent(new CustomEvent('viewer-env-ready'));
      });
    }

    // ── 注册 Scene API ─────────────────────────────────────────
    setSceneReady(true);
    markViewerSceneReady(meshCount);
    registerSceneAPI(loadedScene);

    // 应用 _lightOn 默认值（sceneAPI 已注册）
    if (materialDefaults._lightOn) {
      const api = useStore.getState().sceneAPI;
      if (api) api.toggleLight(true);
    }

    return () => {
      // Cleanup: 从场景中移除模型
      scene.remove(loadedScene);
      liftMixerRef.current = null;
      liftClipDurationRef.current = 0;
      window.__liftAnimation = null;
      window.__threeRenderer = null;
      document.documentElement.dataset.viewerSceneReady = 'false';
      document.documentElement.dataset.viewerEnvReady = 'false';
      cubeCameraRef.current = null;
      groundRef.current = null;
      deskLampMaterialsRef.current = [];
      deskLampAreaLightRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gltf, disableAreaLights, disableWebGLReflections, markViewerSceneReady]);

  // ── 注册 Scene API ─────────────────────────────────────────────
  function registerSceneAPI(loadedScene) {
    const api = {
      // 开关灯
      toggleLight: (on) => {
        setLightOn(on);
        if (!loadedScene) return;

        let lampMaterials = deskLampMaterialsRef.current;
        if (lampMaterials.length === 0) {
          loadedScene.traverse((obj) => {
            const mats = Array.isArray(obj.material)
              ? obj.material
              : obj.material
                ? [obj.material]
                : [];
            mats.forEach((m) => {
              if (m.name === 'Material #186' && !lampMaterials.includes(m)) {
                lampMaterials.push(m);
              }
            });
          });
        }

        lampMaterials.forEach((m) => {
          // 使用 3ds Max 导出的原始自发光强度，而非硬编码 1
          m.emissiveIntensity = on
            ? (origEmissiveIntensityRef.current ?? 1)
            : 0;
          m.side = THREE.DoubleSide;
          m.toneMapped = false;
          m.needsUpdate = true;
        });

        if (deskLampAreaLightRef.current) {
          deskLampAreaLightRef.current.intensity = on ? DESK_LAMP_AREA_LIGHT_INTENSITY : 0;
        }
      },

      // 更换桌面材质
      changeMaterial: (mat) => {
        const targetMat = matCacheRef.current[mat];
        if (!targetMat || !loadedScene) return;
        ['Rectangle005', 'Rectangle006'].forEach((name) => {
          const obj = loadedScene.getObjectByName(name);
          if (obj) obj.material = targetMat;
        });
      },

      // 切换视角（带动画过渡）
      changeView: (viewKey) => {
        const controls = controlsRef.current;
        if (!controls || !loadedScene) return;
        const targetPos =
          controls.target?.clone() || new THREE.Vector3(0, 0.8, 0);
        const d = 14;
        const positions = {
          front: {
            x: targetPos.x,
            y: targetPos.y + d * 0.25,
            z: targetPos.z + d * 0.97,
          },
          back: {
            x: targetPos.x,
            y: targetPos.y + d * 0.25,
            z: targetPos.z - d * 0.97,
          },
          left: {
            x: targetPos.x - d * 0.97,
            y: targetPos.y + d * 0.25,
            z: targetPos.z,
          },
          right: {
            x: targetPos.x + d * 0.97,
            y: targetPos.y + d * 0.25,
            z: targetPos.z,
          },
          top: {
            x: targetPos.x,
            y: targetPos.y + d,
            z: targetPos.z,
          },
        };
        const pos = positions[viewKey];
        if (!pos) return;
        viewTweenRef.current = {
          startPos: camera.position.clone(),
          startTarget: controls.target.clone(),
          endPos: new THREE.Vector3(pos.x, pos.y, pos.z),
          endTarget: targetPos.clone(),
          progress: 0,
          duration: 0.6,
        };
      },

      // 播放到指定高度
      playToFrame: (targetHeightCm) => {
        const targetT = HEIGHT_T_MAP[targetHeightCm];
        if (targetT === undefined) return;

        liftDriveIdRef.current += 1;
        const driveId = liftDriveIdRef.current;
        if (playRAFRef.current !== null) {
          cancelAnimationFrame(playRAFRef.current);
          playRAFRef.current = null;
        }
        arrowMoveRef.current = null;

        let lastTimestamp = null;

        const drive = (timestamp) => {
          if (driveId !== liftDriveIdRef.current) return;
          if (!lastTimestamp) lastTimestamp = timestamp;
          const delta = (timestamp - lastTimestamp) / 1000;
          lastTimestamp = timestamp;

          const current = useStore.getState().arrowT;
          const remaining = targetT - current;
          // 手动插值速度：8秒全长
          const duration = 8.0;
          const step = (delta / duration) * Math.sign(remaining);

          if (Math.abs(remaining) <= Math.abs(step)) {
            setArrowT(targetT);
            applyLiftT(loadedScene, targetT);
            if (driveId === liftDriveIdRef.current) playRAFRef.current = null;
            return;
          }

          const next = current + step;
          setArrowT(next);
          applyLiftT(loadedScene, next);
          if (driveId === liftDriveIdRef.current) {
            playRAFRef.current = requestAnimationFrame(drive);
          }
        };

        playRAFRef.current = requestAnimationFrame(drive);
      },

      // 箭头步进启停
      stepFrame: (dir) => {
        liftDriveIdRef.current += 1;
        if (playRAFRef.current !== null) {
          cancelAnimationFrame(playRAFRef.current);
          playRAFRef.current = null;
        }
        arrowMoveRef.current = dir ? { dir } : null;
      },

      // 配件切换
      toggleAccessory: (accId, visible) => {
        if (!loadedScene) return;
        const accObjMap = {
          acc2: '对象010',
          acc3: '对象011',
          acc4: '组007',
        };
        const objName = accObjMap[accId];
        if (!objName) return;
        const obj = loadedScene.getObjectByName(objName);
        if (!obj) return;

        if (accId === 'acc4') {
          obj.children.forEach((child) => {
            child.visible = visible;
          });
        } else {
          obj.visible = visible;
        }
      },

      // 进入独显模式
      enterSoloMode: () => {
        if (!loadedScene || !controlsRef.current) return;
        const sm = soloModeRef.current;
        const sel = useStore.getState().selectedObject;
        if (!sel) return;

        // 保存相机位置
        sm.origCamPos = {
          pos: camera.position.clone(),
          target: controlsRef.current.target?.clone(),
        };

        // 保存相机限制
        const c = controlsRef.current;
        if (!sm.origCamLimits) {
          sm.origCamLimits = {
            minDistance: c.minDistance,
            maxDistance: c.maxDistance,
            minPolarAngle: c.minPolarAngle,
            maxPolarAngle: c.maxPolarAngle,
            minAzimuthAngle: c.minAzimuthAngle,
            maxAzimuthAngle: c.maxAzimuthAngle,
            enablePan: c.enablePan,
            screenSpacePanning: c.screenSpacePanning,
            mouseButtons: { ...c.mouseButtons },
          };
        }
        c.minDistance = 0.1;
        c.maxDistance = 200;
        c.minPolarAngle = 0;
        c.maxPolarAngle = Math.PI;
        c.minAzimuthAngle = -Infinity;
        c.maxAzimuthAngle = Infinity;
        c.enablePan = true;
        c.screenSpacePanning = true;
        c.mouseButtons = {
          ...c.mouseButtons,
          MIDDLE: THREE.MOUSE.PAN,
        };

        const selObj = loadedScene.getObjectByName(sel);
        if (!selObj) return;

        // Build keepSet
        const keepSet = new Set();
        keepSet.add(selObj);
        let cur = selObj.parent;
        while (cur) {
          keepSet.add(cur);
          cur = cur.parent;
        }

        sm.hiddenObjs = [];
        sm.ancestorMeshStates = [];

        loadedScene.traverse((child) => {
          if (child === loadedScene) return;
          if (child.isLight) return;
          if (child.isCubeCamera || child.type === 'CubeCamera') return;
          if (child === selObj) return;
          if (keepSet.has(child)) {
            if (child.isMesh && child.visible) {
              const mats = Array.isArray(child.material)
                ? child.material
                : child.material
                  ? [child.material]
                  : [];
              if (mats.length) {
                const savedVisible = mats.map((m) => m.visible);
                mats.forEach((m) => {
                  m.visible = false;
                });
                sm.ancestorMeshStates.push({ mats, savedVisible });
              }
            }
            return;
          }
          if (child.visible) {
            child.visible = false;
            sm.hiddenObjs.push(child);
          }
        });

        setSoloActive(true);
      },

      // 退出独显模式
      exitSoloMode: () => {
        const sm = soloModeRef.current;
        if (!loadedScene) return;

        sm.hiddenObjs.forEach((obj) => {
          obj.visible = true;
        });
        sm.hiddenObjs = [];

        sm.ancestorMeshStates.forEach(({ mats, savedVisible }) => {
          mats.forEach((m, i) => {
            m.visible = savedVisible[i];
          });
        });
        sm.ancestorMeshStates = [];

        const c = controlsRef.current;
        if (c && sm.origCamLimits) {
          const lim = sm.origCamLimits;
          c.minDistance = lim.minDistance;
          c.maxDistance = lim.maxDistance;
          c.minPolarAngle = lim.minPolarAngle;
          c.maxPolarAngle = lim.maxPolarAngle;
          c.minAzimuthAngle = lim.minAzimuthAngle;
          c.maxAzimuthAngle = lim.maxAzimuthAngle;
          c.enablePan = lim.enablePan;
          c.screenSpacePanning = lim.screenSpacePanning;
          c.mouseButtons = { ...lim.mouseButtons };
          sm.origCamLimits = null;
        }

        if (sm.origCamPos && c) {
          camera.position.copy(sm.origCamPos.pos);
          if (sm.origCamPos.target) c.target.copy(sm.origCamPos.target);
          c.update();
          sm.origCamPos = null;
        }

        setSoloActive(false);
      },

      // 切换独显模式
      toggleSoloMode: () => {
        if (useStore.getState().soloActive) {
          api.exitSoloMode();
        } else {
          api.enterSoloMode();
        }
      },

      // 切换环绕模式
      toggleOrbitMode: () => {
        const c = controlsRef.current;
        if (!c) return;
        const isActive = useStore.getState().orbitActive;

        // 清除空闲定时器
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;

        if (isActive) {
          c.autoRotate = false;
          if (origCamLimitsRef.current) {
            const lim = origCamLimitsRef.current;
            c.minAzimuthAngle = lim.minAzimuthAngle;
            c.maxAzimuthAngle = lim.maxAzimuthAngle;
            origCamLimitsRef.current = null;
          }
          setOrbitActive(false);
          // 手动退出环绕 → 重新开始 20s 空闲倒计时
          setupIdleTimer();
        } else {
          if (!origCamLimitsRef.current) {
            origCamLimitsRef.current = {
              minAzimuthAngle: c.minAzimuthAngle,
              maxAzimuthAngle: c.maxAzimuthAngle,
            };
          }
          c.minAzimuthAngle = -Infinity;
          c.maxAzimuthAngle = Infinity;
          c.autoRotate = true;
          c.autoRotateSpeed = MANUAL_AUTO_ROTATE_SPEED;
          setOrbitActive(true);
          // 手动开启环绕 → 不启动空闲定时器（用户明确要环绕）
        }
      },

      // 清除选中
      clearSelection: () => {
        setSelectedObject(null);
      },
    };

    setSceneAPI(api);
    window.__sceneAPI = api;
    setupIdleTimer();
  }

  // ── 合并的 useFrame（CubeCamera + 箭头 + 高度/LED + TableY）───
  useFrame((_, delta) => {
    const loadedScene = sceneRef.current;

    // 1. CubeCamera 地面反射（priority -1 等效前置）
    if (!disableWebGLReflections) {
      const ground = groundRef.current;
      const cubeCamera = cubeCameraRef.current;
      if (ground && cubeCamera) {
        ground.visible = false;
        cubeCamera.update(gl, scene);
        ground.visible = true;
      }
    }

    // 2. 箭头步进驱动
    {
      const move = arrowMoveRef.current;
      if (move && loadedScene) {
        // 手动持续升降速度：12秒全长
        const step = (delta / 12.0) * (move.dir === 'up' ? 1 : -1);
        const current = useStore.getState().arrowT;
        const next = Math.max(0, Math.min(1, current + step));
        setArrowT(next);
        applyLiftT(loadedScene, next);
        if (next <= 0 || next >= 1) arrowMoveRef.current = null;
      }
    }

    // 3. 高度同步 + LED
    {
      const t = useStore.getState().arrowT;
      if (Math.abs(t - lastSyncedTRef.current) >= 0.001) {
        lastSyncedTRef.current = t;
        const cm = Math.round(68 + t * 52);
        const clampedCm = Math.max(68, Math.min(120, cm));
        setCurrentHeight(clampedCm);
        heightRef.current = clampedCm;

        const cvs = ledCanvasRef.current;
        const tex = ledTextureRef.current;
        const mat = ledMaterialRef.current;
        if (cvs && tex) {
          drawLed(cvs, clampedCm, ledRef.current);
          tex.needsUpdate = true;
          if (mat) {
            mat.emissiveIntensity =
              ledRef.current.emissiveIntensity ?? LED_DEFAULTS.emissiveIntensity;
            mat.emissive.set(ledRef.current.textColor || LED_DEFAULTS.textColor);
          }
        }
      }
    }

    // 4. LED 参数变化重绘
    {
      if (ledVersion !== prevLedVersionRef.current) {
        prevLedVersionRef.current = ledVersion;
        const cvs = ledCanvasRef.current;
        const tex = ledTextureRef.current;
        const mat = ledMaterialRef.current;
        if (cvs && tex) {
          drawLed(cvs, heightRef.current, ledRef.current);
          tex.needsUpdate = true;
          if (mat) {
            mat.emissiveIntensity =
              ledRef.current.emissiveIntensity ?? LED_DEFAULTS.emissiveIntensity;
            mat.emissive.set(ledRef.current.textColor || LED_DEFAULTS.textColor);
          }
        }
      }
    }

    // 5. Table Y 随高度平移
    {
      if (loadedScene) {
        const table = loadedScene.getObjectByName('Table');
        if (table) {
          const h = heightRef.current;
          table.position.y = 0.68 + ((h - 68) / 52) * 0.52;
        }
      }
    }

    // 6. 视角切换动画
    {
      const tween = viewTweenRef.current;
      if (tween) {
        tween.progress += delta / tween.duration;
        if (tween.progress >= 1) {
          camera.position.copy(tween.endPos);
          controlsRef.current?.target.copy(tween.endTarget);
          controlsRef.current?.update();
          viewTweenRef.current = null;
        } else {
          const t = easeInOutCubic(tween.progress);
          camera.position.lerpVectors(tween.startPos, tween.endPos, t);
          controlsRef.current?.target.lerpVectors(tween.startTarget, tween.endTarget, t);
          controlsRef.current?.update();
        }
      }
    }
  });

  // ── 空闲自动旋转 ──────────────────────────────────────────
  // 在 initScene 中初始化，此时 controls 已挂载
  function setupIdleTimer() {
    const IDLE_MS = 20000;
    const ctrl = controlsRef.current;
    if (!ctrl) return;
    window.__orbitControls = ctrl;

    const startIdle = () => {
      idleTimerRef.current = setTimeout(() => {
        ctrl.autoRotate = true;
        ctrl.autoRotateSpeed = IDLE_AUTO_ROTATE_SPEED;
      }, IDLE_MS);
    };

    const resetIdle = () => {
      ctrl.autoRotate = false;
      clearTimeout(idleTimerRef.current);
      startIdle();
    };

    const idleEvents = ['mousedown', 'wheel', 'touchstart', 'keydown'];
    idleEvents.forEach((evt) => {
      document.addEventListener(evt, resetIdle, { passive: true });
    });

    ctrl.autoRotate = false;
  }

  // ── 移动端性能 ──────────────────────────────────────────────
  useEffect(() => {
    const IS_MOBILE =
      window.innerWidth <= 768 ||
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (IS_MOBILE && gl) {
      gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    }
  }, [gl]);

  // ── 点击选中 ──────────────────────────────────────────────────
  const handlePointerDown = useCallback(
    (e) => {
      e.stopPropagation();
      const name = e.object.name || '';
      if (
        name.startsWith('__dim') ||
        name === 'Plane001' ||
        name === 'CubeCamera'
      ) {
        return;
      }
      setSelectedObject(name || null);
    },
    [setSelectedObject]
  );

  // ── 渲染 ─────────────────────────────────────────────────────
  return (
    <>
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.1}
        target={[-13.11, 19.95, 1.51]}
        far={1000}
        minDistance={soloActive ? 0.1 : 50}
        maxDistance={soloActive ? 200 : 300}
        minPolarAngle={0}
        maxPolarAngle={soloActive ? Math.PI : Math.PI / 2}
        enablePan={true}
        screenSpacePanning={soloActive}
      />

      {/* 环境光：Verge3D S8S_v3d_lights 仅有 ambient [0,0,0] + HDR IBL */}
      <ambientLight intensity={0} />
      <directionalLight position={[10, 15, 10]} intensity={0.15} />
      <directionalLight position={[-10, 10, -5]} intensity={0.1} />

      {/* 模型通过 <primitive> 由 R3F 管理，onPointerDown 使点击选中 + Outline 生效 */}
      <group onPointerDown={handlePointerDown}>
        {gltf?.scene && <primitive object={gltf.scene} />}
      </group>
    </>
  );
}
