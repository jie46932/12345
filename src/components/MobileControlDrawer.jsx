// MobileControlDrawer.jsx — 手机端底部抽屉控制栏
// 底部 Tab 栏 + 向上滑入抽屉，全触摸友好（44px+ 触摸目标）
import { useState } from 'react';
import styled from 'styled-components';
import { useLang, T } from '../LangContext';
import { MATERIALS } from '../data/products';
import GalleryModal from './GalleryModal';
import CartModal from './CartModal';

/* ── SVG 图标 ──────────────────────────────────── */
const Ico = {
  material: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" opacity="0.45" />
    </svg>
  ),
  height: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="2" x2="12" y2="22" />
      <polyline points="8 6 12 2 16 6" />
      <polyline points="8 18 12 22 16 18" />
    </svg>
  ),
  accessory: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  ),
  view: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  cart: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 01-8 0" />
    </svg>
  ),
};

const TABS = [
  { id: 'material',  zh: '材质', en: 'Style'   },
  { id: 'height',    zh: '高度', en: 'Height'  },
  { id: 'accessory', zh: '配件', en: 'Add-ons' },
  { id: 'view',      zh: '查看', en: 'View'    },
  { id: 'cart',      zh: '购物车',en: 'Cart'   },
];

/* ── 组件 ──────────────────────────────────────── */
export default function MobileControlDrawer({
  height, onHeightChange, onPlayToFrame, onStepFrame,
  material, onMaterialChange,
  showAnnotations, onToggleAnnotations,
  onAccessoryChange,
  onSoloMode, onOrbitMode, soloActive, orbitActive,
}) {
  const lang = useLang();
  const t = T[lang];

  const [activeTab,      setActiveTab]      = useState(null);
  const [activeAcc,      setActiveAcc]      = useState(new Set(['acc2', 'acc3', 'acc4']));
  const [activePreset,   setActivePreset]   = useState(94);
  const [galleryOpen,    setGalleryOpen]    = useState(false);
  const [cartOpen,       setCartOpen]       = useState(false);

  const materials = MATERIALS.map(m => ({
    ...m,
    displayName: m.id === 'light' ? t.mat_light : m.id === 'oak' ? t.mat_oak : t.mat_dark,
  }));

  const heights = [
    { cm: 68,  sub: t.mobileSit },
    { cm: 94,  sub: t.mobileStand },
    { cm: 120, sub: t.mobileHigh },
  ];

  const accessories = [
    { id: 'acc2', label: t.acc_cup },
    { id: 'acc3', label: t.acc_hook },
    { id: 'acc4', label: t.acc_lamp },
  ];

  /* 工具函数 */
  const openTab = (id) => setActiveTab(p => p === id ? null : id);

  const moveToPreset = (cm) => {
    setActivePreset(cm);
    onHeightChange?.(cm);
    onPlayToFrame?.(cm);
  };

  const toggleAcc = (id) => {
    setActiveAcc(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      onAccessoryChange?.(id, next.has(id));
      return next;
    });
  };

  const selectMat = (id) => { onMaterialChange?.(id); setActiveTab(null); };

  const drawerOpen = !!activeTab;

  return (
    <>
      <GalleryModal open={galleryOpen} onClose={() => setGalleryOpen(false)} />
      <CartModal
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        material={material}
        activeAccessory={activeAcc}
        height={height}
      />

      {drawerOpen && <Backdrop onClick={() => setActiveTab(null)} />}

      {/* ── 抽屉 ── */}
      <Drawer open={drawerOpen}>
        <Handle onClick={() => setActiveTab(null)}><Bar /></Handle>

        {/* 材质 */}
        {activeTab === 'material' && (
          <Sec>
            <SecTitle>{t.mobileSelectMat}</SecTitle>
            <MatList>
              {materials.map(m => (
                <MatRow key={m.id} $active={material === m.id} onClick={() => selectMat(m.id)}>
                  <Swatch style={{ background: m.color }} />
                  <MatText>
                    <span style={{ fontWeight: 600, fontSize: 15 }}>{m.displayName}</span>
                    <span style={{ fontSize: 12, opacity: 0.55, marginTop: 2 }}>
                      {m.price > 0 ? `+¥${m.price}` : t.mobileStandard}
                    </span>
                  </MatText>
                  {material === m.id && <ActiveDot />}
                </MatRow>
              ))}
            </MatList>
          </Sec>
        )}

        {/* 高度 */}
        {activeTab === 'height' && (
          <Sec>
            <SecTitle>{t.mobileHeightFmt.replace('{h}', height)}</SecTitle>
            <PresetGrid>
              {heights.map(h => (
                <PresetCard key={h.cm} $active={activePreset === h.cm} onClick={() => moveToPreset(h.cm)}>
                  <span style={{ fontSize: 24, fontWeight: 700, lineHeight: 1 }}>{h.cm}</span>
                  <span style={{ fontSize: 11, opacity: 0.55 }}>cm</span>
                  <span style={{ fontSize: 11, marginTop: 4, opacity: 0.7 }}>{h.sub}</span>
                </PresetCard>
              ))}
            </PresetGrid>
            <BtnRow>
              <ActionBtn
                onPointerDown={() => onStepFrame?.('up')}
                onPointerUp={() => onStepFrame?.(null)}
                onPointerLeave={() => onStepFrame?.(null)}
              >▲ {t.mobileRise}</ActionBtn>
              <ActionBtn
                onPointerDown={() => onStepFrame?.('down')}
                onPointerUp={() => onStepFrame?.(null)}
                onPointerLeave={() => onStepFrame?.(null)}
              >▼ {t.mobileLower}</ActionBtn>
            </BtnRow>
          </Sec>
        )}

        {/* 配件 */}
        {activeTab === 'accessory' && (
          <Sec>
            <SecTitle>{t.mobileSelectAcc}</SecTitle>
            <ItemList>
              {accessories.map(acc => (
                <ItemRow key={acc.id} onClick={() => toggleAcc(acc.id)}>
                  <span style={{ fontSize: 15, flex: 1 }}>{acc.label}</span>
                  <ToggleSwitch $on={activeAcc.has(acc.id)}>
                    <ToggleDot $on={activeAcc.has(acc.id)} />
                  </ToggleSwitch>
                </ItemRow>
              ))}
            </ItemList>
          </Sec>
        )}

        {/* 查看 */}
        {activeTab === 'view' && (
          <Sec>
            <SecTitle>{t.mobileSelectView}</SecTitle>
            <ItemList>
              <ItemRow onClick={onToggleAnnotations}>
                <span style={{ fontSize: 15, flex: 1 }}>{t.mobileDimensions}</span>
                <ToggleSwitch $on={showAnnotations}><ToggleDot $on={showAnnotations} /></ToggleSwitch>
              </ItemRow>
              <ItemRow onClick={() => { onSoloMode?.(); setActiveTab(null); }}>
                <span style={{ fontSize: 15, flex: 1 }}>{t.mobileSolo}</span>
                <ToggleSwitch $on={soloActive}><ToggleDot $on={soloActive} /></ToggleSwitch>
              </ItemRow>
              <ItemRow onClick={() => { onOrbitMode?.(); setActiveTab(null); }}>
                <span style={{ fontSize: 15, flex: 1 }}>{t.mobileOrbit}</span>
                <ToggleSwitch $on={orbitActive}><ToggleDot $on={orbitActive} /></ToggleSwitch>
              </ItemRow>
              <ItemRow onClick={() => { setGalleryOpen(true); setActiveTab(null); }}>
                <span style={{ fontSize: 15, flex: 1 }}>{t.mobileGallery}</span>
                <span style={{ fontSize: 20, opacity: 0.3 }}>›</span>
              </ItemRow>
            </ItemList>
          </Sec>
        )}
      </Drawer>

      {/* ── 底部 Tab 栏 ── */}
      <TabBar>
        {TABS.map(tab => {
          const isCart  = tab.id === 'cart';
          const isActive = isCart ? cartOpen : activeTab === tab.id;
          return (
            <Tab
              key={tab.id}
              $active={isActive}
              onClick={() => {
                if (isCart) { setCartOpen(v => !v); setActiveTab(null); }
                else openTab(tab.id);
              }}
            >
              <IconWrap $active={isActive}>{Ico[tab.id]}</IconWrap>
              <TabLbl $active={isActive}>{t[tab.id]}</TabLbl>
            </Tab>
          );
        })}
      </TabBar>
    </>
  );
}

