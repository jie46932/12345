// 产品特性气泡标注：每条标注锚定于场景中的父节点 + 局部偏移坐标
// 支持遮挡检测（被物体挡住时隐藏，同 DimensionAnnotation）
// 受外部 visible prop 控制，与尺寸按钮共用同一开关
//
// 锚点策略：Dummy034-038 被 Verge3D 过滤（无动画的空 Helper），
// 改为用父节点 + GLTF 局部坐标直接计算世界位置：
//   Dummy034: Rectangle006 子节点，局部坐标 [-2.353, 20.243, -2.524]
//   Dummy035: 根节点，世界坐标 [-32.555, 9.411, 4.822]
//   Dummy036: Rectangle006 子节点，局部坐标 [-12.706, -1.607, -2.524]
//   Dummy037: 组008 子节点（组008 是 Rectangle006 子），局部坐标 [7.142, -0.950, -0.310]
//   Dummy038: 根节点，世界坐标 [10.497, 25.249, 19.495]

import { useEffect, useRef } from 'react';

const FADE_DURATION = 0.2; // 秒

// 被遮挡检测排除的网格（与 DimensionAnnotation 保持一致）
const TABLE_EXCLUDE = new Set([
  'Rectangle006', 'Rectangle005', 'Rectangle004',
  'fsdfsd31233210117', 'fsdfsd31233210118',
  'fsdfsd31233210123', 'fsdfsd31233210124',
]);

// 每个标注的配置
// parentName: 父节点名称（null 表示世界坐标根节点）
// localPos: 在父节点局部坐标系中的位置（GLTF 坐标）
//           根节点时为 GLTF 世界坐标（Y-up，已由 Verge3D 转换）
const FEATURE_ANNOTATIONS = [
  {
    parentName: 'Rectangle006',
    localPos: [-2.353000, 20.243000, -2.524000],
    lines: [
      'FAS级3CM橡胶木100%全实木更耐用',
      '环保嘉宝莉水性漆多层高规格防刮保护涂装',
    ],
  },
  {
    parentName: null,
    localPos: [-32.555000, 9.411000, 4.822000],
    lines: [
      '升级冷轧桌腿加粗加宽加厚',
      '多重框架升级静态承重可达600斤',
    ],
  },
  {
    parentName: 'Rectangle006',
    localPos: [-12.706000, -1.607000, -2.524000],
    lines: [
      '加宽斜坡设计贴合手腕不酸痛',
      'CHAO大圆边设计安全防磕碰',
    ],
  },
  {
    parentName: null,
    localPos: [5.027000, 13.162000, 4.092000],
    lines: [
      '睡眠级消声电机德国降噪科技',
      '标杆级电机CQC品牌认证澎湃性能',
    ],
  },
  {
    parentName: null,
    localPos: [10.497000, 25.249000, 19.495000],
    lines: [
      '数显控制器灵活操作不延时',
      '智能久坐提醒站坐交替更健康',
    ],
  },
];

// 气泡样式（颜色/字号/加粗/背景）- 由 FeatureAnnotationGizmo 写入，勿手动编辑
const FEATURE_STYLES = [
  { color0: '#ffffff', color1: '#c8c8c8', size0: 18, size1: 18, bold0: true, bold1: true, bgColor: '#000000', bgAlpha: 0.62, bgPadX: 20 },
  { color0: '#ffffff', color1: '#c8c8c8', size0: 18, size1: 18, bold0: true, bold1: true, bgColor: '#000000', bgAlpha: 0.62, bgPadX: 20 },
  { color0: '#ffffff', color1: '#c8c8c8', size0: 19, size1: 20, bold0: true, bold1: true, bgColor: '#000000', bgAlpha: 0.62, bgPadX: 20 },
  { color0: '#ffffff', color1: '#c8c8c8', size0: 18, size1: 18, bold0: true, bold1: true, bgColor: '#000000', bgAlpha: 0.62, bgPadX: 20 },
  { color0: '#ffffff', color1: '#c8c8c8', size0: 18, size1: 18, bold0: true, bold1: true, bgColor: '#000000', bgAlpha: 0.62, bgPadX: 20 },
];

