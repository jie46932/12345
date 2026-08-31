/**
 * App — R3F 迁移版
 *
 * 移除 Verge3D 场景逻辑（onSceneReady/startReflection/drawLed 等约 600 行），
 * 替换为 <Scene />（R3F Canvas）+ sceneAPI（通过 zustand store 调用）。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import Scene from './components/Scene';
import AFrameEighthWallARExperience from './components/AFrameEighthWallARExperience';
import Header from './components/Header';
import ControlBar from './components/ControlBar';
import LoadingScreen from './components/LoadingScreen';
import DimensionAnnotation from './components/DimensionAnnotation';
import FeatureAnnotationPin from './components/FeatureAnnotationPin';
import MobileControlDrawer from './components/MobileControlDrawer';
import ProductStudioBackground from './components/ProductStudioBackground';
import ProjectConfigBackground from './components/ProjectConfigBackground';
import LightRaysBackground from './components/LightRaysBackground';
import FeatureAnnotationGizmo from './components/FeatureAnnotationGizmo';
import HeaderPanel from './components/HeaderPanel';
import OutlinePanel from './components/OutlinePanel';
import BgPanel from './components/BgPanel';
import ProductStudioBgPanel from './components/ProductStudioBgPanel';
import LedPanel from './components/LedPanel';
import MaterialPanel from './components/MaterialPanel';
import { LangContext } from './LangContext';
import useStore from './store/useStore';
import { mediaUrl } from './utils/assetUrl';
import { launchProductAR } from './ar/launchAR';
import {
  getQuickLookUrl,
  getSafariQuickLookPageUrl,
} from './ar/quickLookConfig';
import { productXRStore } from './xr/productXRStore';
import { enterProductAR } from './xr/productXRStore';
import { EIGHTH_WALL_PROVIDER } from './ar/eighthWallConfig';
import {
  installTelemetryListeners,
  trackError,
  trackOperation,
  trackPerformance,
} from './utils/telemetry';

const DEV_PANELS_ENABLED = typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1'].includes(window.location.hostname);

const DEFAULT_ADMIN_ORIGINS = [
  'http://127.0.0.1:5174',
  'http://localhost:5174',
];
const DEFAULT_PROJECT_CONFIG_ID = 'project_12345';
const LOADING_STAGE_TEXT = {
  download: '正在下载模型',
  structure: '正在解析模型结构',
  material: '正在还原材质与纹理',
  environment: '正在初始化环境光',
  ready: '即将进入场景',
  slow: '模型较大，正在继续加载',
  error: '模型加载失败，请刷新重试',
};
const LIFT_SOUND_URL = mediaUrl('BW61769-loop.wav');
const HEIGHT_T_MAP = { 68: 0, 94: 0.5, 120: 1 };
const PRESET_LIFT_FULL_DURATION = 8.0;
const STEP_LIFT_FULL_DURATION = 12.0;
const LIFT_SOUND_SCHEDULE_AHEAD = 1.2;
const LIFT_SOUND_SCHEDULE_INTERVAL_MS = 120;

function trimLoopBuffer(audioContext, sourceBuffer) {
  const threshold = 0.002;
  const crossfadeSeconds = 0.045;
  const { length, numberOfChannels, sampleRate } = sourceBuffer;
  let start = 0;
  let end = length - 1;

  const framePeak = (frame) => {
    let peak = 0;
    for (let channel = 0; channel < numberOfChannels; channel += 1) {
      const value = Math.abs(sourceBuffer.getChannelData(channel)[frame] || 0);
      if (value > peak) peak = value;
    }
    return peak;
  };

  while (start < length && framePeak(start) < threshold) start += 1;
  while (end > start && framePeak(end) < threshold) end -= 1;

  const trimmedLength = end - start + 1;
  if (trimmedLength <= sampleRate * 0.12) {
    return sourceBuffer;
  }

  const crossfadeFrames = Math.min(
    Math.floor(sampleRate * crossfadeSeconds),
    Math.floor(trimmedLength / 4),
  );
  if (crossfadeFrames < 16) {
    const trimmedBuffer = audioContext.createBuffer(numberOfChannels, trimmedLength, sampleRate);
    for (let channel = 0; channel < numberOfChannels; channel += 1) {
      const sourceData = sourceBuffer.getChannelData(channel);
      trimmedBuffer.copyToChannel(sourceData.subarray(start, end + 1), channel);
    }
    return trimmedBuffer;
  }

  const loopLength = trimmedLength - crossfadeFrames;
  const loopBuffer = audioContext.createBuffer(numberOfChannels, loopLength, sampleRate);
  for (let channel = 0; channel < numberOfChannels; channel += 1) {
    const sourceData = sourceBuffer.getChannelData(channel);
    const loopData = loopBuffer.getChannelData(channel);

    for (let i = 0; i < loopLength; i += 1) {
      let sample = sourceData[start + i] || 0;
      if (i < crossfadeFrames) {
        const fadeIn = (i + 1) / (crossfadeFrames + 1);
        const fadeOut = 1 - fadeIn;
        const tailSample = sourceData[start + loopLength + i] || 0;
        sample = tailSample * fadeOut + sample * fadeIn;
      }
      loopData[i] = sample;
    }
  }
  return loopBuffer;
}

// 移动端检测（模块级，不参与渲染循环）
const IS_MOBILE = typeof window !== 'undefined' &&
  (window.innerWidth <= 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));

const BASE_WIDTH = 1440;

function getConfiguredOrigins(envValue, fallback = []) {
  return String(envValue || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .concat(fallback);
}

function isAllowedMessageOrigin(origin) {
  if (!origin) return false;
  if (origin === window.location.origin) return true;
  return getConfiguredOrigins(import.meta.env.VITE_ADMIN_ORIGINS, DEFAULT_ADMIN_ORIGINS).includes(origin);
}

function getParentTargetOrigin(fallback = '*') {
  if (document.referrer) {
    try {
      return new URL(document.referrer).origin;
    } catch {
      // Fall through to the explicit fallback below.
    }
  }
  return import.meta.env.VITE_PARENT_TARGET_ORIGIN || fallback;
}

function postViewerEvent(type, payload, targetOrigin = getParentTargetOrigin()) {
  window.parent?.postMessage({
    type,
    payload,
    sentAt: new Date().toISOString(),
  }, targetOrigin);
}

function getProjectConfigId() {
  const params = new URLSearchParams(window.location.search);
  const explicitProjectId = params.get('projectId');
  if (explicitProjectId) return explicitProjectId;
  const projectSlug = params.get('project');
  if (projectSlug) return projectSlug.startsWith('project_') ? projectSlug : `project_${projectSlug}`;
  return DEFAULT_PROJECT_CONFIG_ID;
}

function isElectronOfflineRuntime() {
  return Boolean(window.__electronOffline);
}

function getProjectConfigReadUrl() {
  const projectId = getProjectConfigId();
  const configuredUrl = import.meta.env.VITE_PROJECT_CONFIG_URL;
  if (configuredUrl) {
    if (configuredUrl.includes('{projectId}')) {
      return configuredUrl.replace('{projectId}', encodeURIComponent(projectId));
    }
    const url = new URL(configuredUrl, window.location.origin);
    url.searchParams.set('projectId', projectId);
    return url.toString();
  }
  return `/api/project-config?projectId=${encodeURIComponent(projectId)}`;
}

function normalizeRemoteProjectConfig(data) {
  const source = data?.config || data?.data || data;
  if (!source || typeof source !== 'object') return null;
  return {
    ...(source.content || {}),
    ...(source.background ? { background: source.background } : {}),
  };
}

async function loadRemoteProjectConfig() {
  const response = await fetch(getProjectConfigReadUrl(), { credentials: 'include' });
  if (response.status === 404 || response.status === 204) return null;
  if (!response.ok) throw new Error(`Project config request failed: HTTP ${response.status}`);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return null;
  return normalizeRemoteProjectConfig(await response.json());
}

function splitAnnotationText(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  const lines = text
    .split(/\r?\n|，|。/)
    .map((line) => line.trim())
    .filter(Boolean);
  return {
    line0: lines[0] || text.trim(),
    line1: lines.slice(1).join('，') || '',
  };
}

function applyProjectAnnotationsToFeatureStyles(annotations) {
  if (!Array.isArray(annotations)) return;
  useStore.getState().setFeatStyles(
    annotations.map((annotation) => splitAnnotationText(annotation) || {}),
  );
}

function BackendMovedNotice({ portal }) {
  const target = `http://127.0.0.1:5174/index.dev.html?portal=${portal}`;

  return (
    <main style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      padding: 24,
      background: '#f6f7f8',
      color: '#111',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <section style={{
        maxWidth: 560,
        padding: 28,
        borderRadius: 12,
        background: '#fff',
        boxShadow: '0 12px 40px rgba(15, 23, 42, 0.12)',
        border: '1px solid rgba(15, 23, 42, 0.1)',
      }}>
        <p style={{ margin: '0 0 8px', color: '#5b6472', fontSize: 14 }}>12345 Viewer</p>
        <h1 style={{ margin: '0 0 12px', fontSize: 24 }}>后台已迁移到 F:\\houtai</h1>
        <p style={{ margin: '0 0 20px', lineHeight: 1.7 }}>
          12345 项目只保留产品 Viewer、R3F 配置器和 postMessage 接收能力。
          母后台/子后台请在独立项目中运行。
        </p>
        <a href={target} style={{
          display: 'inline-flex',
          alignItems: 'center',
          minHeight: 40,
          padding: '0 14px',
          borderRadius: 8,
          background: '#247a4d',
          color: '#fff',
          textDecoration: 'none',
          fontWeight: 700,
        }}>
          打开独立后台
        </a>
      </section>
    </main>
  );
}

function IOSQuickLookGuide({ visible, onClose, onCopyLink, onOpenUSDZ }) {
  if (!visible) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ios-ar-guide-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 620,
        display: 'grid',
        placeItems: 'center',
        padding: 20,
        background: 'rgba(7, 10, 16, 0.42)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      <section
        style={{
          width: 'min(92vw, 390px)',
          borderRadius: 12,
          padding: 20,
          color: '#ffffff',
          background: 'rgba(15, 19, 28, 0.92)',
          border: '1px solid rgba(255, 255, 255, 0.22)',
          boxShadow: '0 22px 70px rgba(0, 0, 0, 0.38)',
          fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <h2 id="ios-ar-guide-title" style={{ margin: '0 0 10px', fontSize: 19, lineHeight: 1.25 }}>
          使用 Safari 打开 AR
        </h2>
        <p style={{ margin: '0 0 18px', fontSize: 14, lineHeight: 1.7, color: 'rgba(255,255,255,0.78)' }}>
          苹果手机请使用 Safari 打开 AR 预览；当前 Chrome 无法直接唤起系统 Quick Look。
        </p>
        <div style={{ display: 'grid', gap: 10 }}>
          <button
            type="button"
            onClick={onCopyLink}
            style={{
              minHeight: 42,
              borderRadius: 8,
              border: '1px solid rgba(255, 255, 255, 0.26)',
              background: '#ffffff',
              color: '#10141d',
              fontSize: 15,
              fontWeight: 800,
            }}
          >
            复制 Safari 链接
          </button>
          <button
            type="button"
            onClick={onOpenUSDZ}
            style={{
              minHeight: 42,
              borderRadius: 8,
              border: '1px solid rgba(255, 255, 255, 0.24)',
              background: 'rgba(255, 255, 255, 0.1)',
              color: '#ffffff',
              fontSize: 15,
              fontWeight: 800,
            }}
          >
            打开 USDZ 文件
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              minHeight: 38,
              borderRadius: 8,
              border: '0',
              background: 'transparent',
              color: 'rgba(255,255,255,0.72)',
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            关闭
          </button>
        </div>
      </section>
    </div>
  );
}

function applyUIScale() {
  const scale = Math.max(Math.min(window.innerWidth / BASE_WIDTH, 1), 0.38);
  document.documentElement.style.setProperty('--ui-scale', scale);
}

function ConfiguratorApp({ viewer }) {
  // ── Store 订阅 ────────────────────────────────────────────────
  const currentHeight = useStore((s) => s.currentHeight);
  const lightOn = useStore((s) => s.lightOn);
  const soloActive = useStore((s) => s.soloActive);
  const orbitActive = useStore((s) => s.orbitActive);
  const selectedObject = useStore((s) => s.selectedObject);
  const sceneReady = useStore((s) => s.sceneReady);
  const backgroundMode = useStore((s) => s.backgroundMode);
  const sceneBackground = useStore((s) => s.sceneBackground);
  const toggleBackgroundMode = useStore((s) => s.toggleBackgroundMode);
  const showDefaultSceneBackground = viewer !== '1' && backgroundMode !== 'solidStudio';

  // ── UI 状态 ──────────────────────────────────────────────────
  const [material, setMaterial] = useState(null);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [lampVisible, setLampVisible] = useState(true);
  const [activeView, setActiveView] = useState('front');
  const [lang, setLang] = useState('zh');
  const loadStartTime = useRef(Date.now());
  const loadProgressRef = useRef(0);
  const loadErrorRef = useRef('');
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadMessage, setLoadMessage] = useState(LOADING_STAGE_TEXT.download);
  const [loadError, setLoadError] = useState('');
  const [loadingVisible, setLoadingVisible] = useState(true);
  const authed = true;
  const [musicReady, setMusicReady] = useState(false);
  const [notice, setNotice] = useState('');
  const [arActive, setArActive] = useState(false);
  const [eighthWallARActive, setEighthWallARActive] = useState(false);
  const [iosARGuideVisible, setIOSARGuideVisible] = useState(false);
  const autoQuickLookAttemptedRef = useRef(false);
  const sceneUiReady = authed && sceneReady;
  const loadCompleteTrackedRef = useRef(false);
  const noticeTimerRef = useRef(null);
  const liftAudioContextRef = useRef(null);
  const liftSoundBufferRef = useRef(null);
  const liftSoundBufferPromiseRef = useRef(null);
  const liftSoundGainRef = useRef(null);
  const liftSoundTimerRef = useRef(null);
  const liftSoundSchedulerRef = useRef(null);
  const liftSoundSourcesRef = useRef([]);
  const liftSoundEndTimeRef = useRef(0);
  const liftSoundNextStartTimeRef = useRef(0);
  const liftSoundTokenRef = useRef(0);

  useEffect(() => {
    loadProgressRef.current = loadProgress;
  }, [loadProgress]);

  useEffect(() => () => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    if (liftSoundTimerRef.current) clearTimeout(liftSoundTimerRef.current);
    if (liftSoundSchedulerRef.current) clearInterval(liftSoundSchedulerRef.current);
    liftSoundSourcesRef.current.forEach((source) => {
      try { source.stop(); } catch { /* already stopped */ }
      try { source.disconnect(); } catch { /* already disconnected */ }
    });
    liftSoundSourcesRef.current = [];
    liftSoundGainRef.current?.disconnect();
    liftSoundGainRef.current = null;
    liftAudioContextRef.current?.close?.();
    liftAudioContextRef.current = null;
  }, []);

  useEffect(() => {
    loadErrorRef.current = loadError;
  }, [loadError]);

  useEffect(() => {
    const syncARState = (state) => {
      const active = state.mode === 'immersive-ar';
      setArActive(active);
      document.documentElement.dataset.viewerARAvailable = navigator.xr ? 'unknown' : 'false';
      document.documentElement.dataset.viewerARMode = active ? 'active' : 'inactive';
      if (!document.documentElement.dataset.viewerARProvider) {
        document.documentElement.dataset.viewerARProvider = 'unknown';
      }
      if (!document.documentElement.dataset.viewerARPlatform) {
        document.documentElement.dataset.viewerARPlatform = 'unknown';
      }
      if (!document.documentElement.dataset.viewerARLaunchState) {
        document.documentElement.dataset.viewerARLaunchState = 'idle';
      }
    };
    syncARState(productXRStore.getState());
    return productXRStore.subscribe(syncARState);
  }, []);

  // ── UI 缩放 + 防缩放 ──────────────────────────────────────────
  useEffect(() => {
    const updateZoom = () => {
      const zoom = window.visualViewport ? window.visualViewport.scale : (window.outerWidth / window.innerWidth);
      const antiZoom = zoom > 0 ? 1 / zoom : 1;
      document.getElementById('ui-layer')?.style.setProperty('zoom', antiZoom);
    };
    const blockCtrlWheel = (e) => {
      if (e.ctrlKey) e.preventDefault();
    };

    applyUIScale();
    updateZoom();
    window.addEventListener('resize', applyUIScale);
    window.addEventListener('resize', updateZoom);
    window.addEventListener('wheel', blockCtrlWheel, { passive: false });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateZoom);
    }
    return () => {
      window.removeEventListener('resize', applyUIScale);
      window.removeEventListener('resize', updateZoom);
      window.removeEventListener('wheel', blockCtrlWheel);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateZoom);
      }
    };
  }, []);

  // ── 加载进度：真实下载 + 分阶段慢推进，避免长时间卡在固定 92% ────────
  useEffect(() => {
    if (!authed || !loadingVisible) return undefined;

    loadStartTime.current = Date.now();
    loadErrorRef.current = '';
    setLoadError('');
    setLoadMessage(LOADING_STAGE_TEXT.download);
    setLoadProgress((prev) => Math.max(prev, 1));

    const setProgressFloor = (floor) => {
      setLoadProgress((prev) => Math.max(prev, floor));
    };
    const handleModelProgress = (event) => {
      const ratio = Number(event.detail?.ratio || 0);
      if (ratio > 0) {
        setProgressFloor(Math.min(70, Math.max(2, ratio * 70)));
      }
      setLoadMessage(LOADING_STAGE_TEXT.download);
    };
    const handleModelPhase = (event) => {
      if (event.detail?.phase === 'loaded') {
        setProgressFloor(78);
        setLoadMessage(LOADING_STAGE_TEXT.material);
      }
    };
    const handleModelError = (event) => {
      const message = event.detail?.message || LOADING_STAGE_TEXT.error;
      loadErrorRef.current = message;
      setLoadError(message);
      setLoadMessage(LOADING_STAGE_TEXT.error);
    };
    const handleEnvReady = () => {
      setProgressFloor(96);
      setLoadMessage(LOADING_STAGE_TEXT.ready);
    };

    window.addEventListener('viewer-model-progress', handleModelProgress);
    window.addEventListener('viewer-model-phase', handleModelPhase);
    window.addEventListener('viewer-model-error', handleModelError);
    window.addEventListener('viewer-env-ready', handleEnvReady);

    const stagedTimer = setInterval(() => {
      if (loadErrorRef.current) return;

      const current = loadProgressRef.current;
      const elapsedMs = Date.now() - loadStartTime.current;
      const sceneMounted =
        document.documentElement.dataset.viewerSceneReady === 'true' ||
        !!window.__threeScene;
      const envReady = document.documentElement.dataset.viewerEnvReady === 'true';

      let cap = 70;
      let step = elapsedMs > 20000 ? 0.35 : 0.18;
      let message = LOADING_STAGE_TEXT.download;

      if (envReady) {
        cap = 98;
        step = IS_MOBILE ? 0.22 : 0.1;
        message = LOADING_STAGE_TEXT.ready;
      } else if (sceneMounted) {
        cap = 97;
        step = IS_MOBILE ? 0.68 : 0.32;
        message = LOADING_STAGE_TEXT.environment;
      } else if (current >= 88 || elapsedMs > 45000) {
        cap = 97;
        step = IS_MOBILE ? 0.72 : 0.36;
        message = elapsedMs > 45000 ? LOADING_STAGE_TEXT.slow : LOADING_STAGE_TEXT.material;
      } else if (current >= 70) {
        cap = 88;
        step = IS_MOBILE ? 0.46 : 0.28;
        message = current < 80 ? LOADING_STAGE_TEXT.structure : LOADING_STAGE_TEXT.material;
      }

      setLoadMessage(message);
      if (current < cap) {
        let next = Math.min(cap, current + step);
        if (Math.round(next) === 92) next = Math.min(cap, 92.6);
        loadProgressRef.current = next;
        setLoadProgress(next);
      }
    }, 700);

    return () => {
      window.removeEventListener('viewer-model-progress', handleModelProgress);
      window.removeEventListener('viewer-model-phase', handleModelPhase);
      window.removeEventListener('viewer-model-error', handleModelError);
      window.removeEventListener('viewer-env-ready', handleEnvReady);
      clearInterval(stagedTimer);
    };
  }, [authed, loadingVisible]);

  // ── 加载屏：sceneReady 后自动隐藏 ──────────────────────────────
  useEffect(() => {
    const finishLoading = () => {
      setLoadProgress(100);
      setLoadMessage(LOADING_STAGE_TEXT.ready);
      setLoadingVisible(false);
      setMusicReady(true);
      if (!loadCompleteTrackedRef.current) {
        loadCompleteTrackedRef.current = true;
        trackPerformance('scene_ready', {
          elapsedMs: Date.now() - loadStartTime.current,
          sceneReady: true,
          meshCount: document.documentElement.dataset.viewerMeshCount || null,
          envReady: document.documentElement.dataset.viewerEnvReady || null,
        });
      }
    };

    if (!sceneReady) {
      window.addEventListener('viewer-scene-ready', finishLoading);
      return () => window.removeEventListener('viewer-scene-ready', finishLoading);
    }

    setLoadProgress(100);
    const elapsed = Date.now() - loadStartTime.current;
    const delay = Math.max(800, 2500 - elapsed);
    const timer = setTimeout(finishLoading, delay);
    return () => clearTimeout(timer);
  }, [sceneReady]);

  // ── 加载屏兜底：线上真实场景已挂载但 sceneReady 未同步时也收尾 ─────
  useEffect(() => {
    if (!authed || sceneReady || !loadingVisible) return;

    const fallbackTimer = setInterval(() => {
      const sceneMounted =
        document.documentElement.dataset.viewerSceneReady === 'true' ||
        !!window.__threeScene;

      if (!sceneMounted) return;

      setLoadProgress(100);
      setLoadingVisible(false);
      setMusicReady(true);
      if (!loadCompleteTrackedRef.current) {
        loadCompleteTrackedRef.current = true;
        trackPerformance('scene_ready_fallback', {
          elapsedMs: Date.now() - loadStartTime.current,
          threeScene: !!window.__threeScene,
          sceneReadyDataset: document.documentElement.dataset.viewerSceneReady || null,
        });
      }
      clearInterval(fallbackTimer);
    }, 300);

    return () => clearInterval(fallbackTimer);
  }, [authed, sceneReady, loadingVisible]);

  // ── Scene API 包装函数（App.jsx → sceneAPI 桥接）───────────────
  const api = () => useStore.getState().sceneAPI;
  const applyProjectConfig = useCallback((nextConfig) => {
    if (!nextConfig || !Object.keys(nextConfig).length) return;
    window.__lastProjectConfig = nextConfig;
    useStore.getState().setProjectConfig(nextConfig);
    applyProjectAnnotationsToFeatureStyles(nextConfig.annotations);
    useStore.getState().sceneAPI?.changeView?.('front');
  }, []);

  const handleToggleLight = (on) => {
    trackOperation('light_toggled', { enabled: !!on });
    api()?.toggleLight(on);
  };
  const handleMaterialChange = (mat) => {
    trackOperation('material_selected', { material: mat });
    setMaterial(mat);
    api()?.changeMaterial(mat);
  };
  const handleViewChange = (v) => {
    trackOperation('view_changed', { view: v });
    setActiveView(v);
    api()?.changeView(v);
  };
  const getLiftAudioContext = useCallback(() => {
    if (typeof window === 'undefined') return null;
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return null;
    if (!liftAudioContextRef.current) {
      liftAudioContextRef.current = new AudioContextCtor();
    }
    return liftAudioContextRef.current;
  }, []);

  const loadLiftSoundBuffer = useCallback(async () => {
    const audioContext = getLiftAudioContext();
    if (!audioContext) throw new Error('Web Audio is not supported');
    if (liftSoundBufferRef.current) return { audioContext, buffer: liftSoundBufferRef.current };

    if (!liftSoundBufferPromiseRef.current) {
      liftSoundBufferPromiseRef.current = fetch(LIFT_SOUND_URL, { cache: 'force-cache' })
        .then((response) => {
          if (!response.ok) throw new Error(`Lift sound request failed: HTTP ${response.status}`);
          return response.arrayBuffer();
        })
        .then((arrayBuffer) => audioContext.decodeAudioData(arrayBuffer))
        .then((decodedBuffer) => {
          const loopBuffer = trimLoopBuffer(audioContext, decodedBuffer);
          liftSoundBufferRef.current = loopBuffer;
          return loopBuffer;
        });
    }

    const buffer = await liftSoundBufferPromiseRef.current;
    return { audioContext, buffer };
  }, [getLiftAudioContext]);

  useEffect(() => {
    if (!sceneReady) return;
    loadLiftSoundBuffer().catch((error) => {
      trackError('lift_sound_preload_failed', error, { src: LIFT_SOUND_URL, engine: 'web-audio' });
    });
  }, [loadLiftSoundBuffer, sceneReady]);

  const stopLiftSound = useCallback(() => {
    liftSoundTokenRef.current += 1;
    if (liftSoundTimerRef.current) {
      clearTimeout(liftSoundTimerRef.current);
      liftSoundTimerRef.current = null;
    }
    if (liftSoundSchedulerRef.current) {
      clearInterval(liftSoundSchedulerRef.current);
      liftSoundSchedulerRef.current = null;
    }
    liftSoundSourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch {
        // Source may already be stopped by the browser.
      }
      try {
        source.disconnect();
      } catch {
        // Source may already be disconnected.
      }
    });
    liftSoundSourcesRef.current = [];
    liftSoundEndTimeRef.current = 0;
    liftSoundNextStartTimeRef.current = 0;
    liftSoundGainRef.current?.disconnect();
    liftSoundGainRef.current = null;
  }, []);

  const scheduleLiftSoundSource = useCallback((audioContext, buffer, startTime, endTime) => {
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(liftSoundGainRef.current);
    source.onended = () => {
      liftSoundSourcesRef.current = liftSoundSourcesRef.current.filter((item) => item !== source);
      try { source.disconnect(); } catch { /* already disconnected */ }
    };
    liftSoundSourcesRef.current.push(source);
    source.start(startTime);
    source.stop(Math.max(startTime + 0.01, endTime));
  }, []);

  const scheduleLiftSoundWindow = useCallback((audioContext, buffer) => {
    const endTime = liftSoundEndTimeRef.current;
    if (!endTime || audioContext.currentTime >= endTime) {
      stopLiftSound();
      return;
    }

    const scheduleUntil = Math.min(
      endTime,
      audioContext.currentTime + LIFT_SOUND_SCHEDULE_AHEAD,
    );

    if (!liftSoundNextStartTimeRef.current) {
      liftSoundNextStartTimeRef.current = audioContext.currentTime + 0.02;
    }

    while (liftSoundNextStartTimeRef.current < scheduleUntil) {
      const startTime = liftSoundNextStartTimeRef.current;
      scheduleLiftSoundSource(audioContext, buffer, startTime, endTime);
      liftSoundNextStartTimeRef.current = startTime + buffer.duration;
    }
  }, [scheduleLiftSoundSource, stopLiftSound]);

  const playLiftSoundFor = useCallback((durationSeconds) => {
    const durationMs = Math.max(0, durationSeconds * 1000);
    if (liftSoundTimerRef.current) {
      clearTimeout(liftSoundTimerRef.current);
      liftSoundTimerRef.current = null;
    }
    if (durationMs < 120) return;

    liftSoundTimerRef.current = setTimeout(() => {
      stopLiftSound();
    }, durationMs);

    const token = liftSoundTokenRef.current + 1;
    liftSoundTokenRef.current = token;
    loadLiftSoundBuffer()
      .then(async ({ audioContext, buffer }) => {
        if (token !== liftSoundTokenRef.current) return;
        if (audioContext.state === 'suspended') await audioContext.resume();
        if (token !== liftSoundTokenRef.current) return;

        if (!liftSoundGainRef.current) {
          const gain = audioContext.createGain();
          gain.gain.value = 1;
          gain.connect(audioContext.destination);
          liftSoundGainRef.current = gain;
        }

        liftSoundEndTimeRef.current = audioContext.currentTime + Math.max(0.12, durationSeconds);
        if (!liftSoundSchedulerRef.current) {
          liftSoundNextStartTimeRef.current = audioContext.currentTime + 0.02;
          scheduleLiftSoundWindow(audioContext, buffer);
          liftSoundSchedulerRef.current = setInterval(() => {
            scheduleLiftSoundWindow(audioContext, buffer);
          }, LIFT_SOUND_SCHEDULE_INTERVAL_MS);
        } else {
          scheduleLiftSoundWindow(audioContext, buffer);
        }
      })
      .catch((error) => {
        trackError('lift_sound_play_failed', error, { src: LIFT_SOUND_URL, engine: 'web-audio' });
      });
  }, [loadLiftSoundBuffer, scheduleLiftSoundWindow, stopLiftSound]);

  useEffect(() => {
    const handleLiftMotionEnded = () => stopLiftSound();
    window.addEventListener('viewer-lift-motion-ended', handleLiftMotionEnded);
    return () => window.removeEventListener('viewer-lift-motion-ended', handleLiftMotionEnded);
  }, [stopLiftSound]);

  const handlePlayToFrame = (h) => {
    trackOperation('height_preset_selected', { heightCm: h });
    const currentT = useStore.getState().arrowT;
    const targetT = HEIGHT_T_MAP[h];
    if (typeof targetT === 'number') {
      playLiftSoundFor(Math.abs(targetT - currentT) * PRESET_LIFT_FULL_DURATION);
    }
    api()?.playToFrame(h);
  };
  const handleStepFrame = (dir) => {
    trackOperation('height_step_changed', { direction: dir || 'stop' });
    if (!dir) {
      stopLiftSound();
    } else {
      const currentT = useStore.getState().arrowT;
      const remainingT = dir === 'up' ? 1 - currentT : currentT;
      playLiftSoundFor(remainingT * STEP_LIFT_FULL_DURATION);
    }
    api()?.stepFrame(dir);
  };
  const handleAccessoryChange = (accId, visible) => {
    trackOperation('accessory_toggled', { accessoryId: accId, visible: !!visible });
    if (accId === 'acc4') setLampVisible(visible);
    api()?.toggleAccessory(accId, visible);
  };
  const handleSoloMode = () => {
    if (!soloActive && !selectedObject) {
      trackOperation('solo_mode_blocked', { reason: 'no_selection' });
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
      setNotice('请先选择物体');
      noticeTimerRef.current = setTimeout(() => setNotice(''), 2000);
      return;
    }
    trackOperation('solo_mode_toggled', { activeBeforeClick: soloActive });
    api()?.toggleSoloMode();
  };
  const handleOrbitMode = () => {
    trackOperation('orbit_mode_toggled', { activeBeforeClick: orbitActive });
    api()?.toggleOrbitMode();
  };
  const showNotice = useCallback((message, duration = 3200) => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    setNotice(message);
    noticeTimerRef.current = setTimeout(() => setNotice(''), duration);
  }, []);
  const copySafariARLink = useCallback(async () => {
    const url = getSafariQuickLookPageUrl();
    try {
      await navigator.clipboard?.writeText(url);
      showNotice('Safari AR 链接已复制');
    } catch {
      window.prompt('复制 Safari AR 链接', url);
    }
  }, [showNotice]);
  const openUSDZFile = useCallback(() => {
    document.documentElement.dataset.viewerARLaunchState = 'opening-usdz';
    window.location.href = getQuickLookUrl();
  }, []);
  const handleEnterAR = useCallback(async () => {
    try {
      document.documentElement.dataset.viewerARRequested = 'true';
      const result = await launchProductAR();
      if (result.provider === EIGHTH_WALL_PROVIDER) {
        setIOSARGuideVisible(false);
        const arUrl = new URL('/aframe-manipulate.html', window.location.origin);
        if (new URLSearchParams(window.location.search).get('arDebug') === '1') {
          arUrl.searchParams.set('arDebug', '1');
        }
        arUrl.searchParams.set('v', `official-manipulate-${Date.now()}`);
        window.location.href = arUrl.toString();
        trackOperation('ar_session_started', {
          mode: '8th-wall',
          provider: result.provider,
          platform: result.platform,
          browser: result.browser,
          launchState: result.launchState,
        });
        return;
      }
      if (result.launchState === 'safari-required') {
        setIOSARGuideVisible(true);
        trackOperation('ar_quicklook_safari_required', {
          provider: result.provider,
          platform: result.platform,
          browser: result.browser,
        });
        return;
      }
      trackOperation('ar_session_started', {
        mode: result.provider === 'webxr' ? 'immersive-ar' : 'quick-look',
        provider: result.provider,
        platform: result.platform,
        launchState: result.launchState,
      });
    } catch (error) {
      const message = error?.message || '当前浏览器或设备不支持 AR 预览';
      document.documentElement.dataset.viewerARAvailable = 'false';
      document.documentElement.dataset.viewerARLaunchState = error?.code === 'ar_unsupported' ? 'unsupported' : 'failed';
      trackError('ar_session_start_failed', error, {
        mode: 'ar-entry',
        provider: document.documentElement.dataset.viewerARProvider || null,
        platform: document.documentElement.dataset.viewerARPlatform || null,
      });
      showNotice(message);
    }
  }, [showNotice]);

  const handleCloseEighthWallAR = useCallback(() => {
    setEighthWallARActive(false);
    document.documentElement.dataset.viewerARMode = 'inactive';
    document.documentElement.dataset.viewerARControlMode = 'idle';
    document.documentElement.dataset.viewerAROverlayActive = 'false';
    trackOperation('ar_8th_wall_closed', {
      provider: EIGHTH_WALL_PROVIDER,
      platform: document.documentElement.dataset.viewerARPlatform || null,
    });
  }, []);

  const handleEighthWallError = useCallback(async (error) => {
    trackError('ar_8th_wall_failed', error, {
      provider: EIGHTH_WALL_PROVIDER,
      platform: document.documentElement.dataset.viewerARPlatform || null,
    });

    setEighthWallARActive(false);
    const platform = document.documentElement.dataset.viewerARPlatform;
    if (platform === 'android') {
      try {
        await enterProductAR();
        document.documentElement.dataset.viewerARProvider = 'webxr';
        document.documentElement.dataset.viewerARLaunchState = 'started';
        showNotice('已切换到安卓 WebXR AR');
        return;
      } catch (fallbackError) {
        trackError('ar_webxr_fallback_failed', fallbackError, { provider: 'webxr' });
      }
    }

    if (platform === 'ios') {
      setIOSARGuideVisible(true);
      showNotice('AR 预览启动失败，可改用 Safari Quick Look 预览', 4200);
      return;
    }

    showNotice('当前设备无法启动 AR 预览');
  }, [showNotice]);

  useEffect(() => {
    if (!sceneUiReady || autoQuickLookAttemptedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const autoStartDebugAR = params.get('arDebug') === '1' && params.get('arAutoStart') === '1';
    if (params.get('ar') !== 'quicklook' && !autoStartDebugAR) return;

    autoQuickLookAttemptedRef.current = true;
    handleEnterAR();
  }, [handleEnterAR, sceneUiReady]);

  useEffect(() => {
    if (!authed || isElectronOfflineRuntime()) return undefined;
    let cancelled = false;
    loadRemoteProjectConfig()
      .then((config) => {
        if (!cancelled) applyProjectConfig(config);
      })
      .catch((error) => {
        console.warn('[project-config] remote config unavailable', error);
        trackError('project_config_load_failed', error, { projectId: getProjectConfigId() });
      });
    return () => {
      cancelled = true;
    };
  }, [authed, applyProjectConfig]);

  useEffect(() => {
    if (viewer !== '1') return;
    postViewerEvent('VIEWER_READY', { engine: 'r3f', project: '12345' });

    const onMessage = (event) => {
      const message = event.data;
      if (!isAllowedMessageOrigin(event.origin)) return;
      if (!message || message.source !== 'he-furniture-admin') return;
      try {
        trackOperation('viewer_command_received', {
          command: message.type,
          origin: event.origin,
          projectId: message.payload?.projectId || null,
        });
        if (message.type === 'SET_MATERIAL') handleMaterialChange(message.payload?.material || null);
        if (message.type === 'SET_SIZE') handlePlayToFrame(94);
        if (message.type === 'LOAD_PROJECT_CONFIG') {
          const content = message.payload?.content || {};
          const nextConfig = {
            ...content,
            ...(message.payload?.background ? { background: message.payload.background } : {}),
          };
          applyProjectConfig(nextConfig);
        }
        if (message.type === 'EXPORT_SNAPSHOT') {
          postViewerEvent('EXPORT_DONE', { projectId: message.payload?.projectId, mode: 'demo' }, event.origin);
          return;
        }
        postViewerEvent('CONFIG_CHANGED', { command: message.type, accepted: true }, event.origin);
        trackOperation('viewer_config_applied', { command: message.type });
      } catch (error) {
        postViewerEvent('ERROR', { command: message.type, message: String(error?.message || error) }, event.origin);
        trackError('viewer_command_failed', error, { command: message.type });
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
    // The viewer bridge registers once for iframe mode; handlers read the latest scene API from the store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer]);

  // ── 渲染 ──────────────────────────────────────────────────────
  const heightT = (currentHeight - 68) / 52;
  const arOverlayActive = arActive || eighthWallARActive;
  const arDebugMode = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('arDebug') === '1';
  const showARRecoveryEntry = authed && !!loadError && !arOverlayActive;
  const showARDebugEntry = authed && arDebugMode && !arOverlayActive;
  useEffect(() => {
    document.documentElement.dataset.devPanelsEnabled = DEV_PANELS_ENABLED ? 'true' : 'false';
    document.documentElement.dataset.sceneUiReady = sceneUiReady ? 'true' : 'false';
    document.documentElement.dataset.viewerAROverlayActive = arOverlayActive ? 'true' : 'false';
    document.documentElement.dataset.viewerARRecoveryEntryVisible = showARRecoveryEntry ? 'true' : 'false';
    document.documentElement.dataset.viewerARDebugEntryVisible = showARDebugEntry ? 'true' : 'false';
  }, [arOverlayActive, sceneUiReady, showARDebugEntry, showARRecoveryEntry]);

  return (
    <LangContext.Provider value={lang}>
      <>
        {eighthWallARActive && (
          <AFrameEighthWallARExperience
            onClose={handleCloseEighthWallAR}
            onError={handleEighthWallError}
          />
        )}
        {/* 加载屏 */}
        <LoadingScreen
          progress={loadProgress}
          message={loadMessage}
          error={loadError}
          visible={authed && loadingVisible && !sceneReady}
          variant="scene"
        />

        {showARRecoveryEntry && (
          <div
            data-testid="ar-recovery-entry"
            style={{
              position: 'fixed',
              left: '50%',
              bottom: 'calc(178px + env(safe-area-inset-bottom, 0px))',
              transform: 'translateX(-50%)',
              zIndex: 10020,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'auto',
            }}
          >
            <button
              type="button"
              aria-label="AR 预览"
              onClick={handleEnterAR}
              style={{
                minWidth: 156,
                height: 56,
                padding: '0 28px',
                borderRadius: 18,
                color: '#ffffff',
                background: 'linear-gradient(135deg, #242833 0%, #111827 100%)',
                border: '1px solid rgba(255, 255, 255, 0.42)',
                boxShadow: '0 18px 42px rgba(0, 0, 0, 0.32)',
                fontSize: 20,
                fontWeight: 800,
                letterSpacing: 0,
              }}
            >
              AR 预览
            </button>
          </div>
        )}

        {showARDebugEntry && (
          <div
            data-testid="ar-debug-entry"
            style={{
              position: 'fixed',
              left: '50%',
              bottom: 'calc(28px + env(safe-area-inset-bottom, 0px))',
              transform: 'translateX(-50%)',
              zIndex: 10030,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'auto',
            }}
          >
            <button
              type="button"
              aria-label="AR 预览"
              onClick={handleEnterAR}
              style={{
                minWidth: 168,
                height: 58,
                padding: '0 30px',
                borderRadius: 18,
                color: '#ffffff',
                background: 'linear-gradient(135deg, #0f172a 0%, #1f2937 100%)',
                border: '1px solid rgba(255, 255, 255, 0.46)',
                boxShadow: '0 18px 42px rgba(0, 0, 0, 0.34)',
                fontSize: 20,
                fontWeight: 800,
                letterSpacing: 0,
              }}
            >
              AR 预览
            </button>
          </div>
        )}

        {authed && (
          <>
            {/* goo filter for cart button blob effect */}
            <svg style={{ position: 'absolute', width: 0, height: 0 }}>
              <defs>
                <filter id="goo">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
                  <feColorMatrix in="blur" mode="matrix"
                    values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
                  <feBlend in="SourceGraphic" in2="goo" />
                </filter>
              </defs>
            </svg>

            {/* R3F 场景（替代原 Verge3D #v3d-container） */}
            <Scene />

            <ProductStudioBackground />
            <ProjectConfigBackground />

            <div
              id="bg-layer"
              style={{
                opacity: sceneUiReady && showDefaultSceneBackground && !arOverlayActive ? 1 : 0,
                visibility: sceneUiReady && showDefaultSceneBackground && !arOverlayActive ? 'visible' : 'hidden',
                pointerEvents: 'none',
                transition: 'opacity 260ms ease',
              }}
            >
              {sceneUiReady && showDefaultSceneBackground && !arOverlayActive && <LightRaysBackground {...sceneBackground} />}
            </div>

            {/* 3D 标注组件 */}
            {sceneUiReady && !arOverlayActive && (
              <DimensionAnnotation visible={showAnnotations && !soloActive} heightT={heightT} />
            )}
            {sceneUiReady && !arOverlayActive && <FeatureAnnotationPin visible={showAnnotations && !soloActive} />}
            {sceneUiReady && !arOverlayActive && DEV_PANELS_ENABLED && (
              <>
                <FeatureAnnotationGizmo />
                <HeaderPanel />
                <OutlinePanel />
                <BgPanel />
                <ProductStudioBgPanel />
                <LedPanel />
                <MaterialPanel />
              </>
            )}
            {sceneUiReady && !arOverlayActive && notice && (
              <div
                role="status"
                aria-live="polite"
                style={{
                  position: 'fixed',
                  left: '50%',
                  bottom: 'calc(118px + env(safe-area-inset-bottom, 0px))',
                  transform: 'translateX(-50%)',
                  zIndex: 520,
                  padding: '12px 22px',
                  borderRadius: 16,
                  color: '#ffffff',
                  background: 'rgba(12, 15, 22, 0.82)',
                  border: '1px solid rgba(255, 255, 255, 0.34)',
                  boxShadow: '0 18px 44px rgba(0, 0, 0, 0.32)',
                  backdropFilter: 'blur(14px)',
                  WebkitBackdropFilter: 'blur(14px)',
                  fontSize: 16,
                  fontWeight: 700,
                  letterSpacing: 0,
                  pointerEvents: 'none',
                }}
              >
                {notice}
              </div>
            )}
            <IOSQuickLookGuide
              visible={sceneUiReady && !arOverlayActive && iosARGuideVisible}
              onClose={() => setIOSARGuideVisible(false)}
              onCopyLink={copySafariARLink}
              onOpenUSDZ={openUSDZFile}
            />
            {/* UI 层 — zoom 反向抵消浏览器缩放 */}
            {sceneUiReady && !arOverlayActive && (
              <div id="ui-layer" style={{
                position: 'fixed',
                inset: 0,
                zIndex: 250,
                pointerEvents: 'none',
                isolation: 'isolate',
              }}>
                <Header
                  onToggleLight={handleToggleLight}
                  lightOn={lightOn}
                  lampVisible={lampVisible}
                  lang={lang}
                  onLangChange={setLang}
                  musicReady={musicReady}
                  authed={authed}
                />
                <ControlBar
                  height={currentHeight}
                  onHeightChange={() => {}}
                  onPlayToFrame={handlePlayToFrame}
                  onStepFrame={handleStepFrame}
                  material={material}
                  onMaterialChange={handleMaterialChange}
                  showAnnotations={showAnnotations}
                  onToggleAnnotations={() => {
                    trackOperation('annotations_toggled', { visible: !showAnnotations });
                    setShowAnnotations(!showAnnotations);
                  }}
                  activeView={activeView}
                  onViewChange={handleViewChange}
                  onAddToCart={() => {
                    trackOperation('cart_added', { material, height: currentHeight });
                    alert('已加入购物车！');
                  }}
                  onAccessoryChange={handleAccessoryChange}
                  onSoloMode={handleSoloMode}
                  onOrbitMode={handleOrbitMode}
                  onEnterAR={handleEnterAR}
                  arActive={arOverlayActive}
                  backgroundMode={backgroundMode}
                  onToggleBackground={() => {
                    trackOperation('background_toggled', { previousMode: backgroundMode });
                    toggleBackgroundMode();
                  }}
                  soloActive={soloActive}
                  orbitActive={orbitActive}
                />
              </div>
            )}
          </>
        )}
      </>
    </LangContext.Provider>
  );
}

export default function App() {
  useEffect(() => {
    installTelemetryListeners();
    trackOperation('page_viewed', {
      renderer: new URLSearchParams(window.location.search).get('renderer') || 'webgl',
      viewer: new URLSearchParams(window.location.search).get('viewer') || '0',
    });
  }, []);

  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const portal = params?.get('portal');
  const viewer = params?.get('viewer');
  if (portal === 'admin' || portal === 'client') {
    return <BackendMovedNotice portal={portal} />;
  }

  return <ConfiguratorApp viewer={viewer} />;
}
