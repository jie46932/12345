import { useEffect, useRef, useState } from 'react';
import './App.css';
import './critical-fixes.css';
import './high-priority-fixes.css';
import './medium-priority-fixes.css';
import Header from './components/Header';
import ControlBar from './components/ControlBar';
import LoadingScreen from './components/LoadingScreen';
import DimensionAnnotation from './components/DimensionAnnotation';
import { LangContext } from './LangContext';

let globalApp = null;
let reflectionRAF = null;

function startReflection(v3dContainer) {
  const srcCanvas = v3dContainer.querySelector('canvas');
  const reflCanvas = document.getElementById('reflection-canvas');
  if (!srcCanvas || !reflCanvas) return;

  const ctx = reflCanvas.getContext('2d');

  function loop() {
    const w = srcCanvas.width;
    const h = srcCanvas.height;

    if (reflCanvas.width !== w || reflCanvas.height !== h) {
      reflCanvas.width = w;
      reflCanvas.height = h;
    }

    // 直接把整个 canvas 上下翻转画到 reflCanvas
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(0, h);
    ctx.scale(1, -1);
    ctx.drawImage(srcCanvas, 0, 0, w, h);
    ctx.restore();

    reflectionRAF = requestAnimationFrame(loop);
  }

  if (reflectionRAF) cancelAnimationFrame(reflectionRAF);
  loop();
}

const BASE_WIDTH = 1440;

