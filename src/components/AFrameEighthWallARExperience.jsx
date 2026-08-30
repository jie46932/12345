import { useEffect, useRef, useState } from 'react';

const MODEL_URL = '/models/mainModel.glb';
const MODEL_SOURCE_LABEL = '123453_v1.0.0/mainModel.glb';
const MODEL_TARGET_WIDTH_METERS = 1;
const STATE_POST_INTERVAL_MS = 1000;

const SCRIPT_SOURCES = [
  '/external/scripts/8frame-1.5.0.min.js',
  'https://cdn.jsdelivr.net/npm/@8thwall/xrextras@1/dist/xrextras.js',
  'https://cdn.jsdelivr.net/npm/@8thwall/landing-page@1/dist/landing-page.js',
  'https://cdn.jsdelivr.net/npm/@8thwall/engine-binary@1/dist/xr.js',
];

function setARData(name, value) {
  document.documentElement.dataset[name] = String(value);
}

function isDebugTelemetryEnabled() {
  try {
    return new URLSearchParams(window.location.search).get('arDebug') === '1';
  } catch {
    return false;
  }
}

function sendARDebugState() {
  if (!isDebugTelemetryEnabled()) return;
  fetch('/__ar-state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      href: window.location.href,
      dataset: { ...document.documentElement.dataset },
      timestamp: Date.now(),
    }),
    keepalive: true,
  }).catch(() => {});
}

function resetARState() {
  [
    ['viewerARProvider', '8th-wall-aframe'],
    ['viewerARLaunchState', 'starting'],
    ['viewerARMode', 'active'],
    ['viewerAROverlayActive', 'true'],
    ['viewerARCameraPipelineStarted', 'false'],
    ['viewerARCameraFeedReady', 'false'],
    ['viewerARCameraFrameCount', '0'],
    ['viewerARCameraTextureReady', 'false'],
    ['viewerARCameraBlackFrameSuspected', 'false'],
    ['viewerARPlaneReady', 'false'],
    ['viewerARReticleReady', 'false'],
    ['viewerARFloorGridVisible', 'false'],
    ['viewerARTapToPlaceVisible', 'true'],
    ['viewerARPlacementHitReady', 'false'],
    ['viewerARPlacementHitType', 'aframe-ground'],
    ['viewerARPlaced', 'false'],
    ['viewerARFlowState', 'scanning'],
    ['viewerARControlMode', 'idle'],
    ['viewerARDragging', 'false'],
    ['viewerARTwoFingerRotating', 'false'],
    ['viewerARSelectionVisible', 'false'],
    ['viewerARRotationRingVisible', 'false'],
    ['viewerARLastMoveX', ''],
    ['viewerARLastMoveZ', ''],
    ['viewerARLastRotateRadians', '0'],
    ['viewerARResetCount', '0'],
    ['viewerARModelReady', 'false'],
    ['viewerARModelSource', MODEL_SOURCE_LABEL],
    ['viewerARModelVisible', 'false'],
    ['viewerARModelError', ''],
    ['viewerARModelMeshCount', '0'],
    ['viewerARPipelineVersion', 'aframe-official-manipulate-20260830'],
    ['viewerARRuntimeError', ''],
  ].forEach(([name, value]) => setARData(name, value));
}

function loadScript(src) {
  const existing = document.querySelector(`script[data-aframe-8thwall-src="${src}"]`);
  if (existing?.dataset.loaded === 'true') return Promise.resolve();
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.crossOrigin = 'anonymous';
    script.dataset.aframe8thwallSrc = src;
    if (src.includes('engine-binary')) {
      script.async = true;
      script.setAttribute('data-preload-chunks', 'slam');
    }
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      resolve();
    }, { once: true });
    script.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
    document.head.appendChild(script);
  });
}

async function loadAFrameRuntime() {
  for (const src of SCRIPT_SOURCES) {
    await loadScript(src);
  }
}

