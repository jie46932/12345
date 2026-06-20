/**
 * DimensionAnnotation — 3D 尺寸标注
 *
 * 每条标注由两个 Dummy 锚点定义，创建 3D 场景内的虚线 + 箭头三角形。
 * HTML 文本标签通过 3D→2D 投影定位。
 *
 * R3F 版本：从 zustand store 读取 camera/scene，使用 rAF 驱动 tick。
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import useStore from '../store/useStore';

const ARROW_W = 0.48;
const ARROW_L = 1.12;
const ARROW_W_SM = 0.24;
const ARROW_L_SM = 0.56;
const ARROW_W_XS = 0.21;
const ARROW_L_XS = 0.42;
const FADE_DURATION = 0.2;

// 排除规则：标注检测时自动排除属于桌子本体的所有mesh
function isTablePart(name) {
  if (!name) return false;
  // 仅排除明确标记为非遮挡体的桌面部件，不排除所有 Rectangle*
  return name.startsWith('fsdfsd');
}

const ANNOTATIONS = [
  { dummyA: 'Dummy019', dummyB: 'Dummy020', label: '140cm' },
  { dummyA: 'Dummy021', dummyB: 'Dummy022', label: '2.5cm', arrowW: ARROW_W_SM, arrowL: ARROW_L_SM },
  { dummyA: 'Dummy023', dummyB: 'Dummy024', label: '70cm' },
  { dummyA: 'Dummy025', dummyB: 'Dummy026', dynamic: true },
  { dummyA: 'Dummy027', dummyB: 'Dummy028', label: '1.5cm', arrowW: ARROW_W_XS, arrowL: ARROW_L_XS },
  { dummyA: 'Dummy029', dummyB: 'Dummy030', label: '110cm' },
  { dummyA: 'Dummy031', dummyB: 'Dummy032', label: '21cm', arrowW: ARROW_W_SM, arrowL: ARROW_L_SM },
];

function setDimensionGroupOpacity(group, opacity) {
  if (!group) return;
  group._currentOpacity = opacity;
  group._targetOpacity = opacity;
  group.visible = opacity > 0.001;
  group.traverse((obj) => {
    if (!obj.material) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach((m) => {
      m.opacity = opacity;
      m.transparent = true;
      if (m.isShaderMaterial && m.uniforms?.uOpacity) {
        m.uniforms.uOpacity.value = opacity;
      }
      m.needsUpdate = true;
    });
  });
}

export default function DimensionAnnotation({ visible = true, heightT = 0.5 }) {
  const groupsRef = useRef([]);
  const visibleRef = useRef(visible);
  const heightTRef = useRef(heightT);
  const rafRef = useRef(null);
  const labelDivRefs = useRef(ANNOTATIONS.map(() => null));
  const cleanupRef = useRef(null);
  const dimStyle = useStore((s) => s.dimStyle);
  const dimStyleRef = useRef(dimStyle);
  dimStyleRef.current = dimStyle;

  useEffect(() => {
    visibleRef.current = visible;
    const opacity = visible ? 1 : 0;
    groupsRef.current.forEach((group) => {
      setDimensionGroupOpacity(group, opacity);
    });
    labelDivRefs.current.forEach((labelDiv) => {
      if (labelDiv) {
        labelDiv.style.opacity = String(opacity);
        labelDiv.style.display = visible ? 'block' : 'none';
      }
    });
  }, [visible]);
  useEffect(() => { heightTRef.current = heightT; }, [heightT]);

  // 同步 dimStyle 颜色到 3D 线条材质
  useEffect(() => {
    const hexColor = new THREE.Color(dimStyle.lineColor);
    groupsRef.current.forEach((g) => {
      if (!g) return;
      g.traverse((obj) => {
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => {
            if (m.isLineDashedMaterial) {
              m.color.copy(hexColor);
              m.needsUpdate = true;
            }
            if (m.isShaderMaterial && m.uniforms?.uColor) {
              m.uniforms.uColor.value.copy(hexColor);
            }
          });
        }
      });
    });
  }, [dimStyle.lineColor]);

  useEffect(() => {
    let occluderCache = null;
    let occluderFrame = 0;
    let lastTime = 0;

    function tryInit() {
      const camera = useStore.getState().threeCamera;
      const scene = useStore.getState().threeScene;
      if (!camera || !scene) {
        rafRef.current = requestAnimationFrame(tryInit);
        return;
      }
      init(scene, camera);
    }

    function init(scene, camera) {
      let sharedUUIDs = new Set();
      let groups = [];

      function refreshOccluders() {
        sharedUUIDs.clear();
        groupsRef.current.forEach((g) => g && g.traverse((o) => sharedUUIDs.add(o.uuid)));
        occluderCache = [];
        scene.traverse((obj) => {
          if (obj.isMesh && obj.visible && !sharedUUIDs.has(obj.uuid) && !isTablePart(obj.name)) {
            occluderCache.push(obj);
          }
        });
      }

      const raycaster = new THREE.Raycaster();

      const _pts = [
        new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(),
        new THREE.Vector3(), new THREE.Vector3(),
      ];
      const _dir = new THREE.Vector3();
      const _projVec = new THREE.Vector3();

      function checkOcclusion(camPos, la, lb) {
        // 只检测中点（标签位置），3个检测点需要全部被遮挡才判定为遮挡
        _pts[0].copy(la).lerp(lb, 0.3);
        _pts[1].copy(la).lerp(lb, 0.5);
        _pts[2].copy(la).lerp(lb, 0.7);
        let occludedCount = 0;
        for (const pt of _pts) {
          _dir.subVectors(pt, camPos);
          const dist = _dir.length();
          raycaster.set(camPos, _dir.normalize());
          raycaster.near = 0.1;
          raycaster.far = dist - 0.5;
          if (raycaster.intersectObjects(occluderCache, false).length > 0) occludedCount++;
        }
        return occludedCount >= 3;
      }

      // ── 创建每条标注的 3D Group ──
      groups = ANNOTATIONS.map((cfg, idx) => {
        const group = new THREE.Group();
        group.name = `__dim_annotation_${idx}__`;
        group._targetOpacity = visibleRef.current ? 1 : 0;
        group._currentOpacity = visibleRef.current ? 1 : 0;
        group.visible = visibleRef.current;
        groupsRef.current[idx] = group;
        scene.add(group);

        const dashMat = new THREE.LineDashedMaterial({
          color: 0xe8e8e8, opacity: group._currentOpacity, transparent: true,
          depthTest: false, dashSize: 2.4, gapSize: 1.2, linewidth: 2, toneMapped: false,
        });

        const arrowMat = new THREE.ShaderMaterial({
          uniforms: { uOpacity: { value: group._currentOpacity }, uColor: { value: new THREE.Color('#e8e8e8') } },
          vertexShader: `void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
          fragmentShader: `uniform float uOpacity; uniform vec3 uColor; void main() { gl_FragColor = vec4(uColor,uOpacity); }`,
          side: THREE.DoubleSide, depthTest: false, depthWrite: false, transparent: true,
        });

        const dimGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
        const dimLine = new THREE.Line(dimGeo, dashMat);
        dimLine.renderOrder = 999;
        group.add(dimLine);

        function makeTriGeo() {
          const geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
          return geo;
        }
        const arrowLGeo = makeTriGeo();
        const arrowRGeo = makeTriGeo();
        const arrowLMesh = new THREE.Mesh(arrowLGeo, arrowMat);
        const arrowRMesh = new THREE.Mesh(arrowRGeo, arrowMat);
        arrowLMesh.renderOrder = 999;
        arrowLMesh.frustumCulled = false;
        arrowRMesh.renderOrder = 999;
        arrowRMesh.frustumCulled = false;
        group.add(arrowLMesh, arrowRMesh);

        function updateTriangle(geo, tip, axisDir, aw, al) {
          let sideDir = new THREE.Vector3(0, 1, 0);
          if (Math.abs(axisDir.dot(sideDir)) > 0.99) sideDir = new THREE.Vector3(0, 0, 1);
          const base = tip.clone().addScaledVector(axisDir, -al);
          const pos = geo.attributes.position;
          pos.setXYZ(0, tip.x, tip.y, tip.z);
          pos.setXYZ(1, base.x + sideDir.x * aw, base.y + sideDir.y * aw, base.z + sideDir.z * aw);
          pos.setXYZ(2, base.x - sideDir.x * aw, base.y - sideDir.y * aw, base.z - sideDir.z * aw);
          pos.needsUpdate = true;
          geo.computeBoundingSphere();
        }

        function updateLine(geo, p1, p2) {
          const pos = geo.attributes.position;
          pos.setXYZ(0, p1.x, p1.y, p1.z);
          pos.setXYZ(1, p2.x, p2.y, p2.z);
          pos.needsUpdate = true;
        }

        const la = new THREE.Vector3(), lb = new THREE.Vector3();
        const dirLR = new THREE.Vector3(), dirRL = new THREE.Vector3();
        const laInner = new THREE.Vector3(), lbInner = new THREE.Vector3();
        const mid = new THREE.Vector3(), toCam = new THREE.Vector3();
        const up = new THREE.Vector3(0, 1, 0), zAxis = new THREE.Vector3(0, 0, 1);
        const lineNormal = new THREE.Vector3();
        const laTip = new THREE.Vector3(), lbTip = new THREE.Vector3();

        const aw = cfg.arrowW ?? ARROW_W;
        const al = cfg.arrowL ?? ARROW_L;
        let lastDynamicCm = -1;

        return function tick(delta, camPos, shouldShowBase) {
          const dA = scene.getObjectByName(cfg.dummyA);
          const dB = scene.getObjectByName(cfg.dummyB);
          if (!dA || !dB) return;

          dA.getWorldPosition(la);
          dB.getWorldPosition(lb);
          dirLR.subVectors(lb, la).normalize();
          dirRL.copy(dirLR).negate();

          laInner.copy(la).addScaledVector(dirLR, al);
          lbInner.copy(lb).addScaledVector(dirRL, al);
          updateLine(dimGeo, laInner, lbInner);
          dimLine.computeLineDistances();

          laTip.copy(la);
          lbTip.copy(lb);
          updateTriangle(arrowLGeo, laTip, dirRL, aw, al);
          updateTriangle(arrowRGeo, lbTip, dirLR, aw, al);

          mid.copy(la).lerp(lb, 0.5);

          // HTML 标签
          const labelDiv = labelDivRefs.current[idx];
          let labelBehind = false;
          if (labelDiv) {
            if (cfg.dynamic) {
              const t = heightTRef.current ?? 0.5;
              const cm = Math.round(68 + t * 52);
              if (cm !== lastDynamicCm) { lastDynamicCm = cm; labelDiv.textContent = cm + 'cm'; }
            }

            _projVec.copy(mid);
            _projVec.y += 4;
            _projVec.project(camera);

            labelBehind = _projVec.z > 1;
            const canvas = useStore.getState().threeRenderer?.domElement;
            const cw = canvas ? canvas.clientWidth : window.innerWidth;
            const ch = canvas ? canvas.clientHeight : window.innerHeight;
            labelDiv.style.left = ((_projVec.x * 0.5 + 0.5) * cw) + 'px';
            labelDiv.style.top = ((_projVec.y * -0.5 + 0.5) * ch) + 'px';

            const dist = mid.distanceTo(camPos);
            const _minD = 30, _maxD = 280;
            const _tDist = Math.max(0, Math.min(1, (dist - _minD) / (_maxD - _minD)));
            const _fs = Math.round(14 - _tDist * 4);
            labelDiv.style.fontSize = _fs + 'px';
            if (labelBehind) {
              labelDiv.style.opacity = '0';
              labelDiv.style.display = 'none';
            } else {
              labelDiv.style.display = shouldShowBase ? 'block' : 'none';
            }
          }

          let shouldShow = shouldShowBase;
          if (shouldShow) {
            toCam.subVectors(camPos, mid).normalize();
            // 平滑选择更稳定的线法线方向（避免 0.99 硬阈值导致的跳变）
            const nUp = new THREE.Vector3().crossVectors(dirLR, up);
            const nZ = new THREE.Vector3().crossVectors(dirLR, zAxis);
            lineNormal.copy(nUp.lengthSq() > nZ.lengthSq() ? nUp : nZ).normalize();
            const dot1 = toCam.dot(lineNormal);
            if (Math.abs(dot1) < 0.08) shouldShow = false;
            if (shouldShow && checkOcclusion(camPos, la, lb)) shouldShow = false;
          }

          group._targetOpacity = shouldShow ? 1 : 0;
          const curr = group._currentOpacity;
          const target = group._targetOpacity;
          if (Math.abs(curr - target) > 0.001) {
            const step = (delta / FADE_DURATION) * (target > curr ? 1 : -1);
            const next = Math.max(0, Math.min(1, curr + step));
            setDimensionGroupOpacity(group, next);
            arrowMat.uniforms.uOpacity.value = next;
            if (labelDiv && !labelBehind) {
              labelDiv.style.opacity = next.toFixed(3);
              labelDiv.style.display = next > 0.001 ? 'block' : 'none';
            }
          } else if (curr !== target) {
            setDimensionGroupOpacity(group, target);
            arrowMat.uniforms.uOpacity.value = target;
            if (labelDiv && !labelBehind) {
              labelDiv.style.opacity = String(target);
              labelDiv.style.display = target > 0.001 ? 'block' : 'none';
            }
          }
          // 始终同步标签透明度（修复首次tick时不更新的问题）
          if (labelDiv && !labelBehind && Math.abs(curr - target) <= 0.001 && curr === target) {
            labelDiv.style.opacity = String(group._currentOpacity);
            labelDiv.style.display = group._currentOpacity > 0.001 ? 'block' : 'none';
          }
        };
      });

      // ── 主循环 ──
      const _camPos = new THREE.Vector3();

      function masterTick(timestamp) {
        const camera = useStore.getState().threeCamera;
        const scene = useStore.getState().threeScene;
        if (!camera || !scene) {
          rafRef.current = requestAnimationFrame(masterTick);
          return;
        }

        // 计算 delta
        const delta = lastTime ? Math.min((timestamp - lastTime) / 1000, 0.05) : 0.016;
        lastTime = timestamp;

        occluderFrame++;
        if (!occluderCache || occluderFrame % 30 === 0) refreshOccluders();
        camera.getWorldPosition(_camPos);
        const shouldShowBase = visibleRef.current;
        groups.forEach((tick) => tick && tick(delta, _camPos, shouldShowBase));

        rafRef.current = requestAnimationFrame(masterTick);
      }

      // 第一次 tick（初始化）
      rafRef.current = requestAnimationFrame(masterTick);

      // 保存 cleanup 函数
      cleanupRef.current = () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        groupsRef.current.forEach((g) => {
          if (g) scene.remove(g);
        });
        groupsRef.current = [];
      };
    }

    rafRef.current = requestAnimationFrame(tryInit);

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      } else if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 15 }}>
      {ANNOTATIONS.map((cfg, idx) => (
        <div
          key={idx}
          ref={(el) => { labelDivRefs.current[idx] = el; }}
          style={{
            position: 'absolute',
            transform: 'translate(-50%, -50%)',
            background: `rgba(${parseInt(dimStyle.bgColor.slice(1,3),16)},${parseInt(dimStyle.bgColor.slice(3,5),16)},${parseInt(dimStyle.bgColor.slice(5,7),16)},${dimStyle.bgAlpha})`,
            color: dimStyle.textColor,
            borderRadius: 8,
            padding: '5px 16px',
            fontSize: dimStyle.fontSize,
            fontFamily: "'Rajdhani', 'Inter', sans-serif",
            fontWeight: 700,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            opacity: 0,
            willChange: 'left, top, opacity',
            letterSpacing: '0.5px',
          }}
        >
          {cfg.dynamic ? '' : (cfg.label || '')}
        </div>
      ))}
    </div>
  );
}