/* ── Styled Components ─────────────────────────── */

const Backdrop = styled.div`
  position: fixed; inset: 0;
  z-index: 148;
  background: rgba(0,0,0,0.25);
  backdrop-filter: blur(2px);
  pointer-events: auto;
`;

const Drawer = styled.div`
  position: fixed;
  left: 0; right: 0;
  bottom: 72px;
  z-index: 149;
  max-height: 55vh;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  background: rgba(255,255,255,0.97);
  backdrop-filter: blur(28px) saturate(1.5);
  -webkit-backdrop-filter: blur(28px) saturate(1.5);
  border-radius: 24px 24px 0 0;
  border-top: 1px solid rgba(255,255,255,0.7);
  box-shadow: 0 -6px 40px rgba(0,0,0,0.13);
  transform: translateY(${p => p.open ? '0' : '110%'});
  opacity: ${p => p.open ? 1 : 0};
  transition: transform 0.32s cubic-bezier(0.23, 1, 0.32, 1),
              opacity 0.24s ease;
  pointer-events: ${p => p.open ? 'auto' : 'none'};
`;

const Handle = styled.div`
  display: flex; justify-content: center;
  padding: 12px 0 6px;
  cursor: pointer;
`;
const Bar = styled.div`
  width: 40px; height: 4px;
  border-radius: 2px;
  background: rgba(0,0,0,0.15);
`;