function applyUIScale() {
  const scale = Math.min(window.innerWidth / BASE_WIDTH, 1);
  document.documentElement.style.setProperty('--ui-scale', scale);
}
export default function App() {
  const containerRef = useRef(null);
  const appRef = useRef(null);
  const playRAFRef = useRef(null);
  const arrowMoveRef = useRef(null); // { dir: 'up'|'down' }
  const arrowTRef = useRef(0.5);    // 当前位置 t（0=一档68cm, 1=三档120cm）
  const [height, setHeight] = useState(94);
  const [material, setMaterial] = useState(null);
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [monitorAddon, setMonitorAddon] = useState(false);
  const [lightOn, setLightOn] = useState(false);
  const [activeView, setActiveView] = useState('front');
  const [lang, setLang] = useState('zh');
  const loadStartTime = useRef(Date.now());
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadingVisible, setLoadingVisible] = useState(true);

  const materials = [
    { id: 'light', price: 0 },
    { id: 'oak', price: 200 },
    { id: 'dark', price: 500 }
  ];

  const basePrice = 899;
  const addonPrice = monitorAddon ? 89 : 0;
  const totalPrice = basePrice + addonPrice;

  useEffect(() => {
    const updateZoom = () => {
      const zoom = window.visualViewport ? window.visualViewport.scale : (window.outerWidth / window.innerWidth);
      const antiZoom = zoom > 0 ? 1 / zoom : 1;
      document.getElementById('ui-layer')?.style.setProperty('zoom', antiZoom);
    };
    applyUIScale();
    updateZoom();
    window.addEventListener('resize', applyUIScale);
    window.addEventListener('resize', updateZoom);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateZoom);
    }
    return () => {
      window.removeEventListener('resize', applyUIScale);
      window.removeEventListener('resize', updateZoom);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateZoom);
      }
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function onSceneReady({ detail: { app } }) {
      appRef.current = app;
      globalApp = app;

      // 隐藏加载屏：最短展示 2.5s
      setLoadProgress(100);
      const elapsed = Date.now() - loadStartTime.current;
      const delay = Math.max(800, 2500 - elapsed);
      setTimeout(() => setLoadingVisible(false), delay);

      // 禁用 AnimationAction，改用直接位置插值驱动两个伸缩件同步运动
      if (app.actions?.length) {
        app.actions.forEach(a => { a.enabled = false; });
      }

      // 从关键帧数据提取各档位的 y 坐标（0=一档, 0.5=二档, 1=三档）
      // Dummy003: 0→-4.1517, 1→-9.592  Dummy002: 0→-0.4365, 1→-7.1008
      const dummies = [
        { name: 'Dummy003', y0: -4.1517, y1: -9.592 },
        { name: 'Dummy002', y0: -0.4365, y1: -7.1008 },
      ];

      // applyT：用统一的 t(0~1) 设置两个对象的 y 位置
      const applyT = (t) => {
        dummies.forEach(({ name, y0, y1 }) => {
          const obj = app.scene?.getObjectByName(name);
          if (obj) obj.position.y = y0 + (y1 - y0) * t;
        });
      };

      // 初始定位到二档（t=0.5，对应 94cm）
      applyT(0.5);

      // 初始化配件：默认全部隐藏，与 ControlBar activeAccessory 初始空 Set 同步
      ['对象010', '对象011', '组007'].forEach(name => {
        const obj = app.scene?.getObjectByName(name);
        if (obj) obj.visible = false;
      });

      // 注册 renderCallback：驱动箭头移动（直接操作位置，完全同步）
      if (app.renderCallbacks) {
        app.renderCallbacks.push((delta) => {
          const move = arrowMoveRef.current;
          if (!move) return;
          const SPEED = 0.3; // t/秒，全程 ~3.3s
          const step = SPEED * delta * (move.dir === 'up' ? 1 : -1);
          const current = arrowTRef.current;
          const next = Math.max(0, Math.min(1, current + step));
          arrowTRef.current = next;
          applyT(next);
          if (next <= 0 || next >= 1) arrowMoveRef.current = null;
        });
      }

      // 把 v3d canvas 移入 React 容器
      const v3dContainer = document.getElementById('v3d-container');
      const canvas = v3dContainer?.querySelector('canvas');
      if (canvas) container.appendChild(canvas);

      if (app.scene) {
        app.scene.background = null;
        const ground = app.scene.getObjectByName('Plane001');
        if (ground) {
          const cubeRenderTarget = new window.v3d.WebGLCubeRenderTarget(256, {
            generateMipmaps: true,
            minFilter: window.v3d.LinearMipmapLinearFilter,
          });
          const cubeCamera = new window.v3d.CubeCamera(0.1, 100, cubeRenderTarget);
          cubeCamera.position.set(ground.position.x, 0.01, ground.position.z);
          app.scene.add(cubeCamera);

          ground.material = new window.v3d.MeshStandardMaterial({
            envMap: cubeRenderTarget.texture,
            roughness: 0,
            metalness: 1,
            transparent: true,
            opacity: 0.4,
          });
          ground.visible = true;

          function updateReflection() {
            ground.visible = false;
            cubeCamera.update(app.renderer, app.scene);
            ground.visible = true;
            requestAnimationFrame(updateReflection);
          }
          updateReflection();
        }
      }

      startReflection(container);
    }

    // 如果 table.js 已经初始化完成（场景已就绪）
    if (globalApp || window.v3dApp) {
      onSceneReady({ detail: { app: globalApp || window.v3dApp } });
      return;
    }

    window.addEventListener('v3d-scene-ready', onSceneReady, { once: true });
    return () => window.removeEventListener('v3d-scene-ready', onSceneReady);
  }, []);

  // 监听 Verge3D 加载进度
  useEffect(() => {
    // 方案1: 监听 v3d 自定义进度事件
    const onProgress = (e) => {
      const pct = e.detail?.progress ?? e.detail?.loaded ?? 0;
      setLoadProgress(Math.min(Math.round(pct * 100), 99));
    };
    window.addEventListener('v3d-loading-progress', onProgress);

    // 方案2: 每 100ms +1，平滑逐步增加到 92（兜底）
    let fakeTimer = null;
    let fakeProgress = 0;
    fakeTimer = setInterval(() => {
      if (fakeProgress < 92) {
        fakeProgress += 1;
        setLoadProgress(prev => (prev < fakeProgress ? fakeProgress : prev));
      }
    }, 100);

    return () => {
      window.removeEventListener('v3d-loading-progress', onProgress);
      if (fakeTimer) clearInterval(fakeTimer);
    };
  }, []);

  // 定期同步 height UI（从 arrowTRef 反推 cm）
  useEffect(() => {
    const timer = setInterval(() => {
      const t = arrowTRef.current;
      const cm = Math.round(68 + t * 52);
      setHeight(Math.max(68, Math.min(120, cm)));
    }, 50);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const app = appRef.current;
    if (!app?.scene) return;
    const table = app.scene.getObjectByName('Table');
    if (table) table.position.y = 0.68 + ((height - 68) / 52) * 0.52;
  }, [height]);

  // 箭头按钮：设置/清除 arrowMoveRef，实际移动在 Verge3D renderCallback 里执行
  const stepFrame = (dir) => {
    arrowMoveRef.current = dir ? { dir } : null;
  };

  // 材质名称映射：按钮 id → 场景中的 PBR 材质名
  const matNameMap = {
    light: 'Wood03_PBR',
    oak:   'Wood06_PBR',
    dark:  'Wood07_PBR',
  };

  const changeMaterial = (mat) => {
    setMaterial(mat);
    const app = appRef.current;
    if (!app?.scene) return;

    // 从场景中找到目标材质对象
    const targetMatName = matNameMap[mat];
    let targetMat = null;
    app.scene.traverse(obj => {
      if (targetMat) return;
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        const found = mats.find(m => m.name === targetMatName);
        if (found) targetMat = found;
      }
    });
    if (!targetMat) return;

    // 赋给 Rectangle005、Rectangle006
    ['Rectangle005', 'Rectangle006'].forEach(name => {
      const obj = app.scene.getObjectByName(name);
      if (obj) obj.material = targetMat;
    });
  };

  // 高度档位 → t 值（0=一档68cm, 0.5=二档94cm, 1=三档120cm）
  const heightTMap = { 68: 0, 94: 0.5, 120: 1 };

  // 直接位置插值（绕过 AnimationAction）
  const DUMMIES = [
    { name: 'Dummy003', y0: -4.1517, y1: -9.592 },
    { name: 'Dummy002', y0: -0.4365, y1: -7.1008 },
  ];
  const applyT = (t, app) => {
    const a = app || appRef.current;
    if (!a?.scene) return;
    DUMMIES.forEach(({ name, y0, y1 }) => {
      const obj = a.scene.getObjectByName(name);
      if (obj) obj.position.y = y0 + (y1 - y0) * t;
    });
  };

  // 瞬间跳到指定档位（初始化用）
  const changeFrame = (heightCm) => {
    const t = heightTMap[heightCm];
    if (t === undefined) return;
    arrowTRef.current = t;
    applyT(t);
  };

  // 从当前位置平滑播放到目标档位
  const playToFrame = (targetHeightCm) => {
    const targetT = heightTMap[targetHeightCm];
    if (targetT === undefined) return;

    if (playRAFRef.current !== null) {
      cancelAnimationFrame(playRAFRef.current);
      playRAFRef.current = null;
    }
    arrowMoveRef.current = null; // 停止箭头持续移动

    const SPEED = 1.5; // t/秒，全程约 0.67s
    let lastTimestamp = null;

    const drive = (timestamp) => {
      if (!lastTimestamp) lastTimestamp = timestamp;
      const delta = (timestamp - lastTimestamp) / 1000;
      lastTimestamp = timestamp;

      const current = arrowTRef.current;
      const remaining = targetT - current;
      const step = SPEED * delta * Math.sign(remaining);

      if (Math.abs(remaining) <= Math.abs(step)) {
        arrowTRef.current = targetT;
        applyT(targetT);
        playRAFRef.current = null;
        return;
      }

      arrowTRef.current = current + step;
      applyT(current + step);
      playRAFRef.current = requestAnimationFrame(drive);
    };

    playRAFRef.current = requestAnimationFrame(drive);
  };

  // 配件 id → 场景物体名称
  const accObjMap = {
    acc2: '对象010',
    acc3: '对象011',
    acc4: '组007',
  };

  const toggleAccessory = (accId, visible) => {
    const app = appRef.current;
    if (!app?.scene) return;
    const objName = accObjMap[accId];
    if (!objName) return;
    const obj = app.scene.getObjectByName(objName);
    if (obj) obj.visible = visible;
  };

  const changeView = (viewKey) => {
    const app = appRef.current;
    if (!app?.controls || !window.v3d) return;

    const target = app.controls.targetObj?.position || { x: 0, y: 0.8, z: 0 };
    const d = 14;

    const positions = {
      front: { x: target.x, y: target.y + d * 0.25, z: target.z + d * 0.97 },
      back: { x: target.x, y: target.y + d * 0.25, z: target.z - d * 0.97 },
      left: { x: target.x - d * 0.97, y: target.y + d * 0.25, z: target.z },
      right: { x: target.x + d * 0.97, y: target.y + d * 0.25, z: target.z },
      top: { x: target.x, y: target.y + d, z: target.z }
    };

    const pos = positions[viewKey];
    if (pos) {
      app.controls.tween(
        new window.v3d.Vector3(pos.x, pos.y, pos.z),
        new window.v3d.Vector3(target.x, target.y, target.z),
        0.6
      );
    }
  };

  return (
    <LangContext.Provider value={lang}>
      <>
        <LoadingScreen progress={loadProgress} visible={loadingVisible} />
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
        <div id="v3d-container" ref={containerRef} />
        <div id="bg-layer" />
        <div id="ground-layer" />
        <canvas id="reflection-canvas" />
        <DimensionAnnotation />
        {/* UI layer — zoom反向抵消浏览器缩放 */}
        <div id="ui-layer" style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          pointerEvents: 'none',
          isolation: 'isolate',
        }}>
          <Header onToggleLight={() => setLightOn(v => !v)} lightOn={lightOn} lang={lang} onLangChange={setLang} />
          <ControlBar
            height={height}
            onHeightChange={setHeight}
            onPlayToFrame={playToFrame}
            onStepFrame={stepFrame}
            material={material}
            onMaterialChange={changeMaterial}
            showAnnotations={showAnnotations}
            onToggleAnnotations={() => setShowAnnotations(!showAnnotations)}
            activeView={activeView}
            onViewChange={(v) => { setActiveView(v); changeView(v); }}
            onAddToCart={() => alert('已加入购物车！')}
            onAccessoryChange={toggleAccessory}
          />
        </div>
      </>
    </LangContext.Provider>
  );
}
