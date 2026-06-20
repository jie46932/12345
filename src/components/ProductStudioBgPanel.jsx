import { useCallback, useRef, useState } from 'react';
import useStore, { DEFAULT_STUDIO_BG } from '../store/useStore';

const ACCENT = '#ef4444';

const S = {
  row: { marginBottom: 10 },
  label: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 11,
    color: '#c9a5a5',
    marginBottom: 3,
  },
  val: {
    color: ACCENT,
    fontVariantNumeric: 'tabular-nums',
    minWidth: 42,
    textAlign: 'right',
  },
  slider: { width: '100%', accentColor: ACCENT, cursor: 'pointer' },
  color: {
    width: 42,
    height: 24,
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: 5,
    background: 'transparent',
    padding: 0,
    cursor: 'pointer',
  },
};

export default function ProductStudioBgPanel() {
  const studioBackground = useStore((s) => s.studioBackground);
  const setStudioBackground = useStore((s) => s.setStudioBackground);
  const setBackgroundMode = useStore((s) => s.setBackgroundMode);
  const [open, setOpen] = useState(false);
  const posRef = useRef({ x: 20, y: 500 });
  const [pos, setPos] = useState({ x: 20, y: 500 });

  const set = useCallback((key, val) => {
    setStudioBackground({ [key]: val });
    setBackgroundMode('solidStudio');
  }, [setBackgroundMode, setStudioBackground]);

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
      position: 'fixed',
      left: pos.x,
      top: pos.y,
      zIndex: 9991,
      minWidth: 248,
      background: 'rgba(18,8,10,0.94)',
      border: `1px solid ${ACCENT}55`,
      borderRadius: 10,
      backdropFilter: 'blur(14px)',
      boxShadow: `0 4px 28px rgba(0,0,0,0.72), 0 0 12px ${ACCENT}22`,
      userSelect: 'none',
      fontFamily: 'monospace',
      transform: 'scale(var(--ui-scale, 1))',
      transformOrigin: 'top left',
    }}>
      <div
        onMouseDown={onMouseDown}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '9px 14px',
          cursor: 'grab',
          borderBottom: open ? `1px solid ${ACCENT}28` : 'none',
          color: ACCENT,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: 1.2,
        }}
      >
        <span>◈ STUDIO BG</span>
        <span style={{ fontSize: 10, opacity: 0.55 }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ padding: '12px 14px' }}>
          <ColorControl label="基底色" value={studioBackground.baseColor} onChange={(v) => set('baseColor', v)} />
          <RangeControl label="高光强度" value={studioBackground.highlightOpacity} min={0} max={1} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set('highlightOpacity', v)} />
          <RangeControl label="高光大小" value={studioBackground.highlightSize ?? DEFAULT_STUDIO_BG.highlightSize} min={0.15} max={1.8} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set('highlightSize', v)} />
          <RangeControl label="暗角强度" value={studioBackground.vignetteStrength} min={0} max={1} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set('vignetteStrength', v)} />

          <button
            onClick={() => {
              setStudioBackground(DEFAULT_STUDIO_BG);
              setBackgroundMode('solidStudio');
            }}
            style={buttonStyle(false)}
          >RESET</button>

          <button
            onClick={async () => {
              try {
                const res = await fetch('/api/write-studio-bg-defaults', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(studioBackground),
                });
                const data = await res.json();
                if (data.success) {
                  alert('✅ 棚拍背景参数已写入 useStore.js DEFAULT_STUDIO_BG');
                } else {
                  alert('❌ 写入失败: ' + data.message);
                }
              } catch (e) {
                alert('❌ 请求失败: ' + e.message);
              }
            }}
            style={buttonStyle(true)}
          >✎ 确认写入代码</button>
        </div>
      )}
    </div>
  );
}

function ColorControl({ label, value, onChange }) {
  return (
    <div style={S.row}>
      <div style={S.label}>
        <span>{label}</span>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} style={S.color} />
      </div>
    </div>
  );
}

function RangeControl({ label, value, min, max, step = 1, unit = '', format, onChange }) {
  const display = format ? format(value) : `${value}${unit}`;
  return (
    <div style={S.row}>
      <div style={S.label}>
        <span>{label}</span>
        <span style={S.val}>{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        style={S.slider}
      />
    </div>
  );
}

function buttonStyle(primary) {
  return {
    marginTop: primary ? 5 : 4,
    width: '100%',
    padding: '5px 0',
    background: primary ? `${ACCENT}30` : `${ACCENT}18`,
    border: `1px solid ${primary ? `${ACCENT}88` : `${ACCENT}44`}`,
    borderRadius: 5,
    color: ACCENT,
    fontSize: 10,
    cursor: 'pointer',
    letterSpacing: 1.4,
    fontFamily: 'monospace',
    fontWeight: primary ? 700 : 400,
  };
}
