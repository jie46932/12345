/**
 * HeaderPanel — 左上角品牌/副标题文字动画控制面板
 * 调整 subBrand 中英文、动画延迟 等参数，支持写入源码
 */
import { useState, useRef, useCallback } from 'react';
import { T } from '../LangContext';

const S = {
  trigger: { position:'fixed', bottom:'136px', right:'20px', zIndex:200,
    background:'rgba(14,18,28,0.82)', border:'1px solid rgba(180,150,80,0.4)',
    borderRadius:'9px', padding:'5px 12px', color:'rgba(220,190,110,0.9)',
    font:'700 11px/1.5 monospace', cursor:'pointer', backdropFilter:'blur(10px)', pointerEvents:'auto' },
  panel: { position:'fixed', left:'20px', bottom:'40px', zIndex:200,
    background:'rgba(20,20,30,0.85)', backdropFilter:'blur(10px)',
    border:'1px solid rgba(255,255,255,0.15)', borderRadius:'12px',
    padding:'14px 16px', color:'#e8eaf0', font:'13px/1.6 monospace',
    width:'300px', maxHeight:'calc(100vh - 120px)', overflowY:'auto',
    boxShadow:'0 4px 20px rgba(0,0,0,0.5)', pointerEvents:'auto' },
  header: { display:'flex', justifyContent:'space-between', marginBottom:'10px' },
  title: { fontWeight:700, fontSize:'14px', letterSpacing:'.5px' },
  row: { marginBottom:'8px' },
  label: { fontSize:'11px', color:'rgba(180,150,80,0.8)', marginBottom:'2px', display:'block' },
  input: { width:'100%', boxSizing:'border-box', background:'rgba(255,255,255,0.08)',
    border:'1px solid rgba(255,255,255,0.2)', borderRadius:'5px', color:'#e8eaf0',
    font:'12px monospace', padding:'4px 8px', outline:'none' },
  footer: { textAlign:'center', marginTop:'10px', borderTop:'1px solid rgba(255,255,255,0.08)', paddingTop:'10px' },
  saveBtn: { width:'100%', padding:'6px 0', cursor:'pointer', borderRadius:'7px',
    background:'linear-gradient(135deg,rgba(80,200,120,0.35),rgba(40,160,90,0.25))',
    color:'#7fe8a2', font:'700 12px monospace', letterSpacing:'.5px',
    border:'1px solid rgba(100,220,140,0.35)' },
  saveMsg: { fontSize:'11px', marginTop:'5px', minHeight:'16px', color:'#7fe8a2' },
};

function letterKey(ch, i) { return `${i}-${ch}`; }

