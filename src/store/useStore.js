/**
 * 全局状态 Store
 * 替代所有 window 全局变量的 R3F 版本
 */
import { create } from 'zustand';
import { mediaUrl } from '../utils/assetUrl';

const DEFAULT_OUTLINE = {
  enabled: true,
  edgeThickness: 3,
  edgeGlow: 1.2,
  pulsePeriod: 2,
  visibleEdgeColor: '#ffffff',
};

const DEFAULT_LED = {
  textColor: '#ffffff',
  unitColor: '#ffffff',
  bgColor: '#050505',
  glowBlur: 5,
  textSize: 0.6,
  textX: 0.51,
  textY: 0.76,
  emissiveIntensity: 0.5,
  unit: 'cm',
  unitSize: 0.5,
  unitGap: 10,
  unitOffsetY: 0,
};

const DEFAULT_DIM = {
  textColor: '#ffffff',
  bgColor: '#000000',
  bgAlpha: 0.55,
  fontSize: 14,
  lineColor: '#e8e8e8',
};

const DEFAULT_BG = {
  x: 0,
  y: 0,
  scale: 1.0,
  opacity: 1.0,
};

const DEFAULT_SCENE_BG = {
  backgroundColor: '#0a0a0b',
  raysOrigin: 'top-center',
  raysColor: '#b8d5f5',
  raysSpeed: 0.55,
  lightSpread: 1.1,
  rayLength: 2.1,
  pulsating: false,
  fadeDistance: 1.15,
  saturation: 1.18,
  noiseAmount: 0,
  distortion: 0.035,
};

const DEFAULT_STUDIO_BG = {
  baseColor: '#2d62b9',
  highlightOpacity: 0.92,
  highlightSize: 0.46,
  vignetteStrength: 1,
};

const DEFAULT_PROJECT_CONFIG = {
  annotations: [],
  galleryImages: [mediaUrl('4.jpg'), mediaUrl('5.jpg'), mediaUrl('6.jpg'), mediaUrl('7.jpg'), mediaUrl('8.jpg'), mediaUrl('9.jpg')],
  video: '',
  backgroundMusic: mediaUrl('Rob Simonsen - Blue_cut.mp3'),
  consultation: {
    buttonLabel: '',
    modalTitle: '',
    modalSubtitle: '',
    qrImage: mediaUrl('wechat-qr.jpg'),
    name: '沈杰',
    title: '',
    phone: '18684747357',
    wechat: 'SaveSimply',
    address: '',
  },
};

const useStore = create((set) => ({
  // ── 场景状态 ─────────────────────────────────────────────
  sceneReady: false,
  setSceneReady: (v) => set({ sceneReady: v }),

  // 选中物体名称（Outline 用）
  selectedObject: null,
  setSelectedObject: (name) => set({ selectedObject: name }),
  clearSelection: () => set({ selectedObject: null }),

  // ── Outline 参数（替代 window.__outlineCtrl）──────────────
  outline: { ...DEFAULT_OUTLINE },
  setOutline: (partial) => set((s) => ({ outline: { ...s.outline, ...partial } })),

  // ── LED 参数（替代 window.__ledCtrl / __ledDefaults）─────
  led: { ...DEFAULT_LED },
  setLed: (partial) => set((s) => ({ led: { ...s.led, ...partial } })),
  ledVersion: 0,
  triggerLedRedraw: () => set((s) => ({ ledVersion: s.ledVersion + 1 })),

  // ── 尺寸标注样式 ──────────────────────────────────────
  dimStyle: { ...DEFAULT_DIM },
  setDimStyle: (partial) =>
    set((s) => ({ dimStyle: { ...s.dimStyle, ...partial } })),

  // ── 背景参数（替代 window.__bgCtrl）──────────────────────
  background: { ...DEFAULT_BG },
  setBackground: (partial) =>
    set((s) => ({ background: { ...s.background, ...partial } })),
  sceneBackground: { ...DEFAULT_SCENE_BG },
  setSceneBackground: (partial) =>
    set((s) => ({ sceneBackground: { ...s.sceneBackground, ...partial } })),

  // ── 背景模式：sceneDefault=静态场景默认背景，solidStudio=产品棚拍纯色背景 ─────
  backgroundMode: 'sceneDefault',
  setBackgroundMode: (mode) =>
    set({ backgroundMode: mode === 'solidStudio' ? 'solidStudio' : 'sceneDefault' }),
  toggleBackgroundMode: () =>
    set((s) => ({
      backgroundMode: s.backgroundMode === 'solidStudio' ? 'sceneDefault' : 'solidStudio',
    })),
  studioBackground: { ...DEFAULT_STUDIO_BG },
  setStudioBackground: (partial) =>
    set((s) => ({ studioBackground: { ...s.studioBackground, ...partial } })),

  // ── 子后台项目配置（画廊、视频、背景音乐、标注文案）────────────
  projectConfig: { ...DEFAULT_PROJECT_CONFIG },
  setProjectConfig: (partial) =>
    set((s) => ({ projectConfig: { ...s.projectConfig, ...partial } })),

  // ── 特性标注坐标 + 样式（替代 window._featPos / _featStyle）
  featPositions: [
    null,
    null,
    null,
    null,
    null,
  ],
  setFeatPosition: (idx, pos) =>
    set((s) => {
      const copy = [...s.featPositions];
      copy[idx] = pos;
      return { featPositions: copy };
    }),
  featStyles: [],
  setFeatStyles: (styles) => set({ featStyles: styles }),

  // ── 当前高度 ────────────────────────────────────────────
  currentHeight: 94,
  setCurrentHeight: (h) => set({ currentHeight: h }),

  // ── Dummy 位置 t（0-1）───────────────────────────────────
  arrowT: 0.5,
  setArrowT: (t) => set({ arrowT: t }),

  // ── 灯光状态 ────────────────────────────────────────────
  lightOn: false,
  setLightOn: (on) => set({ lightOn: on }),

  // ── 独显/环绕模式 ──────────────────────────────────────
  soloActive: false,
  setSoloActive: (v) => set({ soloActive: v }),
  orbitActive: false,
  setOrbitActive: (v) => set({ orbitActive: v }),

  // ── Three.js 引用（供标注组件投影用）────────────────────────
  threeCamera: null,
  threeScene: null,
  threeRenderer: null,
  setThreeRefs: (camera, scene, renderer) =>
    set({ threeCamera: camera, threeScene: scene, threeRenderer: renderer }),

  // ── 场景 API（SceneContent 注册，App.jsx 调用）────────────
  sceneAPI: null,
  setSceneAPI: (api) => set({ sceneAPI: api }),

  // ── 默认值导出（供写入接口用）─────────────────────────────
  getOutlineDefaults: () => ({ ...DEFAULT_OUTLINE }),
  getLedDefaults: () => ({ ...DEFAULT_LED }),
  getBgDefaults: () => ({ ...DEFAULT_BG }),
  getSceneBgDefaults: () => ({ ...DEFAULT_SCENE_BG }),
  getStudioBgDefaults: () => ({ ...DEFAULT_STUDIO_BG }),
  getProjectConfigDefaults: () => ({ ...DEFAULT_PROJECT_CONFIG }),
}));

export {
  DEFAULT_OUTLINE,
  DEFAULT_LED,
  DEFAULT_BG,
  DEFAULT_SCENE_BG,
  DEFAULT_STUDIO_BG,
  DEFAULT_DIM,
  DEFAULT_PROJECT_CONFIG,
};
export default useStore;


