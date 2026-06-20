/**
 * BgPanel — 场景背景位移/缩放/透明度控制面板
 * 通过 zustand useStore 读写 background 参数
 * 同时操作 DynamicBackground 内的 Unicorn canvas
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import useStore from '../store/useStore';

const DEFAULTS = {
  x: 0,
  y: 0,
  scale: 1.0,
  opacity: 1.0,
};

const ACCENT = '#a78bfa';

const S = {
  label: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    fontSize: 11, color: '#9aa', marginBottom: 2,
  },
  slider: { width: '100%', accentColor: ACCENT, cursor: 'pointer' },
  row: { marginBottom: 10 },
  val: { color: ACCENT, fontVariantNumeric: 'tabular-nums', minWidth: 36, textAlign: 'right' },
};

function applyToBg(params) {
  window.__bgCtrl = { x: params.x, y: params.y, scale: params.scale, opacity: params.opacity };
  const canvas = document.querySelector('#bg-layer canvas');
  if (!canvas) return;
  canvas.style.transform = `translate(${params.x}px, ${params.y}px) scale(${params.scale})`;
  canvas.style.transformOrigin = 'center center';
  canvas.style.opacity = params.opacity;
}

export default function BgPanel() {
  const [open, setOpen] = useState(false);
  const background = useStore((s) => s.background);
  const setBackground = useStore((s) => s.setBackground);
  const posRef = useRef({ x: 20, y: 380 });
  const [pos, setPos] = useState({ x: 20, y: 380 });

  useEffect(() => {
    applyToBg(background);
  }, [background]);

  const set = useCallback((key, val) => setBackground({ [key]: val }), [setBackground]);

  const onMouseDown = (e) => {
    e.stopPropagation();
    const sx = e.clientX - posRef.current.x;
    const sy = e.clientY - posRef.current.y;
    const onMove = (ev) => {
      posRef.current = { x: ev.clientX - sx, y: ev.clientY - sy };
      setPos({ ...posRef.current });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div style={{
      position: 'fixed', left: pos.x, top: pos.y, zIndex: 9990,
      background: 'rgba(10,12,20,0.93)', border: `1px solid ${ACCENT}44`,
      borderRadius: 10, backdropFilter: 'blur(14px)',
      boxShadow: `0 4px 28px rgba(0,0,0,0.7), 0 0 12px ${ACCENT}22`,
      minWidth: 230, userSelect: 'none', fontFamily: 'monospace',
      transform: 'scale(var(--ui-scale, 1))',
      transformOrigin: 'top left',
    }}>
      <div
        onMouseDown={onMouseDown}
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '9px 14px', cursor: 'grab',
          borderBottom: open ? `1px solid ${ACCENT}28` : 'none',
          color: ACCENT, fontSize: 12, fontWeight: 700, letterSpacing: 1.5,
        }}
      >
        <span>◈ BACKGROUND</span>
        <span style={{ fontSize: 10, opacity: 0.5 }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ padding: '12px 14px' }}>
          <div style={S.row}>
            <div style={S.label}>
              <span>X 位移</span>
              <span style={S.val}>{background.x}px</span>
            </div>
            <input type="range" min={-400} max={400} step={1}
              value={background.x}
              onChange={e => set('x', +e.target.value)}
              style={S.slider} />
          </div>

          <div style={S.row}>
            <div style={S.label}>
              <span>Y 位移</span>
              <span style={S.val}>{background.y}px</span>
            </div>
            <input type="range" min={-400} max={400} step={1}
              value={background.y}
              onChange={e => set('y', +e.target.value)}
              style={S.slider} />
          </div>

          <div style={S.row}>
            <div style={S.label}>
              <span>缩放</span>
              <span style={S.val}>{background.scale.toFixed(2)}×</span>
            </div>
            <input type="range" min={0.5} max={2.0} step={0.01}
              value={background.scale}
              onChange={e => set('scale', +e.target.value)}
              style={S.slider} />
          </div>

          <div style={S.row}>
            <div style={S.label}>
              <span>透明度</span>
              <span style={S.val}>{Math.round(background.opacity * 100)}%</span>
            </div>
            <input type="range" min={0} max={1} step={0.01}
              value={background.opacity}
              onChange={e => set('opacity', +e.target.value)}
              style={S.slider} />
          </div>

          <button
            onClick={() => setBackground(DEFAULTS)}
            style={{
              marginTop: 4, width: '100%', padding: '5px 0',
              background: `${ACCENT}18`, border: `1px solid ${ACCENT}44`,
              borderRadius: 5, color: ACCENT, fontSize: 10,
              cursor: 'pointer', letterSpacing: 1.5, fontFamily: 'monospace',
            }}
          >RESET</button>

          <button
            onClick={async () => {
              try {
                const res = await fetch('/api/write-bg-defaults', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(background),
                });
                const data = await res.json();
                if (data.success) {
                  alert('✅ 参数已写入 useStore.js DEFAULT_BG');
                } else {
                  alert('❌ 写入失败: ' + data.message);
                }
              } catch (e) {
                alert('❌ 请求失败: ' + e.message);
              }
            }}
            style={{
              marginTop: 5, width: '100%', padding: '5px 0',
              background: `${ACCENT}30`, border: `1px solid ${ACCENT}88`,
              borderRadius: 5, color: ACCENT, fontSize: 10,
              cursor: 'pointer', letterSpacing: 1.5, fontFamily: 'monospace',
              fontWeight: 700,
            }}
          >✎ 确认写入代码</button>
        </div>
      )}
    </div>
  );
}