const Sec = styled.div`padding: 4px 20px 28px;`;

const SecTitle = styled.div`
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: rgba(0,0,0,0.38);
  margin-bottom: 16px;
`;

/* 材质 */
const MatList = styled.div`display: flex; flex-direction: column; gap: 8px;`;

const MatRow = styled.div`
  display: flex; align-items: center; gap: 14px;
  padding: 14px 16px;
  border-radius: 14px;
  border: 2px solid ${p => p.$active ? '#8B6348' : 'rgba(0,0,0,0.07)'};
  background: ${p => p.$active ? 'rgba(139,99,72,0.07)' : 'transparent'};
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: border-color .15s, background .15s;
`;

const Swatch = styled.div`
  width: 46px; height: 46px; border-radius: 50%;
  flex-shrink: 0;
  border: 2px solid rgba(0,0,0,0.08);
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.12);
`;

const MatText = styled.div`
  flex: 1;
  display: flex; flex-direction: column;
`;

const ActiveDot = styled.div`
  width: 24px; height: 24px; border-radius: 50%;
  background: #8B6348;
  flex-shrink: 0;
  &::after { content: '✓'; display: block; text-align: center; color: #fff; font-size: 13px; font-weight: 700; line-height: 24px; }
`;

/* 高度 */
const PresetGrid = styled.div`display: flex; gap: 10px; margin-bottom: 12px;`;

const PresetCard = styled.div`
  flex: 1;
  display: flex; flex-direction: column; align-items: center;
  padding: 18px 8px;
  border-radius: 16px;
  border: 2px solid ${p => p.$active ? '#8B6348' : 'rgba(0,0,0,0.08)'};
  background: ${p => p.$active ? 'rgba(139,99,72,0.09)' : 'rgba(0,0,0,0.02)'};
  color: ${p => p.$active ? '#8B6348' : '#2C1F14'};
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: all .15s;
`;

const BtnRow = styled.div`display: flex; gap: 10px;`;

const ActionBtn = styled.div`
  flex: 1; height: 52px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 14px;
  background: rgba(0,0,0,0.04);
  border: 1.5px solid rgba(0,0,0,0.08);
  font-size: 14px; font-weight: 600;
  color: #2C1F14;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  &:active { background: rgba(0,0,0,0.1); }
`;

/* 通用 Item 列表 */
const ItemList = styled.div`display: flex; flex-direction: column;`;

const ItemRow = styled.div`
  display: flex; align-items: center;
  padding: 16px 4px;
  border-bottom: 1px solid rgba(0,0,0,0.06);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  &:last-child { border-bottom: none; }
`;

/* Toggle 开关 */
const ToggleSwitch = styled.div`
  width: 48px; height: 28px; border-radius: 14px;
  background: ${p => p.$on ? '#8B6348' : 'rgba(0,0,0,0.14)'};
  position: relative; flex-shrink: 0;
  transition: background .2s;
`;
const ToggleDot = styled.div`
  position: absolute; top: 3px;
  left: ${p => p.$on ? '23px' : '3px'};
  width: 22px; height: 22px; border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0,0,0,0.22);
  transition: left .2s cubic-bezier(0.34,1.56,.64,1);
`;

/* Tab 栏 */
const TabBar = styled.div`
  position: fixed; left: 0; right: 0; bottom: 0;
  height: 72px;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  background: rgba(255,255,255,0.97);
  backdrop-filter: blur(20px) saturate(1.5);
  -webkit-backdrop-filter: blur(20px) saturate(1.5);
  border-top: 1px solid rgba(0,0,0,0.07);
  display: flex; align-items: stretch;
  z-index: 150;
  pointer-events: auto;
`;

const Tab = styled.div`
  flex: 1;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 3px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  padding: 8px 4px;
  color: ${p => p.$active ? '#8B6348' : 'rgba(0,0,0,0.38)'};
  transition: color .15s;
`;

const IconWrap = styled.div`
  width: 30px; height: 30px; border-radius: 9px;
  display: flex; align-items: center; justify-content: center;
  background: ${p => p.$active ? 'rgba(139,99,72,0.13)' : 'transparent'};
  transition: background .15s;
`;

const TabLbl = styled.span`
  font-size: 10px;
  font-weight: ${p => p.$active ? 600 : 400};
  letter-spacing: 0.02em;
  white-space: nowrap;
`;
