// Figma: 方案四-顶部导航+底部工具栏 (底部工具栏区域)
// neumorphism 风格 — 与右上角三按钮统一
import { useRef, useEffect, useState } from 'react';
import ViewSlider from './ViewSlider';
import GalleryModal from './GalleryModal';
import CartModal from './CartModal';
import { useLang, T } from '../LangContext';

// ── SVG 图标 ──────────────────────────────────────────────
const Icons = {
  wrench: (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  ),
  cup: (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 8h1a4 4 0 0 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/>
      <line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/>
    </svg>
  ),
  hook: (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
      <path d="M9 12H5a7 7 0 0 0 14 0h-4"/>
    </svg>
  ),
  lamp: (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 2h6l3 7H6L9 2z"/><path d="M12 9v13"/><path d="M9 22h6"/>
      <circle cx="12" cy="6" r="1" fill="currentColor"/>
    </svg>
  ),
  ar: (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {/* 四角扫描框 */}
      <path d="M3 7V4h3"/>
      <path d="M21 7V4h-3"/>
      <path d="M3 17v3h3"/>
      <path d="M21 17v3h-3"/>
      {/* 中心立方体 */}
      <path d="M12 8l-4 2.3v4.4L12 17l4-2.3V10.3z"/>
      <path d="M8 10.3l4 2.3 4-2.3"/>
      <line x1="12" y1="12.6" x2="12" y2="17"/>
    </svg>
  ),
  cart: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
    </svg>
  ),
  info: (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  ),
  eye: (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  up: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="18 15 12 9 6 15"/>
    </svg>
  ),
  down: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  ),
  qr: (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/>
      <path d="M14 14h.01M18 14h.01M14 18h.01M18 18h.01M14 21h.01M21 14v7"/>
    </svg>
  ),
  gallery: (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>
  ),
};

// ── 凹槽容器 + 凸起圆形图标按钮 (同右上角结构) ──
function NeuBtn({ icon, label, active, onClick, title, size = 44 }) {
  const circleSize = Math.round(size * 0.68);
  const handleClick = (e) => {
    e.currentTarget.blur(); // 点击后立刻释放 focus，避免光圈
    onClick?.();
  };
  return (
    <div className="nb-outer" title={title}>
      {label && <span className="nb-label">{label}</span>}
      <button
        className={`nb-wrap ${active ? 'nb-active' : ''}`}
        style={{ width: size, height: size }}
        onClick={handleClick}
      >
        {/* 凸起圆形（blur 产生柔和边缘） */}
        <span className="nb-circle" style={{ width: circleSize, height: circleSize }} />
        {/* 图标独立层，不受 blur 影响 */}
        <span className="nb-icon">{icon}</span>
      </button>
    </div>
  );
}