// 气泡画布尺寸（保持足够宽以容纳中文）
const CANVAS_W = 512;
const CANVAS_H = 96;

export default function FeatureAnnotation({ visible = true }) {
  const spritesRef    = useRef([]);
  const visibleRef    = useRef(visible);
  const masterTickRef = useRef(null);

  useEffect(() => {
    visibleRef.current = visible;
    spritesRef.current.forEach(s => {
      if (s) s.group._targetOpacity = visible ? 1 : 0;
    });
  }, [visible]);

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

      // ── 遮挡检测（30帧刷新缓存）──
      let occluderCache = null;
      let occluderFrame = 0;
      let sharedUUIDs   = new Set();

      function refreshOccluders() {
        sharedUUIDs.clear();
        spritesRef.current.forEach(s => s && s.group.traverse(o => sharedUUIDs.add(o.uuid)));
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
      const _dir = new v3d.Vector3();

      function checkOcclusion(camPos, anchor) {
        _dir.subVectors(anchor, camPos);
        const dist = _dir.length();
        raycaster.set(camPos, _dir.normalize());
        raycaster.near = 0.1;
        raycaster.far  = dist - 0.5;
        return raycaster.intersectObjects(occluderCache, false).length > 0;
      }

      // ── 为每条标注创建 Group + Sprite ──
      const ticks = FEATURE_ANNOTATIONS.map((cfg, idx) => {
        const group = new v3d.Group();
        group.name = `__feat_annotation_${idx}__`;
        group._targetOpacity  = visibleRef.current ? 1 : 0;
        group._currentOpacity = visibleRef.current ? 1 : 0;
        group.visible = visibleRef.current;
        app.scene.add(group);
        group.layers.set(2);

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

        // ── Canvas 气泡绘制 ──
        const canvas = document.createElement('canvas');
        canvas.width  = CANVAS_W;
        canvas.height = CANVAS_H;
        const ctx = canvas.getContext('2d');

        function drawBubble() {
          // 读取 Gizmo 实时覆盖（文字/颜色/字号/加粗/背景）
          const ov   = window._featStyle?.[idx] || {};
          const base = FEATURE_STYLES[idx] || {};
          const lines0  = ov.line0   ?? cfg.lines[0];
          const lines1  = ov.line1   ?? cfg.lines[1];
          const color0  = ov.color0  ?? base.color0  ?? '#ffffff';
          const color1  = ov.color1  ?? base.color1  ?? '#c8c8c8';
          const size0   = ov.size0   ?? base.size0   ?? 18;
          const size1   = ov.size1   ?? base.size1   ?? 15;
          const bold0   = ov.bold0   ?? base.bold0   ?? true;
          const bold1   = ov.bold1   ?? base.bold1   ?? false;
          // 背景：hex色 + 透明度(0-1) + 内边距缩放
          const bgColor = ov.bgColor ?? base.bgColor ?? '#000000';
          const bgAlpha = ov.bgAlpha ?? base.bgAlpha ?? 0.62;
          const bgPadX  = ov.bgPadX  ?? base.bgPadX  ?? 20;   // 左右留白px

          // 解析背景色为 rgba
          const hx = bgColor.replace('#','');
          const br = parseInt(hx.slice(0,2),16);
          const bg = parseInt(hx.slice(2,4),16);
          const bb = parseInt(hx.slice(4,6),16);

          ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

          const bh = CANVAS_H - 8;
          ctx.fillStyle = `rgba(${br},${bg},${bb},${bgAlpha})`;
          ctx.beginPath();
          ctx.roundRect(bgPadX, 4, CANVAS_W - bgPadX * 2, bh, 10);
          ctx.fill();

          // 左侧金色竖条
          ctx.fillStyle = 'rgba(180, 150, 80, 0.9)';
          ctx.beginPath();
          ctx.roundRect(bgPadX + 8, 14, 4, bh - 20, 2);
          ctx.fill();

          const textX = bgPadX + 22;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';

          [
            [lines0, bold0 ? `bold ${size0}px` : `${size0}px`, color0],
            [lines1, bold1 ? `bold ${size1}px` : `${size1}px`, color1],
          ].forEach(([line, font, color], i) => {
            if (!line) return;
            ctx.font = `${font} "PingFang SC", "Microsoft YaHei", sans-serif`;
            ctx.fillStyle = color;
            const yPos = cfg.lines.length === 1
              ? CANVAS_H / 2
              : (i === 0 ? CANVAS_H * 0.35 : CANVAS_H * 0.68);
            ctx.fillText(line, textX, yPos);
          });
        }

        drawBubble();

        const tex = new v3d.CanvasTexture(canvas);
        const spriteMat = new v3d.SpriteMaterial({
          map: tex,
          depthTest: false,
          transparent: true,
          opacity: group._currentOpacity,
          toneMapped: false,
        });
        const sprite = new v3d.Sprite(spriteMat);
        sprite.scale.set(24, 4.5, 1);
        sprite.renderOrder = 999;
        sprite.frustumCulled = false;
        group.add(sprite);
        group.traverse(o => o.layers.set(2));

        spritesRef.current[idx] = { group, sprite, spriteMat, tex, drawBubble };

        // 预分配：锚点世界坐标
        const anchor    = new v3d.Vector3();
        const localVec  = new v3d.Vector3(...cfg.localPos);
        let   lastStyleStr = '';

        return function tick(delta, camPos, shouldShowBase) {
          // ── 样式变化检测：重绘 Canvas ──
          const styleStr = JSON.stringify(window._featStyle?.[idx] || {});
          if (styleStr !== lastStyleStr) {
            lastStyleStr = styleStr;
            drawBubble();
            tex.needsUpdate = true;
          }

          // ── 计算锚点世界坐标（支持 Gizmo 实时覆盖） ──
          const overridePos = window._featPos?.[idx];
          if (overridePos) localVec.set(overridePos[0], overridePos[1], overridePos[2]);

          if (cfg.parentName) {
            const parentObj = app.scene.getObjectByName(cfg.parentName);
            if (!parentObj) return;
            parentObj.updateWorldMatrix(true, false);
            anchor.copy(localVec).applyMatrix4(parentObj.matrixWorld);
          } else {
            // 根节点：Verge3D GLTF 坐标已是 Three.js 世界坐标
            anchor.copy(localVec);
          }

          sprite.position.copy(anchor);

          // ── 遮挡检测 ──
          let shouldShow = shouldShowBase;
          if (shouldShow && checkOcclusion(camPos, anchor)) shouldShow = false;

          // ── 平滑淡入淡出 ──
          group._targetOpacity = shouldShow ? 1 : 0;
          const curr   = group._currentOpacity;
          const target = group._targetOpacity;
          if (Math.abs(curr - target) > 0.001) {
            const step = (delta / FADE_DURATION) * (target > curr ? 1 : -1);
            const next = Math.max(0, Math.min(1, curr + step));
            setGroupOpacity(next);
            spriteMat.opacity = next;
          } else if (curr !== target) {
            setGroupOpacity(target);
            spriteMat.opacity = target;
          }
        };
      });

      // ── 主 renderCallback ──
      const _camPos = new v3d.Vector3();

      function masterTick(delta) {
        occluderFrame++;
        if (!occluderCache || occluderFrame % 30 === 0) refreshOccluders();

        const cam = app.camera;
        cam.getWorldPosition(_camPos);

        const shouldShowBase = visibleRef.current;
        ticks.forEach(tick => tick(delta, _camPos, shouldShowBase));
      }

      masterTickRef.current = masterTick;
      if (app.renderCallbacks) app.renderCallbacks.push(masterTick);
      masterTick(0.016);
    }

    tryInit();

    return () => {
      const app = window.v3dApp;
      if (app?.renderCallbacks && masterTickRef.current) {
        const idx = app.renderCallbacks.indexOf(masterTickRef.current);
        if (idx !== -1) app.renderCallbacks.splice(idx, 1);
        masterTickRef.current = null;
      }
      if (app?.scene) {
        spritesRef.current.forEach(s => {
          if (s?.group) app.scene.remove(s.group);
        });
        spritesRef.current = [];
      }
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return null;
}
