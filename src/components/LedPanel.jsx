/**
 * LedPanel — Rectangle007 LED 高度显示调试面板
 * 通过 zustand useStore 读写 LED 参数，触发 CanvasTexture 重绘
 * 「确认写入代码」通过 /api/write-led-defaults 持久化到 useStore.js DEFAULT_LED
 */
import { useState, useRef, useCallback } from 'react';
import useStore from '../store/useStore';

const ACCENT = '#00ffff';

const S = {
  label: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    fontSize: 11, color: '#9aa', marginBottom: 2,
  },
  slider: { width: '100%', accentColor: ACCENT, cursor: 'pointer' },
  row: { marginBottom: 10 },
  val: { color: ACCENT, fontVariantNumeric: 'tabular-nums', minWidth: 42, textAlign: 'right' },
  colorRow: {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
  },
  colorLabel: { fontSize: 11, color: '#9aa', flex: 1 },
  colorInput: { width: 36, height: 22, border: 'none', borderRadius: 4, cursor: 'pointer', padding: 0 },
};

export default function LedPanel() {
  const [open, setOpen] = useState(false);
  const [dimOpen, setDimOpen] = useState(false);
  const led = useStore((s) => s.led);
  const setLed = useStore((s) => s.setLed);
  const triggerLedRedraw = useStore((s) => s.triggerLedRedraw);
  const dimStyle = useStore((s) => s.dimStyle);
  const setDimStyle = useStore((s) => s.setDimStyle);
  const posRef = useRef({ x: 20, y: 520 });
  const [pos, setPos] = useState({ x: 20, y: 520 });

  const set = useCallback((key, val) => {
    setLed({ [key]: val });
    triggerLedRedraw();
  }, [setLed, triggerLedRedraw]);

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
      minWidth: 240, userSelect: 'none', fontFamily: 'monospace',
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
        <span>◈ LED DISPLAY</span>
        <span style={{ fontSize: 10, opacity: 0.5 }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ padding: '12px 14px' }}>

          <div style={{ fontSize: 10, color: '#555', marginBottom: 8, letterSpacing: 1, borderBottom: `1px solid ${ACCENT}22`, paddingBottom: 6 }}>
            ── LED 显示 ──
          </div>

          <div style={S.colorRow}>
            <span style={S.colorLabel}>文字颜色</span>
            <input type="color" value={led.textColor}
              onChange={e => set('textColor', e.target.value)}
              style={S.colorInput} />
            <span style={{ fontSize: 10, color: ACCENT }}>{led.textColor}</span>
          </div>

          <div style={S.colorRow}>
            <span style={S.colorLabel}>单位颜色</span>
            <input type="color" value={led.unitColor}
              onChange={e => set('unitColor', e.target.value)}
              style={S.colorInput} />
            <span style={{ fontSize: 10, color: ACCENT }}>{led.unitColor}</span>
          </div>

          <div style={S.colorRow}>
            <span style={S.colorLabel}>背景颜色</span>
            <input type="color" value={led.bgColor}
              onChange={e => set('bgColor', e.target.value)}
              style={S.colorInput} />
            <span style={{ fontSize: 10, color: ACCENT }}>{led.bgColor}</span>
          </div>

          <div style={{ ...S.row, marginBottom: 12 }}>
            <div style={{ ...S.label, marginBottom: 6 }}>
              <span>显示单位</span>
              <span style={{ fontSize: 10, color: ACCENT }}>{
                led.unit === 'inch' ? 'in' : led.unit
              }</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {['mm', 'cm', 'inch'].map(u => (
                <button
                  key={u}
                  onClick={() => set('unit', u)}
                  style={{
                    flex: 1, padding: '4px 0',
                    background: led.unit === u ? `${ACCENT}40` : `${ACCENT}10`,
                    border: `1px solid ${led.unit === u ? ACCENT : ACCENT + '44'}`,
                    borderRadius: 5, color: ACCENT,
                    fontSize: 11, cursor: 'pointer',
                    fontFamily: 'monospace', fontWeight: led.unit === u ? 700 : 400,
                    letterSpacing: 0.5,
                  }}
                >
                  {u === 'inch' ? 'in' : u}
                </button>
              ))}
            </div>
          </div>

          <div style={S.row}>
            <div style={S.label}>
              <span>字号</span>
              <span style={S.val}>{led.textSize.toFixed(2)}</span>
            </div>
            <input type="range" min={0.20} max={0.90} step={0.01}
              value={led.textSize}
              onChange={e => set('textSize', +e.target.value)}
              style={S.slider} />
          </div>

          <div style={S.row}>
            <div style={S.label}>
              <span>辉光</span>
              <span style={S.val}>{led.glowBlur}</span>
            </div>
            <input type="range" min={0} max={60} step={1}
              value={led.glowBlur}
              onChange={e => set('glowBlur', +e.target.value)}
              style={S.slider} />
          </div>

          <div style={S.row}>
            <div style={S.label}>
              <span>水平位置</span>
              <span style={S.val}>{led.textX.toFixed(2)}</span>
            </div>
            <input type="range" min={0.10} max={0.90} step={0.01}
              value={led.textX}
              onChange={e => set('textX', +e.target.value)}
              style={S.slider} />
          </div>

          <div style={S.row}>
            <div style={S.label}>
              <span>垂直位置</span>
              <span style={S.val}>{led.textY.toFixed(2)}</span>
            </div>
            <input type="range" min={0.30} max={0.98} step={0.01}
              value={led.textY}
              onChange={e => set('textY', +e.target.value)}
              style={S.slider} />
          </div>

          <div style={S.row}>
            <div style={S.label}>
              <span>单位字号</span>
              <span style={S.val}>{(led.unitSize ?? 0.24).toFixed(2)}</span>
            </div>
            <input type="range" min={0.10} max={0.60} step={0.01}
              value={led.unitSize ?? 0.24}
              onChange={e => set('unitSize', +e.target.value)}
              style={S.slider} />
          </div>

          <div style={S.row}>
            <div style={S.label}>
              <span>数字·单位间距</span>
              <span style={S.val}>{led.unitGap ?? 5}px</span>
            </div>
            <input type="range" min={0} max={40} step={1}
              value={led.unitGap ?? 5}
              onChange={e => set('unitGap', +e.target.value)}
              style={S.slider} />
          </div>

          <div style={S.row}>
            <div style={S.label}>
              <span>单位垂直偏移</span>
              <span style={S.val}>{led.unitOffsetY ?? 0}px</span>
            </div>
            <input type="range" min={-40} max={40} step={1}
              value={led.unitOffsetY ?? 0}
              onChange={e => set('unitOffsetY', +e.target.value)}
              style={S.slider} />
          </div>

          <div style={S.row}>
            <div style={S.label}>
              <span>发光强度</span>
              <span style={S.val}>{led.emissiveIntensity.toFixed(1)}</span>
            </div>
            <input type="range" min={0} max={6} step={0.1}
              value={led.emissiveIntensity}
              onChange={e => set('emissiveIntensity', +e.target.value)}
              style={S.slider} />
          </div>

          <button
            onClick={() => {
              const defaults = useStore.getState().getLedDefaults();
              setLed(defaults);
              triggerLedRedraw();
            }}
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
                const res = await fetch('/api/write-led-defaults', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(led),
                });
                const data = await res.json();
                if (data.success) {
                  alert('✅ 参数已写入 useStore.js DEFAULT_LED');
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

          {/* ── 尺寸标注样式 ── */}
          <div style={{ marginTop: 12, borderTop: `1px solid ${ACCENT}28`, paddingTop: 8 }}>
            <div
              onClick={() => setDimOpen(v => !v)}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                cursor: 'pointer', color: '#b8b', fontSize: 11, fontWeight: 700,
                letterSpacing: 1, marginBottom: dimOpen ? 8 : 0,
              }}
            >
              <span>◈ 尺寸标注</span>
              <span style={{ fontSize: 10, opacity: 0.5 }}>{dimOpen ? '▲' : '▼'}</span>
            </div>

            {dimOpen && (
              <>
                <div style={S.colorRow}>
                  <span style={S.colorLabel}>文字颜色</span>
                  <input type="color" value={dimStyle.textColor}
                    onChange={e => setDimStyle({ textColor: e.target.value })}
                    style={S.colorInput} />
                </div>

                <div style={S.colorRow}>
                  <span style={S.colorLabel}>线条颜色</span>
                  <input type="color" value={dimStyle.lineColor}
                    onChange={e => setDimStyle({ lineColor: e.target.value })}
                    style={S.colorInput} />
                </div>

                <div style={S.colorRow}>
                  <span style={S.colorLabel}>背景颜色</span>
                  <input type="color" value={dimStyle.bgColor}
                    onChange={e => setDimStyle({ bgColor: e.target.value })}
                    style={S.colorInput} />
                </div>

                <div style={S.row}>
                  <div style={S.label}>
                    <span>背景透明度</span>
                    <span style={S.val}>{dimStyle.bgAlpha.toFixed(2)}</span>
                  </div>
                  <input type="range" min={0} max={1} step={0.05}
                    value={dimStyle.bgAlpha}
                    onChange={e => setDimStyle({ bgAlpha: +e.target.value })}
                    style={S.slider} />
                </div>

                <div style={S.row}>
                  <div style={S.label}>
                    <span>字号</span>
                    <span style={S.val}>{dimStyle.fontSize}</span>
                  </div>
                  <input type="range" min={10} max={24} step={1}
                    value={dimStyle.fontSize}
                    onChange={e => setDimStyle({ fontSize: +e.target.value })}
                    style={S.slider} />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