function normalizeModelScale(el) {
  const THREE = window.THREE || window.AFRAME?.THREE;
  const mesh = el.getObject3D('mesh');
  if (!THREE || !mesh) return 0;
  mesh.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(mesh);
  const size = new THREE.Vector3();
  box.getSize(size);
  const width = Math.max(size.x, size.z);
  if (!width) return 0;
  const scale = MODEL_TARGET_WIDTH_METERS / width;
  el.object3D.scale.setScalar(scale);
  return scale;
}

function updateModelTransformState(el) {
  if (!el?.object3D) return;
  const { position, rotation, visible } = el.object3D;
  setARData('viewerARModelVisible', visible ? 'true' : 'false');
  setARData('viewerARLastMoveX', position.x.toFixed(4));
  setARData('viewerARLastMoveZ', position.z.toFixed(4));
  setARData('viewerARLastRotateRadians', rotation.y.toFixed(4));
}

function registerAFrameComponents() {
  const AFRAME = window.AFRAME;
  if (!AFRAME) throw new Error('A-Frame runtime is not available');

  if (!AFRAME.components['viewer-model-normalizer']) {
    AFRAME.registerComponent('viewer-model-normalizer', {
      init() {
        this.el.addEventListener('model-loaded', () => {
          const scale = normalizeModelScale(this.el);
          let meshCount = 0;
          this.el.object3D.traverse((object) => {
            if (object.isMesh) {
              meshCount += 1;
              object.frustumCulled = false;
              object.castShadow = true;
              object.receiveShadow = true;
            }
          });
          setARData('viewerARModelReady', 'true');
          setARData('viewerARModelError', '');
          setARData('viewerARModelMeshCount', String(meshCount));
          setARData('viewerARModelScale', scale ? scale.toFixed(5) : '0');
          updateModelTransformState(this.el);
        });
        this.el.addEventListener('model-error', (event) => {
          setARData('viewerARModelReady', 'false');
          setARData('viewerARModelError', event?.detail?.src || 'model-error');
        });
      },
      tick() {
        updateModelTransformState(this.el);
      },
    });
  }

  if (!AFRAME.components['viewer-manipulate-telemetry']) {
    AFRAME.registerComponent('viewer-manipulate-telemetry', {
      init() {
        this.frameCount = 0;
        this.lastRotationY = 0;
        this.onSceneLoaded = () => {
          setARData('viewerARLaunchState', 'started');
          setARData('viewerARCameraPipelineStarted', 'true');
          setARData('viewerARCameraTextureReady', window.XR8 ? 'true' : 'false');
        };
        this.el.sceneEl.addEventListener('loaded', this.onSceneLoaded, { once: true });
      },
      tick() {
        this.frameCount += 1;
        setARData('viewerARCameraFrameCount', String(this.frameCount));
        if (window.XR8) {
          setARData('viewerARCameraFeedReady', 'true');
          setARData('viewerARCameraTextureReady', 'true');
          setARData('viewerARCameraBlackFrameSuspected', 'false');
        }
      },
      remove() {
        this.el.sceneEl?.removeEventListener('loaded', this.onSceneLoaded);
      },
    });
  }

  if (!AFRAME.components['viewer-tap-place']) {
    AFRAME.registerComponent('viewer-tap-place', {
      init() {
        this.ground = null;
        this.model = null;
        this.placed = false;
        this.placeAt = (point) => {
          this.model = this.model || document.getElementById('aframe-product-model');
          if (!this.model || !point) {
            setARData('viewerARPlacementHitReady', 'false');
            return;
          }
          this.model.setAttribute('position', point);
          this.model.setAttribute('visible', 'true');
          this.placed = true;
          setARData('viewerARPlaneReady', 'true');
          setARData('viewerARReticleReady', 'true');
          setARData('viewerARFloorGridVisible', 'false');
          setARData('viewerARTapToPlaceVisible', 'false');
          setARData('viewerARPlacementHitReady', 'true');
          setARData('viewerARPlaced', 'true');
          setARData('viewerARFlowState', 'placed');
          setARData('viewerARControlMode', 'move');
          setARData('viewerARSelectionVisible', 'true');
          setARData('viewerARRotationRingVisible', 'true');
          updateModelTransformState(this.model);
          document.getElementById('aframe-status-text')?.replaceChildren('单指拖动移动，双指旋转方向');
        };
        this.onGroundClick = (event) => {
          if (!this.model) return;
          const point = event?.detail?.intersection?.point;
          this.placeAt(point);
        };
        this.bindGround = () => {
          this.ground = document.getElementById('ground');
          this.model = document.getElementById('aframe-product-model');
          this.ground?.removeEventListener('click', this.onGroundClick);
          this.ground?.addEventListener('click', this.onGroundClick);
          window.__viewerARPlaceAt = this.placeAt;
        };
        window.setTimeout(this.bindGround, 0);
        this.el.sceneEl.addEventListener('loaded', this.bindGround, { once: true });
      },
      remove() {
        this.ground?.removeEventListener('click', this.onGroundClick);
        this.el.sceneEl?.removeEventListener('loaded', this.bindGround);
        if (window.__viewerARPlaceAt === this.placeAt) delete window.__viewerARPlaceAt;
      },
    });
  }

  if (!AFRAME.components['viewer-touch-state']) {
    AFRAME.registerComponent('viewer-touch-state', {
      init() {
        this.onTouchStart = (event) => {
          const count = event.touches?.length || 0;
          setARData('viewerARDragging', count === 1 ? 'true' : 'false');
          setARData('viewerARTwoFingerRotating', count >= 2 ? 'true' : 'false');
          setARData('viewerARControlMode', count >= 2 ? 'rotate' : count === 1 ? 'move' : 'idle');
        };
        this.onTouchMove = this.onTouchStart;
        this.onTouchEnd = (event) => {
          const count = event.touches?.length || 0;
          setARData('viewerARDragging', count === 1 ? 'true' : 'false');
          setARData('viewerARTwoFingerRotating', count >= 2 ? 'true' : 'false');
          if (count === 0 && document.documentElement.dataset.viewerARPlaced === 'true') {
            setARData('viewerARControlMode', 'move');
          }
        };
        window.addEventListener('touchstart', this.onTouchStart, { passive: true });
        window.addEventListener('touchmove', this.onTouchMove, { passive: true });
        window.addEventListener('touchend', this.onTouchEnd, { passive: true });
        window.addEventListener('touchcancel', this.onTouchEnd, { passive: true });
      },
      remove() {
        window.removeEventListener('touchstart', this.onTouchStart);
        window.removeEventListener('touchmove', this.onTouchMove);
        window.removeEventListener('touchend', this.onTouchEnd);
        window.removeEventListener('touchcancel', this.onTouchEnd);
      },
    });
  }
}

