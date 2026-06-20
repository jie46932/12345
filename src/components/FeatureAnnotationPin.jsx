/**
 * FeatureAnnotationPin — 特性圆形图钉
 *
 * 锚定在 3D 世界坐标，点击展开/收起气泡弹窗。
 * 从 zustand store 读取 threeCamera/threeScene 进行投影，
 * 从 featPositions/featStyles 读取坐标和样式。
 *
 * 锚点策略（Dummy034-038）：
 *   原 Verge3D 场景中 Dummy034-038 是 3ds Max 中放置的定位辅助点，
 *   glTF 导出后部分 Dummy 作为空 Helper 被 Verge3D 过滤（无动画的 Helper），
 *   因此此处改用"父节点名称 + 局部坐标"的方式计算世界位置。
 *
 *   各标注锚定：
 *     Dummy034: Rectangle006 子节点 → parentName:'Rectangle006', local: [-2.353, 20.243, -2.524]
 *     Dummy035: 根节点              → world:  [-32.555, 9.411, 4.822]
 *     Dummy036: Rectangle006 子节点 → parentName:'Rectangle006', local: [-12.706, -1.607, -2.524]
 *     Dummy037: 组008 子节点        → world:  [5.027, 13.162, 4.092]（已展平为世界坐标）
 *     Dummy038: 根节点              → world:  [10.497, 25.249, 19.495]
 *
 * 验证（3ds Max 2026-05-21）：
 *   Dummy037 实际为 组008 子节点，Max 坐标 [5.027, -4.092, 13.162]，
 *   Y-up 转换后世界坐标 [5.027, 13.162, 4.092]。
 *   注：组008 是 Rectangle006 子节点，但已展平为世界坐标以兼容 R3F。
 */
import { useState, useEffect, useRef, useContext } from 'react';
import { Tag } from 'lucide-react';
import * as THREE from 'three';
import useStore from '../store/useStore';
import { LangContext } from '../LangContext';

const FEATURE_ANNOTATIONS = [
  { parentName: 'Rectangle006', localPos: [-2.353000, 20.243000, -2.524000], lines: ['FAS级3CM橡胶木100%全实木更耐用', '环保嘉宝莉水性漆多层高规格防刮保护涂装'], linesEn: ['FAS Grade 3cm Solid Rubber Wood', 'Eco Water-Based Paint - Multi-Layer Anti-Scratch'] },
  { parentName: null,            localPos: [-32.555000, 9.411000, 4.822000],  lines: ['升级冷轧桌腿加粗加宽加厚', '多重框架升级静态承重可达600斤'], linesEn: ['Upgraded Cold-Rolled Legs - Wider & Thicker', 'Multi-Frame Design - Load Capacity 600 Jin'] },
  { parentName: 'Rectangle006', localPos: [-12.706000, -1.607000, -2.524000], lines: ['加宽斜坡设计贴合手腕不酸痛', 'CHAO大圆边设计安全防磕碰'], linesEn: ['Wide Slope Ergonomic Wrist Support', 'CHAO Large Rounded Edge - Anti-Bump'] },
  { parentName: null,            localPos: [5.027000, 13.162000, 4.092000],   lines: ['睡眠级消声电机德国降噪科技', '标杆级电机CQC品牌认证澎湃性能'], linesEn: ['Sleep-Grade Silent Motor - German Tech', 'CQC Certified Motor - Powerful & Reliable'] },
  { parentName: null,            localPos: [10.497000, 25.249000, 19.495000], lines: ['数显控制器灵活操作不延时', '智能久坐提醒站坐交替更健康'], linesEn: ['Digital Display Controller - Responsive', 'Smart Sedentary Alert - Sit-Stand for Health'] },
];

function getConfiguredLines(annotation, fallbackLines) {
  if (typeof annotation !== 'string' || !annotation.trim()) return fallbackLines;
  const lines = annotation
    .split(/\r?\n|，|。/)
    .map((line) => line.trim())
    .filter(Boolean);
  return [lines[0] || annotation.trim(), lines.slice(1).join('，') || ''];
}

