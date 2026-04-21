// 尺寸标注：支持多条标注线，每条由两个 Dummy 锚点定义
//
// 标注列表：
//   Dummy019 ↔ Dummy020  实测距离，单位 mm（乘以10）
//   Dummy021 ↔ Dummy022  固定 25mm
//   Dummy023 ↔ Dummy024  固定 70mm
//   Dummy025 ↔ Dummy026  固定 68mm
//
// 实现方案：纯 3D 场景内（Three.js Line + Mesh + Sprite）
//  - 法线朝向检测：camera·normal < 0 时隐藏（背面剔除）
//  - 射线遮挡检测：每30帧刷新障碍物列表，5点采样
//  - 平滑淡入淡出：直接操作 material.opacity，200ms 线性插值

import { useEffect, useRef } from 'react';

const LINE_COLOR = 0xffffff;
const ARROW_W = 0.48;
const ARROW_L = 1.12;
const ARROW_W_SM = 0.24;   // 小号箭头（50%）
const ARROW_L_SM = 0.56;
const ARROW_W_XS = 0.21;   // 超小箭头（极短间距用）
const ARROW_L_XS = 0.42;
const FADE_DURATION = 0.2;   // 秒

// 桌面板网格名：这些包围着锚点，排除在遮挡检测外避免误判
const TABLE_EXCLUDE = new Set([
  'Rectangle006', 'Rectangle005', 'Rectangle004',
  'fsdfsd31233210117', 'fsdfsd31233210118',
  'fsdfsd31233210123', 'fsdfsd31233210124',
]);

// 标注配置列表
// label: 固定文字；arrowW/arrowL: 可选覆盖箭头尺寸
const ANNOTATIONS = [
  { dummyA: 'Dummy019', dummyB: 'Dummy020', label: '140mm' },
  { dummyA: 'Dummy021', dummyB: 'Dummy022', label: '25mm',  arrowW: ARROW_W_SM, arrowL: ARROW_L_SM },
  { dummyA: 'Dummy023', dummyB: 'Dummy024', label: '70mm'  },
  { dummyA: 'Dummy025', dummyB: 'Dummy026', dynamic: true   },  // 实时显示桌高（cm）
  { dummyA: 'Dummy027', dummyB: 'Dummy028', label: '15mm',  arrowW: ARROW_W_XS, arrowL: ARROW_L_XS },
  { dummyA: 'Dummy029', dummyB: 'Dummy030', label: '110mm' },
  { dummyA: 'Dummy031', dummyB: 'Dummy032', label: '21mm',  arrowW: ARROW_W_SM, arrowL: ARROW_L_SM },
];

