/**
 * App — R3F 迁移版
 *
 * 移除 Verge3D 场景逻辑（onSceneReady/startReflection/drawLed 等约 600 行），
 * 替换为 <Scene />（R3F Canvas）+ sceneAPI（通过 zustand store 调用）。
 */
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import './App.css';
import Scene from './components/Scene';
import SceneWebGPU from './components/SceneWebGPU';
import DynamicBackground from './components/DynamicBackground';
import Header from './components/Header';
import ControlBar from './components/ControlBar';
import LoadingScreen from './components/LoadingScreen';
import LoginScreen from './components/LoginScreen';
import DimensionAnnotation from './components/DimensionAnnotation';
import FeatureAnnotationPin from './components/FeatureAnnotationPin';
import MobileControlDrawer from './components/MobileControlDrawer';
import ProductStudioBackground from './components/ProductStudioBackground';
import ProjectConfigBackground from './components/ProjectConfigBackground';
import { LangContext } from './LangContext';
import useStore from './store/useStore';
import { getStoredAuthToken } from './utils/authStorage';
import {
  installTelemetryListeners,
  trackError,
  trackOperation,
  trackPerformance,
} from './utils/telemetry';

const FeatureAnnotationGizmo = lazy(() => import('./components/FeatureAnnotationGizmo'));
const HeaderPanel = lazy(() => import('./components/HeaderPanel'));
const OutlinePanel = lazy(() => import('./components/OutlinePanel'));
const BgPanel = lazy(() => import('./components/BgPanel'));
const ProductStudioBgPanel = lazy(() => import('./components/ProductStudioBgPanel'));
const LedPanel = lazy(() => import('./components/LedPanel'));
const MaterialPanel = lazy(() => import('./components/MaterialPanel'));

// 交付模式默认不显示场景调试控制面板。需要调参时使用 ?devPanels=1 显式开启。
const DEV_PANELS_ENABLED = import.meta.env.DEV &&
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('devPanels') === '1';
const DEFAULT_ADMIN_ORIGINS = [
  'http://127.0.0.1:5174',
  'http://localhost:5174',
];
const DEFAULT_PROJECT_CONFIG_ID = 'project_12345';

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

function applyUIScale() {
  const scale = Math.max(Math.min(window.innerWidth / BASE_WIDTH, 1), 0.38);
  document.documentElement.style.setProperty('--ui-scale', scale);
}

function isDynamicBackgroundMode(mode) {
  return mode === 'dynamic' || mode === 'unicorn';
}