export default function HeaderPanel() {
  const [open, setOpen] = useState(false);
  const [subBrandZh, setSubBrandZh] = useState(T.zh.subBrand);
  const [subBrandEn, setSubBrandEn] = useState(T.en.subBrand);
  const [brandText, setBrandText] = useState('HE FURNITURE');
  const [delay, setDelay] = useState(100);
  const [saveMsg, setSaveMsg] = useState('');
  const [activeTab, setActiveTab] = useState('general');
  const panelRef = useRef(null);
  const dragState = useRef({ dragging:false, startX:0, startY:0, origLeft:0, origTop:0 });

  // 逐字母延迟偏移 (ms)，从 window 读取或初始化为 0
  const enChars = (T.en.subBrand || '').split('');
  const [letterOffsets, setLetterOffsets] = useState(() => {
    const saved = window.__letterOffsets;
    if (saved && saved.length === enChars.length) return [...saved];
    return enChars.map(() => 0);
  });

  // 修改单个字母偏移时同步到 window
  const setOffset = (i, val) => {
    setLetterOffsets(prev => {
      const next = [...prev];
      next[i] = val;
      window.__letterOffsets = next;
      return next;
    });
  };

  // subBrandEn 改变时重置偏移数组
  const updateSubBrandEn = (val) => {
    setSubBrandEn(val);
    const chars = val.split('');
    const offsets = chars.map((_, i) => (letterOffsets[i] || 0));
    setLetterOffsets(offsets);
    window.__letterOffsets = offsets;
  };

  const onPointerDown = useCallback((e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
    const panel = panelRef.current;
    if (!panel) return;
    if (!panel.dataset.positioned) {
      panel.style.right = 'auto'; panel.style.bottom = 'auto';
      panel.style.left = panel.getBoundingClientRect().left + 'px';
      panel.style.top = panel.getBoundingClientRect().top + 'px';
      panel.dataset.positioned = '1';
    }
    dragState.current = { dragging:true, startX:e.clientX, startY:e.clientY,
      origLeft:parseFloat(panel.style.left), origTop:parseFloat(panel.style.top) };
    panel.setPointerCapture(e.pointerId);
    e.preventDefault();
  }, []);
  const onPointerMove = useCallback((e) => {
    const ds = dragState.current;
    if (!ds.dragging) return;
    const p = panelRef.current;
    if (p) { p.style.left = (ds.origLeft + e.clientX - ds.startX) + 'px';
      p.style.top = (ds.origTop + e.clientY - ds.startY) + 'px'; }
  }, []);
  const onPointerUp = useCallback(() => { dragState.current.dragging = false; }, []);

  const saveToCode = async () => {
    setSaveMsg('写入中…');
    try {
      const r = await fetch('/api/write-header-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subBrandZh, subBrandEn, brandText, delay }),
      }).then(r => r.json());
      setSaveMsg(r.success ? '✅ 已写入' : '❌ 失败');
    } catch { setSaveMsg('❌ 请求失败'); }
    setTimeout(() => setSaveMsg(''), 2500);
  };

  const tabBtn = (key, label) => ({
    flex:1, padding:'4px 0', cursor:'pointer', textAlign:'center',
    borderRadius:'5px', border:'1px solid rgba(255,255,255,0.15)',
    background: activeTab===key ? 'rgba(180,150,80,0.3)' : 'transparent',
    color: activeTab===key ? '#ffd580' : '#888',
    font:'11px monospace', fontWeight: activeTab===key ? 700 : 400,
  });

  return (
    <>
      <button style={S.trigger} onClick={() => setOpen(o => !o)}>🔤 标题</button>
      {open && (
        <div ref={panelRef} style={S.panel}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
          <div style={S.header}><span style={S.title}>🔤 标题动画</span></div>

          {/* 页签切换 */}
          <div style={{ display:'flex', gap:6, marginBottom:12 }}>
            <button style={tabBtn('general', '通用')} onClick={() => setActiveTab('general')}>⚙ 通用</button>
            <button style={tabBtn('letters', '逐字母')} onClick={() => setActiveTab('letters')}>🔡 逐字母</button>
          </div>

          {activeTab === 'general' && (<>
            <div style={S.row}>
              <label style={S.label}>品牌名 BRAND</label>
              <input style={S.input} value={brandText} onChange={e => setBrandText(e.target.value)} />
            </div>
            <div style={S.row}>
              <label style={S.label}>subBrand 中文</label>
              <input style={S.input} value={subBrandZh} onChange={e => setSubBrandZh(e.target.value)} />
            </div>
            <div style={S.row}>
              <label style={S.label}>subBrand 英文</label>
              <input style={S.input} value={subBrandEn} onChange={e => updateSubBrandEn(e.target.value)} />
            </div>
            <div style={S.row}>
              <label style={S.label}>字母延迟 {delay}ms</label>
              <input type="range" min={30} max={250} step={5} value={delay}
                style={{ width:'100%', accentColor:'rgba(180,150,80,0.85)' }}
                onChange={e => setDelay(parseInt(e.target.value))} />
            </div>
          </>)}

          {activeTab === 'letters' && (<>
            <div style={{ ...S.label, marginBottom:6 }}>
              subBrand 英文逐字母延迟偏移 (ms)
            </div>
            {enChars.map((ch, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                <span style={{
                  display:'inline-block', width:20, textAlign:'center',
                  fontWeight:700, color: ch===' '?'rgba(255,100,100,0.4)':'#ffd580',
                  font:'13px monospace',
                }}>{ch === ' ' ? '␣' : ch}</span>
                <input type="range" min={-300} max={300} step={5}
                  value={letterOffsets[i] || 0}
                  style={{ flex:1, accentColor:'rgba(180,150,80,0.85)' }}
                  onChange={e => setOffset(i, parseInt(e.target.value))} />
                <span style={{
                  width:38, textAlign:'right', fontSize:'10px',
                  color: (letterOffsets[i]||0)===0?'#666':'#7fe8a2',
                  font:'11px monospace',
                }}>{(letterOffsets[i]||0) > 0 ? '+' : ''}{letterOffsets[i]||0}</span>
              </div>
            ))}
            <div style={{ fontSize:'10px', color:'#666', marginTop:4 }}>
              实际延迟 = 基础延迟 + 偏移。空格␣调整两词衔接。
            </div>
          </>)}

          <div style={S.footer}>
            <button style={S.saveBtn} onClick={saveToCode}>✅ 确认写入代码</button>
            <div style={S.saveMsg}>{saveMsg}</div>
          </div>
        </div>
      )}
    </>
  );
}