export default function ControlBar({
  height, onHeightChange, onPlayToFrame, onStepFrame,
  material, onMaterialChange,
  showAnnotations, onToggleAnnotations,
  activeView, onViewChange,
  onAddToCart, onAccessoryChange,
}) {
  const lang = useLang();
  const t = T[lang];
  const intervalRef = useRef(null); // 存 rAF id
  const movingDirRef = useRef(null); // 同步给 rAF 闭包读取
  const accLeaveTimer = useRef(null); // 配件区 mouseLeave 延迟收起
  const shareLeaveTimer = useRef(null); // 分享区 mouseLeave 延迟收起
  const heightLeaveTimer = useRef(null); // 高度区 mouseLeave 延迟收起
  const matLeaveTimer = useRef(null); // 材质区 mouseLeave 延迟收起
  const [movingDir, setMovingDir] = useState(null);
  const [activeAccessory, setActiveAccessory] = useState(new Set());
  const [cartClicked, setCartClicked] = useState(false);
  const [activePreset, setActivePreset] = useState(94); // 初始二档高亮
  const [activeMats, setActiveMats] = useState(new Set());
  const [heightExpanded, setHeightExpanded] = useState(false);
  const [matExpanded, setMatExpanded] = useState(false);
  const [accExpanded, setAccExpanded] = useState(false);
  const [shareExpanded, setShareExpanded] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  // 画廊打开时屏蔽右上角 nav-btn-group 的鼠标事件，防止 hover 触发展开动画
  useEffect(() => {
    document.body.classList.toggle('gallery-modal-open', galleryOpen);
  }, [galleryOpen]);

  const materials = [
    { id: 'light', name: t.mat_light, color: '#c8a882' },
    { id: 'oak',   name: t.mat_oak,   color: '#e8d5b0' },
    { id: 'dark',  name: t.mat_dark,  color: '#3a2a1a' },
  ];

  const heights = [
    { cm: 68,  label: t.rank1 },
    { cm: 94,  label: t.rank2 },
    { cm: 120, label: t.rank3 },
  ];

  const accessories = [
    { id: 'acc2', label: t.acc_cup,  icon: Icons.cup },
    { id: 'acc3', label: t.acc_hook, icon: Icons.hook },
    { id: 'acc4', label: t.acc_lamp, icon: Icons.lamp },
  ];

  const ARROW_SPEED = 0.5; // 保留常量，仅供参考（实际速度在 App.jsx renderCallback 里控制）

  const toggleMove = (dir) => {
    if (movingDirRef.current === dir) {
      // 再次点击同方向：停止
      movingDirRef.current = null;
      setMovingDir(null);
      onStepFrame?.(null); // 清除 arrowMoveRef
      if (intervalRef.current) { cancelAnimationFrame(intervalRef.current); intervalRef.current = null; }
    } else {
      // 停止旧的
      if (intervalRef.current) { cancelAnimationFrame(intervalRef.current); intervalRef.current = null; }
      // 开始新方向
      movingDirRef.current = dir;
      setMovingDir(dir);
      setActivePreset(null);
      onStepFrame?.(dir); // 设置 arrowMoveRef，renderCallback 开始驱动

      // rAF 只用于定期触发 re-render 更新高度显示（不驱动动画）
      const loop = (ts) => {
        if (!movingDirRef.current) return;
        intervalRef.current = requestAnimationFrame(loop);
      };
      intervalRef.current = requestAnimationFrame(loop);
    }
  };

  const stopMove = () => {
    movingDirRef.current = null;
    setMovingDir(null);
    onStepFrame?.(null); // 清除 arrowMoveRef
    if (intervalRef.current) { cancelAnimationFrame(intervalRef.current); intervalRef.current = null; }
  };
  useEffect(() => () => stopMove(), []);

  // 从当前位置平滑移动到目标档位：让 Verge3D 动画系统负责过渡
  const moveToPreset = (targetCm) => {
    stopMove();
    setActivePreset(targetCm);
    onHeightChange(targetCm);      // 更新 UI 数值显示
    onPlayToFrame?.(targetCm);     // 播放动画片段
  };

  const handleCart = () => {
    setCartClicked(true);
    setTimeout(() => setCartClicked(false), 600);
    setCartOpen(v => !v);
  };

  return (
    <>
      <GalleryModal open={galleryOpen} onClose={() => setGalleryOpen(false)} />
      <CartModal
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        material={material}
        activeAccessory={activeAccessory}
        height={height}
      />
      {qrOpen && (
        <div
          onClick={() => setQrOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'rgba(204, 208, 212, 0.55)',
              backdropFilter: 'blur(24px) saturate(1.5)',
              WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
              border: '1px solid rgba(255,255,255,0.5)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7), 0 8px 40px rgba(0,0,0,0.18)',
              borderRadius: '20px',
              padding: '32px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
            }}
          >
            <p style={{ margin: 0, fontSize: '14px', fontFamily: 'Rajdhani, Inter, sans-serif', fontWeight: 600, letterSpacing: '0.08em', color: 'rgba(0,0,0,0.6)' }}>{t.scanQr}</p>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(window.location.href)}`}
              alt="二维码"
              width={200}
              height={200}
              style={{ borderRadius: '8px', display: 'block' }}
            />
            <p style={{ margin: 0, fontSize: '12px', fontFamily: 'Rajdhani, Inter, sans-serif', color: 'rgba(0,0,0,0.4)', letterSpacing: '0.05em' }}>{window.location.href}</p>
          </div>
        </div>
      )}
      <style>{`
        /* ── 底部栏整体 ─────────────────────────────── */
        .cb-bar {
          position: fixed;
          bottom: 16px;
          left: 50%;
          transform: translateX(-50%);
          transform-origin: bottom center;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 131px;
          width: fit-content;
          background: rgba(204, 208, 212, 0.36);
          backdrop-filter: blur(18px) saturate(1.4);
          -webkit-backdrop-filter: blur(18px) saturate(1.4);
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.45);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.6), 0 4px 24px rgba(0,0,0,0.12);
          gap: 12px;
          padding: 0 24px;
          transition: none;
          font-family: 'Rajdhani', 'Inter', sans-serif;
          pointer-events: auto;
        }

        /* 重置 cb-bar 内所有元素的 transition，只有圆形和购物车内圆保留 */
        .cb-bar * {
          transition: none !important;
        }
        /* 去掉所有 focus 光圈和 box-shadow 变化 */
        .cb-bar *:focus,
        .cb-bar *:focus-visible {
          outline: none !important;
          box-shadow: unset !important;
        }
        /* 材质圆形 focus 时不清除 box-shadow（保留 active 凹陷） */
        .cb-bar .cb-mat-circle:focus,
        .cb-bar .cb-mat-circle:focus-visible {
          outline: none !important;
          box-shadow: unset;
        }
        .cb-bar .cb-mat-circle.active:focus,
        .cb-bar .cb-mat-circle.active:focus-visible {
          outline: none !important;
          box-shadow:
            inset 0 -8px 25px -1px rgba(255, 255, 255, 0.9),
            inset 0 8px 16px 0 rgba(0, 0, 0, 0.35),
            inset 0 0 5px 1px rgba(255, 255, 255, 0.6) !important;
        }
        .cb-bar .nb-wrap:focus,
        .cb-bar .nb-wrap:focus-visible {
          box-shadow: none !important;
        }
        .cb-bar .nb-h-wrap:focus,
        .cb-bar .nb-h-wrap:focus-visible {
          box-shadow: none !important;
        }
        .cb-bar .nb-arrow:focus,
        .cb-bar .nb-arrow:focus-visible {
          box-shadow: none !important;
        }
        .cb-bar .cb-cart-outer:focus,
        .cb-bar .cb-cart-outer:focus-visible {
          box-shadow: none !important;
        }
        /* hover 时所有按钮不改变外观（transform/box-shadow 全部保持原样） */
        .cb-bar button:hover {
          transform: none !important;
        }
        /* 去掉 focus 光圈 */
        .cb-bar button:focus,
        .cb-bar button:focus-visible {
          outline: none !important;
          box-shadow: unset !important;
        }
        .cb-bar .nb-wrap:focus,
        .cb-bar .nb-wrap:focus-visible {
          box-shadow: none !important;
        }
        .cb-bar .nb-circle,
        .cb-bar .nb-h-circle,
        .cb-bar .cb-mat-circle,
        .cb-bar .nb-arrow .nb-circle,
        .cb-bar .cb-cart-inner {
          transition: box-shadow 300ms cubic-bezier(0.23,1,0.32,1),
                      transform 300ms cubic-bezier(0.23,1,0.32,1) !important;
        }

        /* ── 三块分区 ───────────────────────────────── */
        .cb-panel-view {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          background: transparent;
          padding: 0;
        }
        .cb-panel {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0;
          flex-shrink: 0;
          background: transparent;
          transition: none;
        }
        .cb-panel-mid {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 24px;
          background: rgba(204, 208, 212, 0.36);
          backdrop-filter: blur(18px) saturate(1.4);
          -webkit-backdrop-filter: blur(18px) saturate(1.4);
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.45);
          transition: none;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.6),
            0 4px 24px rgba(0,0,0,0.12);
        }
        .cb-panel-right {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 0 24px;
          flex-shrink: 0;
          background: rgba(204, 208, 212, 0.36);
          backdrop-filter: blur(18px) saturate(1.4);
          -webkit-backdrop-filter: blur(18px) saturate(1.4);
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.45);
          transition: none;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.6),
            0 4px 24px rgba(0,0,0,0.12);
        }

        /* ── 分区标签 ───────────────────────────────── */
        .cb-group {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          position: relative;
        }
        .cb-group-label {
          font-size: 13px;
          letter-spacing: 0;
          color: rgba(0,0,0,0.55);
          text-transform: uppercase;
          font-family: 'Rajdhani', sans-serif;
          line-height: 1;
          white-space: nowrap;
          pointer-events: none;
          text-align: center;
          display: block;
        }
        .cb-group-label em {
          font-style: normal;
          color: rgba(0,0,0,0.72);
          margin-left: 6px;
        }
        .cb-group-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        /* ── neumorphism 按钮外层（标签+按钮纵向排列） */
        .nb-outer {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0;
          flex-shrink: 0;
          position: relative;
        }

        /* ── neumorphism 按钮：凹槽底座 ──────────────── */
        .nb-wrap {
          position: relative;
          border: none;
          cursor: pointer;
          background: transparent;
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          flex-shrink: 0;
          box-shadow: none;
        }

        .nb-label {
          font-size: 13px;
          line-height: 1;
          color: rgba(0,0,0,0.55);
          letter-spacing: 0.06em;
          font-family: 'Rajdhani', sans-serif;
          pointer-events: none;
          white-space: nowrap;
          position: absolute;
          bottom: -18px;
          left: 50%;
          transform: translateX(calc(-50% - 0.03em));
        }

        /* 凸起圆形 — 与右上角 .button 同款阴影（原始数值不缩放） */
        .nb-circle {
          border-radius: 50%;
          background: #ccd0d4;
          flex-shrink: 0;
          filter: blur(1px);
          box-shadow:
            inset 0 -3px 4px -1px rgba(0,0,0,0.25),
            inset 0 3px 4px -1px rgba(255,255,255,0.4),
            inset 0 0 5px 1px rgba(255,255,255,0.8),
            inset 0 20px 30px 0 rgba(255,255,255,0.2),
            0 4px 12px -2px rgba(0,0,0,0.25),
            0 -4px 8px -2px rgba(255,255,255,0.4);
          position: relative;
          z-index: 1;
        }
        /* 图标不受 blur 影响 — 绝对定位叠在圆形上 */
        .nb-icon {
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          z-index: 2;
          color: rgba(0,0,0,0.45);
        }

        /* 点击：圆形凹下去（瞬间按压感） */
        .nb-wrap:active .nb-circle {
          transform: translateY(1px);
          box-shadow:
            inset 0 -8px 30px 1px rgba(255, 255, 255, 0.9),
            inset 0 8px 25px 0 rgba(0, 0, 0, 0.4),
            inset 0 0 10px 1px rgba(255, 255, 255, 0.6);
        }

        /* 激活态：圆形凹陷 */
        .nb-wrap.nb-active .nb-circle {
          transform: translateY(1px);
          box-shadow:
            inset 0 -8px 25px -1px rgba(255, 255, 255, 0.9),
            inset 0 8px 16px 0 rgba(0, 0, 0, 0.35),
            inset 0 0 5px 1px rgba(255, 255, 255, 0.6);
        }
        .nb-wrap.nb-active .nb-label { color: rgba(0,0,0,0.55); }

        /* ── 高度档位按钮（NeuBtn 同款：凹槽方块 + 凸起圆） ── */
        .nb-h-wrap {
          position: relative;
          width: 67px; height: 67px;
          border: none;
          cursor: pointer;
          background: transparent;
          border-radius: 20px;
          padding: 0;
          flex-shrink: 0;
          box-shadow: none;
          display: flex; align-items: center; justify-content: center;
        }
        .nb-h-circle {
          width: 46px; height: 46px;
          border-radius: 50%;
          background: #ccd0d4;
          filter: blur(1px);
          box-shadow:
            inset 0 -3px 4px -1px rgba(0,0,0,0.25),
            inset 0 3px 4px -1px rgba(255,255,255,0.4),
            inset 0 0 5px 1px rgba(255,255,255,0.8),
            inset 0 20px 30px 0 rgba(255,255,255,0.2),
            0 4px 12px -2px rgba(0,0,0,0.25),
            0 -4px 8px -2px rgba(255,255,255,0.4);
          position: relative;
          z-index: 1;
          transition: box-shadow 300ms cubic-bezier(0.23,1,0.32,1),
                      transform 300ms cubic-bezier(0.23,1,0.32,1) !important;
        }
        .nb-h-text {
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          display: flex;
          align-items: center; justify-content: center;
          pointer-events: none;
          z-index: 2;
          color: rgba(0,0,0,0.55);
        }
        .nb-h-wrap .h-num { display: none; }
        .nb-h-wrap .h-lbl { font-size: 13px; line-height: 1; color: rgba(0,0,0,0.55); letter-spacing: 0.06em; }
        .nb-h-wrap:active .nb-h-circle {
          transform: translateY(1px);
          box-shadow:
            inset 0 -8px 30px 1px rgba(255, 255, 255, 0.9),
            inset 0 8px 25px 0 rgba(0, 0, 0, 0.4),
            inset 0 0 10px 1px rgba(255, 255, 255, 0.6);
        }
        .nb-h-wrap.nb-h-active .nb-h-circle {
          transform: translateY(1px);
          box-shadow:
            inset 0 -8px 25px -1px rgba(255, 255, 255, 0.9),
            inset 0 8px 16px 0 rgba(0, 0, 0, 0.35),
            inset 0 0 5px 1px rgba(255, 255, 255, 0.6);
        }
        .nb-h-wrap.nb-h-active .nb-h-text { color: rgba(0,0,0,0.6); }

        /* 箭头按钮（NeuBtn 同款：凹槽方块 + 凸起圆） */
        .nb-arrow {
          position: relative;
          width: 67px; height: 67px;
          border: none;
          cursor: pointer;
          background: transparent;
          border-radius: 20px;
          display: flex; align-items: center; justify-content: center;
          padding: 0;
          color: rgba(0,0,0,0.38);
          box-shadow: none;
        }
        .nb-arrow .nb-circle {
          width: 46px; height: 46px;
        }
        .nb-arrow:active .nb-circle,
        .nb-arrow.nb-h-moving .nb-circle {
          transform: translateY(1px);
          box-shadow:
            inset 0 -8px 30px 1px rgba(255, 255, 255, 0.9),
            inset 0 8px 25px 0 rgba(0, 0, 0, 0.4),
            inset 0 0 10px 1px rgba(255, 255, 255, 0.6);
        }

        /* ── ViewSlider 旋钮容器（透明，无背景，放大到填满面板） ── */
        .cb-knob-outer {
          width: 131px; height: 131px;
          border-radius: 20px;
          background: transparent;
          display: flex; align-items: center; justify-content: center;
          overflow: visible;
          box-shadow: none;
          flex-shrink: 0;
        }

        /* ── 材质外层容器（与 nb-outer 同款） ── */
        .cb-mat-outer {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0;
          flex-shrink: 0;
          position: relative;
          width: 67px;
          height: 67px;
          justify-content: center;
        }

        /* ── 材质圆形色块（NeuBtn 同款：凹槽方块 + 凸起圆） ── */
        .cb-mat-slot {
          width: 67px; height: 67px;
          border-radius: 20px;
          background: transparent;
          display: flex; align-items: center; justify-content: center;
          box-shadow: none;
          flex-shrink: 0;
          cursor: pointer;
        }
        .cb-mat-circle {
          width: 46px; height: 46px;
          border-radius: 50%;
          border: none;
          cursor: pointer;
          padding: 0;
          filter: blur(1px);
          box-shadow:
            inset 0 -3px 4px -1px rgba(0,0,0,0.25),
            inset 0 3px 4px -1px rgba(255,255,255,0.4),
            inset 0 0 5px 1px rgba(255,255,255,0.8),
            inset 0 20px 30px 0 rgba(255,255,255,0.2),
            0 4px 12px -2px rgba(0,0,0,0.25),
            0 -4px 8px -2px rgba(255,255,255,0.4);
          transition: box-shadow 300ms cubic-bezier(0.23,1,0.32,1),
                      transform 300ms cubic-bezier(0.23,1,0.32,1) !important;
          outline: none;
        }
        .cb-mat-circle:active {
          transform: translateY(1px);
          box-shadow:
            inset 0 -8px 30px 1px rgba(255, 255, 255, 0.9),
            inset 0 8px 25px 0 rgba(0, 0, 0, 0.4),
            inset 0 0 10px 1px rgba(255, 255, 255, 0.6);
        }
        .cb-mat-circle.active {
          transform: translateY(1px);
          box-shadow:
            inset 0 -8px 25px -1px rgba(255, 255, 255, 0.9),
            inset 0 8px 16px 0 rgba(0, 0, 0, 0.35),
            inset 0 0 5px 1px rgba(255, 255, 255, 0.6) !important;
        }

        /* ── 总价区 ──────────────────────────────────── */
        .cb-price-wrap {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          flex-shrink: 0;
          gap: 2px;
        }
        .cb-price-label { font-size: 18px; color: rgba(0,0,0,0.38); letter-spacing: 0.12em; font-family: 'Rajdhani', sans-serif; }
        .cb-price-value {
          font-size: 44px; font-weight: 800; line-height: 1;
          color: rgba(0,0,0,0.72);
          letter-spacing: -0.02em;
          font-family: 'Orbitron', 'Rajdhani', sans-serif;
        }

        /* ── 购物车按钮（与 NeuBtn 同款：凹槽方块 + 凸起圆） ─── */
        .cb-cart-outer {
          position: relative;
          width: 67px; height: 67px;
          border-radius: 20px;
          background: transparent;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          flex-shrink: 0;
          box-shadow: none;
        }
        .cb-cart-inner {
          width: 46px; height: 46px;
          border-radius: 50%;
          background: #ccd0d4;
          filter: blur(1px);
          box-shadow:
            inset 0 -3px 4px -1px rgba(0,0,0,0.25),
            inset 0 3px 4px -1px rgba(255,255,255,0.4),
            inset 0 0 5px 1px rgba(255,255,255,0.8),
            inset 0 20px 30px 0 rgba(255,255,255,0.2),
            0 4px 12px -2px rgba(0,0,0,0.25),
            0 -4px 8px -2px rgba(255,255,255,0.4);
          transition: box-shadow 300ms cubic-bezier(0.23,1,0.32,1),
                      transform 300ms cubic-bezier(0.23,1,0.32,1) !important;
          flex-shrink: 0;
          position: relative;
          z-index: 1;
        }
        .cb-cart-icon {
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-48%, -48%);
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          z-index: 2;
          color: rgba(0,0,0,0.45);
        }
        .cb-cart-outer:active .cb-cart-inner,
        .cb-cart-outer.clicked .cb-cart-inner {
          transform: translateY(1px);
          box-shadow:
            inset 0 -8px 30px 1px rgba(255,255,255,0.9),
            inset 0 8px 25px 0 rgba(0,0,0,0.4),
            inset 0 0 10px 1px rgba(255,255,255,0.6);
        }

        /* ── 高度展开动画容器 ─────────────────────── */
        .nb-h-expand-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
          overflow: hidden;
          max-width: 0;
          opacity: 0;
          padding: 8px 0 20px;
          margin: -8px 0 -20px -8px;
          transition: max-width 400ms cubic-bezier(0.23, 1, 0.32, 1),
                      opacity 300ms ease !important;
        }
        .nb-h-expand-wrap.nb-h-open {
          max-width: 700px;
          opacity: 1;
          margin-left: 0;
        }
        /* 材质展开容器：底部对齐让圆形和 label 与第一个按钮对齐 */
        .nb-mat-expand-wrap {
        }

        /* 展开时箭头不旋转 */
        .nb-arrow.nb-h-expanded .nb-icon {
          transform: translate(-50%, -50%) rotate(0deg);
          transition: transform 300ms cubic-bezier(0.23, 1, 0.32, 1) !important;
        }
        .nb-arrow .nb-icon {
          transition: transform 300ms cubic-bezier(0.23, 1, 0.32, 1) !important;
        }
        .cb-sep {
          display: none;
        }
      `}</style>

      <div className="cb-bar">

        {/* ══ 左块：高度 + 标注 ══ */}
        <div className="cb-panel">
          <div className="cb-group"
            onMouseEnter={() => { if (heightLeaveTimer.current) { clearTimeout(heightLeaveTimer.current); heightLeaveTimer.current = null; } setHeightExpanded(true); }}
            onMouseLeave={() => { heightLeaveTimer.current = setTimeout(() => setHeightExpanded(false), 150); }}
          >
            <span className="cb-group-label">{t.height} {heightExpanded && <em>{height}cm</em>}</span>
            <div className="cb-group-row">

              {/* 下降箭头：hover 展开/折叠触发器，展开后点击切换下降 */}
              <button className={`nb-arrow ${heightExpanded ? 'nb-h-expanded' : ''} ${movingDir === 'down' ? 'nb-h-moving' : ''}`}
                onClick={(e) => { e.currentTarget.blur(); if (heightExpanded) toggleMove('down'); }}
                title={heightExpanded ? (movingDir === 'down' ? t.clickStop : t.descend) : t.expand}
              >
                <span className="nb-circle" style={{ width: 46, height: 46 }} />
                <span className="nb-icon">{Icons.down}</span>
              </button>

              {/* 展开区域：上升箭头 + 档位按钮 */}
              <div className={`nb-h-expand-wrap ${heightExpanded ? 'nb-h-open' : ''}`}>
                <button className={`nb-arrow ${movingDir === 'up' ? 'nb-h-moving' : ''}`}
                  onClick={(e) => { e.currentTarget.blur(); toggleMove('up'); }}
                  title={movingDir === 'up' ? t.clickStop : t.rise}
                >
                  <span className="nb-circle" style={{ width: 46, height: 46 }} />
                  <span className="nb-icon">{Icons.up}</span>
                </button>
                {heights.map(h => (
                  <button
                    key={h.cm}
                    className={`nb-h-wrap ${activePreset === h.cm ? 'nb-h-active' : ''}`}
                    onClick={(e) => { e.currentTarget.blur(); moveToPreset(h.cm); }}
                  >
                    <span className="nb-h-circle" />
                    <span className="nb-h-text">
                      <span className="h-num">{h.cm}</span>
                      <span className="h-lbl">{h.label}</span>
                    </span>
                  </button>
                ))}
              </div>

            </div>
          </div>

          <div className="cb-sep" />

          {/* 标注 */}
          <div className="cb-group">
            <span className="cb-group-label">{t.annotation}</span>
            <div className="cb-group-row">
              <NeuBtn
                icon={Icons.info}
                active={showAnnotations}
                onClick={onToggleAnnotations}
                title="显示/隐藏标注"
                size={67}
              />
            </div>
          </div>

          <div className="cb-sep" />

          {/* AR + 二维码 + 画廊（hover 展开） */}
          <div className="cb-group"
            onMouseEnter={() => { if (shareLeaveTimer.current) { clearTimeout(shareLeaveTimer.current); shareLeaveTimer.current = null; } setShareExpanded(true); }}
            onMouseLeave={() => { shareLeaveTimer.current = setTimeout(() => setShareExpanded(false), 150); }}
          >
            <span className="cb-group-label">{t.share}</span>
            <div className="cb-group-row">
              {/* 第一个：AR，始终显示 */}
              <NeuBtn
                icon={Icons.ar}
                label={shareExpanded ? 'AR' : undefined}
                active={activeAccessory.has('acc5')}
                onClick={() => setActiveAccessory(prev => {
                  const next = new Set(prev);
                  next.has('acc5') ? next.delete('acc5') : next.add('acc5');
                  return next;
                })}
                title="AR 预览"
                size={67}
              />
              {/* 展开区域：二维码 + 画廊 */}
              <div className={`nb-h-expand-wrap ${shareExpanded ? 'nb-h-open' : ''}`}>
                <NeuBtn
                  icon={Icons.qr}
                  label={shareExpanded ? t.qr : undefined}
                  active={qrOpen}
                  onClick={() => setQrOpen(v => !v)}
                  title={t.qr}
                  size={67}
                />
                <NeuBtn
                  icon={Icons.gallery}
                  label={shareExpanded ? t.gallery : undefined}
                  active={galleryOpen}
                  onClick={() => setGalleryOpen(v => !v)}
                  title={t.gallery}
                  size={67}
                />
              </div>
            </div>
          </div>

        </div>

        {/* ══ 中块：材质 + 配件（与高度+标注合并为一个面板） ══ */}
        <div className="cb-panel">

          {/* 材质 */}
          <div className="cb-group"
            onMouseEnter={() => { if (matLeaveTimer.current) { clearTimeout(matLeaveTimer.current); matLeaveTimer.current = null; } setMatExpanded(true); }}
            onMouseLeave={() => { matLeaveTimer.current = setTimeout(() => setMatExpanded(false), 150); }}
          >
            <span className="cb-group-label">{t.material} {matExpanded && <em>{materials.find(m => m.id === material)?.name}</em>}</span>
            <div className="cb-group-row">
              {/* 第一个色块：凸起圆（NeuBtn同款），hover 展开 + 点击选材质 */}
              <div className="cb-mat-outer" style={{cursor:'pointer'}}>
                <button
                  className={`nb-wrap ${activeMats.has(materials[0].id) ? 'nb-active' : ''}`}
                  style={{ width: 67, height: 67 }}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setActiveMats(prev => {
                      const next = new Set(prev);
                      next.has(materials[0].id) ? next.delete(materials[0].id) : next.add(materials[0].id);
                      return next;
                    });
                    onMaterialChange(materials[0].id);
                  }}
                  title={materials[0].name}
                >
                  <span className="nb-circle" style={{
                    width: 46, height: 46,
                    background: materials[0].color,
                  }} />
                </button>
                {matExpanded && <span className="nb-label">{materials[0].name}</span>}
              </div>
              {/* 展开区域：剩余色块，结构与第一个按钮一致（nb-wrap + nb-circle） */}
              <div className={`nb-h-expand-wrap nb-mat-expand-wrap ${matExpanded ? 'nb-h-open' : ''}`}>
                {materials.slice(1).map(mat => (
                  <div key={mat.id} className="cb-mat-outer">
                    <button
                      className={`nb-wrap ${activeMats.has(mat.id) ? 'nb-active' : ''}`}
                      style={{ width: 67, height: 67 }}
                      onClick={(e) => {
                        e.currentTarget.blur();
                        setActiveMats(prev => {
                          const next = new Set(prev);
                          next.has(mat.id) ? next.delete(mat.id) : next.add(mat.id);
                          return next;
                        });
                        onMaterialChange(mat.id);
                      }}
                      title={mat.name}
                    >
                      <span className="nb-circle" style={{ width: 46, height: 46, background: mat.color }} />
                    </button>
                    {matExpanded && <span className="nb-label">{mat.name}</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="cb-sep" />

          {/* 配件 */}
          <div className="cb-group"
            onMouseEnter={() => { if (accLeaveTimer.current) { clearTimeout(accLeaveTimer.current); accLeaveTimer.current = null; } setAccExpanded(true); }}
            onMouseLeave={() => { accLeaveTimer.current = setTimeout(() => setAccExpanded(false), 150); }}
          >
            <span className="cb-group-label">{t.accessory}</span>
            <div className="cb-group-row">
              {/* 第一个配件按钮：始终显示 */}
              <NeuBtn
                icon={accessories[0].icon}
                label={accExpanded ? accessories[0].label : undefined}
                active={activeAccessory.has(accessories[0].id)}
                onClick={() => {
                  const id = accessories[0].id;
                  setActiveAccessory(prev => {
                    const next = new Set(prev);
                    const nowActive = next.has(id) ? (next.delete(id), false) : (next.add(id), true);
                    onAccessoryChange?.(id, nowActive);
                    return next;
                  });
                }}
                title={accessories[0].label}
                size={67}
              />
              {/* 展开区域：挂钩 + 台灯 */}
              <div className={`nb-h-expand-wrap ${accExpanded ? 'nb-h-open' : ''}`}>
                {accessories.slice(1).map(acc => (
                  <NeuBtn
                    key={acc.id}
                    icon={acc.icon}
                    label={acc.label}
                    active={activeAccessory.has(acc.id)}
                    onClick={() => {
                      const id = acc.id;
                      setActiveAccessory(prev => {
                        const next = new Set(prev);
                        const nowActive = next.has(id) ? (next.delete(id), false) : (next.add(id), true);
                        onAccessoryChange?.(id, nowActive);
                        return next;
                      });
                    }}
                    title={acc.label}
                    size={67}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="cb-sep" />

          {/* 购物车 */}
          <div className="cb-group">
            <span className="cb-group-label">{t.cart}</span>
            <div className="cb-group-row">
              <button
                className={`cb-cart-outer ${cartClicked ? 'clicked' : ''}`}
                onClick={handleCart}
                title="查看购物车"
              >
                <span className="cb-cart-inner" />
                <span className="cb-cart-icon">{Icons.cart}</span>
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* ══ 视角圆盘：固定左侧，与左上角 Logo 对齐 ══ */}
      <div style={{
        position: 'fixed',
        bottom: 16, left: 24,
        zIndex: 51,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 131, height: 131,
        pointerEvents: 'auto',
      }}>
        <div style={{ transform: 'scale(0.637)', transformOrigin: 'center' }}>
          <ViewSlider onViewChange={v => onViewChange?.(v)} />
        </div>
      </div>

    </>
  );
}
