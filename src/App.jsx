import { useEffect, useRef, useState } from 'react';
import UnicornScene from 'unicornstudio-react';
import './App.css';
import Header from './components/Header';
import ControlBar from './components/ControlBar';
import LoadingScreen from './components/LoadingScreen';
import LoginScreen from './components/LoginScreen';
import DimensionAnnotation from './components/DimensionAnnotation';
import { LangContext } from './LangContext';

let reflectionRAF = null;
let groundReflectionRAF = null;

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
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [monitorAddon, setMonitorAddon] = useState(false);
  const [lightOn, setLightOn] = useState(false);
  const [lampVisible, setLampVisible] = useState(true);
  const [activeView, setActiveView] = useState('front');
  const [lang, setLang] = useState('zh');
  const loadStartTime = useRef(Date.now());
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadingVisible, setLoadingVisible] = useState(true);

  // 登录状态：检查 sessionStorage 是否已有合法 token
  const [authed, setAuthed] = useState(() => !!sessionStorage.getItem('v3d_token'));

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

      // 主相机启用 layer 2，使标注对象（layer 2）可见，但不被 CubeCamera 反射捕捉
      app.camera.layers.enable(2);

      // 隐藏加载屏：最短展示 2.5s
      setLoadProgress(100);
      const elapsed = Date.now() - loadStartTime.current;
      const delay = Math.max(800, 2500 - elapsed);
      setTimeout(() => {
        setLoadingVisible(false);  // 触发 600ms fade-out
        // 初始状态：灯关（Material #186 = 0，UI 按钮 = false）
        setLightOn(false);
        const mat = getMat186(app.scene);
        if (mat?.nodeInputs?.float) mat.nodeInputs.float[13] = 0;
      }, delay);

      // 禁用 AnimationAction，改用直接位置插值驱动两个伸缩件同步运动
      if (app.actions?.length) {
        app.actions.forEach(a => { a.enabled = false; });
      }

      // 从关键帧数据提取各档位的 y 坐标（0=一档, 0.5=二档, 1=三档）
      // Dummy003: 0→-4.1517, 1→-9.592  Dummy002: 0→-0.4365, 1→-7.1008

      // 初始定位到二档（t=0.5，对应 94cm）
      applyT(0.5, app);

      // 初始化配件：默认全部隐藏，与 ControlBar activeAccessory 初始空 Set 同步
      ['对象010', '对象011'].forEach(name => {
        const obj = app.scene?.getObjectByName(name);
        if (obj) obj.visible = false;
      });
      // 台灯（组007）：初始状态显示
      const lamp = app.scene?.getObjectByName('组007');
      if (lamp) lamp.children.forEach(child => { child.visible = true; });

      // 初始关灯：只归零 Material #186（对象016 台灯头），按钮唯一控制对象
      app.scene.traverse(obj => {
        const mats = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : []);
        mats.forEach(m => {
          if (m.name === 'Material #186' && m.nodeInputs?.float) m.nodeInputs.float[13] = 0;
        });
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
          applyT(next, app);
          if (next <= 0 || next >= 1) arrowMoveRef.current = null;
        });
      }

      // 把 v3d canvas 移入 React 容器
      const v3dContainer = document.getElementById('v3d-container');
      const canvas = v3dContainer?.querySelector('canvas');
      if (canvas) container.appendChild(canvas);

      // fsdfsd31233210118 材质导出错误（Material #85），强制替换为 GalvanizedSteel02_PBR
      // 同时修复负缩放导致的法线翻转问题（3ds Max 镜像未重置 Xform）
      const wrongObj = app.scene.getObjectByName('fsdfsd31233210118');
      if (wrongObj) {
        let steelMat = null;
        app.scene.traverse(o => {
          if (steelMat) return;
          const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
          const found = mats.find(m => m.name === 'GalvanizedSteel02_PBR');
          if (found) steelMat = found;
        });
        if (steelMat) wrongObj.material = steelMat;
      }

      if (app.scene) {
        app.scene.background = null;
        // 强制 clearAlpha=0，让 v3d canvas 完全透明，Unicorn 背景层可透出
        if (app.renderer) {
          app.renderer.setClearColor(0x000000, 0);
        }
        // Verge3D 内部 render loop 每帧可能重置 background，用 renderCallbacks 持续强制清零
        if (app.renderCallbacks) {
          app.renderCallbacks.push(() => {
            if (app.scene.background !== null) {
              app.scene.background = null;
            }
            if (app.renderer.getClearAlpha() !== 0) {
              app.renderer.setClearColor(0x000000, 0);
            }
          });
        }
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
            groundReflectionRAF = requestAnimationFrame(updateReflection);
          }
          updateReflection();
        }
      }

      startReflection(container);

      // ── 无操作 5s 后自动旋转 ──────────────────────────────────────────────
      // 利用 Verge3D OrbitControls 内置 autoRotate，无需手动操作相机
      const IDLE_MS = 20000;
      const controls = app.controls;
      if (controls) {
        controls.autoRotateSpeed = 0.735; // 转速再降低30%（1.05 × 0.7）
        let idleTimer = null;

        const startIdle = () => {
          idleTimer = setTimeout(() => {
            controls.autoRotate = true;
          }, IDLE_MS);
        };

        const resetIdle = () => {
          controls.autoRotate = false;
          clearTimeout(idleTimer);
          startIdle();
        };

        // 监听 document 上的用户交互（包含 UI 按钮点击，防止点按钮后 autoRotate 不停止）
        const idleEvents = ['mousedown', 'wheel', 'touchstart', 'keydown'];
        idleEvents.forEach(evt => {
          document.addEventListener(evt, resetIdle, { passive: true });
        });
        // mousemove 只监听 canvas，避免鼠标在 UI 区域游走时频繁重置
        const canvas = container.querySelector('canvas');
        if (canvas) {
          canvas.addEventListener('mousemove', resetIdle, { passive: true });
          canvas.addEventListener('touchmove', resetIdle, { passive: true });
        }

        // 启动首次倒计时
        startIdle();

        // 组件卸载时清理事件监听和 timer，防止内存泄漏
        const cleanupIdle = () => {
          clearTimeout(idleTimer);
          idleEvents.forEach(evt => {
            document.removeEventListener(evt, resetIdle);
          });
          if (canvas) {
            canvas.removeEventListener('mousemove', resetIdle);
            canvas.removeEventListener('touchmove', resetIdle);
          }
        };
        container._cleanupIdle = cleanupIdle;
      }
    }

    // 如果 table.js 已经初始化完成（场景已就绪）
    if (appRef.current || window.v3dApp) {
      onSceneReady({ detail: { app: appRef.current || window.v3dApp } });
      return;
    }

    window.addEventListener('v3d-scene-ready', onSceneReady, { once: true });
    return () => {
      window.removeEventListener('v3d-scene-ready', onSceneReady);
      // 清理自动旋转事件监听和 timer
      containerRef.current?._cleanupIdle?.();
      // 清理内存泄漏：取消两个 rAF 循环
      if (reflectionRAF) {
        cancelAnimationFrame(reflectionRAF);
        reflectionRAF = null;
      }
      if (groundReflectionRAF) {
        cancelAnimationFrame(groundReflectionRAF);
        groundReflectionRAF = null;
      }
    };
  }, []);

  // 监听 Verge3D 加载进度（仅在已登录时启动，避免未登录时假进度条跑到 92% 透出）
  useEffect(() => {
    if (!authed) return;

    const onProgress = (e) => {
      const pct = e.detail?.progress ?? e.detail?.loaded ?? 0;
      setLoadProgress(Math.min(Math.round(pct * 100), 99));
    };
    window.addEventListener('v3d-loading-progress', onProgress);

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
  }, [authed]);

  // 同步 height UI：只在 t 值变化时更新，避免静止时频繁 re-render
  const lastSyncedT = useRef(-1);
  useEffect(() => {
    const timer = setInterval(() => {
      const t = arrowTRef.current;
      if (Math.abs(t - lastSyncedT.current) < 0.001) return;
      lastSyncedT.current = t;
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

  // 从当前位置平滑播放到目标档位
  const playToFrame = (targetHeightCm) => {
    const targetT = heightTMap[targetHeightCm];
    if (targetT === undefined) return;

    if (playRAFRef.current !== null) {
      cancelAnimationFrame(playRAFRef.current);
      playRAFRef.current = null;
    }
    arrowMoveRef.current = null; // 停止箭头持续移动

    const SPEED = 0.3; // t/秒，与箭头按钮速度一致
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
    if (!obj) return;

    if (accId === 'acc4') {
      // 台灯：控制 组007 的所有子对象
      obj.children.forEach(child => { child.visible = visible; });
      setLampVisible(visible);
    } else {
      obj.visible = visible;
    }
  };

  // ── 灯光系统 ──────────────────────────────────────────────────────────────
  // 按钮只控制 Material #186（对象016 台灯头）自发光，0=关，1=开

  const getMat186 = (scene) => {
    let mat = null;
    const seen = new Set();
    scene.traverse(obj => {
      const mats = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : []);
      mats.forEach(m => {
        if (seen.has(m.uuid)) return;
        seen.add(m.uuid);
        if (m.name === 'Material #186') mat = m;
      });
    });
    return mat;
  };

  // ── 手动开关灯 ──
  const toggleLight = (on) => {
    setLightOn(on);
    const app = appRef.current;
    if (!app?.scene) return;
    const mat = getMat186(app.scene);
    if (mat?.nodeInputs?.float) mat.nodeInputs.float[13] = on ? 1 : 0;

    // Bloom 辉光后处理：开灯启用，关灯关闭
    // LDR 模式亮度范围 0-1，threshold 需低于 1
    if (on) {
      app.enablePostprocessing?.([{
        type: 'bloom',
        threshold: 0.8,
        strength: 0.8,
        radius: 0.5,
      }]);

      // Bloom 基于帧缓冲采样，无法通过 layer 排除标注。
      // Monkey-patch BloomPass.render：渲染前隐藏标注 group，完成后恢复。
      // 一次性收集标注 group，避免每帧 traverse
      const bloomPass = app.postprocessing?.composer?.passes?.find(p => p.strength !== undefined);
      if (bloomPass && !bloomPass.__origRender) {
        const dimGroups = [];
        app.scene.traverse(obj => {
          if (obj.name?.startsWith('__dim_annotation_') && obj.isGroup) dimGroups.push(obj);
        });
        bloomPass.__origRender = bloomPass.render.bind(bloomPass);
        bloomPass.render = function(...args) {
          const visStates = dimGroups.map(g => g.visible);
          dimGroups.forEach(g => { g.visible = false; });
          bloomPass.__origRender(...args);
          dimGroups.forEach((g, i) => { g.visible = visStates[i]; });
        };
      }
    } else {
      // 关灯时移除 patch 并关闭后处理
      const bloomPass = app.postprocessing?.composer?.passes?.find(p => p.strength !== undefined);
      if (bloomPass?.__origRender) {
        bloomPass.render = bloomPass.__origRender;
        delete bloomPass.__origRender;
      }
      app.disablePostprocessing?.(true, true);
    }
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
        {/* 登录界面：未通过验证时显示，挡在所有内容之前 */}
        <LoginScreen visible={!authed} onSuccess={() => setAuthed(true)} />

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
        <div id="v3d-container" ref={containerRef} />
        <div id="bg-layer">
          <UnicornScene
            projectId="bznXS8AvCasu71Yi5hVk"
            width="1440px"
            height="900px"
            scale={1}
            dpi={1.5}
            sdkUrl="https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@2.1.9/dist/unicornStudio.umd.js"
          />
        </div>
        <div id="ground-layer" />
        <canvas id="reflection-canvas" />
        <DimensionAnnotation visible={showAnnotations} heightT={(height - 68) / 52} />
        {/* UI layer — zoom反向抵消浏览器缩放 */}
        <div id="ui-layer" style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          pointerEvents: 'none',
          isolation: 'isolate',
        }}>
          <Header onToggleLight={(on) => toggleLight(on)} lightOn={lightOn} lampVisible={lampVisible} lang={lang} onLangChange={setLang} />
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
