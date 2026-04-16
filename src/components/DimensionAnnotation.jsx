// SVG 尺寸标注：Dummy019 ↔ Dummy020
// 每帧实时投影，随相机旋转/缩放/移动精准跟随

import { useEffect, useRef } from 'react';

const LABEL  = '150 cm';
const TICK   = 8;   // 端部短刻度线半长
const OFFSET = 40;  // 标注线偏移量（法向偏移，单位 px）
const MARGIN = 32;  // 视口边缘 clamp 余量

export default function DimensionAnnotation() {
  const svgRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const lead19  = svg.querySelector('#lead19');
    const lead20  = svg.querySelector('#lead20');
    const dimLine = svg.querySelector('#dim-line');
    const tick19  = svg.querySelector('#tick19');
    const tick20  = svg.querySelector('#tick20');
    const label   = svg.querySelector('#dim-label');

    // 3D 世界坐标 → 屏幕像素坐标
    function toScreen(worldPos, camera, w, h) {
      const v = worldPos.clone();
      v.project(camera);
      return {
        x: (v.x + 1) / 2 * w,
        y: -(v.y - 1) / 2 * h,
        behind: v.z > 1,
      };
    }

    function draw(s19, s20, w, h) {
      // clamp 端点到视口内（处理相机角度导致投影超边界）
      const cx = (x) => Math.max(MARGIN, Math.min(w - MARGIN, x));
      const cy = (y) => Math.max(MARGIN, Math.min(h - MARGIN, y));

      const p19x = cx(s19.x), p19y = cy(s19.y);
      const p20x = cx(s20.x), p20y = cy(s20.y);

      // 连线方向 & 法向
      const dx = p20x - p19x;
      const dy = p20y - p19y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 1) return;

      const ux = dx / len, uy = dy / len;   // 单位切向
      const nx = -uy,      ny =  ux;        // 法向（垂直于连线）

      // 标注线端点（沿法向偏移）
      const ax = p19x + nx * OFFSET, ay = p19y + ny * OFFSET;
      const bx = p20x + nx * OFFSET, by = p20y + ny * OFFSET;
      const midX = (ax + bx) / 2, midY = (ay + by) / 2;

      // 引导线：真实投影点 → 标注线端点
      lead19.setAttribute('x1', s19.x); lead19.setAttribute('y1', s19.y);
      lead19.setAttribute('x2', ax);    lead19.setAttribute('y2', ay);
      lead20.setAttribute('x1', s20.x); lead20.setAttribute('y1', s20.y);
      lead20.setAttribute('x2', bx);    lead20.setAttribute('y2', by);

      // 主标注线
      dimLine.setAttribute('x1', ax); dimLine.setAttribute('y1', ay);
      dimLine.setAttribute('x2', bx); dimLine.setAttribute('y2', by);

      // 两端刻度线（垂直于标注线方向）
      tick19.setAttribute('x1', ax - ux * TICK); tick19.setAttribute('y1', ay - uy * TICK);
      tick19.setAttribute('x2', ax + ux * TICK); tick19.setAttribute('y2', ay + uy * TICK);
      tick20.setAttribute('x1', bx - ux * TICK); tick20.setAttribute('y1', by - uy * TICK);
      tick20.setAttribute('x2', bx + ux * TICK); tick20.setAttribute('y2', by + uy * TICK);

      // 标签居中
      label.setAttribute('x', midX);
      label.setAttribute('y', midY - 8);
    }

    function update() {
      const app = window.v3dApp;
      if (!app?.scene || !app?.camera || !app?.renderer) {
        rafRef.current = requestAnimationFrame(update);
        return;
      }

      const d19 = app.scene.getObjectByName('Dummy019');
      const d20 = app.scene.getObjectByName('Dummy020');
      if (!d19 || !d20) {
        rafRef.current = requestAnimationFrame(update);
        return;
      }

      // 等加载屏消失后才显示
      const loadingHidden = !!document.querySelector('[class*="ls-hide"]');
      if (!loadingHidden) {
        svg.style.opacity = '0';
        rafRef.current = requestAnimationFrame(update);
        return;
      }

      const canvas = app.renderer.domElement;
      const w = canvas.clientWidth  || canvas.width;
      const h = canvas.clientHeight || canvas.height;

      const wp19 = new window.v3d.Vector3();
      const wp20 = new window.v3d.Vector3();
      d19.getWorldPosition(wp19);
      d20.getWorldPosition(wp20);

      const s19 = toScreen(wp19, app.camera, w, h);
      const s20 = toScreen(wp20, app.camera, w, h);

      if (s19.behind || s20.behind) {
        svg.style.opacity = '0';
        rafRef.current = requestAnimationFrame(update);
        return;
      }

      svg.style.opacity = '1';
      draw(s19, s20, w, h);

      rafRef.current = requestAnimationFrame(update);
    }

    rafRef.current = requestAnimationFrame(update);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <svg
      ref={svgRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 40,
        overflow: 'visible',
        opacity: 0,
        transition: 'opacity 0.3s',
      }}
    >
      <defs>
        <marker id="da-arrow-l" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto">
          <path d="M6,0.5 L0.5,3 L6,5.5 Z" fill="rgba(255,255,255,0.9)" />
        </marker>
        <marker id="da-arrow-r" markerWidth="6" markerHeight="6" refX="0" refY="3" orient="auto-start-reverse">
          <path d="M0,0.5 L5.5,3 L0,5.5 Z" fill="rgba(255,255,255,0.9)" />
        </marker>
        <filter id="da-txt-shadow" x="-40%" y="-80%" width="180%" height="260%">
          <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="rgba(0,0,0,0.95)" floodOpacity="1" />
        </filter>
      </defs>

      {/* 引导线（虚线，连接真实投影点与标注线端点） */}
      <line id="lead19" stroke="rgba(255,255,255,0.45)" strokeWidth="1" strokeDasharray="3 4" />
      <line id="lead20" stroke="rgba(255,255,255,0.45)" strokeWidth="1" strokeDasharray="3 4" />

      {/* 主标注线（双箭头） */}
      <line
        id="dim-line"
        stroke="rgba(255,255,255,0.92)"
        strokeWidth="1.2"
        markerStart="url(#da-arrow-l)"
        markerEnd="url(#da-arrow-r)"
      />

      {/* 两端刻度线 */}
      <line id="tick19" stroke="rgba(255,255,255,0.92)" strokeWidth="1.2" />
      <line id="tick20" stroke="rgba(255,255,255,0.92)" strokeWidth="1.2" />

      {/* 文字标签 */}
      <text
        id="dim-label"
        textAnchor="middle"
        dominantBaseline="auto"
        fill="rgba(255,255,255,0.95)"
        fontSize="13"
        fontFamily="'Rajdhani', 'Inter', monospace"
        fontWeight="600"
        letterSpacing="0.06em"
        filter="url(#da-txt-shadow)"
      >
        {LABEL}
      </text>
    </svg>
  );
}