export default function FeatureAnnotationPin({ visible = true }) {
  const lang = useContext(LangContext);
  const [expanded, setExpanded] = useState(null);
  const featStyles = useStore((s) => s.featStyles);
  const projectAnnotations = useStore((s) => s.projectConfig.annotations);
  const pinRefs = useRef([]);
  const rafRef = useRef(null);
  const visibleRef = useRef(visible);

  useEffect(() => { visibleRef.current = visible; }, [visible]);

  // 点击空白区域关闭展开的标注
  useEffect(() => {
    if (expanded === null) return;
    const onPointerDown = (e) => {
      const container = pinRefs.current[expanded];
      if (container && !container.contains(e.target)) {
        setExpanded(null);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [expanded]);

  // rAF 循环：3D → 屏幕投影，直接操作 DOM style
  useEffect(() => {
    let occluderCache = null;
    let occluderFrame = 0;
    let _raycaster = null;
    let _camPos = null;
    let _dir = null;

    function tryInit() {
      const camera = useStore.getState().threeCamera;
      const scene = useStore.getState().threeScene;
      if (!camera || !scene) {
        rafRef.current = requestAnimationFrame(tryInit);
        return;
      }
      loop();
    }

    function loop() {
      const camera = useStore.getState().threeCamera;
      const scene = useStore.getState().threeScene;
      const renderer = useStore.getState().threeRenderer;
      if (!camera || !scene) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const canvas = renderer?.domElement;
      if (!canvas) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      const rect = canvas.getBoundingClientRect();

      if (!_raycaster) {
        _raycaster = new THREE.Raycaster();
        _camPos = new THREE.Vector3();
        _dir = new THREE.Vector3();
      }

      occluderFrame++;
      if (!occluderCache || occluderFrame % 30 === 0) {
        occluderCache = [];
        // 收集所有可见 mesh 作为遮挡候选（不做全局排除，改为逐 Pin 剔除自身父节点）
        scene.traverse((obj) => {
          if (obj.isMesh && obj.visible && !obj.name?.startsWith('__dim')) {
            occluderCache.push(obj);
          }
        });
      }
      camera.getWorldPosition(_camPos);

      // 从 store 读取当前坐标覆盖
      const featPositions = useStore.getState().featPositions;

      FEATURE_ANNOTATIONS.forEach((cfg, idx) => {
        const el = pinRefs.current[idx];
        if (!el) return;
        if (!visibleRef.current) { el.style.display = 'none'; return; }

        const overridePos = featPositions?.[idx];
        const lv = overridePos
          ? new THREE.Vector3(overridePos[0], overridePos[1], overridePos[2])
          : new THREE.Vector3(...cfg.localPos);

        let worldPos;
        if (cfg.parentName) {
          const par = scene.getObjectByName(cfg.parentName);
          if (!par) { el.style.display = 'none'; return; }
          par.updateWorldMatrix(true, false);
          worldPos = lv.clone().applyMatrix4(par.matrixWorld);
        } else {
          worldPos = lv.clone();
        }

        // 遮挡检测：逐 Pin 剔除自身父节点，避免被自身锚定平面遮挡
        // 非父子关系的 mesh（如桌板 Rectangle006）对其他 Pin 正常参与遮挡
        let pinOccluders = occluderCache;
        if (cfg.parentName) {
          pinOccluders = occluderCache.filter(m => {
            if (m.name === cfg.parentName) return false;
            let p = m.parent;
            while (p) {
              if (p.name === cfg.parentName) return false;
              p = p.parent;
            }
            return true;
          });
        }
        _dir.subVectors(worldPos, _camPos);
        const dist = _dir.length();
        const OCCLUSION_TOLERANCE = 2.0;
        _raycaster.set(_camPos, _dir.normalize());
        _raycaster.near = 0.1;
        _raycaster.far = dist;
        const hits = _raycaster.intersectObjects(pinOccluders, false);
        if (hits.length > 0 && hits[0].distance < dist - OCCLUSION_TOLERANCE) {
          el.style.display = 'none';
          return;
        }

        // NDC 投影
        const ndc = worldPos.clone().project(camera);
        if (ndc.z > 1) { el.style.display = 'none'; return; }

        const x = rect.left + (ndc.x * 0.5 + 0.5) * rect.width;
        const y = rect.top + (-ndc.y * 0.5 + 0.5) * rect.height;

        el.style.display = '';
        el.style.left = x + 'px';
        el.style.top = y + 'px';
      });

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(tryInit);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <>
      {FEATURE_ANNOTATIONS.map((cfg, idx) => {
        const isOpen = expanded === idx;
        const ov = featStyles[idx] || {};
        const textLines = lang === 'en'
          ? (cfg.linesEn || cfg.lines)
          : getConfiguredLines(projectAnnotations?.[idx], cfg.lines);
        const line0 = ov.line0 || textLines[0];
        const line1 = ov.line1 || textLines[1];
        const color0 = ov.color0 ?? '#ffffff';
        const color1 = ov.color1 ?? '#ffffff';
        const size0 = ov.size0 ?? 18;
        const size1 = ov.size1 ?? 18;
        const bold0 = ov.bold0 ?? false;
        const bold1 = ov.bold1 ?? false;
        const bgColor = ov.bgColor ?? '#000000';
        const bgAlpha = ov.bgAlpha ?? 0.62;
        const bgW = ov.bgW ?? 330;
        const bgH = ov.bgH ?? 125;
        const _bgR = parseInt(bgColor.slice(1, 3), 16) || 0;
        const _bgG = parseInt(bgColor.slice(3, 5), 16) || 0;
        const _bgB = parseInt(bgColor.slice(5, 7), 16) || 0;
        const bgRgba = `rgba(${_bgR},${_bgG},${_bgB},${bgAlpha})`;

        return (
          <div
            key={idx}
            ref={(el) => { pinRefs.current[idx] = el; }}
            style={{
              position: 'fixed',
              display: visible ? '' : 'none',
              transform: 'translate(-50%, -50%)',
              zIndex: 110,
              pointerEvents: 'auto',
            }}
          >
            <button
              onClick={() => setExpanded(isOpen ? null : idx)}
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: isOpen ? 'rgba(20,22,32,0.96)' : 'rgba(15,17,26,0.82)',
                border: '2px solid rgba(255,255,255,0.85)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                boxShadow: isOpen
                  ? '0 0 20px rgba(255,255,255,0.35), inset 0 1px 0 rgba(255,255,255,0.15)'
                  : '0 0 10px rgba(255,255,255,0.12), inset 0 1px 0 rgba(255,255,255,0.08)',
                transition: 'box-shadow 0.2s, background 0.2s',
                outline: 'none',
                padding: 0,
              }}
            >
              <Tag size={16} strokeWidth={2.2} />
            </button>

            {isOpen && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 46,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: bgRgba,
                  backdropFilter: 'blur(18px)',
                  WebkitBackdropFilter: 'blur(18px)',
                  border: '1px solid rgba(255,255,255,0.22)',
                  borderRadius: 10,
                  width: bgW,
                  height: bgH,
                  boxSizing: 'border-box',
                  boxShadow: '0 6px 28px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)',
                  pointerEvents: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  padding: '0 14px 0 22px',
                }}
              >
                <div style={{
                  position: 'absolute',
                  left: 8,
                  top: 10,
                  bottom: 10,
                  width: 3,
                  borderRadius: 2,
                  background: 'rgba(255,255,255,0.75)',
                }} />

                <div style={{
                  fontSize: size0,
                  fontWeight: bold0 ? 700 : 400,
                  color: color0,
                  fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
                  marginBottom: 3,
                  lineHeight: 1.4,
                }}>
                  {line0}
                </div>
                <div style={{
                  fontSize: size1,
                  fontWeight: bold1 ? 700 : 400,
                  color: color1,
                  fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
                  lineHeight: 1.45,
                }}>
                  {line1}
                </div>

                <div style={{
                  position: 'absolute',
                  bottom: -7,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 0,
                  height: 0,
                  borderLeft: '7px solid transparent',
                  borderRight: '7px solid transparent',
                  borderTop: '7px solid rgba(255,255,255,0.22)',
                }} />
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