export default function AFrameEighthWallARExperience({ onClose, onError }) {
  const [ready, setReady] = useState(false);
  const [resetCount, setResetCount] = useState(0);
  const timerRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    resetARState();
    const handleError = (event) => {
      const message = event?.message || event?.reason?.message || String(event?.reason || 'runtime-error');
      setARData('viewerARRuntimeError', message);
    };
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleError);

    loadAFrameRuntime()
      .then(() => {
        if (cancelled) return;
        registerAFrameComponents();
        setReady(true);
        timerRef.current = window.setInterval(sendARDebugState, STATE_POST_INTERVAL_MS);
        sendARDebugState();
      })
      .catch((error) => {
        if (cancelled) return;
        setARData('viewerARLaunchState', 'failed');
        setARData('viewerARRuntimeError', error?.message || String(error));
        onError?.(error);
      });

    return () => {
      cancelled = true;
      if (timerRef.current) window.clearInterval(timerRef.current);
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleError);
      setARData('viewerARMode', 'inactive');
      setARData('viewerAROverlayActive', 'false');
      setARData('viewerARDragging', 'false');
      setARData('viewerARTwoFingerRotating', 'false');
      try {
        window.XR8?.stop?.();
      } catch {
        // 8th Wall cleanup is best-effort when React unmounts the scene.
      }
    };
  }, [onError]);

  const handleReset = () => {
    const model = document.getElementById('aframe-product-model');
    model?.setAttribute('visible', 'false');
    model?.setAttribute('position', '0 0 0');
    setARData('viewerARPlaced', 'false');
    setARData('viewerARFlowState', 'scanning');
    setARData('viewerARControlMode', 'idle');
    setARData('viewerARSelectionVisible', 'false');
    setARData('viewerARRotationRingVisible', 'false');
    setARData('viewerARTapToPlaceVisible', 'true');
    setARData('viewerARLastMoveX', '');
    setARData('viewerARLastMoveZ', '');
    setResetCount((count) => {
      const next = count + 1;
      setARData('viewerARResetCount', String(next));
      return next;
    });
    document.getElementById('aframe-status-text')?.replaceChildren('点击地面放置模型');
  };

  return (
    <div className="aframe-ar-shell" role="dialog" aria-modal="true" aria-label="8th Wall A-Frame AR 预览">
      {!ready && (
        <div className="aframe-ar-loading">
          <strong>AR 预览</strong>
          <span>正在启动 8th Wall A-Frame</span>
        </div>
      )}
      {ready && (
        <a-scene
          viewer-tap-place
          viewer-manipulate-telemetry
          viewer-touch-state
          xrextras-gesture-detector
          landing-page
          xrextras-loading
          xrextras-runtime-error
          renderer="colorManagement:true; physicallyCorrectLights:true"
          xrweb="allowedDevices: any"
        >
          <a-camera
            id="camera"
            position="0 8 8"
            raycaster="objects: .cantap"
            cursor="fuse: false; rayOrigin: mouse"
          ></a-camera>

          <a-entity
            light="
              type: directional;
              intensity: 0.9;
              castShadow: true;
              shadowMapHeight: 2048;
              shadowMapWidth: 2048;
              shadowCameraTop: 40;
              shadowCameraBottom: -40;
              shadowCameraRight: 40;
              shadowCameraLeft: -40;
              target: #camera"
            xrextras-attach="target: camera; offset: 8 15 4"
            shadow
          ></a-entity>
          <a-light type="ambient" intensity="0.7"></a-light>

          <a-entity
            id="aframe-product-model"
            gltf-model={MODEL_URL}
            class="cantap"
            visible="false"
            position="0 0 0"
            rotation="0 0 0"
            scale="1 1 1"
            viewer-model-normalizer
            xrextras-hold-drag
            xrextras-two-finger-rotate
            shadow="receive: false"
          ></a-entity>

          <a-box
            id="ground"
            class="cantap"
            scale="1000 2 1000"
            position="0 -0.99 0"
            material="shader: shadow; transparent: true; opacity: 0.35"
            shadow
          ></a-box>
        </a-scene>
      )}

      <div className="aframe-ar-hud" aria-hidden="true">
        <div className="aframe-move-arrows">
          <span className="aframe-arrow aframe-arrow-up">↑<small>前</small></span>
          <span className="aframe-arrow aframe-arrow-left">←<small>左</small></span>
          <span className="aframe-arrow aframe-arrow-right">→<small>右</small></span>
          <span className="aframe-arrow aframe-arrow-down">↓<small>后</small></span>
        </div>
        <div className="aframe-rotation-ring"></div>
        <div className="aframe-status-card">
          <strong>AR 预览</strong>
          <span id="aframe-status-text">点击地面放置模型</span>
        </div>
      </div>

      <button type="button" className="aframe-ar-exit" onClick={onClose} aria-label="退出 AR">←</button>
      <button type="button" className="aframe-ar-reset" onClick={handleReset} aria-label="重置 AR 放置" data-reset-count={resetCount}>↻</button>

      <style>{`
        .aframe-ar-shell {
          position: fixed;
          inset: 0;
          z-index: 700;
          overflow: hidden;
          background: #070b10;
          color: #fff;
          touch-action: none;
          font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .aframe-ar-shell a-scene {
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100vh;
        }

        .aframe-ar-loading,
        .aframe-status-card {
          position: fixed;
          left: 50%;
          bottom: calc(24px + env(safe-area-inset-bottom));
          transform: translateX(-50%);
          z-index: 5;
          width: min(78vw, 560px);
          min-height: 74px;
          display: grid;
          place-items: center;
          gap: 6px;
          padding: 14px 18px;
          border: 1px solid rgba(255, 255, 255, 0.28);
          border-radius: 8px;
          background: rgba(22, 24, 28, 0.88);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.28);
          text-align: center;
        }

        .aframe-status-card strong,
        .aframe-ar-loading strong {
          font-size: 16px;
          line-height: 1.2;
          color: rgba(255, 255, 255, 0.72);
        }

        .aframe-status-card span,
        .aframe-ar-loading span {
          font-size: clamp(18px, 4.4vw, 26px);
          line-height: 1.2;
          font-weight: 800;
        }

        .aframe-ar-exit,
        .aframe-ar-reset {
          position: fixed;
          top: calc(36px + env(safe-area-inset-top));
          z-index: 6;
          width: 58px;
          height: 58px;
          border: 0;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.72);
          color: #fff;
          font-size: 42px;
          line-height: 1;
          display: grid;
          place-items: center;
        }

        .aframe-ar-exit {
          left: 24px;
        }

        .aframe-ar-reset {
          right: 24px;
        }

        .aframe-ar-hud {
          position: fixed;
          inset: 0;
          z-index: 4;
          pointer-events: none;
        }

        .aframe-move-arrows {
          position: absolute;
          left: 50%;
          top: 50%;
          width: min(72vw, 330px);
          aspect-ratio: 1;
          transform: translate(-50%, -50%);
          opacity: 0;
          transition: opacity 180ms ease;
        }

        [data-viewer-a-r-placed="true"] .aframe-move-arrows {
          opacity: 0.42;
        }

        .aframe-arrow {
          position: absolute;
          width: 72px;
          height: 64px;
          display: grid;
          place-items: center;
          font-size: 48px;
          color: rgba(20, 245, 255, 0.95);
          text-shadow: 0 2px 10px rgba(0, 0, 0, 0.38);
        }

        .aframe-arrow small {
          position: absolute;
          top: 45px;
          font-size: 14px;
          font-weight: 800;
          color: rgba(255, 255, 255, 0.92);
        }

        .aframe-arrow-up { left: 50%; top: 0; transform: translateX(-50%); }
        .aframe-arrow-down { left: 50%; bottom: 0; transform: translateX(-50%); }
        .aframe-arrow-left { left: 0; top: 50%; transform: translateY(-50%); }
        .aframe-arrow-right { right: 0; top: 50%; transform: translateY(-50%); }

        .aframe-rotation-ring {
          position: absolute;
          left: 50%;
          top: 56%;
          width: min(72vw, 340px);
          aspect-ratio: 1;
          transform: translate(-50%, -50%);
          border: 14px solid rgba(20, 245, 255, 0.78);
          border-left-color: transparent;
          border-right-color: transparent;
          border-radius: 50%;
          opacity: 0;
          transition: opacity 180ms ease;
        }

        [data-viewer-a-r-two-finger-rotating="true"] .aframe-rotation-ring {
          opacity: 0.76;
        }
      `}</style>
    </div>
  );
}
