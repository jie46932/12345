/**
 * OutlinePanel — 描边效果控制面板
 * 通过 zustand useStore 读写 outline 参数
 */
import { useState, useRef, useCallback } from 'react';
import useStore, { DEFAULT_OUTLINE } from '../store/useStore';

const S = {
  label: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    fontSize: 11, color: '#9aa', marginBottom: 2,
  },
  slider: { width: '100%', accentColor: '#00ffff', cursor: 'pointer' },
  row: { marginBottom: 10 },
};

export default function OutlinePanel() {
  const [open, setOpen] = useState(false);
  const outline = useStore((s) => s.outline);
  const setOutline = useStore((s) => s.setOutline);
  const posRef = useRef({ x: 20, y: 140 });
  const [pos, setPos] = useState({ x: 20, y: 140 });

  const set = useCallback((key, val) => setOutline({ [key]: val }), [setOutline]);

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

  const presets = [
    { label: '青色', color: '#00ffff' },
    { label: '橙色', color: '#ff8800' },
    { label: '白色', color: '#ffffff' },
    { label: '黄色', color: '#ffff00' },
    { label: '紫色', color: '#cc44ff' },
  ];

  const accent = outline.visibleEdgeColor;

  return (
    <div style={{
      position: 'fixed', left: pos.x, top: pos.y, zIndex: 9990,
      background: 'rgba(10,12,20,0.93)', border: `1px solid ${accent}44`,
      borderRadius: 10, backdropFilter: 'blur(14px)',
      boxShadow: `0 4px 28px rgba(0,0,0,0.7), 0 0 12px ${accent}22`,
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
          borderBottom: open ? `1px solid ${accent}28` : 'none',
          color: accent, fontSize: 12, fontWeight: 700, letterSpacing: 1.5,
        }}
      >
        <span>◈ OUTLINE</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ position: 'relative', display: 'inline-block', width: 32, height: 16, cursor: 'pointer' }}
            onClick={e => e.stopPropagation()}>
            <input type="checkbox" checked={outline.enabled}
              onChange={e => set('enabled', e.target.checked)}
              style={{ opacity: 0, width: 0, height: 0 }} />
            <span style={{
              position: 'absolute', inset: 0, borderRadius: 16,
              background: outline.enabled ? accent : '#333', transition: 'background 0.2s',
            }}>
              <span style={{
                position: 'absolute', top: 2, left: outline.enabled ? 16 : 2,
                width: 12, height: 12, borderRadius: '50%',
                background: '#fff', transition: 'left 0.2s',
              }} />
            </span>
          </label>
          <span style={{ fontSize: 10, opacity: 0.5 }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {open && (
        <div style={{ padding: '12px 14px' }}>
          <div style={S.row}>
            <div style={S.label}>
              <span>描边粗细</span>
              <span style={{ color: accent }}>{outline.edgeThickness}</span>
            </div>
            <input type="range" min={1} max={20} step={1}
              value={outline.edgeThickness}
              onChange={e => set('edgeThickness', +e.target.value)}
              style={S.slider} />
          </div>

          <div style={S.row}>
            <div style={S.label}>
              <span>外发光</span>
              <span style={{ color: accent }}>{outline.edgeGlow.toFixed(1)}</span>
            </div>
            <input type="range" min={0} max={5} step={0.1}
              value={outline.edgeGlow}
              onChange={e => set('edgeGlow', +e.target.value)}
              style={S.slider} />
          </div>

          <div style={S.row}>
            <div style={S.label}>
              <span>呼吸周期 <span style={{ fontSize: 9, color: '#666' }}>0=关</span></span>
              <span style={{ color: accent }}>{outline.pulsePeriod === 0 ? 'OFF' : `${outline.pulsePeriod.toFixed(1)}s`}</span>
            </div>
            <input type="range" min={0} max={5} step={0.1}
              value={outline.pulsePeriod}
              onChange={e => set('pulsePeriod', +e.target.value)}
              style={S.slider} />
          </div>

          <div style={{ ...S.row }}>
            <div style={{ ...S.label, marginBottom: 6 }}>
              <span>描边颜色</span>
              <input type="color" value={outline.visibleEdgeColor}
                onChange={e => set('visibleEdgeColor', e.target.value)}
                style={{ width: 32, height: 20, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {presets.map(p => (
                <button key={p.color}
                  onClick={() => set('visibleEdgeColor', p.color)}
                  title={p.label}
                  style={{
                    width: 22, height: 22, borderRadius: 4,
                    background: p.color, border: outline.visibleEdgeColor === p.color ? '2px solid #fff' : '2px solid transparent',
                    cursor: 'pointer', padding: 0,
                    boxShadow: `0 0 6px ${p.color}88`,
                  }} />
              ))}
            </div>
          </div>

          <button
            onClick={() => setOutline(DEFAULT_OUTLINE)}
            style={{
              marginTop: 4, width: '100%', padding: '5px 0',
              background: `${accent}18`, border: `1px solid ${accent}44`,
              borderRadius: 5, color: accent, fontSize: 10,
              cursor: 'pointer', letterSpacing: 1.5, fontFamily: 'monospace',
            }}
          >RESET</button>

          <button
            onClick={async () => {
              try {
                const res = await fetch('/api/write-outline-defaults', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(outline),
                });
                const data = await res.json();
                if (data.success) {
                  alert('✅ 参数已写入 useStore.js DEFAULT_OUTLINE');
                } else {
                  alert('❌ 写入失败: ' + data.message);
                }
              } catch (e) {
                alert('❌ 请求失败: ' + e.message);
              }
            }}
            style={{
              marginTop: 5, width: '100%', padding: '5px 0',
              background: `${accent}30`, border: `1px solid ${accent}88`,
              borderRadius: 5, color: accent, fontSize: 10,
              cursor: 'pointer', letterSpacing: 1.5, fontFamily: 'monospace',
              fontWeight: 700,
            }}
          >✎ 确认写入代码</button>
        </div>
      )}
    </div>
  );
}