function ConfiguratorApp({ viewer, rendererMode }) {
  // ── Store 订阅 ────────────────────────────────────────────────
  const currentHeight = useStore((s) => s.currentHeight);
  const lightOn = useStore((s) => s.lightOn);
  const soloActive = useStore((s) => s.soloActive);
  const orbitActive = useStore((s) => s.orbitActive);
  const sceneReady = useStore((s) => s.sceneReady);
  const backgroundMode = useStore((s) => s.backgroundMode);
  const toggleBackgroundMode = useStore((s) => s.toggleBackgroundMode);
  const showDynamicBackground = viewer !== '1' && isDynamicBackgroundMode(backgroundMode);
  const useWebGPU = viewer !== '1' && rendererMode === 'webgpu';

  // ── UI 状态 ──────────────────────────────────────────────────
  const [material, setMaterial] = useState(null);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [lampVisible, setLampVisible] = useState(true);
  const [activeView, setActiveView] = useState('front');
  const [lang, setLang] = useState('zh');
  const loadStartTime = useRef(Date.now());
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadingVisible, setLoadingVisible] = useState(true);
  const [authed, setAuthed] = useState(() => {
    const bypass = new URLSearchParams(window.location.search).get('bypass');
    if (bypass === '1') return true;
    return !!getStoredAuthToken('v3d_token');
  });
  const [musicReady, setMusicReady] = useState(false);
  const loadCompleteTrackedRef = useRef(false);

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

  // ── 加载进度：假进度条 0→92% ──────────────────────────────────
  useEffect(() => {
    if (!authed) return;
    let fakeTimer = null;
    let fakeProgress = 0;
    fakeTimer = setInterval(() => {
      if (fakeProgress < 92) {
        fakeProgress += 1;
        setLoadProgress((prev) => (prev < fakeProgress ? fakeProgress : prev));
      }
    }, 100);
    return () => {
      if (fakeTimer) clearInterval(fakeTimer);
    };
  }, [authed]);

  // ── 加载屏：sceneReady 后自动隐藏 ──────────────────────────────
  useEffect(() => {
    const finishLoading = () => {
      setLoadProgress(100);
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
  const applyProjectConfig = (nextConfig) => {
    if (!nextConfig || !Object.keys(nextConfig).length) return;
    window.__lastProjectConfig = nextConfig;
    useStore.getState().setProjectConfig(nextConfig);
    applyProjectAnnotationsToFeatureStyles(nextConfig.annotations);
    api()?.changeView?.('front');
  };

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
  const handlePlayToFrame = (h) => {
    trackOperation('height_preset_selected', { heightCm: h });
    api()?.playToFrame(h);
  };
  const handleStepFrame = (dir) => {
    trackOperation('height_step_changed', { direction: dir || 'stop' });
    api()?.stepFrame(dir);
  };
  const handleAccessoryChange = (accId, visible) => {
    trackOperation('accessory_toggled', { accessoryId: accId, visible: !!visible });
    if (accId === 'acc4') setLampVisible(visible);
    api()?.toggleAccessory(accId, visible);
  };
  const handleSoloMode = () => {
    trackOperation('solo_mode_toggled', { activeBeforeClick: soloActive });
    api()?.toggleSoloMode();
  };
  const handleOrbitMode = () => {
    trackOperation('orbit_mode_toggled', { activeBeforeClick: orbitActive });
    api()?.toggleOrbitMode();
  };

  useEffect(() => {
    if (!authed) return undefined;
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
  }, [authed]);

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

  return (
    <LangContext.Provider value={lang}>
      <>
        {/* 登录界面 */}
        <LoginScreen visible={!authed} onSuccess={() => setAuthed(true)} />

        {/* 加载屏 */}
        <LoadingScreen progress={loadProgress} visible={authed && loadingVisible} />

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
        {useWebGPU ? <SceneWebGPU /> : <Scene />}

        <ProductStudioBackground />
        <ProjectConfigBackground />

        <div
          id="bg-layer"
          style={{
            opacity: showDynamicBackground ? 1 : 0,
            visibility: showDynamicBackground ? 'visible' : 'hidden',
            pointerEvents: 'none',
            transition: 'opacity 260ms ease',
          }}
        >
          {showDynamicBackground && <DynamicBackground />}
        </div>

        {/* 3D 标注组件 */}
        {!useWebGPU && (
          <DimensionAnnotation visible={showAnnotations && !soloActive} heightT={heightT} />
        )}
        <FeatureAnnotationPin visible={showAnnotations && !soloActive} />
        {DEV_PANELS_ENABLED && (
          <Suspense fallback={null}>
            <FeatureAnnotationGizmo />
            <HeaderPanel />
            <OutlinePanel />
            <BgPanel />
            <ProductStudioBgPanel />
            <LedPanel />
            <MaterialPanel />
          </Suspense>
        )}

        {/* UI 层 — zoom 反向抵消浏览器缩放 */}
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
            backgroundMode={backgroundMode}
            onToggleBackground={() => {
              trackOperation('background_toggled', { previousMode: backgroundMode });
              toggleBackgroundMode();
            }}
            soloActive={soloActive}
            orbitActive={orbitActive}
          />
        </div>
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
  const rendererMode = params?.get('renderer');

  if (portal === 'admin' || portal === 'client') {
    return <BackendMovedNotice portal={portal} />;
  }

  return <ConfiguratorApp viewer={viewer} rendererMode={rendererMode} />;
}





