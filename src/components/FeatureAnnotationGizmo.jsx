/**
 * FeatureAnnotationGizmo — Dummy034-038 特性标注位置+样式调试面板
 * 通过 zustand useStore 读写坐标和样式，替代 window._featPos / _featStyle
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import useStore from '../store/useStore';

const DEFAULTS = [
  { label: 'Dummy034 · 桌面木材', color: '#a8e6a3', parentName: 'Rectangle006', pos: [-2.353, 20.243, -2.524] },
  { label: 'Dummy035 · 钢腿框架', color: '#ffd580', parentName: null,            pos: [-32.555, 9.411, 4.822] },
  { label: 'Dummy036 · 桌面边缘', color: '#80cfff', parentName: 'Rectangle006', pos: [-12.706, -1.607, -2.524] },
  { label: 'Dummy037 · 静音电机', color: '#ffb3b3', parentName: null,            pos: [5.027, 13.162, 4.092] },
  { label: 'Dummy038 · 控制器',   color: '#d4a8ff', parentName: null,            pos: [10.497, 25.249, 19.495] },
];

const DEFAULT_STYLES = [
  { line0: '', line1: '', color0: '#ffffff', color1: '#ffffff', size0: 18, size1: 18, bold0: false, bold1: false, bgColor: '#000000', bgAlpha: 0.62, bgW: 330, bgH: 125 },
  { line0: '', line1: '', color0: '#ffffff', color1: '#ffffff', size0: 18, size1: 18, bold0: false, bold1: false, bgColor: '#000000', bgAlpha: 0.62, bgW: 330, bgH: 125 },
  { line0: '', line1: '', color0: '#ffffff', color1: '#ffffff', size0: 18, size1: 18, bold0: false, bold1: false, bgColor: '#000000', bgAlpha: 0.62, bgW: 330, bgH: 125 },
  { line0: '', line1: '', color0: '#ffffff', color1: '#ffffff', size0: 18, size1: 18, bold0: false, bold1: false, bgColor: '#000000', bgAlpha: 0.62, bgW: 330, bgH: 125 },
  { line0: '', line1: '', color0: '#ffffff', color1: '#ffffff', size0: 18, size1: 18, bold0: false, bold1: false, bgColor: '#000000', bgAlpha: 0.62, bgW: 330, bgH: 125 }
];

const RANGE = { min: -60, max: 60, step: 0.001 };

export default function FeatureAnnotationGizmo() {
  const [open, setOpen] = useState(false);
  const featPositions = useStore((s) => s.featPositions);
  const featStyles = useStore((s) => s.featStyles);
  const setFeatPosition = useStore((s) => s.setFeatPosition);
  const setFeatStyles = useStore((s) => s.setFeatStyles);

  // 本地 state，初始化时从 store 读取（null 时回退到 DEFAULTS）
  const [poses, setPoses] = useState(() =>
    featPositions.map((p, i) => p ? [...p] : [...DEFAULTS[i].pos])
  );
  const [styles, setStyles] = useState(() => featStyles.length ? featStyles.map(s => ({ ...s })) : DEFAULT_STYLES.map(s => ({ ...s })));
  const [saveMsg, setSaveMsg] = useState('');
  const posesRef = useRef(poses);
  posesRef.current = poses;
  const panelRef = useRef(null);
  const dragState = useRef({ dragging: false, startX: 0, startY: 0, origLeft: 0, origTop: 0 });

  // Store 初始化：不再自动写入默认文字，让 Pin 组件使用语言感知的 lines/linesEn
  // featStyles 仅存储用户通过 Gizmo 明确自定义的文字（非空字符串时优先显示）

  // 同步坐标到 store
  const updatePos = (idx, axis, val) => {
    const newPos = [...posesRef.current[idx]];
    newPos[axis] = val;
    setPoses(prev => {
      const next = prev.map(p => [...p]);
      next[idx] = newPos;
      return next;
    });
    setFeatPosition(idx, newPos);
  };

  // 同步样式到 store
  const updateStyle = (idx, key, val) => {
    setStyles(prev => {
      const next = prev.map(s => ({ ...s }));
      next[idx][key] = val;
      return next;
    });
  };

  // 批量同步样式到 store (通过 setFeatStyles)
  useEffect(() => {
    setFeatStyles(styles.map(s => ({ ...s })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styles]);

  // 单次同步坐标到 store (useEffect 兜底)
  useEffect(() => {
    poses.forEach((p, i) => {
      storeFeatPos(i, p);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function storeFeatPos(idx, pos) {
    const store = useStore.getState();
    const cur = store.featPositions[idx];
    if (!cur || cur[0] !== pos[0] || cur[1] !== pos[1] || cur[2] !== pos[2]) {
      store.setFeatPosition(idx, pos);
    }
  }

  const resetOne = (idx) => {
    const defPos = [...DEFAULTS[idx].pos];
    const defSty = { ...DEFAULT_STYLES[idx] };
    setPoses(prev => {
      const next = prev.map(p => [...p]);
      next[idx] = defPos;
      return next;
    });
    setStyles(prev => {
      const next = prev.map(s => ({ ...s }));
      next[idx] = defSty;
      return next;
    });
    setFeatPosition(idx, defPos);
  };

  const resetAll = () => {
    const defPos = DEFAULTS.map(d => [...d.pos]);
    const defSty = DEFAULT_STYLES.map(s => ({ ...s }));
    setPoses(defPos);
    setStyles(defSty);
    setFeatStyles(defSty);
  };

  const saveToCode = () => {
    setSaveMsg('写入中…');
    fetch('/api/write-feature-pos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ poses, styles }),
    })
      .then(r => r.json())
      .then(d => {
        setSaveMsg(d.success ? '✅ 已写入源码' : '❌ 写入失败');
        setTimeout(() => setSaveMsg(''), 2500);
      })
      .catch(() => { setSaveMsg('❌ 请求失败'); setTimeout(() => setSaveMsg(''), 2500); });
  };

  const onPointerDown = useCallback((e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    if (!panel.dataset.positioned) {
      panel.style.right = 'auto';
      panel.style.left = rect.left + 'px';
      panel.style.top = rect.top + 'px';
      panel.dataset.positioned = '1';
    }
    dragState.current = {
      dragging: true,
      startX: e.clientX, startY: e.clientY,
      origLeft: parseFloat(panel.style.left),
      origTop: parseFloat(panel.style.top),
    };
    panel.setPointerCapture(e.pointerId);
    e.preventDefault();
  }, []);

  const onPointerMove = useCallback((e) => {
    const ds = dragState.current;
    if (!ds.dragging) return;
    const panel = panelRef.current;
    if (panel) {
      panel.style.left = (ds.origLeft + e.clientX - ds.startX) + 'px';
      panel.style.top = (ds.origTop + e.clientY - ds.startY) + 'px';
    }
  }, []);

  const onPointerUp = useCallback(() => { dragState.current.dragging = false; }, []);

  const S = {
    trigger: {
      position: 'fixed', bottom: '80px', right: '20px', zIndex: 200,
      background: 'rgba(14,18,28,0.82)', border: '1px solid rgba(180,150,80,0.4)',
      borderRadius: '9px', padding: '5px 12px', color: 'rgba(220,190,110,0.9)',
      font: '700 11px/1.5 monospace', cursor: 'pointer', letterSpacing: '.04em',
      backdropFilter: 'blur(10px)', pointerEvents: 'auto',
    },
    panel: {
      position: 'fixed', left: '20px', top: '80px', zIndex: 200,
      background: 'rgba(20,20,30,0.82)', backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px',
      padding: '14px 16px', color: '#e8eaf0', font: '13px/1.6 monospace',
      width: '280px', userSelect: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      pointerEvents: 'auto', cursor: 'grab',
      maxHeight: 'calc(100vh - 100px)', overflowY: 'auto',
    },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' },
    title: { fontWeight: 700, fontSize: '14px', letterSpacing: '.5px' },
    section: { marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' },
    sectionLast: { marginBottom: '8px' },
    sectionTitle: { fontSize: '11px', marginBottom: '6px' },
    row: { display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' },
    axisLabel: { fontSize: '11px', width: '12px', flexShrink: 0, color: 'rgba(180,150,80,0.8)', fontWeight: 700 },
    range: { flex: 1, accentColor: 'rgba(180,150,80,0.85)' },
    number: {
      width: '58px', flexShrink: 0,
      background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: '4px', color: '#e8eaf0', font: '11px monospace',
      padding: '2px 5px', outline: 'none', textAlign: 'right',
    },
    subLabel: { fontSize: '10px', color: 'rgba(180,150,80,0.7)', marginTop: '5px', marginBottom: '2px' },
    textInput: {
      width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)',
      borderRadius: '5px', color: '#e8eaf0', font: '12px monospace', padding: '3px 6px', outline: 'none',
      boxSizing: 'border-box',
    },
    colorRow: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' },
    colorInput: { width: '36px', height: '22px', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: 0 },
    colorVal: { fontSize: '10px', color: '#aaa' },
    sizeRow: { display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' },
    sizeRange: { flex: 1, accentColor: 'rgba(140,180,255,0.85)' },
    sizeVal: { fontSize: '10px', color: '#aaa', width: '28px' },
    boldLabel: {
      display: 'flex', alignItems: 'center', gap: '2px', marginLeft: '4px',
      fontSize: '11px', fontWeight: 700, color: 'rgba(180,150,80,0.8)', cursor: 'pointer',
    },
    parentTag: { fontSize: '10px', color: 'rgba(140,180,255,0.6)', marginBottom: '4px' },
    resetOne: {
      fontSize: '10px', color: 'rgba(180,150,80,0.7)', background: 'none',
      border: '1px solid rgba(180,150,80,0.2)', borderRadius: '4px',
      padding: '2px 7px', cursor: 'pointer', marginTop: '4px',
    },
    divider: { height: '1px', background: 'rgba(255,255,255,0.06)', margin: '5px 0' },
    footer: { textAlign: 'center', marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px' },
    saveBtn: {
      width: '100%', padding: '6px 0', cursor: 'pointer', borderRadius: '7px',
      background: 'linear-gradient(135deg,rgba(80,200,120,0.35),rgba(40,160,90,0.25))',
      color: '#7fe8a2', font: '700 12px monospace', letterSpacing: '.5px',
      border: '1px solid rgba(100,220,140,0.35)',
    },
    resetAllBtn: {
      width: '100%', padding: '5px 0', cursor: 'pointer', borderRadius: '7px',
      background: 'none', color: 'rgba(180,150,80,0.7)', font: '11px monospace',
      border: '1px solid rgba(180,150,80,0.25)', marginTop: '6px',
    },
    saveMsg: { fontSize: '11px', marginTop: '5px', minHeight: '16px', color: '#7fe8a2' },
  };

  return (
    <>
      <button style={S.trigger} onClick={() => setOpen(o => !o)}>
        📍 标注调试
      </button>

      {open && (
        <div
          ref={panelRef}
          style={S.panel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <div style={S.header}>
            <span style={S.title}>📍 Dummy034-038 标注</span>
          </div>

          {DEFAULTS.map((def, idx) => (
            <div key={idx} style={idx < DEFAULTS.length - 1 ? S.section : S.sectionLast}>
              <div style={{ ...S.sectionTitle, color: def.color }}>▶ {def.label}</div>
              {def.parentName && <div style={S.parentTag}>父节点: {def.parentName}</div>}

              {['X', 'Y', 'Z'].map((axis, ai) => (
                <div style={S.row} key={axis}>
                  <span style={S.axisLabel}>{axis}</span>
                  <input type="range" min={RANGE.min} max={RANGE.max} step={RANGE.step}
                    value={poses[idx][ai]} style={S.range}
                    onChange={e => updatePos(idx, ai, parseFloat(e.target.value))} />
                  <input type="number" step={RANGE.step}
                    value={poses[idx][ai].toFixed(3)} style={S.number}
                    onChange={e => updatePos(idx, ai, parseFloat(e.target.value) || 0)} />
                </div>
              ))}

              <div style={S.divider} />

              <div style={S.subLabel}>第一行文字</div>
              <input type="text" value={styles[idx].line0} style={S.textInput}
                onChange={e => updateStyle(idx, 'line0', e.target.value)} />
              <div style={S.colorRow}>
                <span style={{ fontSize: '10px', color: '#aaa' }}>颜色</span>
                <input type="color" value={styles[idx].color0} style={S.colorInput}
                  onChange={e => updateStyle(idx, 'color0', e.target.value)} />
                <span style={S.colorVal}>{styles[idx].color0}</span>
                <span style={{ fontSize: '10px', color: '#aaa', marginLeft: '6px' }}>字号</span>
                <input type="range" min={12} max={36} step={1}
                  value={styles[idx].size0} style={{ ...S.sizeRange, width: '55px' }}
                  onChange={e => updateStyle(idx, 'size0', parseInt(e.target.value))} />
                <span style={S.sizeVal}>{styles[idx].size0}px</span>
                <label style={S.boldLabel}>
                  <input type="checkbox" checked={styles[idx].bold0}
                    onChange={e => updateStyle(idx, 'bold0', e.target.checked)} />
                  <span>B</span>
                </label>
              </div>

              <div style={S.subLabel}>第二行文字</div>
              <input type="text" value={styles[idx].line1} style={S.textInput}
                onChange={e => updateStyle(idx, 'line1', e.target.value)} />
              <div style={S.colorRow}>
                <span style={{ fontSize: '10px', color: '#aaa' }}>颜色</span>
                <input type="color" value={styles[idx].color1} style={S.colorInput}
                  onChange={e => updateStyle(idx, 'color1', e.target.value)} />
                <span style={S.colorVal}>{styles[idx].color1}</span>
                <span style={{ fontSize: '10px', color: '#aaa', marginLeft: '6px' }}>字号</span>
                <input type="range" min={10} max={28} step={1}
                  value={styles[idx].size1} style={{ ...S.sizeRange, width: '55px' }}
                  onChange={e => updateStyle(idx, 'size1', parseInt(e.target.value))} />
                <span style={S.sizeVal}>{styles[idx].size1}px</span>
                <label style={S.boldLabel}>
                  <input type="checkbox" checked={styles[idx].bold1}
                    onChange={e => updateStyle(idx, 'bold1', e.target.checked)} />
                  <span>B</span>
                </label>
              </div>

              <div style={S.divider} />

              <div style={S.subLabel}>气泡背景</div>
              <div style={S.colorRow}>
                <span style={{ fontSize: '10px', color: '#aaa' }}>颜色</span>
                <input type="color" value={styles[idx].bgColor} style={S.colorInput}
                  onChange={e => updateStyle(idx, 'bgColor', e.target.value)} />
                <span style={S.colorVal}>{styles[idx].bgColor}</span>
                <span style={{ fontSize: '10px', color: '#aaa', marginLeft: '6px' }}>透明</span>
                <input type="range" min={0} max={1} step={0.01}
                  value={styles[idx].bgAlpha} style={{ ...S.sizeRange, width: '55px' }}
                  onChange={e => updateStyle(idx, 'bgAlpha', parseFloat(e.target.value))} />
                <span style={{ ...S.sizeVal, width: '32px' }}>{styles[idx].bgAlpha.toFixed(2)}</span>
              </div>
              <div style={S.colorRow}>
                <span style={{ fontSize: '10px', color: '#aaa' }}>宽度</span>
                <input type="range" min={80} max={600} step={1}
                  value={styles[idx].bgW} style={{ ...S.sizeRange, width: '70px' }}
                  onChange={e => updateStyle(idx, 'bgW', parseInt(e.target.value))} />
                <span style={{ ...S.sizeVal, width: '32px' }}>{styles[idx].bgW}px</span>
              </div>
              <div style={S.colorRow}>
                <span style={{ fontSize: '10px', color: '#aaa' }}>高度</span>
                <input type="range" min={40} max={400} step={1}
                  value={styles[idx].bgH} style={{ ...S.sizeRange, width: '70px' }}
                  onChange={e => updateStyle(idx, 'bgH', parseInt(e.target.value))} />
                <span style={{ ...S.sizeVal, width: '32px' }}>{styles[idx].bgH}px</span>
              </div>

              <button style={S.resetOne} onClick={() => resetOne(idx)}>↩ 重置此条</button>
            </div>
          ))}

          <div style={S.footer}>
            <button style={S.saveBtn} onClick={saveToCode}>✅ 确认写入代码</button>
            <button style={S.resetAllBtn} onClick={resetAll}>⏮ 重置全部</button>
            <div style={S.saveMsg}>{saveMsg}</div>
          </div>
        </div>
      )}
    </>
  );
}