export default function DimensionAnnotation({ visible = true, heightT = 0.5 }) {
  const groupsRef  = useRef([]);   // 每条标注对应一个 Group
  const visibleRef = useRef(visible);
  const heightTRef = useRef(heightT);

  useEffect(() => {
    visibleRef.current = visible;
    groupsRef.current.forEach(g => {
      if (g) g._targetOpacity = visible ? 1 : 0;
    });
  }, [visible]);

  useEffect(() => {
    heightTRef.current = heightT;
  }, [heightT]);

  useEffect(() => {
    let raf = null;

    function tryInit() {
      const app = window.v3dApp;
      if (!app?.scene || !window.v3d) {
        raf = requestAnimationFrame(tryInit);
        return;
      }
      init(app);
    }

    function init(app) {
      const v3d = window.v3d;

      // 每30帧共享障碍物缓存（所有标注共用）
      let occluderCache = null;
      let occluderFrame = 0;
      let sharedUUIDs   = new Set();

      function refreshOccluders() {
        sharedUUIDs.clear();
        groupsRef.current.forEach(g => g && g.traverse(o => sharedUUIDs.add(o.uuid)));
        occluderCache = [];
        app.scene.traverse(obj => {
          if (
            obj.isMesh &&
            obj.visible &&
            !sharedUUIDs.has(obj.uuid) &&
            !TABLE_EXCLUDE.has(obj.name)
          ) {
            occluderCache.push(obj);
          }
        });
      }

      const raycaster = new v3d.Raycaster();

      function checkOcclusion(camPos, la, lb) {
        const pts = [
          la.clone(),
          la.clone().lerp(lb, 0.25),
          la.clone().lerp(lb, 0.5),
          la.clone().lerp(lb, 0.75),
          lb.clone(),
        ];
        for (const pt of pts) {
          const dir  = new v3d.Vector3().subVectors(pt, camPos);
          const dist = dir.length();
          raycaster.set(camPos, dir.normalize());
          raycaster.near = 0.1;
          raycaster.far  = dist - 0.5;
          if (raycaster.intersectObjects(occluderCache, false).length > 0) return true;
        }
        return false;
      }

      // 法线向量（共享）

      // ── 为每条标注配置创建独立的 Group ──
      const ticks = ANNOTATIONS.map((cfg, idx) => {
        // ── Group ──
        const group = new v3d.Group();
        group.name = `__dim_annotation_${idx}__`;
        group._targetOpacity  = visibleRef.current ? 1 : 0;
        group._currentOpacity = visibleRef.current ? 1 : 0;
        group.visible = visibleRef.current;
        groupsRef.current[idx] = group;
        app.scene.add(group);

        // Layer 2：只在主相机渲染，不被 CubeCamera（默认 layer 0）捕捉 → 不出现在反射里
        group.layers.set(2);
        group.traverse(o => o.layers.set(2));

        // ── 统一设置 opacity ──
        function setGroupOpacity(opacity) {
          group._currentOpacity = opacity;
          group.traverse(obj => {
            if (obj.material) {
              const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
              mats.forEach(m => {
                m.opacity = opacity;
                m.transparent = true;
                m.needsUpdate = true;
              });
            }
          });
          group.visible = opacity > 0.001;
        }

        // ── 虚线材质 ──
        const dashMat = new v3d.LineDashedMaterial({
          color: 0xe8e8e8,
          opacity: group._currentOpacity,
          transparent: true,
          depthTest: false,
          dashSize: 2.4,
          gapSize: 1.2,
          linewidth: 2,
          toneMapped: false,
        });

        // ── 箭头材质：ShaderMaterial ──
        const arrowMat = new v3d.ShaderMaterial({
          uniforms: { uOpacity: { value: group._currentOpacity } },
          vertexShader:   `void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
          fragmentShader: `uniform float uOpacity; void main() { gl_FragColor = vec4(0.9,0.9,0.9,uOpacity); }`,
          side: v3d.DoubleSide,
          depthTest: false,
          depthWrite: false,
          transparent: true,
        });

        // ── 虚线 ──
        const dimGeo  = new v3d.BufferGeometry().setFromPoints([new v3d.Vector3(), new v3d.Vector3()]);
        const dimLine = new v3d.Line(dimGeo, dashMat);
        dimLine.renderOrder = 999;
        group.add(dimLine);

        // ── 箭头 ──
        function makeTriGeo() {
          const geo = new v3d.BufferGeometry();
          geo.setAttribute('position', new v3d.BufferAttribute(new Float32Array(9), 3));
          return geo;
        }
        const arrowLGeo  = makeTriGeo();
        const arrowRGeo  = makeTriGeo();
        const arrowLMesh = new v3d.Mesh(arrowLGeo, arrowMat);
        const arrowRMesh = new v3d.Mesh(arrowRGeo, arrowMat);
        arrowLMesh.renderOrder = 999; arrowLMesh.frustumCulled = false;
        arrowRMesh.renderOrder = 999; arrowRMesh.frustumCulled = false;
        group.add(arrowLMesh, arrowRMesh);

        function updateTriangle(geo, tip, axisDir, aw, al) {
          let sideDir = new v3d.Vector3(0, 1, 0);
          if (Math.abs(axisDir.dot(sideDir)) > 0.99) sideDir = new v3d.Vector3(0, 0, 1);
          const base = tip.clone().addScaledVector(axisDir, -al);
          const v0 = tip;
          const v1 = base.clone().addScaledVector(sideDir,  aw);
          const v2 = base.clone().addScaledVector(sideDir, -aw);
          const pos = geo.attributes.position;
          pos.setXYZ(0, v0.x, v0.y, v0.z);
          pos.setXYZ(1, v1.x, v1.y, v1.z);
          pos.setXYZ(2, v2.x, v2.y, v2.z);
          pos.needsUpdate = true;
          geo.computeBoundingSphere();
        }

        function updateLine(geo, p1, p2) {
          const pos = geo.attributes.position;
          pos.setXYZ(0, p1.x, p1.y, p1.z);
          pos.setXYZ(1, p2.x, p2.y, p2.z);
          pos.needsUpdate = true;
        }

        // ── Sprite ──
        const labelCanvas = document.createElement('canvas');
        labelCanvas.width = 256; labelCanvas.height = 64;
        const ctx = labelCanvas.getContext('2d');
        const tex = new v3d.CanvasTexture(labelCanvas);
        const spriteMat = new v3d.SpriteMaterial({
          map: tex,
          depthTest: false,
          transparent: true,
          opacity: group._currentOpacity,
          toneMapped: false,
        });
        const sprite = new v3d.Sprite(spriteMat);
        sprite.renderOrder = 999;
        sprite.scale.set(12, 3, 1);
        group.add(sprite);

        // 所有子对象挂载完后统一设置 layer 2
        group.traverse(o => o.layers.set(2));

        function drawLabel(text) {
          ctx.clearRect(0, 0, 256, 64);
          ctx.font = 'bold 20px Rajdhani, Inter, monospace';
          const bw = ctx.measureText(text).width + 28;
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          ctx.beginPath();
          ctx.roundRect(128 - bw / 2, 14, bw, 36, 6);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.98)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(text, 128, 32);
          tex.needsUpdate = true;
        }

        // 固定标签预先绘制
        if (cfg.label) drawLabel(cfg.label);

        // ── 返回该标注的 tick 函数 ──
        const aw = cfg.arrowW ?? ARROW_W;
        const al = cfg.arrowL ?? ARROW_L;

        // ── 对象池：预分配复用对象，避免每帧创建临时 Vector3 ──
        const la = new v3d.Vector3();
        const lb = new v3d.Vector3();
        const dirLR = new v3d.Vector3();
        const dirRL = new v3d.Vector3();
        const laInner = new v3d.Vector3();
        const lbInner = new v3d.Vector3();
        const mid = new v3d.Vector3();
        const toCam = new v3d.Vector3();
        const up = new v3d.Vector3(0, 1, 0);
        const zAxis = new v3d.Vector3(0, 0, 1);
        const lineNormal = new v3d.Vector3();
        const laTip = new v3d.Vector3();
        const lbTip = new v3d.Vector3();

        return function tick(delta, camPos, shouldShowBase) {
          const dA = app.scene.getObjectByName(cfg.dummyA);
          const dB = app.scene.getObjectByName(cfg.dummyB);
          if (!dA || !dB) return;

          dA.getWorldPosition(la);
          dB.getWorldPosition(lb);

          dirLR.subVectors(lb, la).normalize();
          dirRL.copy(dirLR).negate();

          // 更新几何
          laInner.copy(la).addScaledVector(dirLR, al);
          lbInner.copy(lb).addScaledVector(dirRL, al);
          updateLine(dimGeo, laInner, lbInner);
          dimLine.computeLineDistances();

          laTip.copy(la);
          lbTip.copy(lb);
          updateTriangle(arrowLGeo, laTip, dirRL, aw, al);
          updateTriangle(arrowRGeo, lbTip, dirLR, aw, al);

          mid.copy(la).lerp(lb, 0.5);
          sprite.position.copy(mid);
          sprite.position.y += 4;

          // 动态 label：每帧从 heightTRef 读取当前高度（cm）并重绘
          if (cfg.dynamic) {
            const t = heightTRef.current ?? 0.5;
            const cm = Math.round(68 + t * 52);
            drawLabel(cm + 'mm');
          }

          // ── 判断是否应显示 ──
          let shouldShow = shouldShowBase;

          if (shouldShow) {
            // 1. 法线朝向检测
            toCam.subVectors(camPos, mid).normalize();

            // 若标注线近似垂直（Y方向），用 Z 轴替代
            if (Math.abs(dirLR.dot(up)) > 0.99) {
              lineNormal.crossVectors(dirLR, zAxis).normalize();
            } else {
              lineNormal.crossVectors(dirLR, up).normalize();
            }

            const dot1 = toCam.dot(lineNormal);
            const dot2 = -dot1;
            if (Math.abs(dot1) < 0.08 && Math.abs(dot2) < 0.08) shouldShow = false;

            // 2. 遮挡检测
            if (shouldShow) {
              if (checkOcclusion(camPos, la, lb)) shouldShow = false;
            }
          }

          // ── 平滑淡入淡出 ──
          group._targetOpacity = shouldShow ? 1 : 0;
          const curr   = group._currentOpacity;
          const target = group._targetOpacity;
          if (Math.abs(curr - target) > 0.001) {
            const step = (delta / FADE_DURATION) * (target > curr ? 1 : -1);
            const next = Math.max(0, Math.min(1, curr + step));
            setGroupOpacity(next);
            arrowMat.uniforms.uOpacity.value = next;
          } else if (curr !== target) {
            setGroupOpacity(target);
            arrowMat.uniforms.uOpacity.value = target;
          }
        };
      });

      // ── 主 renderCallback ──
      function masterTick(delta) {
        // 每30帧刷新障碍物缓存（所有标注共用）
        occluderFrame++;
        if (!occluderCache || occluderFrame % 30 === 0) refreshOccluders();

        const cam    = app.camera;
        const camPos = new v3d.Vector3();
        cam.getWorldPosition(camPos);

        const shouldShowBase = visibleRef.current;

        ticks.forEach(tick => tick(delta, camPos, shouldShowBase));
      }

      if (app.renderCallbacks) app.renderCallbacks.push(masterTick);
      masterTick(0.016);
    }

    tryInit();

    return () => {
      const app = window.v3dApp;
      // 清理 renderCallback 泄漏：从 app.renderCallbacks 中移除 masterTick
      if (app?.renderCallbacks) {
        const idx = app.renderCallbacks.indexOf(masterTick);
        if (idx !== -1) app.renderCallbacks.splice(idx, 1);
      }
      // 清理场景对象
      if (app?.scene) {
        groupsRef.current.forEach(g => {
          if (g) app.scene.remove(g);
        });
        groupsRef.current = [];
      }
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return null;
}
